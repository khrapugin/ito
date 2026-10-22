/* Shared calculation engine: the browser and SQLite editions use identical rules. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ITO = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const tables = ['people', 'projects', 'operations', 'tasks', 'assignments', 'actuals', 'absences', 'skills', 'assessments', 'imports', 'snapshots', 'events'];
  const clone = x => JSON.parse(JSON.stringify(x));
  const sum = (xs, fn) => xs.reduce((s, x) => s + Number(fn(x) || 0), 0);
  const same = (a, b) => String(a) === String(b);
  const uid = () => 'N' + (globalThis.crypto?.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2));
  const date = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && !isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  function plus(day, n) { const d = new Date(day + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  function monday(day) { const d = new Date(day + 'T12:00:00Z'); return plus(day, -(d.getUTCDay() + 6) % 7); }
  const today = () => new Intl.DateTimeFormat('en-CA', {timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit'}).format(new Date());
  function normalize(raw) {
    const s = clone(raw.data || raw);
    tables.forEach(k => { s[k] ||= []; });
    s.schema_version = 5;
    for (const k of ['assignments', 'actuals', 'absences']) s[k].forEach(r => { r.id ??= uid(); });
    s.tasks.forEach(t => { t.status ||= 'Запланировано'; t.planned ??= Number(t.qty || 0) * Number(s.operations.find(o => same(o.id, t.operation_id))?.norm || 0); });
    s.actuals.forEach(a => { a.kind ||= 'work'; });
    return s;
  }
  function validate(s) {
    const fail = msg => { throw Error(msg); };
    tables.forEach(k => { if (!Array.isArray(s[k])) fail('Некорректная таблица: ' + k); });
    const refs = {tasks: {project_id: 'projects', operation_id: 'operations'}, assignments: {task_id: 'tasks', person_id: 'people'}, actuals: {task_id: 'tasks', person_id: 'people'}, absences: {person_id: 'people'}};
    for (const k of ['people', 'projects', 'operations', 'tasks', 'assignments', 'actuals', 'absences']) {
      const ids = new Set();
      for (const r of s[k]) {
        if (r.id == null || String(r.id).trim() === '' || ids.has(String(r.id))) fail('Пустой или повторный ID: ' + k);
        ids.add(String(r.id));
        const requiredNumbers = {people:['weekly'],operations:['norm'],tasks:['qty','planned'],assignments:['hours'],actuals:['hours'],absences:['hours']}[k] || [];
        for (const f of requiredNumbers) if (r[f] == null || r[f] === '' || !Number.isFinite(Number(r[f]))) fail('Укажите числовое значение: ' + f);
        if (['people', 'projects', 'operations'].includes(k) && !String(r.name || '').trim()) fail('Укажите название / имя');
        if (k === 'tasks' && !String(r.title || '').trim()) fail('Укажите ожидаемый результат задачи');
        for (const [field, table] of Object.entries(refs[k] || {})) if (!s[table].some(x => same(x.id, r[field]))) fail('Не найдено соответствие: ' + field + ' = ' + r[field]);
        for (const f of ['hours', 'weekly', 'norm', 'qty', 'planned', 'rework', 'remarks']) if (r[f] != null && (!Number.isFinite(Number(r[f])) || Number(r[f]) < 0)) fail('Часы, объём и нормы должны быть неотрицательными');
        if (k === 'people' && ![0, 1].includes(Number(r.active))) fail('Укажите участие в расчёте: да или нет');
        if (['assignments', 'absences'].includes(k) && (!date(r.week) || monday(r.week) !== r.week)) fail('Неделя должна начинаться в понедельник');
        if (k === 'actuals' && (!date(r.day) || Number(r.hours) <= 0 || !['work', 'rework', 'loss'].includes(r.kind || 'work'))) fail('Укажите дату, тип и положительное время');
        if (k === 'actuals' && r.day > today()) fail('Фактическая работа не может быть в будущем');
        if (['assignments','absences'].includes(k) && Number(r.hours) <= 0) fail('Укажите положительное количество часов');
        if (k === 'tasks' && r.due && !date(r.due)) fail('Некорректный срок');
        if (k === 'actuals' && r.kind === 'loss' && !String(r.reason || '').trim()) fail('Укажите причину потери времени');
      }
    }
    const ext = s.actuals.map(a => a.external_id).filter(Boolean).map(String);
    if (new Set(ext).size !== ext.length) fail('Повторный внешний ID факта');
    if (new Set(s.snapshots.map(x => x.week)).size !== s.snapshots.length) fail('Повторная фиксация недели');
    s.snapshots.forEach(x => {
      if (!date(x.week) || monday(x.week) !== x.week || !Array.isArray(x.entries) || !Array.isArray(x.people)) fail('Некорректный снимок плана');
      x.entries.forEach(e => { if (!s.tasks.some(t => same(t.id,e.task_id)) || !Number.isFinite(Number(e.hours)) || Number(e.hours)<0) fail('Некорректная строка снимка'); });
    });
    s.events.forEach(x => {
      if (!date(x.day) || !['accept', 'reopen'].includes(x.action) || !s.tasks.some(t => same(t.id, x.task_id))) fail('Некорректная история приёмки');
      if(x.action==='accept') {
        for(const k of ['planned_hours','actual_hours','rework_hours','remarks']) if(!Number.isFinite(Number(x[k]))||Number(x[k])<0) fail('Некорректные часы приёмки');
        if(!x.result||!x.accepted_by) fail('Нужен подтверждённый результат');
      }
    });
    return s;
  }
  function latestEvents(s, end) {
    const out = new Map();
    s.events.filter(e => e.day <= end).map((e, i) => ({...e, order: i})).sort((a, b) => a.day.localeCompare(b.day) || a.order - b.order).forEach(e => out.set(String(e.task_id), e));
    return out;
  }
  function metrics(s, week) {
    const end = plus(week, 6), assignments = s.assignments.filter(a => a.week === week), facts = s.actuals.filter(a => a.day >= week && a.day <= end);
    const people = s.people.map(p => {
      const absence = sum(s.absences.filter(a => same(a.person_id, p.id) && a.week === week), a => a.hours);
      const capacity = +p.active ? Math.max(0, Number(p.weekly) - absence) : 0;
      const plan = sum(assignments.filter(a => same(a.person_id, p.id)), a => a.hours);
      return {...p, absence, capacity, plan, fact: sum(facts.filter(a => same(a.person_id, p.id)), a => a.hours), free: capacity - plan, load: capacity > 0 ? plan / capacity * 100 : null};
    });
    const team = people.filter(p => +p.active), activeIds = new Set(team.map(p => String(p.id)));
    const capacity = sum(team, p => p.capacity), plan = sum(team, p => p.plan), totalPlan = sum(assignments, a => a.hours);
    const snapshot = s.snapshots.find(x => x.week === week), last = latestEvents(s, end);
    const accepted = [...last.values()].filter(e => e.action === 'accept' && e.day >= week);
    const comparable = accepted.filter(e => e.actual_complete && e.actual_hours > 0);
    const original = snapshot ? sum(snapshot.entries, e => e.hours) : null;
    const done = snapshot ? sum(snapshot.entries.filter(x => { const e=last.get(String(x.task_id)); return e?.action === 'accept' && e.day >= week; }), x => x.hours) : null;
    const acceptedHours = sum(accepted, e => e.planned_hours), actualDone = sum(comparable, e => e.actual_hours), comparablePlan = sum(comparable, e => e.planned_hours);
    const quality = accepted.filter(e => e.quality_reviewed), qualityHours = sum(quality, e => e.planned_hours);
    const firstPassHours = sum(quality.filter(e => !e.rework_hours && !e.remarks), e => e.planned_hours);
    const tids = new Set([...assignments.map(a => String(a.task_id)), ...facts.map(a => String(a.task_id)), ...accepted.map(a => String(a.task_id))]);
    const tasks = s.tasks.filter(t => tids.has(String(t.id)));
    const projects = s.projects.map(p => {
      const ids = new Set(s.tasks.filter(t => same(t.project_id, p.id)).map(t => String(t.id)));
      return {...p, plan: sum(assignments.filter(a => ids.has(String(a.task_id))), a => a.hours), fact: sum(facts.filter(a => ids.has(String(a.task_id))), a => a.hours), accepted: accepted.filter(e => ids.has(String(e.task_id))).length, tasks: tasks.filter(t => ids.has(String(t.id))).length};
    }).filter(p => p.plan || p.fact || p.tasks).sort((a, b) => b.plan - a.plan);
    const baselineIds = new Set(snapshot?.entries.map(e => String(e.task_id)) || []);
    const newHours = snapshot ? sum(assignments.filter(a => !baselineIds.has(String(a.task_id))), a => a.hours) : null;
    return {week, end, people, team, capacity, plan, totalPlan, outsidePlan: totalPlan - plan, free: capacity - plan, load: capacity ? plan / capacity * 100 : null,
      fact: sum(facts.filter(a => activeIds.has(String(a.person_id))), a => a.hours), totalFact: sum(facts, a => a.hours), loss: sum(facts.filter(a => a.kind === 'loss'), a => a.hours), rework: sum(facts.filter(a => a.kind === 'rework'), a => a.hours),
      snapshot, original, done, completion: original > 0 ? done / original * 100 : null, newHours, accepted, acceptedHours, actualDone, comparablePlan,
      ratio: comparable.length && comparable.length === accepted.length && actualDone > 0 ? comparablePlan / actualDone : null,
      deviation: comparable.length && comparable.length === accepted.length && comparablePlan > 0 ? (actualDone - comparablePlan) / comparablePlan * 100 : null,
      quality: qualityHours > 0 && quality.length === accepted.length ? firstPassHours / qualityHours * 100 : null,
      tasks, projects, blocked: tasks.filter(t => t.status === 'Заблокировано'), overloaded: team.filter(p => p.plan > p.capacity), facts};
  }
  function apply(input, action, data) {
    const s = clone(input);
    if (action === 'save') {
      const {table, record} = data;
      if (!['people', 'projects', 'operations', 'tasks', 'assignments', 'actuals', 'absences', 'assessments'].includes(table)) throw Error('Этот раздел не редактируется напрямую');
      const index = s[table].findIndex(r => same(r.id, record.id));
      const r = {...(index >= 0 ? s[table][index] : {}), ...record, id: record.id || uid()};
      const taskId = table === 'tasks' ? r.id : r.task_id;
      if (['tasks', 'actuals'].includes(table) && s.tasks.find(t => same(t.id, taskId))?.accepted) throw Error('Сначала верните задачу в работу');
      if (table === 'tasks') { r.accepted = 0; r.qty ??= 1; r.rework ??= 0; r.status ||= 'Запланировано'; r.source ||= 'manual'; }
      if (table === 'actuals') r.kind ||= 'work';
      if (table === 'assessments') {
        for (const k of ['competence', 'autonomy', 'energy', 'motivation', 'conditions']) if (r[k] !== null && (!Number.isInteger(r[k]) || r[k] < 1 || r[k] > 10)) throw Error('Оценка: от 1 до 10 либо пусто');
      }
      if (index >= 0) s[table][index] = r; else s[table].push(r);
    } else if (action === 'delete') {
      if (!['assignments', 'actuals', 'absences'].includes(data.table)) throw Error('Удаление не поддерживается');
      const row = s[data.table].find(r => same(r.id, data.id));
      if (data.table === 'actuals' && s.tasks.find(t => same(t.id, row?.task_id))?.accepted) throw Error('Сначала верните задачу в работу');
      s[data.table] = s[data.table].filter(r => !same(r.id, data.id));
    } else if (action === 'freeze') {
      if (!date(data.week) || monday(data.week) !== data.week) throw Error('Выберите понедельник');
      if (s.snapshots.some(x => x.week === data.week)) throw Error('Исходный план уже зафиксирован');
      const assignments = s.assignments.filter(a => a.week === data.week);
      if (!assignments.length) throw Error('Сначала назначьте задачи на неделю');
      const ids = [...new Set(assignments.map(a => String(a.task_id)))];
      if (ids.some(id => s.tasks.find(t => same(t.id, id))?.accepted)) throw Error('План нужно фиксировать до приёмки результатов');
      s.snapshots.push({id: uid(), week: data.week, created_at: new Date().toISOString(), people: clone(s.people), absences: clone(s.absences.filter(a => a.week === data.week)), assignments: clone(assignments), entries: ids.map(id => ({task_id: id, title: s.tasks.find(t => same(t.id, id)).title, hours: sum(assignments.filter(a => same(a.task_id, id)), a => a.hours), planned: s.tasks.find(t => same(t.id, id)).planned}))});
    } else if (action === 'accept' || action === 'reopen') {
      const task = s.tasks.find(t => same(t.id, data.task_id));
      if (!task) throw Error('Задача не найдена');
      if (!date(data.day)) throw Error('Укажите дату результата');
      if (data.day > today()) throw Error('Дата результата не может быть в будущем');
      const previous = s.events.filter(e => same(e.task_id, task.id)).at(-1);
      if (previous && data.day < previous.day) throw Error('Дата не может быть раньше предыдущего события');
      if (action === 'accept') {
        if (task.accepted) throw Error('Задача уже принята');
        if (!String(data.result || '').trim() || !String(data.accepted_by || '').trim()) throw Error('Опишите результат и укажите, кто его принял');
        if (s.actuals.some(a => same(a.task_id, task.id) && a.day > data.day)) throw Error('Дата приёмки раньше последнего факта по задаче');
        const facts = s.actuals.filter(a => same(a.task_id, task.id) && a.day <= data.day);
        const actual = sum(facts, a => a.hours);
        if (data.actual_complete && actual <= 0) throw Error('Для полного факта сначала внесите часы');
        const snaps = s.snapshots.filter(x => x.week <= data.day).sort((a, b) => a.week.localeCompare(b.week));
        const initial = snaps.flatMap(x => x.entries).find(e => same(e.task_id, task.id));
        s.events.push({id: uid(), action, task_id: task.id, day: data.day, created_at: new Date().toISOString(), result: data.result, accepted_by: data.accepted_by, actual_complete: !!data.actual_complete, quality_reviewed: !!data.quality_reviewed, remarks: Number(data.remarks || 0), planned_hours: Number(initial?.planned ?? task.planned), current_plan: Number(task.planned), actual_hours: actual, rework_hours: Math.max(Number(task.rework || 0), sum(facts.filter(a => a.kind === 'rework'), a => a.hours))});
        task.accepted = 1; task.status = 'Принято';
      } else {
        if (!task.accepted) throw Error('Задача уже в работе');
        if (!String(data.result || '').trim()) throw Error('Укажите причину возврата');
        s.events.push({id: uid(), action, task_id: task.id, day: data.day, created_at: new Date().toISOString(), result: data.result});
        task.accepted = 0; task.status = 'В работе';
      }
    } else throw Error('Неизвестное действие');
    return validate(s);
  }
  return {tables, clone, sum, same, uid, date, plus, monday, today, normalize, validate, metrics, apply, latestEvents};
});
