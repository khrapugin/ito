"""Opt-in weekly aggregates, isolated from staff, tasks and their backups.

No individual score rows are stored. Weekly random browser tokens are HMAC'd
solely for deduplication and a minimum cohort; they do not identify employees.
This is a local pilot, not an authenticated multi-user service.
"""
import datetime as dt
import hashlib
import hmac
import json
import secrets
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import FileResponse
from pydantic import BaseModel, ConfigDict, Field

MIN_BROWSERS = 5
RETENTION_WEEKS = 12
METRICS = ('wellbeing', 'energy', 'calm', 'context')


def today():
    return (dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=3)).date()


def monday(day):
    return day - dt.timedelta(days=day.weekday())


class Checkin(BaseModel):
    model_config = ConfigDict(extra='forbid')
    day: str
    slot: Literal['morning', 'evening']
    token: str = Field(pattern=r'^[a-f0-9]{64}$')
    consent: bool = Field(strict=True)
    wellbeing: int = Field(strict=True, ge=1, le=5)
    energy: int = Field(strict=True, ge=1, le=5)
    calm: int = Field(strict=True, ge=1, le=5)
    context: int = Field(strict=True, ge=1, le=5)


class WellbeingStore:
    def __init__(self, path):
        self.path = Path(path)
        with self.connect() as c:
            c.executescript('''
                CREATE TABLE IF NOT EXISTS salts (week TEXT PRIMARY KEY, secret TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS receipts (
                    week TEXT, day TEXT, slot TEXT, digest TEXT,
                    PRIMARY KEY (week, day, slot, digest));
                CREATE TABLE IF NOT EXISTS participants (
                    week TEXT, slot TEXT, digest TEXT,
                    PRIMARY KEY (week, slot, digest));
                CREATE TABLE IF NOT EXISTS buckets (
                    week TEXT, slot TEXT, n INTEGER NOT NULL, sums TEXT NOT NULL,
                    PRIMARY KEY (week, slot));
                CREATE TABLE IF NOT EXISTS published (week TEXT PRIMARY KEY, payload TEXT NOT NULL);
            ''')
            self.maintain(c)

    @contextmanager
    def connect(self):
        c = sqlite3.connect(self.path, timeout=10)
        c.row_factory = sqlite3.Row
        c.execute('PRAGMA secure_delete=ON')
        try:
            with c:
                yield c
        finally:
            c.close()

    def maintain(self, c):
        current = monday(today()).isoformat()
        cutoff = (monday(today()) - dt.timedelta(weeks=RETENTION_WEEKS)).isoformat()
        weeks = [r[0] for r in c.execute('SELECT DISTINCT week FROM buckets WHERE week < ?', (current,))]
        for week in weeks:
            slots = {}
            for slot in ('morning', 'evening'):
                n_devices = c.execute('SELECT count(*) FROM participants WHERE week=? AND slot=?', (week, slot)).fetchone()[0]
                bucket = c.execute('SELECT * FROM buckets WHERE week=? AND slot=?', (week, slot)).fetchone()
                result = {'status': 'insufficient'}
                if n_devices >= MIN_BROWSERS and bucket:
                    result = {'status': 'published', 'responses': bucket['n'], 'browsers': n_devices,
                              'means': {k: round(v / bucket['n'], 1) for k, v in json.loads(bucket['sums']).items()}}
                slots[slot] = result
            c.execute('INSERT OR IGNORE INTO published VALUES (?,?)', (week, json.dumps(slots)))
        for table in ('salts', 'receipts', 'participants', 'buckets'):
            c.execute(f'DELETE FROM {table} WHERE week < ?', (current,))
        c.execute('DELETE FROM published WHERE week < ?', (cutoff,))

    def submit(self, data):
        if not data.consent:
            raise HTTPException(400, 'Отправка возможна только с отдельным согласием.')
        if data.day != today().isoformat():
            raise HTTPException(400, 'В сводку можно отправить только отметку за сегодня по московскому времени.')
        week = monday(today()).isoformat()
        with self.connect() as c:
            c.execute('BEGIN IMMEDIATE')
            self.maintain(c)
            c.execute('INSERT OR IGNORE INTO salts VALUES (?,?)', (week, secrets.token_hex(32)))
            secret = c.execute('SELECT secret FROM salts WHERE week=?', (week,)).fetchone()[0]
            digest = hmac.new(bytes.fromhex(secret), data.token.encode(), hashlib.sha256).hexdigest()
            inserted = c.execute('INSERT OR IGNORE INTO receipts VALUES (?,?,?,?)', (week, data.day, data.slot, digest)).rowcount
            if not inserted:
                return {'status': 'already_received'}
            c.execute('INSERT OR IGNORE INTO participants VALUES (?,?,?)', (week, data.slot, digest))
            row = c.execute('SELECT * FROM buckets WHERE week=? AND slot=?', (week, data.slot)).fetchone()
            sums = json.loads(row['sums']) if row else {k: 0 for k in METRICS}
            for key in METRICS:
                sums[key] += getattr(data, key)
            c.execute('INSERT OR REPLACE INTO buckets VALUES (?,?,?,?)', (week, data.slot, (row['n'] if row else 0) + 1, json.dumps(sums)))
        return {'status': 'received'}

    def summary(self):
        with self.connect() as c:
            c.execute('BEGIN IMMEDIATE')
            self.maintain(c)
            weeks = [{'week': r['week'], 'slots': json.loads(r['payload'])}
                     for r in c.execute('SELECT * FROM published ORDER BY week DESC')]
        return {'current_week': monday(today()).isoformat(), 'minimum_browsers': MIN_BROWSERS,
                'retention_weeks': RETENTION_WEEKS, 'weeks': weeks}


def make_router(root, db_path):
    router = APIRouter()
    store = WellbeingStore(db_path)

    @router.get('/checkin')
    def checkin_page():
        return FileResponse(root / 'checkin.html', headers={'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer'})

    @router.post('/api/wellbeing/checkins')
    def submit(data: Checkin, request: Request, response: Response):
        origin = request.headers.get('origin')
        if origin and origin != str(request.base_url).rstrip('/'):
            raise HTTPException(403, 'Отправляйте отметку со страницы этого приложения.')
        response.headers['Cache-Control'] = 'no-store'
        return store.submit(data)

    @router.get('/api/wellbeing/summary')
    def summary(response: Response):
        response.headers['Cache-Control'] = 'no-store'
        return store.summary()

    return router
