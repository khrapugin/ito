"""ITO v0.5: transactional SQLite storage for the shared browser calculation engine.
Legacy relational tables remain intact. The active state has a revision number.
"""
import csv
import datetime as dt
import io
import json
import math
import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from openpyxl import load_workbook

ROOT = Path(__file__).resolve().parent
DB = Path(os.environ.get('ITO_DB_PATH', ROOT / 'ito.sqlite3'))
TABLES = ['people', 'projects', 'operations', 'tasks', 'assignments', 'actuals', 'absences', 'skills', 'assessments', 'imports', 'snapshots', 'events']
app = FastAPI(title='ITO • Эффективность отдела', version='0.6.0')
app.mount('/static', StaticFiles(directory=ROOT / 'static'), name='static')
from wellbeing import make_router
app.include_router(make_router(ROOT, DB.with_name(DB.stem + '_wellbeing.sqlite3')))

@contextmanager
def connect():
    c = sqlite3.connect(DB, timeout=10)
    c.row_factory = sqlite3.Row
    try:
        with c:
            yield c
    finally:
        c.close()

def normalize(raw):
    state = raw.get('data', raw)
    if not isinstance(state, dict):
        raise ValueError('Ожидается объект данных')
    state = json.loads(json.dumps(state, ensure_ascii=False))
    for table in TABLES:
        state.setdefault(table, [])
    for table in ['assignments', 'actuals', 'absences']:
        for i, row in enumerate(state[table]):
            row.setdefault('id', f'legacy-{table}-{i}')
    for row in state['actuals']:
        row.setdefault('kind', 'work')
    state['schema_version'] = 5
    return state

def valid_date(value):
    try:
        return isinstance(value, str) and dt.date.fromisoformat(value).isoformat() == value
    except (ValueError, TypeError):
        return False

def validate(state):
    if any(not isinstance(state.get(t), list) for t in TABLES):
        raise ValueError('Некорректный состав таблиц')
    refs = {'tasks': {'project_id': 'projects', 'operation_id': 'operations'}, 'assignments': {'task_id': 'tasks', 'person_id': 'people'}, 'actuals': {'task_id': 'tasks', 'person_id': 'people'}, 'absences': {'person_id': 'people'}}
    for table in TABLES:
        if any(not isinstance(r, dict) for r in state[table]):
            raise ValueError(f'Некорректная запись: {table}')
    for table in ['people', 'projects', 'operations', 'tasks', 'assignments', 'actuals', 'absences']:
        ids = set()
        for row in state[table]:
            identity = str(row.get('id', '')).strip()
            if not identity or identity in ids:
                raise ValueError(f'Пустой или повторный ID: {table}')
            ids.add(identity)
            required_numbers = {'people':['weekly'], 'operations':['norm'], 'tasks':['qty','planned'], 'assignments':['hours'], 'actuals':['hours'], 'absences':['hours']}.get(table, [])
            for field in required_numbers:
                if row.get(field) in [None, ''] or not math.isfinite(float(row[field])):
                    raise ValueError(f'Укажите числовое значение: {field}')
            for field, target in refs.get(table, {}).items():
                if str(row.get(field)) not in {str(r['id']) for r in state[target]}:
                    raise ValueError(f'Не найдено соответствие: {field} = {row.get(field)}')
            for field in ['hours', 'weekly', 'norm', 'qty', 'planned', 'rework', 'remarks']:
                if row.get(field) is not None:
                    n = float(row[field])
                    if not math.isfinite(n) or n < 0:
                        raise ValueError(f'Некорректное число: {field}')
            if table in ['people', 'projects', 'operations'] and not str(row.get('name', '')).strip():
                raise ValueError('Укажите название / имя')
            if table == 'people' and row.get('active') not in [0, 1]:
                raise ValueError('Укажите участие в расчёте')
            if table == 'tasks' and (not str(row.get('title', '')).strip() or (row.get('due') and not valid_date(row['due']))):
                raise ValueError('Укажите название и корректный срок задачи')
            if table in ['assignments', 'absences'] and (not valid_date(row.get('week')) or dt.date.fromisoformat(row['week']).weekday() != 0):
                raise ValueError('Неделя должна начинаться в понедельник')
            if table == 'actuals':
                if not valid_date(row.get('day')) or float(row.get('hours', 0)) <= 0 or row.get('kind') not in ['work', 'rework', 'loss']:
                    raise ValueError('Укажите дату, тип и положительное время')
                if row.get('kind') == 'loss' and not str(row.get('reason', '')).strip():
                    raise ValueError('Укажите причину потери времени')
                if row['day'] > (dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=3)).date().isoformat():
                    raise ValueError('Фактическая работа не может быть в будущем')
            if table in ['assignments', 'absences'] and float(row['hours']) <= 0:
                raise ValueError('Укажите положительное количество часов')
    external = [str(r['external_id']) for r in state['actuals'] if r.get('external_id')]
    if len(external) != len(set(external)):
        raise ValueError('Повторный внешний ID факта')
    weeks = set()
    for snap in state['snapshots']:
        if not valid_date(snap.get('week')) or dt.date.fromisoformat(snap['week']).weekday() != 0 or snap['week'] in weeks:
            raise ValueError('Некорректная неделя снимка')
        weeks.add(snap['week'])
        if not isinstance(snap.get('entries'), list) or not isinstance(snap.get('people'), list):
            raise ValueError('Некорректный снимок плана')
        for entry in snap['entries']:
            if str(entry.get('task_id')) not in {str(t['id']) for t in state['tasks']} or not math.isfinite(float(entry.get('hours', -1))) or float(entry['hours']) < 0:
                raise ValueError('Некорректная строка снимка')
    for event in state['events']:
        if not valid_date(event.get('day')) or event.get('action') not in ['accept', 'reopen'] or str(event.get('task_id')) not in {str(t['id']) for t in state['tasks']}:
            raise ValueError('Некорректная история приёмки')
        if event['action'] == 'accept':
            for field in ['planned_hours', 'actual_hours', 'rework_hours', 'remarks']:
                if not math.isfinite(float(event.get(field, -1))) or float(event[field]) < 0:
                    raise ValueError('Некорректные часы приёмки')
            if not event.get('result') or not event.get('accepted_by'):
                raise ValueError('Нужен подтверждённый результат')
    for assessment in state['assessments']:
        for field in ['competence', 'autonomy', 'energy', 'motivation', 'conditions']:
            value = assessment.get(field)
            if value is not None and (type(value) is not int or not 1 <= value <= 10):
                raise ValueError('Оценка: 1–10 либо пусто')
    return state

def initialize():
    with connect() as c:
        c.execute('CREATE TABLE IF NOT EXISTS app_state (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL, payload TEXT NOT NULL)')
        if c.execute('SELECT 1 FROM app_state WHERE id=1').fetchone():
            return
        existing = {r[0] for r in c.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        if 'people' in existing and c.execute('SELECT count(*) FROM people').fetchone()[0]:
            raw = {t: [dict(r) for r in c.execute(f'SELECT * FROM {t}')] if t in existing else [] for t in TABLES}

        else:
            raw = json.loads((ROOT / 'static' / 'seed.json').read_text(encoding='utf-8'))
        state = validate(normalize(raw))
        c.execute('INSERT INTO app_state VALUES(1, 1, ?)', (json.dumps(state, ensure_ascii=False),))

initialize()

class StateRequest(BaseModel):
    data: dict
    revision: int

def read_state(c):
    row = c.execute('SELECT * FROM app_state WHERE id=1').fetchone()
    return {'revision': row['revision'], 'data': json.loads(row['payload'])}

@app.get('/')
def index():
    return FileResponse(ROOT / 'index.html')

@app.get('/api/state')
def state():
    with connect() as c:
        return read_state(c)

def save_state(request, restore=False):
    try:
        incoming = validate(normalize(request.data))
    except (ValueError, TypeError, KeyError, AttributeError) as exc:
        raise HTTPException(400, str(exc))
    with connect() as c:
        c.execute('BEGIN IMMEDIATE')
        current = read_state(c)
        if request.revision != current['revision']:
            raise HTTPException(409, 'Данные изменились в другом окне. Обновите страницу и повторите действие.')
        if not restore:
            for key in ['snapshots', 'events']:
                old = current['data'][key]
                if incoming[key][:len(old)] != old:
                    raise HTTPException(400, 'История плана и приёмки неизменяема. Используйте возврат в работу.')
        else:
            backup_dir = DB.parent / 'backups'
            backup_dir.mkdir(exist_ok=True)
            path = backup_dir / (dt.datetime.now().strftime('%Y%m%d_%H%M%S_%f') + '.json')
            path.write_text(json.dumps({'version': 5, 'data': current['data']}, ensure_ascii=False, indent=2), encoding='utf-8')
        revision = current['revision'] + 1
        c.execute('UPDATE app_state SET revision=?,payload=? WHERE id=1', (revision, json.dumps(incoming, ensure_ascii=False)))
    return {'revision': revision, 'data': incoming}

@app.put('/api/state')
def update_state(request: StateRequest):
    return save_state(request)

@app.post('/api/restore')
def restore(request: StateRequest):
    return save_state(request, restore=True)

@app.get('/api/backup.json')
def backup():
    return {'version': 5, 'data': state()['data']}

@app.post('/api/import/preview')
async def preview(kind: str, file: UploadFile = File(...)):
    contracts = {'actuals': ['external_id', 'task_id', 'person_id', 'day', 'hours'], 'operations': ['id', 'category', 'name', 'unit', 'norm'], 'tasks': ['id', 'project_id', 'operation_id', 'title', 'qty']}
    if kind not in contracts:
        raise HTTPException(400, 'Неизвестный вид импорта')
    raw = await file.read(10_000_001)
    if len(raw) > 10_000_000:
        raise HTTPException(400, 'Максимум 10 МБ')
    try:
        name = Path(file.filename or '').name
        if name.lower().endswith('.csv'):
            text = raw.decode('utf-8-sig')
            first = text.splitlines()[0] if text.splitlines() else ''
            items = list(csv.DictReader(io.StringIO(text), delimiter=';' if first.count(';') >= first.count(',') else ','))
        elif name.lower().endswith('.xlsx'):
            import zipfile
            with zipfile.ZipFile(io.BytesIO(raw)) as z:
                if sum(i.file_size for i in z.infolist()) > 50_000_000:
                    raise ValueError('Распакованный файл слишком большой')
            wb = load_workbook(io.BytesIO(raw), read_only=True, data_only=True)
            try:
                it = iter(wb.active.values)
                heads = [str(v or '').strip() for v in next(it)]
                items = [dict(zip(heads, row)) for row in it if any(v is not None for v in row)]
            finally:
                wb.close()
        else:
            raise ValueError('Поддерживаются CSV UTF-8 и XLSX')
        if not items or not all(k in items[0] for k in contracts[kind]):
            raise ValueError('Нужны колонки: ' + ', '.join(contracts[kind]))
        if len(items) > 10000:
            raise ValueError('Максимум 10 000 строк')
        for row in items:
            for key, value in row.items():
                if isinstance(value, (dt.date, dt.datetime)):
                    row[key] = value.isoformat()[:10]
        return {'filename': name, 'items': items}
    except Exception as exc:
        raise HTTPException(400, f'Не удалось прочитать файл: {exc}')

@app.get('/potential')
def potential():
    return RedirectResponse('/#potential')

@app.get('/methodology')
def methodology():
    return RedirectResponse('/#method')

@app.get('/presentation')
def presentation():
    return RedirectResponse('/')
