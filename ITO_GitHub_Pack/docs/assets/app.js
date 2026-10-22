'use strict';
const $ = id => document.getElementById(id);
const E = x => String(x ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const N = x => Number(x || 0).toLocaleString('ru-RU', {maximumFractionDigits: 1});
const icons = {
  grid:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  calendar:'M8 2v4 M16 2v4 M3 10h18 M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2 M7 14h3 M14 14h3 M7 18h3',
  team:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M16 4a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  folder:'M3 6V4h6l2 3h10v13H3z', chart:'M4 20V4 M4 20h17 M8 15l4-5 4 3 5-7',
  list:'M8 5h13 M8 12h13 M8 19h13 M3 5h.01 M3 12h.01 M3 19h.01',
  exchange:'M3 7h17 M16 3l4 4-4 4 M21 17H4 M8 13l-4 4 4 4',
  book:'M12 5v16 M3 3c4-1 7 0 9 2 2-2 5-3 9-2v16c-4-1-7 0-9 2-2-2-5-3-9-2z',
  arrow:'M5 12h14 M14 7l5 5-5 5', plus:'M12 5v14 M5 12h14',
  clock:'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0 M12 6v6l4 2',
  target:'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0 M18 12a6 6 0 1 1-12 0 6 6 0 0 1 12 0 M12 10v4 M10 12h4',
  download:'M12 3v12 M7 10l5 5 5-5 M4 16v5h16v-5',
  check:'M5 12l4 4L19 6', alert:'M12 3L2 21h20z M12 9v5 M12 18h.01',
  info:'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0 M12 11v6 M12 7h.01',
  left:'M15 5l-7 7 7 7', right:'M9 5l7 7-7 7', close:'M6 6l12 12 M18 6L6 18',
  search:'M21 21l-6-6 M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0',
  edit:'M15 4l5 5 M4 20l4-1L21 6l-4-4L4 15z', lock:'M6 10h12v11H6z M8 10V6a4 4 0 0 1 8 0v4',
  tool:'M14 6a5 5 0 0 0-6 6L2 18l4 4 6-6a5 5 0 0 0 6-6l-3 3-4-4z',
  pulse:'M2 12h5l3-8 4 16 3-8h5', menu:'M3 6h18 M3 12h18 M3 18h18',
  trash:'M3 6h18 M8 6V3h8v3 M5 6l1 15h12l1-15 M10 10v7 M14 10v7'
};
const icon = k => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${icons[k] || icons.grid}"/></svg>`;
const btn = (text, act, ico, cls = '', attrs = '') => `<button type="button" class="btn ${cls}" data-act="${act}" ${attrs}>${ico ? icon(ico) : ''}${text}</button>`;
const navLink = (text, page) => `<button class="text-link" data-act="go" data-page="${page}">${text}${icon('arrow')}</button>`;
const pill = (text, tone = '') => `<span class="pill ${tone}">${text}</span>`;
const initials = name => name.split(/\s+/).slice(0, 2).map(x => x[0]).join('');
const demo = document.body.dataset.mode === 'demo';
const KEY = 'ITO_PUBLIC_RESOURCE_V061';
const LEGACY_KEY = 'ITO_PUBLIC_LEGACY_UNUSED';
const server = document.body.dataset.mode === 'server' && location.protocol !== 'file:';
let S, M, revision = 0, saving = false, page = location.hash.slice(1) || 'overview', week = ITO.monday(ITO.today());
let tab = 'tasks', query = '', projectFilter = '', statusFilter = '', importDraft, restoreDraft;
const NAV = [['overview','Обзор отдела','grid'],['planning','План недели','calendar'],['results','Результаты','chart'],['people','Команда','team'],['wellbeing','Пульс команды','pulse'],['projects','Проекты','folder'],['operations','Каталог операций','list']];
const titles = {overview:'Эффективность отдела',planning:'План недели',results:'Результаты и отклонения',people:'Команда',projects:'Портфель проектов',operations:'Каталог операций',exchange:'Данные и отчёты',method:'Методология',potential:'Потенциал команды',stage2:'СМР и ПНР'};
const subtitles = {overview:'Ресурсы, обязательства и принятый результат — в одном месте.',planning:'От ожидаемого результата к исполнителю и часам.',results:'Только сопоставимый объём и подтверждённые результаты.',people:'Доступность, нагрузка и участие в расчёте отдела.',projects:'Распределение ресурса между проектами и внутренними работами.',operations:'Экспертные нормы для планирования. Уточняем по завершённым работам.',exchange:'Резервные копии, перенос данных и недельный отчёт.',method:'Рабочая редакция 0.6.1 · правила текущего пилота и предложения.',potential:'Экспертная оценка и добровольная самооценка — отдельный контур.',stage2:'Второй этап развития: монтаж и пусконаладка.'};
titles.wellbeing='Пульс команды';
subtitles.wellbeing='Личный дневник и добровольная сводка самоощущения.';
const find = (table, id) => S[table].find(x => ITO.same(x.id, id));
const name = (table, id) => find(table, id)?.name || '—';
const taskName = id => find('tasks', id)?.title || String(id);
const taskFact = id => ITO.sum(S.actuals.filter(x => ITO.same(x.task_id, id)), x => x.hours);
const dateLabel = day => new Date(day + 'T12:00:00').toLocaleDateString('ru-RU', {day: 'numeric', month: 'long'});
const rangeLabel = () => `${new Date(week).getUTCDate()}–${dateLabel(ITO.plus(week,6))} ${week.slice(0,4)}`;
const statusPill = t => pill(t.accepted ? 'Принято' : t.status === 'Заблокировано' ? 'Блокировка' : t.status === 'В работе' ? 'В работе' : 'В плане', t.accepted ? 'green' : t.status === 'Заблокировано' ? 'amber' : '');
function table(head, rows, empty = 'Пока нет записей') {
  return `<div class="table-wrap"><table><thead><tr>${head.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.length ? rows.map(r=>`<tr>${r.map(c=>`<td>${c ?? ''}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${head.length}"><div class="empty">${icon('list')}<h3>${empty}</h3><p>Добавьте данные для выбранной недели.</p></div></td></tr>`}</tbody></table></div>`;
}
const panel = (title, subtitle, content, link = '', foot = '') => `<section class="panel"><div class="panel-head"><div><h2>${title}</h2>${subtitle ? `<p>${subtitle}</p>` : ''}</div>${link}</div>${content}${foot ? `<div class="panel-foot">${foot}</div>` : ''}</section>`;
const note = (text, tone='') => `<div class="inline-note ${tone}">${icon(tone === 'amber' ? 'alert' : 'info')}<div>${text}</div></div>`;
const kpi = (label,value,unit,foot,ico,bar=null) => `<section class="kpi"><div class="kpi-label">${label}${icon(ico)}</div><div class="kpi-value">${value}<em>${unit}</em></div><div class="kpi-foot">${foot}</div>${bar !== null ? `<div class="micro"><div style="width:${Math.min(100,Math.max(0,bar))}%"></div></div>` : ''}</section>`;

async function api(path, options) {
  if(demo)throw Error('Демонстрация не подключена к серверу');
  const res = await fetch('/api/' + path, options);
  const data = await res.json();
  if (!res.ok) throw Error(typeof data.detail === 'string' ? data.detail : 'Не удалось сохранить данные');
  return data;
}
async function persist(next, restoring=false) {
  if(demo){S=ITO.validate(next);revision++;return;}
  if (saving) throw Error('Дождитесь сохранения');
  saving = true;
  try {
    if (server) {
      const saved = await api(restoring ? 'restore' : 'state', {method: restoring ? 'POST' : 'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({data:next,revision})});
      S = ITO.normalize(saved.data); revision = saved.revision;
    } else {
      const current = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (current && current.revision !== revision) throw Error('Данные изменились в другом окне. Обновите страницу.');
      if (restoring) localStorage.setItem(KEY + '_BEFORE_RESTORE', JSON.stringify({version:5, data:S}));
      localStorage.setItem(KEY,JSON.stringify({version:5,revision:revision+1,data:next}));
      S = next; revision++;
    }
  } finally { saving = false; }
}
async function mutate(action, data) { await persist(ITO.apply(S, action, data)); render(); }
function toast(message, error=false) {
  document.querySelector('.toast')?.remove();
  const node = document.createElement('div'); node.className = 'toast' + (error ? ' error-toast' : ''); node.setAttribute('role', error ? 'alert' : 'status'); node.textContent = message; document.body.appendChild(node); setTimeout(()=>node.remove(), 6000);
}
function go(next) { page= titles[next] ? next : 'overview'; query='';projectFilter='';statusFilter='';location.hash=page;render();window.scrollTo(0,0); }
function render() {
  if (!S) return;
  page = titles[page] ? page : 'overview'; M = ITO.metrics(S,week);
  $('app').innerHTML = `<aside class="sidebar" id="sidebar"><div class="brand"><div class="brand-mark">IT</div><div><b>ITO</b><small>RESOURCE INTELLIGENCE</small></div></div><div class="workspace">${icon('team')}Инженерный отдел<span class="dot"></span></div><div class="nav-label">Управление отделом</div><nav class="nav-list" aria-label="Основная навигация">${NAV.map(([id,label,ico])=>`<button class="nav-button ${page===id?'active':''}" data-act="go" data-page="${id}" ${page===id?'aria-current="page"':''}>${icon(ico)}${label}${id==='planning'?`<span class="count">${M.tasks.length}</span>`:''}</button>`).join('')}</nav><div class="nav-label">Следующий этап</div><button class="nav-button ${page==='stage2'?'active':''}" data-act="go" data-page="stage2">${icon('tool')}СМР и ПНР${pill('02')}</button><div class="sidebar-bottom"><div class="nav-list">${[['exchange','Данные и отчёты','exchange'],['method','Методология','book']].map(([id,label,ico])=>`<button class="nav-button ${page===id?'active':''}" data-act="go" data-page="${id}">${icon(ico)}${label}</button>`).join('')}</div><div class="storage"><span class="dot"></span>${demo?'Учебные данные · без сохранения':server?'Локальная база · SQLite':'Сохранено в этом браузере'}</div><div class="user"><span class="avatar">IT</span><div><strong>Рабочее пространство ИТО</strong><small>Пилот · версия 0.6</small></div></div></div></aside><main class="main"><header class="topbar"><div class="crumb"><button class="icon-btn mobile-menu" data-act="menu" aria-label="Открыть меню">${icon('menu')}</button><span>Рабочее пространство</span><span>/</span><span>${page==='stage2'?'Этап 02':'Этап 01'}</span></div><div class="top-right"><span class="outline-label">${demo?'ДЕМОНСТРАЦИЯ':'ЛОКАЛЬНОЕ ПРИЛОЖЕНИЕ'}</span><span class="dot"></span><span class="saved-text">${demo?'Учебный пример':server?'База подключена':'Автосохранение'}</span></div></header><div class="content">${demo?ITO_DEMO.toolbar():''}<div class="page-head"><div><h1>${titles[page]}</h1><p>${subtitles[page]}</p></div><div class="actions">${pageActions()}</div></div>${!['method','stage2','operations','wellbeing'].includes(page)?periodBar():''}<p class="print-only" style="margin-bottom:18px">Отчёт за неделю: ${rangeLabel()}</p><div id="view">${({overview,planning,results,people,projects,operations,exchange,method,potential,stage2,wellbeing})[page]()}</div><footer class="page-foot"><span>ITO Resource Intelligence · ${server?'SQLite':'автономный режим'} · v0.6</span><span>Нормы — рабочие гипотезы. Загрузка не равна эффективности.</span></footer></div></main>`;
  if(page==='method')$('view').insertAdjacentHTML('beforeend',wellbeingMethod()+wellbeingPeriodRules());
  if(page==='wellbeing')loadWellbeingSummary();
}
function pageActions() {
  if (page==='overview') return btn('Отчёт','report','download','ghost')+btn('План недели','go','plus','primary','data-page="planning"');
  if (page==='planning') return btn('Внести факт','edit','clock','ghost','data-table="actuals"')+btn('Новая задача','edit','plus','primary','data-table="tasks"');
  if (page==='people') return btn('Отсутствие','edit','calendar','ghost','data-table="absences"')+btn('Сотрудник','edit','plus','primary','data-table="people"');
  if (['projects','operations'].includes(page)) return btn(page==='projects'?'Новый проект':'Новая операция','edit','plus','primary',`data-table="${page}"`);
  if (page==='results') return btn('Внести факт','edit','clock','ghost','data-table="actuals"')+btn('Отчёт CSV','report','download');
  if (page==='exchange') return btn('Резервная копия','backup','download','primary')+(!demo&&!server&&localStorage.getItem(KEY+'_BEFORE_RESTORE')?btn('Предыдущая копия','previous-backup','download','ghost'):'');
  if (page==='potential') return btn('К команде','go','team','ghost','data-page="people"');
  return '';
}
function periodBar() {
  return `<div class="period-bar"><div class="period"><button class="icon-btn" data-act="week" data-offset="-7" aria-label="Предыдущая неделя">${icon('left')}</button><button class="icon-btn" data-act="week" data-offset="7" aria-label="Следующая неделя">${icon('right')}</button><strong>${rangeLabel()}</strong><input id="week" aria-label="Выбрать неделю" type="date" value="${week}" title="Любая дата нужной недели"></div><div class="period-meta">${M.snapshot?pill('План зафиксирован','green'):pill('Черновик плана')}<span>${M.tasks.length} задач · ${M.team.length} сотрудников в расчёте</span></div></div>`;
}
function overview() {
  const shortage = M.overloaded.reduce((s,p)=>s-p.free,0), leader=M.overloaded[0];
  const rows = M.team.filter(p=>p.plan || p.capacity).sort((a,b)=>(b.load||0)-(a.load||0));
  const signals = [leader ? `<div class="signal"><span class="signal-icon amber">${icon('alert')}</span><div><h3>${M.overloaded.length===1?(leader.role.includes('Руководитель')?'Перегрузка руководителя':'Перегрузка сотрудника'):'Перегружены: '+M.overloaded.length}</h3><p>${E(leader.name)}: ${N(leader.plan)} ч при ресурсе ${N(leader.capacity)} ч. ${M.overloaded.length===1?'Нужно перераспределить '+N(-leader.free)+' ч.':'Суммарный дефицит — '+N(shortage)+' ч.'}</p>${navLink('Посмотреть нагрузку','people')}</div></div>` : `<div class="signal"><span class="signal-icon">${icon('check')}</span><div><h3>План в пределах ресурса</h3><p>У сотрудников нет превышения доступных часов на эту неделю.</p></div></div>`,
    M.outsidePlan ? `<div class="signal"><span class="signal-icon amber">${icon('team')}</span><div><h3>${N(M.outsidePlan)} ч вне подтверждённого состава</h3><p>Уточните участие и график сотрудников вне расчёта. Эти часы видны в плане проектов.</p>${navLink('Сверить состав','people')}</div></div>` : '',
    `<div class="signal"><span class="signal-icon gray">${icon(M.blocked.length?'lock':'clock')}</span><div><h3>${M.blocked.length?M.blocked.length+' задач с блокировками':M.totalFact?'Факт за неделю: '+N(M.totalFact)+' ч':'Фактические часы ещё не внесены'}</h3><p>${M.blocked.length?'Отметьте причину блокировки; в факт вносите только реально затраченное ожиданием время.':M.totalFact?'Приёмка и полнота учёта определяют доступность метрик результата.':'План / факт появится после учёта времени и приёмки результата.'}</p>${navLink('К результатам','results')}</div></div>`].join('');
  return `<div class="kpis">${kpi('Доступный ресурс',N(M.capacity),'ч',`${M.team.filter(p=>p.capacity>0).length} в работе · ${M.team.filter(p=>p.capacity===0).length} без ресурса`,'team')}${kpi('Плановая загрузка',M.load===null?'—':N(M.load),'%',`${N(M.plan)} из ${N(M.capacity)} ч основного состава`,'chart',M.load||0)}${kpi('Принято из плана',M.completion===null?'—':N(M.completion),'%',M.snapshot?`${N(M.done)} из ${N(M.original)} ч принято`:'Сначала зафиксируйте план недели','target',M.completion||0)}${kpi('Фактическое время',M.totalFact?N(M.totalFact):'—','ч',M.totalFact?`${N(M.loss)} ч потерь · ${N(M.rework)} ч переделок`:'Ожидает заполнения','clock')}</div>
  <div class="dashboard-grid"><div class="stack">${panel('Загрузка команды','План / доступные часы',`<div class="panel-body"><div class="load-head"><span>Сотрудник</span><span>Распределение ресурса</span><span style="text-align:right">Часы</span></div>${rows.map(p=>`<div class="load-row"><div class="load-person"><span class="avatar">${E(initials(p.name))}</span><div><strong>${E(p.name)}</strong><small>${E(p.role.split('/')[0].trim())}</small></div></div><div><div class="track"><div class="fill ${p.plan>p.capacity?'over':''}" style="width:${Math.min(100,p.load||0)}%"></div></div><div class="load-extra ${p.plan>p.capacity?'warning':''}">${p.plan>p.capacity?'Перегрузка +'+N(p.plan-p.capacity)+' ч':p.free>0?'Резерв '+N(p.free)+' ч':'Ресурс распределён'}</div></div><div class="load-number ${p.plan>p.capacity?'warning':''}">${N(p.plan)} <small>/ ${N(p.capacity)}</small></div></div>`).join('')}</div>`,navLink('Вся команда','people'),`<div class="legend"><span><i></i>Назначено</span><span><i style="background:var(--amber)"></i>Перегрузка</span><span>${N(M.free)} ч — чистый резерв отдела</span></div>`)}</div><div class="stack">${panel('Требует внимания','Управленческие сигналы',`<div class="panel-body">${signals}</div>`)}${panel('Результат недели','Принятые обязательства исходного плана',`<div class="result-summary"><div class="ring" style="--value:${Math.min(100,M.completion||0)}"><div class="ring-inner">${M.completion===null?'—':N(M.completion)+'%'}<small>${M.snapshot?'выполнено':'нет базы'}</small></div></div><div><h3>${M.snapshot?N(M.done)+' из '+N(M.original)+' ч':'Зафиксируйте точку отсчёта'}</h3><p>${M.snapshot?'Изменения текущего плана не меняют исходные обязательства.':'Снимок сохранит обязательства недели для честного сравнения.'}</p>${navLink(M.snapshot?'Посмотреть результаты':'Открыть план','planning')}</div></div>`)}</div></div>
  ${panel('Распределение по проектам',`${N(M.totalPlan)} ч всего, включая ${N(M.outsidePlan)} ч вне основного состава`,table(['Проект / направление','Задачи','План, ч','Факт, ч','Принято'],M.projects.map(p=>[E(p.name),p.tasks,`<div class="table-progress"><div class="track"><div class="fill" style="width:${M.totalPlan?p.plan/M.totalPlan*100:0}%"></div></div><b>${N(p.plan)}</b></div>`,p.fact?N(p.fact):'—',pill(p.accepted+' из '+p.tasks,p.accepted?'green':'')])),navLink('Все проекты','projects'))}`;
}
function filters(status=true) {
  return `<div class="toolbar"><div class="search">${icon('search')}<input id="search" placeholder="Найти задачу, проект или сотрудника" value="${E(query)}" aria-label="Поиск"></div><select id="projectFilter" aria-label="Фильтр по проекту"><option value="">Все проекты</option>${S.projects.map(p=>`<option value="${E(p.id)}" ${projectFilter===String(p.id)?'selected':''}>${E(p.name)}</option>`).join('')}</select>${status?`<select id="statusFilter" aria-label="Фильтр по статусу"><option value="">Все статусы</option>${['Запланировано','В работе','Заблокировано','Принято'].map(s=>`<option ${statusFilter===s?'selected':''}>${s}</option>`).join('')}</select>`:''}</div>`;
}
function matchedTask(t) {
  if (projectFilter && !ITO.same(t.project_id, projectFilter)) return false;
  if (statusFilter && (t.accepted?'Принято':t.status==='План недели'?'Запланировано':t.status)!==statusFilter) return false;
  const persons = S.assignments.filter(a=>ITO.same(a.task_id,t.id)&&a.week===week).map(a=>name('people',a.person_id));
  return [t.title,t.id,name('projects',t.project_id),...persons].join(' ').toLowerCase().includes(query.toLowerCase());
}
function taskRows(tasks, acceptance=false) {
  return tasks.map(t=>{
    const assignments = S.assignments.filter(a=>ITO.same(a.task_id,t.id)&&a.week===week);
    const persons = [...new Set(assignments.map(a=>name('people',a.person_id)))];
    return [`<div class="title-cell"><button class="table-button" data-act="${t.accepted?'receipt':'edit'}" data-table="tasks" data-id="${E(t.id)}">${E(t.title)}</button><span class="table-sub">${E(t.id)} · ${E(name('projects',t.project_id))}</span></div>`,persons.length?persons.map(E).join('<br>'):pill('Не назначено','amber'),`${N(t.planned)}<span class="table-sub">${N(ITO.sum(assignments,a=>a.hours))} ч на неделю</span>`,taskFact(t.id)?N(taskFact(t.id)):'—',statusPill(t),`<div class="table-actions">${acceptance?btn(t.accepted?'Приёмка':'Принять',t.accepted?'receipt':'accept',t.accepted?'check':'plus','small',`data-id="${E(t.id)}"`):btn('Открыть',t.accepted?'receipt':'edit','right','small ghost',`data-table="tasks" data-id="${E(t.id)}"`)}</div>`];
  });
}
function planning() {
  const weeklyIds = new Set(S.assignments.filter(a=>a.week===week).map(a=>String(a.task_id)));
  const unassigned = S.tasks.filter(t=>!S.assignments.some(a=>ITO.same(a.task_id,t.id))&&!t.accepted);
  const tasks = S.tasks.filter(t=>weeklyIds.has(String(t.id)) || unassigned.includes(t)).filter(matchedTask);
  const freeze = `<div class="inline-note">${icon(M.snapshot?'lock':'calendar')}<div style="flex:1"><strong>${M.snapshot?'Исходный план: '+N(M.original)+' ч':'План ещё можно уточнить'}</strong><br>${M.snapshot?`Снимок от ${new Date(M.snapshot.created_at).toLocaleString('ru-RU')} · текущий план ${N(M.totalPlan)} ч · новые задачи ${N(M.newHours)} ч.`:'Назначьте часы и зафиксируйте обязательства. Изменения после фиксации останутся видны отдельно.'}</div>${M.snapshot?btn('Открыть снимок','snapshot','lock','small ghost'):btn('Зафиксировать план','freeze','lock','small')}</div>`;
  let content;
  if (tab==='tasks') content=table(['Задача / ожидаемый результат','Исполнитель','Оценка, ч','Факт, ч','Статус',''],taskRows(tasks));
  if (tab==='assignments') content=table(['Задача','Исполнитель','Неделя','План, ч',''],S.assignments.filter(a=>a.week===week&&matchedTask(find('tasks',a.task_id))).map(a=>[E(taskName(a.task_id)),E(name('people',a.person_id)),E(a.week),N(a.hours),btn('Изменить','edit','edit','small ghost',`data-table="assignments" data-id="${E(a.id)}"`)]));
  if (tab==='actuals') content=table(['Дата','Задача','Сотрудник','Тип','Часы',''],M.facts.filter(a=>matchedTask(find('tasks',a.task_id))).map(a=>[E(a.day),`<span class="table-main">${E(taskName(a.task_id))}</span><span class="table-sub">${E(a.reason||'')}</span>`,E(name('people',a.person_id)),pill({work:'Работа',rework:'Переделка',loss:'Потери'}[a.kind||'work'],a.kind==='loss'?'amber':''),N(a.hours),btn('Изменить','edit','edit','small ghost',`data-table="actuals" data-id="${E(a.id)}"`)]));
  return `${freeze}<div class="tabs" role="tablist" aria-label="План и факт">${[['tasks','Задачи'],['assignments','Назначения'],['actuals','Факт времени']].map(([id,title])=>`<button role="tab" aria-selected="${tab===id}" class="tab ${tab===id?'active':''}" data-act="tab" data-tab="${id}">${title}</button>`).join('')}</div><div class="toolbar" style="justify-content:space-between"><span class="muted" style="font-size:12px">${unassigned.length?unassigned.length+' задач без назначения · ':''}Все часы на выбранную неделю</span><div class="actions">${btn('Назначить часы','edit','plus','small','data-table="assignments"')}${btn('Учесть время','edit','clock','small ghost','data-table="actuals"')}</div></div>${filters()}<div class="panel" id="filtered">${content}</div>${note('Оценка задачи — трудоёмкость всего результата. Назначения — распределение этой работы между людьми и неделями. Факт в списке задач показан за весь срок задачи.')}`;
}
function results() {
  const tasks = M.tasks.filter(matchedTask);
  return `<div class="kpis">${kpi('Принято из плана',M.completion===null?'—':N(M.completion),'%',M.snapshot?`${N(M.done)} / ${N(M.original)} ч исходного плана`:'Нет зафиксированного плана','target')}${kpi('План / факт',M.ratio===null?'—':N(M.ratio),'×',M.ratio===null?'Нужны приёмка и полный факт':`${N(M.comparablePlan)} план / ${N(M.actualDone)} факт`,'chart')}${kpi('Отклонение трудоёмкости',M.deviation===null?'—':(M.deviation>0?'+':'')+N(M.deviation),'%',M.deviation===null?'Нет сопоставимых результатов':'Факт относительно исходной оценки','clock')}${kpi('Приёмка без замечаний',M.quality===null?'—':N(M.quality),'%',M.quality===null?'Нужна проверка качества':'Вес — исходные оценки принятых задач','check')}</div>${note('План / факт сравнивает исходные оценки с полным фактом задач, принятых в этой неделе. Если хотя бы по одной факт неполный, коэффициент не выводится. Пока оценки экспертные, это не измерение производительности. «Принято из плана» использует часы назначений из снимка, а не проверку срока задачи.')}<div class="two">${panel('Приёмка результатов',`${M.accepted.length} принято на выбранной неделе`, `<div class="panel-body"><h2>${N(M.acceptedHours)} <span class="muted">плановых часов</span></h2><p style="font-size:12px;margin-top:9px">Оценка фиксируется из первого снимка задачи, если он есть. Актуальный план сохраняется отдельно.</p></div>`)}${panel('Потери и переделки','Учтённое время за выбранную неделю',`<div class="panel-body"><h2>${N(M.loss)} ч <span class="muted">потерь</span> &nbsp; / &nbsp; ${N(M.rework)} ч <span class="muted">исправлений</span></h2><p style="font-size:12px;margin-top:9px">${M.blocked.length} задач заблокировано. Потерянные часы фиксируйте отдельно от календарной задержки.</p></div>`)}</div>${filters()}${panel('Задачи и приёмка','Факт задачи — за весь срок её выполнения',table(['Результат / проект','Исполнитель','Оценка, ч','Факт, ч','Статус',''],taskRows(tasks,true)))}${S.events.length?`<div style="margin-top:20px">${panel('Журнал результатов','Подтверждения и возвраты в работу',table(['Дата','Задача','Событие','Подтверждение'],S.events.filter(e=>e.day>=week&&e.day<=M.end).slice().reverse().map(e=>[E(e.day),E(taskName(e.task_id)),pill(e.action==='accept'?'Принято':'Возврат',e.action==='accept'?'green':'amber'),`${E(e.result)}<span class="table-sub">${E(e.accepted_by||'')}</span>`])))}</div>`:''}`;
}
function people() {
  return `${note(`В расчёте отдела: ${M.team.length} человек, доступно ${N(M.capacity)} ч. Дополнительный и сменный состав показан отдельно. Командировка распределяет ресурс на проект, а не уменьшает его.`)}${panel('Основной состав','Доступность и недельный баланс',table(['Сотрудник / роль','Ресурс, ч','План, ч','Факт, ч','Баланс',''],M.team.map(p=>[`<span class="table-main">${E(p.name)}</span><span class="table-sub">${E(p.role)}</span>`,`${N(p.capacity)}${p.absence?`<span class="table-sub">${N(p.absence)} ч отсутствия</span>`:''}`,N(p.plan),p.fact?N(p.fact):'—',pill(p.capacity===0&&!p.plan?'Нет ресурса':p.free<0?'Перегрузка '+N(-p.free)+' ч':'Резерв '+N(p.free)+' ч',p.free<0?'amber':p.free>0?'green':''),btn('Изменить','edit','edit','small ghost',`data-table="people" data-id="${E(p.id)}"`)])))}<div style="margin-top:20px">${panel('Состав для уточнения','Не включён в ресурс основного отдела',table(['Сотрудник','Роль','Назначено, ч',''],M.people.filter(p=>!+p.active).map(p=>[E(p.name),E(p.role),N(p.plan),btn('Уточнить','edit','edit','small ghost',`data-table="people" data-id="${E(p.id)}"`)])))}</div><div class="two" style="margin-top:20px">${panel('Отсутствия','Выбранная неделя',table(['Сотрудник','Часы','Причина',''],S.absences.filter(a=>a.week===week).map(a=>[E(name('people',a.person_id)),N(a.hours),E(a.reason),btn('Править','edit',null,'small ghost',`data-table="absences" data-id="${E(a.id)}"`)])))}${panel('Развитие команды','Исследовательский контур',`<div class="panel-body"><p style="font-size:12px;line-height:1.8">Компетенция и самостоятельность — экспертные оценки. Энергия, мотивация и условия — добровольные ответы сотрудника. Они не меняют показатели эффективности.</p><div style="margin-top:18px">${btn('Потенциал команды','go','team','ghost','data-page="potential"')}</div></div>`)}</div>`;
}
function projects() {
  return panel('Проекты и направления','Часы и результаты только за выбранную неделю',table(['Проект','Тип','План, ч','Факт, ч','Принято',''],S.projects.map(p=>{const m=M.projects.find(x=>ITO.same(x.id,p.id));return [E(p.name),E(p.kind||'Проект'),N(m?.plan),m?.fact?N(m.fact):'—',m?m.accepted+' / '+m.tasks:'—',btn('Изменить','edit','edit','small ghost',`data-table="projects" data-id="${E(p.id)}"`)];})))+`<div style="margin-top:20px">${note('Внутренние работы по СМР и ПНР входят в загрузку отдела. Метрики подрядного монтажа, бюджета и технической приёмки появятся на втором этапе.')}</div>`;
}
function operations() {
  const rows=S.operations.filter(o=>[o.name,o.category,o.id].join(' ').toLowerCase().includes(query.toLowerCase()));
  return `${note('Каталог содержит '+S.operations.length+' операций из текущей версии. Нормы экспертные; полный каталог можно добавить вручную или импортировать. Изменение нормы не переписывает уже оценённые задачи.')}<div class="toolbar"><div class="search">${icon('search')}<input id="search" placeholder="Поиск операции или направления" value="${E(query)}" aria-label="Поиск операции"></div>${btn('Импорт каталога','go','exchange','ghost','data-page="exchange"')}</div>${panel('Операции и нормативы','Норма на одну единицу результата',table(['Код','Операция','Направление','Единица','Норма, ч',''],rows.map(o=>[E(o.id),E(o.name),E(o.category),E(o.unit),N(o.norm),btn('Изменить','edit','edit','small ghost',`data-table="operations" data-id="${E(o.id)}"`)])))}`;
}
function exchange() {
  if(demo)return panel('Данные и отчёты','В демонстрации доступны только учебные данные',`<div class="panel-body prose"><p>В рабочей версии есть предпросмотр CSV/XLSX, проверка ID, отсечение повторов и JSON-копии. Для Bitrix24 нужен подготовленный журнал отдельных записей времени; прямой интеграции пока нет.</p><p>Импорт и восстановление в публичном демо отключены. Рабочие файлы здесь не загружаются.</p><div class="actions">${btn('Учебный отчёт CSV','report','download')}${btn('Учебная копия JSON','backup','download')}${btn('Печать','print','book','ghost')}</div></div>`);

  return `<div class="two">${panel('Резервная копия','Рабочие данные отдела в JSON',`<div class="panel-body"><p style="font-size:12px;line-height:1.8">Команда, задачи, фактические часы, исходные планы и история результатов. Дневник и сводки самочувствия сюда не входят. Подходит для переноса между автономной и серверной версиями.</p><div class="actions" style="margin-top:20px">${btn('Скачать JSON','backup','download','primary')}${btn('Восстановить','restore-pick','exchange','ghost')}</div><input type="file" id="restoreFile" accept=".json" class="hidden"></div>`)}${panel('Отчёт за неделю',rangeLabel(),`<div class="panel-body"><p style="font-size:12px;line-height:1.8">Общие показатели, баланс команды, план и факт проектов. Индивидуальные субъективные оценки в отчёт не включаются.</p><div class="actions" style="margin-top:20px">${btn('Скачать CSV','report','download','primary')}${btn('Версия для печати','print','book','ghost')}</div></div>`)}</div>${panel('Импорт CSV / XLSX','Сначала проверка и предпросмотр, затем сохранение',`<div class="panel-body"><form id="importForm"><div class="form-grid"><label class="field">Что импортируем<select name="kind"><option value="actuals">Фактическое время</option><option value="operations">Каталог операций</option><option value="tasks">Задачи</option></select></label><label class="field">Файл<input type="file" name="file" accept="${server?'.csv,.xlsx':'.csv'}" required></label></div><div class="actions" style="margin-top:18px"><button class="btn primary" type="submit">${icon('search')}Проверить файл</button>${btn('Шаблон факта CSV','template','download','ghost')}</div></form><div style="margin-top:20px">${note('Для факта нужны колонки external_id; task_id; person_id; day; hours. ID должны совпадать со справочниками приложения. Даты — ГГГГ-ММ-ДД. Повторные external_id пропускаются. Это подготовленная выгрузка, прямого подключения к Bitrix24 пока нет.')}</div><p style="font-size:11px">Операции: id; category; name; unit; norm. Задачи: id; project_id; operation_id; title; qty (необязательно planned, due).${!server?' XLSX доступен после запуска серверной версии.':''}</p></div>`)}<div style="margin-top:20px">${panel('История импортов','Успешно подтверждённые загрузки',table(['Дата','Файл','Добавлено','Дубликаты'],S.imports.slice().reverse().map(i=>[E((i.created_at||'').slice(0,16).replace('T',' ')),E(i.filename),N(i.added),N(i.skipped)])))}</div>${S.migration_note?`<div style="margin-top:20px">${note(E(S.migration_note))}</div>`:''}`;
}
function method() {
  const documentLink=server?'/static/methodology.html':'Методология_ИТО.html';
  return `<div class="big-notice"><span class="pill green">РАБОЧАЯ РЕДАКЦИЯ · 0.6.1</span><h2 style="margin-top:16px">Результаты, сроки, труд и качество</h2><p>Отдел выполняет согласованные обязательства и сохраняет возможность брать следующие. Смотрим, что принято, сколько труда потребовалось и что мешало работе. Загрузка описывает занятость; единого балла эффективности нет.</p><a class="btn ghost" style="margin-top:18px" href="${documentLink}" target="_blank" rel="noopener">Полный текст методологии ↗</a></div>
  <div class="two"><section class="panel panel-body prose"><h2>Что уточнили</h2><ul><li>План / факт показывает отношение оценки к затратам, пока нормы остаются гипотезами.</li><li>Часы на неделю и обещание сдать результат к сроку — разные вещи.</li><li>Обучение, наставничество и координация — необходимая работа отдела.</li><li>Самочувствие остаётся отдельной добровольной обратной связью.</li></ul></section><section class="panel panel-body prose"><h2>Как читать эту редакцию</h2><p>Ниже — правила текущих расчётов и отдельно предложения для следующей версии. Формулы и рабочие данные не пересчитаны.</p><p>Редакция предназначена для обсуждения с командой. Численные пороги, нормы и персональные KPI по ней автоматически не утверждаются.</p></section></div>
  <section class="panel panel-body prose" style="margin-top:20px"><h2>Три разных вида часов</h2>${table(['Величина','Пример','Назначение'],[['Оценка результата','24 ч на комплект схем','План трудоёмкости всего результата'],['Назначение на неделю','8 ч из этих 24','Распределение доступного ресурса'],['Фактическое время','3 ч за сегодня','Уже затраченный труд']])}<p>Назначить 8 часов не означает обещать весь комплект за неделю. В текущей версии приёмка целиком по задаче: для недельных обязательств выделяем отдельные проверяемые результаты.</p></section>
  <div class="two" style="margin-top:20px"><section class="panel panel-body prose"><h2>Ресурс и план · работает сейчас</h2><h3>Доступная ёмкость</h3><div class="formula">Рабочие часы основного состава − отсутствия</div><p>Командировка остаётся в ресурсе. Сменный состав включается после сверки графика. Переработка не увеличивает исходный ресурс задним числом.</p><h3>Плановая загрузка</h3><div class="formula">Назначенные часы основного состава / его ресурс × 100%</div><p>100% не является универсальной целью. Остаток часов не доказывает возможность взять любую задачу: нужны компетенции, сроки и исходные данные. Перегрузку каждого проверяем отдельно.</p><h3>Принято из плана</h3><div class="formula">Часы назначений на принятые задачи снимка / все часы снимка × 100%</div><p>Вес — недельные часы из снимка, включая дополнительный состав. Задача должна быть принята в выбранной неделе и не возвращена к её концу. Новые задачи не меняют исходный знаменатель.</p><p>Это ещё не проверка обещанного срока. Длинные задачи без отдельных принимаемых результатов могут занижать показатель.</p></section>
  <section class="panel panel-body prose"><h2>Результат · работает сейчас</h2><h3>План / факт принятых работ</h3><div class="formula">Исходная оценка принятых задач / полный факт этих задач</div><p>Прежнее название — «Производительность». При экспертных оценках коэффициент 1,2 не означает 120% эффективности. Проверяем сложность, изменения объёма и полноту факта.</p><p>Берём задачи по дате приёмки и полный факт за весь срок. Если хотя бы по одной факт неполный, коэффициент не показываем. Без снимка оценка фиксируется при приёмке и не считается восстановленным исходным планом.</p><h3>Отклонение трудоёмкости</h3><div class="formula">(Факт − исходная оценка) / исходная оценка × 100%</div><p>Сопоставляем один и тот же принятый объём. Изменения требований разбираем отдельно.</p><h3>Приёмка без замечаний</h3><p>Доля исходных оценок принятых задач без учтённых переделок и замечаний. Нужна проверка качества всех принятых задач. Это признак качества при приёмке, не гарантия отсутствия поздних дефектов.</p></section></div>
  <section class="panel panel-body prose" style="margin-top:20px"><span class="pill">ОСНОВА СЛЕДУЮЩЕЙ ВЕРСИИ</span><h2 style="margin-top:14px">Каталог описывает работу; нормы ещё предстоит проверить</h2><p>Твой реестр v1.0 содержит 68 операций и 239 шагов по 17 этапам. В нём различаются действующие и целевые процессы, роли и способы исполнения. Поля норм и стоимости пока пусты.</p><div class="formula">Этап → операция → шаг → задача с результатом → назначения и факт</div><p>Записей в прежнем каталоге приложения: ${S.operations.length}. Перед переносом сопоставим коды и единицы результата, сохраним связи задач. Пустую норму не заменяем нулём; конкретную задачу можно оценить вручную с обоснованием.</p><p>Нужно также уточнить ссылку на проектирование: в карте процесса указан код 30, а разработка ПД/РД в реестре находится под кодом 32.</p></section>
  <div class="two" style="margin-top:20px"><section class="panel panel-body prose"><h2>Учёт труда и причины отклонений</h2><p>Обучение, наставничество, координация и база знаний получают цель, план времени и результат. Часы наставника учитываются отдельно от часов младшего сотрудника.</p><p>Исправление несоответствия — переделка. Новый объём — изменение задачи. Предусмотренная итерация — обычная работа. Для вывода о качестве нужна причина, а не только факт возврата.</p><p>Два дня блокировки не означают 16 часов потерь, если сотрудник выполнял другую работу. Один интервал одного человека записывается один раз.</p><p>В приложении пока три типа: работа, переделка, потери. Дорога и причины изменений ещё не выделены отдельными признаками.</p></section><section class="panel panel-body prose"><h2>Bitrix24 и достоверность данных</h2><p>Нужен журнал отдельных записей времени: ID записи, задача, сотрудник, дата и длительность. Общий счётчик часов задачи не заменяет журнал за период.</p><p>Проверяем дубликаты, единицы времени, сопоставление задач и полноту выгрузки. Нераспределённые часы нельзя молча исключать. Повторные ID текущий импорт пропускает; исправленные записи нужно разбирать отдельно.</p><p>Нет полного факта — нет коэффициента. Нет проверки качества — нет оценки качества. Отсутствие записи не превращается в ноль.</p>${navLink('Данные и отчёты','exchange')}</section></div>
  ${panel('Недельный цикл','От договорённости до одного проверяемого улучшения',`<div class="panel-body">${[['01','Понедельник · согласовать результат','Проверить ресурс, приоритеты, критерии приёмки и оценки. Разделить длинные работы на принимаемые результаты, затем зафиксировать план.'],['02','В течение недели · учитывать изменения','Вести факт, отмечать новые срочные задачи, блокировки и причины отклонений. Исходный план сохранять.'],['03','Пятница · проверить приёмку','Указать результат, дату, принимающего, полноту факта и проверку качества. Незавершённость не считать экономией.'],['04','Ретроспектива · принять решение','Разобрать переносы, изменения требований и распределение нагрузки. Выбрать одно улучшение, ответственного и срок проверки.']].map(([n,t,d])=>`<div class="roadmap-step"><span>${n}</span><div><h3>${t}</h3><p>${d}</p></div></div>`).join('')}</div>`)}
  <div class="two" style="margin-top:20px"><section class="panel panel-body prose"><h2>Навыки и самоощущение</h2><p>Навыки оцениваем по конкретным операциям и примерам работ. Поддержка младшего специалиста планируется явно; общий балл не заменяет матрицу компетенций.</p><p>В старом «Потенциале» ещё есть именные оценки состояния 1–10. Они входят в JSON-копию и не являются анонимными. Новые ежедневные отметки ведём через отдельный «Мой день».</p><p>Самочувствие не меняет нормо-часы, оплату и кадровые решения. Шкалы 1–5 описывают самоощущение и не являются психологической диагностикой.</p>${navLink('Пульс команды','wellbeing')}</section><section class="panel panel-body prose"><h2>Что предстоит внедрить</h2><p><b>Ближайший пилот:</b> отдельный хостинг, HTTPS, доступ сотрудника и руководителя, постоянная база и проверка восстановления.</p><p><b>Модель учёта:</b> сопоставление каталога, версии оценок, отдельные обязательства со сроками, история доступности и обработка изменений Bitrix24.</p><p><b>Затем:</b> месячные отчёты и матрица компетенций. Самостоятельные методики СМР и ПНР — второй этап.</p>${navLink('СМР и ПНР','stage2')}</section></div>`;
}
function stage2() {
  return `<div class="big-notice">${pill('В РАЗРАБОТКЕ · ЭТАП 02')}<h2 style="margin-top:16px">Два самостоятельных контура оценки</h2><p>Сначала отлаживаем недельный цикл отдела. Затем расширяем модель под экономику подрядного монтажа и технический результат пусконаладки.</p></div><div class="two"><section class="panel stage-card">${pill('ВНЕШНИЕ ПОДРЯДЧИКИ')}<div class="stage-icon">${icon('tool')}</div><h2>Эффективность СМР</h2><p>Оцениваем объём, стоимость и качество монтажа.</p><ul><li>Полнота первоначального ТЗ и изменения объёма</li><li>Дополнительные работы, бюджет и маржинальность</li><li>Соблюдение сроков и готовность фронта работ</li><li>Качество монтажа, замечания и переделки</li></ul><span class="muted" style="font-size:11px">Показатели и формы будут разработаны отдельно.</span></section><section class="panel stage-card">${pill('СОБСТВЕННЫЕ ИНЖЕНЕРЫ')}<div class="stage-icon">${icon('pulse')}</div><h2>Эффективность ПНР</h2><p>Оцениваем трудоёмкость и подтверждённую готовность систем.</p><ul><li>Операции, объём и фактическое время</li><li>Испытания и протоколы приёмки</li><li>Повторные настройки и технические блокировки</li><li>Сроки готовности и качество результата</li></ul><span class="muted" style="font-size:11px">Собственные часы уже видны в загрузке отдела.</span></section></div>${note('Внешние часы монтажников не входят в штатную ёмкость ИТО. Собственные часы ПНР можно анализировать в двух контурах, но в суммарной себестоимости учитывать только один раз.')}`;
}
function potential() {
  return `${note('Прежний именной раздел 1–10: эти оценки входят в JSON-копию и не являются анонимными. Для новых ежедневных отметок используйте «Мой день» в разделе «Пульс команды». Оценки не меняют доступные часы и показатели результата.')}<div class="panel">${table(['Сотрудник','Компетенция','Самостоятельность','Энергия','Мотивация','Условия',''],S.people.filter(p=>+p.active||p.id==='X01').map(p=>{const a=S.assessments.find(x=>ITO.same(x.person_id,p.id)&&x.week===week)||{};return [E(p.name),...['competence','autonomy','energy','motivation','conditions'].map(k=>a[k]??'—'),btn('Оценить','assess','edit','small ghost',`data-id="${E(p.id)}"`)];}))}</div>`;
}

let modalCallback = null;
function modal(title, body, footer='', callback=null) {
  $('dialog')?.remove();
  const d=document.createElement('dialog');d.id='dialog';d.setAttribute('aria-labelledby','dialogTitle');
  d.innerHTML=`<form id="modalForm"><div class="dialog-head"><h2 id="dialogTitle">${title}</h2><button type="button" class="icon-btn" data-act="close" aria-label="Закрыть">${icon('close')}</button></div><div class="dialog-body">${body}<div class="error" id="formError" role="alert"></div></div><div class="dialog-foot">${btn('Отмена','close',null,'ghost')}${footer}</div></form>`;
  modalCallback=callback;document.body.appendChild(d);d.showModal();
}
function closeModal() { $('dialog')?.close();$('dialog')?.remove();modalCallback=null; }
const submit = label => `<button type="submit" class="btn primary">${label}</button>`;
const field = (label,key,value='',type='text',opts={}) => `<label class="field ${opts.full?'full':''}">${label}<${type==='textarea'?'textarea':'input'} ${type==='textarea'?'':`type="${type}"`} name="${key}" ${type==='textarea'?'':`value="${E(value)}"`} ${opts.required===false?'':'required'} ${type==='number'?`min="${opts.min??0}" step="${opts.step||'0.25'}"`:''} ${opts.max?`max="${opts.max}"`:''} ${opts.readonly?'readonly':''}>${type==='textarea'?E(value)+'</textarea>':''}${opts.help?`<small>${opts.help}</small>`:''}</label>`;
const selectField=(label,key,values,value,opts={})=>`<label class="field ${opts.full?'full':''}">${label}<select name="${key}" ${opts.required===false?'':'required'}>${opts.blank?`<option value="">${opts.blank}</option>`:''}${values.map(([id,label])=>`<option value="${E(id)}" ${ITO.same(id,value)?'selected':''}>${E(label)}</option>`).join('')}</select>${opts.help?`<small>${opts.help}</small>`:''}</label>`;
const choices = (table,key='name',predicate=()=>true) => S[table].filter(predicate).map(x=>[x.id,x[key]]);
function edit(tableName,id) {
  const old=id?find(tableName,id):null,r=old||{};
  if ((tableName==='tasks'&&r.accepted)||(tableName==='actuals'&&find('tasks',r.task_id)?.accepted)) throw Error('Сначала верните принятую задачу в работу через раздел «Результаты».');
  let fields='',hint='',title='';
  if (tableName==='tasks') {
    title=id?'Изменить задачу':'Новая задача';
    fields=field('Ожидаемый результат','title',r.title,'textarea',{full:true})+selectField('Проект','project_id',choices('projects'),r.project_id)+selectField('Операция','operation_id',choices('operations'),r.operation_id)+field('Объём операции','qty',r.qty??1,'number')+field('Оценка всего результата, ч','planned',r.planned??S.operations[0]?.norm??0,'number',{help:'Первоначальная оценка сохранится в снимке плана.'})+field('Срок результата','due',r.due||M.end,'date',{required:false})+selectField('Статус','status',['Запланировано','В работе','Заблокировано'].map(x=>[x,x]),r.status==='План недели'?'Запланировано':r.status||'Запланировано')+field('Причина блокировки / отклонения','reason',r.reason||'','textarea',{full:true,required:false});
    if(!id)fields+=selectField('Назначить на текущую неделю','assignee',choices('people'),'',{full:true,blank:'Без назначения — распределю позже',required:false,help:'Весь план задачи будет назначен сотруднику. Распределение можно изменить.'});
    hint='Формулируйте проверяемый результат. Объём × норма подставляются при выборе операции; оценку можно уточнить вручную.';
  }
  if(tableName==='assignments'){
    title=id?'Изменить назначение':'Назначить часы';
    fields=selectField('Задача','task_id',choices('tasks','title',t=>!t.accepted||ITO.same(t.id,r.task_id)),r.task_id,{full:true})+selectField('Исполнитель','person_id',choices('people'),r.person_id)+field('Неделя (понедельник)','week',r.week||week,'date')+field('Назначенные часы','hours',r.hours??'','number',{min:0.25});
    hint='Одна задача может быть распределена между несколькими сотрудниками и неделями. Фиксация плана сохраняет исходное распределение.';
  }
  if(tableName==='actuals'){
    title=id?'Изменить факт':'Внести фактическое время';
    fields=selectField('Задача','task_id',choices('tasks','title',t=>!t.accepted||ITO.same(t.id,r.task_id)),r.task_id,{full:true})+selectField('Исполнитель','person_id',choices('people'),r.person_id)+field('Дата работы','day',r.day||(ITO.today()>=week&&ITO.today()<=M.end?ITO.today():week),'date')+field('Затрачено часов','hours',r.hours??'','number',{min:0.25})+selectField('Тип времени','kind',[['work','Работа'],['rework','Переделка'],['loss','Организационные потери']],r.kind||'work')+field('Причина / примечание','reason',r.reason||'','textarea',{full:true,required:false,help:'Для организационных потерь причина обязательна.'});
    hint='Вносите каждый интервал один раз: работа, переделка или потери. Все три типа входят в фактическую трудоёмкость задачи.';
  }
  if(tableName==='people'){
    title=id?'Карточка сотрудника':'Добавить сотрудника';
    fields=field('Имя и фамилия','name',r.name,'text',{full:true})+field('Роль','role',r.role,'text',{full:true})+field('Рабочие часы в неделю','weekly',r.weekly??40,'number')+selectField('Участие в расчёте отдела','active',[[1,'Основной состав'],[0,'Вне расчёта / график уточнить']],r.active??1);
    hint='После сверки штата укажите рабочий график. Отсутствия оформляются отдельно на нужную неделю.';
  }
  if(tableName==='absences'){
    title=id?'Изменить отсутствие':'Учесть отсутствие';
    fields=selectField('Сотрудник','person_id',choices('people'),r.person_id,{full:true})+field('Неделя (понедельник)','week',r.week||week,'date')+field('Часы отсутствия','hours',r.hours??40,'number',{min:0.25})+field('Причина','reason',r.reason||'Отпуск','text',{full:true});
    hint='Отпуск, больничный или другой период недоступности. Командировка не уменьшает ресурс.';
  }
  if(tableName==='projects'){
    title=id?'Изменить проект':'Новый проект';fields=field('Название','name',r.name,'text',{full:true})+field('Тип / направление','kind',r.kind||'Проект','text',{full:true});
  }
  if(tableName==='operations'){
    title=id?'Изменить операцию':'Новая операция';fields=field('Название операции','name',r.name,'text',{full:true})+field('Направление','category',r.category)+field('Единица результата','unit',r.unit||'задача')+field('Норма на единицу, ч','norm',r.norm??'','number')+field('Статус нормы','kind',r.kind||'Экспертная гипотеза');
    hint='Изменение нормы повлияет только на новые оценки. Существующие задачи и снимки сохранят свои часы.';
  }
  const remove=old&&['assignments','actuals','absences'].includes(tableName)?btn('Удалить','delete','trash','danger-btn',`data-table="${tableName}" data-id="${E(id)}"`):'';
  modal(title,`<p>${hint}</p><div class="form-grid">${fields}</div>`,remove+submit('Сохранить'),async form=>{
    const values=Object.fromEntries(new FormData(form)),assignee=values.assignee;delete values.assignee;
    for(const k of ['hours','weekly','active','norm','planned','qty'])if(values[k]!==undefined)values[k]=Number(values[k]);
    const record={...r,...values,id:r.id||ITO.uid()};
    if(tableName==='tasks'&&record.status==='Заблокировано'&&!record.reason.trim())throw Error('Укажите причину блокировки');
    let next=ITO.apply(S,'save',{table:tableName,record});
    if(tableName==='tasks'&&!id&&assignee&&record.planned>0)next=ITO.apply(next,'save',{table:'assignments',record:{id:ITO.uid(),task_id:record.id,person_id:assignee,week,hours:record.planned}});
    await persist(next);closeModal();render();toast('Сохранено');
  });
}
function acceptDialog(id,reopen=false){
  const t=find('tasks',id);
  const day=ITO.today();
  let body=`<p>${E(t.title)}</p><div class="form-grid">${field('Дата события','day',day,'date',{max:ITO.today()})}${!reopen?field('Кто принял результат','accepted_by',''):''}${field(reopen?'Причина возврата':'Подтверждение результата','result','','textarea',{full:true,help:reopen?'История предыдущей приёмки сохранится.':'Что проверено и принято; ссылка на документ или протокол при наличии.'})}${!reopen?field('Замечания, шт.','remarks',0,'number',{step:1}):''}</div>`;
  if(!reopen)body+=`<label class="checkbox"><input type="checkbox" name="actual_complete">Фактические часы этой задачи внесены полностью (сейчас ${N(taskFact(id))} ч)</label><label class="checkbox"><input type="checkbox" name="quality_reviewed">Качество проверено, переделки и замечания учтены</label><p style="font-size:11px">Без полного факта план / факт не рассчитывается. Без проверки качества показатель качества остаётся пустым.</p>`;
  modal(reopen?'Вернуть задачу в работу':'Принять результат',body,submit(reopen?'Вернуть в работу':'Принять результат'),async form=>{
    const data=Object.fromEntries(new FormData(form));data.task_id=id;data.actual_complete=!!data.actual_complete;data.quality_reviewed=!!data.quality_reviewed;
    await mutate(reopen?'reopen':'accept',data);closeModal();toast(reopen?'Задача возвращена в работу':'Результат принят');
  });
}
function receipt(id){
  const t=find('tasks',id),event=S.events.filter(e=>ITO.same(e.task_id,id)&&e.action==='accept').at(-1);
  modal('Принятый результат',`<p>${E(t.title)}</p>${event?`<div class="prose"><h3>${E(event.result)}</h3><p>${E(event.day)} · ${E(event.accepted_by)}</p><div class="formula">Исходная оценка: ${N(event.planned_hours)} ч · факт: ${N(event.actual_hours)} ч</div><p>Факт ${event.actual_complete?'полный':'не подтверждён как полный'}. Качество ${event.quality_reviewed?'проверено':'не проверено'}. Переделки: ${N(event.rework_hours)} ч. Замечания: ${N(event.remarks)}.</p></div>`:note('Задача принята в предыдущей версии без даты и подтверждения. Для включения в метрики верните её в работу и оформите приёмку.','amber')}`,btn('Вернуть в работу','reopen','exchange','',`data-id="${E(id)}"`));
}
function freezeDialog(){
  modal('Зафиксировать план недели',`<p>${rangeLabel()}. Сохраним ${M.tasks.length} задач и ${N(M.totalPlan)} ч назначений. Этот снимок станет неизменяемой базой выполнения обязательств.</p>${note(`Основной состав: ${N(M.plan)} ч. Вне подтверждённого состава: ${N(M.outsidePlan)} ч. Перегружено сотрудников: ${M.overloaded.length}.`,M.overloaded.length||M.outsidePlan?'amber':'')}<p>После фиксации можно менять задачи и назначения. Исходные часы останутся в снимке, новые работы будут показаны отдельно.</p>`,submit('Зафиксировать'),async()=>{await mutate('freeze',{week});closeModal();toast('Исходный план сохранён');});
}
function snapshotDialog(){
  modal('Исходный план · '+rangeLabel(),`<p>Зафиксирован ${new Date(M.snapshot.created_at).toLocaleString('ru-RU')}. Снимок не меняется при редактировании текущего плана.</p>${table(['Задача','Обязательства недели, ч','Оценка задачи, ч'],M.snapshot.entries.map(t=>[E(t.title),N(t.hours),N(t.planned)]))}`);
}
function assessDialog(id){
  const a=S.assessments.find(x=>ITO.same(x.person_id,id)&&x.week===week)||{},p=find('people',id);
  const fs=[['competence','Компетенция · руководитель'],['autonomy','Самостоятельность · руководитель'],['energy','Энергия · сотрудник'],['motivation','Мотивация · сотрудник'],['conditions','Условия · сотрудник']];
  modal('Оценка · '+E(p.name),`<p>Неделя ${rangeLabel()}. Самооценка вносится добровольно, со слов сотрудника. Неоценённые поля оставляйте пустыми.</p><div class="form-grid">${fs.map(([key,label])=>selectField(label,key,Array.from({length:10},(_,i)=>[i+1,i+1]),a[key]??'',{blank:'Не оценено',required:false})).join('')}</div>`,submit('Сохранить оценку'),async form=>{
    const values=Object.fromEntries(new FormData(form));fs.forEach(([k])=>values[k]=values[k]===''?null:Number(values[k]));
    const record={...a,...values,id:a.id||`${id}:${week}`,person_id:id,week,recorded_at:new Date().toISOString(),source:'Руководитель / добровольный ответ сотрудника'};
    // Older assessments used a compound key without an id.
    let base=ITO.clone(S);base.assessments=base.assessments.filter(x=>!(ITO.same(x.person_id,id)&&x.week===week));
    await persist(ITO.apply(base,'save',{table:'assessments',record}));closeModal();render();toast('Оценка сохранена');
  });
}
function download(filename,text,mime='application/json'){
  const u=URL.createObjectURL(new Blob([text],{type:mime})),a=document.createElement('a');a.href=u;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1500);
}
function csvText(rows){return '\ufeff'+rows.map(r=>r.map(v=>{let str=String(v??'');if(typeof v==='string'&&/^[=+@\-\t\r]/.test(str))str="'"+str;return '"'+str.replaceAll('"','""')+'"';}).join(';')).join('\r\n');}
function report(){
  const rows=[['ITO — отчёт отдела',rangeLabel()],['Показатель','Значение','Единица'],['Ресурс основного состава',M.capacity,'ч'],['План основного состава',M.plan,'ч'],['Загрузка',M.load??'Нет данных','%'],['План всего',M.totalPlan,'ч'],['Вне состава',M.outsidePlan,'ч'],['Факт всего',M.totalFact,'ч'],['Исходный план',M.original??'Нет снимка','ч'],['Принято из исходного плана',M.done??'Нет снимка','ч'],['Принято из плана',M.completion??'Нет данных','%'],['План / факт принятых работ',M.ratio??'Нет полного факта','коэффициент'],['Отклонение трудоёмкости',M.deviation??'Нет данных','%'],['Приёмка без замечаний',M.quality??'Нет данных','%'],['Потери',M.loss,'ч'],['Переделки',M.rework,'ч'],[],['Сотрудник','Роль','В основном составе','Ресурс, ч','План, ч','Факт, ч','Резерв/дефицит, ч'],...M.people.map(p=>[p.name,p.role,+p.active?'Да':'Нет',p.capacity,p.plan,p.fact,p.free]),[],['Проект','План, ч','Факт, ч','Принято задач','Задач в неделе'],...M.projects.map(p=>[p.name,p.plan,p.fact,p.accepted,p.tasks]),[],['Принятый результат','Дата','Исходная оценка, ч','Факт задачи за весь срок, ч','Полный факт','Качество проверено'],...M.accepted.map(e=>[taskName(e.task_id),e.day,e.planned_hours,e.actual_hours,e.actual_complete?'Да':'Нет',e.quality_reviewed?'Да':'Нет'])];
  download(`ITO_Отчёт_${week}.csv`,csvText(rows),'text/csv;charset=utf-8');toast('Отчёт подготовлен');
}
function parseCSV(text){
  text=text.replace(/^\uFEFF/,'');const first=text.split(/\r?\n/)[0]||'',sep=first.split(';').length>=first.split(',').length?';':',';
  const rows=[];let row=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++){
    const ch=text[i];
    if(ch==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
    else if(ch===sep&&!quoted){row.push(cell);cell='';}
    else if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x.trim()))rows.push(row);row=[];cell='';}
    else cell+=ch;
  }
  if(quoted)throw Error('В CSV не закрыта кавычка');
  row.push(cell);if(row.some(x=>x.trim()))rows.push(row);
  const heads=rows.shift()?.map(x=>x.trim());if(!heads?.length)throw Error('Файл пуст');
  if(new Set(heads).size!==heads.length)throw Error('Повторяющиеся названия колонок');
  return rows.map((r,i)=>{if(r.length!==heads.length)throw Error('Строка '+(i+2)+': число колонок не совпадает с заголовком');return Object.fromEntries(heads.map((h,j)=>[h,r[j]]));});
}
async function previewImport(form){
  if(demo)throw Error('Импорт в публичной демонстрации отключён');
  const file=form.elements.file.files[0],kind=form.elements.kind.value;if(!file)return;
  if(file.size>10000000)throw Error('Максимум 10 МБ');
  let items;
  if(server){const fd=new FormData();fd.append('file',file);items=(await api('import/preview?kind='+kind,{method:'POST',body:fd})).items;}
  else{if(!file.name.toLowerCase().endsWith('.csv'))throw Error('В автономном режиме доступен CSV. XLSX — в серверной версии.');items=parseCSV(await file.text());}
  if(items.length>10000)throw Error('Максимум 10 000 строк');
  const contract={actuals:['external_id','task_id','person_id','day','hours'],operations:['id','category','name','unit','norm'],tasks:['id','project_id','operation_id','title','qty']}[kind];
  if(!items.length||!contract.every(k=>k in items[0]))throw Error('Нужны колонки: '+contract.join('; '));
  let next=ITO.clone(S),added=0,skipped=0;const issues=[],preview=[];
  items.forEach((item,index)=>{
    const row=Object.fromEntries(Object.entries(item).filter(([,v])=>v!==null&&v!=='').map(([k,v])=>[k,typeof v==='string'?v.trim():v]));
    const idField=kind==='actuals'?'external_id':'id';
    if(!String(row[idField]??'').trim()){issues.push([index+2,'Пустой '+idField]);return;}
    if(next[kind].some(x=>ITO.same(x[idField],row[idField]))){skipped++;return;}
    try{
      for(const key of ['hours','norm','qty','planned'])if(row[key]!==undefined)row[key]=Number(String(row[key]).replace(',','.'));
      let record;
      if(kind==='actuals')record={id:ITO.uid(),external_id:String(row.external_id),task_id:String(row.task_id),person_id:String(row.person_id),day:String(row.day),hours:row.hours,kind:row.kind||'work',reason:row.reason||'',source:file.name};
      if(kind==='operations')record={id:String(row.id),category:row.category,name:row.name,unit:row.unit,norm:row.norm,kind:row.kind||'Импорт · экспертная норма'};
      if(kind==='tasks')record={id:String(row.id),project_id:String(row.project_id),operation_id:String(row.operation_id),title:row.title,qty:row.qty,planned:row.planned??Number(next.operations.find(o=>ITO.same(o.id,row.operation_id))?.norm||0)*row.qty,due:row.due||'',source:file.name};
      next=ITO.apply(next,'save',{table:kind,record});added++;if(preview.length<8)preview.push([index+2,E(record.title||record.name||taskName(record.task_id)),N(record.hours??record.norm??record.planned)]);
    }catch(err){issues.push([index+2,err.message]);}
  });
  importDraft={next,revision,added,skipped,filename:file.name};
  modal('Проверка импорта',`<p>${E(file.name)} · ${items.length} строк</p>${note(`Готово к добавлению: ${added}. Повторные ID: ${skipped}. Ошибки: ${issues.length}.`,issues.length?'amber':'')}${issues.length?table(['Строка','Ошибка'],issues.slice(0,30).map(([n,msg])=>[n,E(msg)])):table(['Строка','Запись','Часы'],preview)}${issues.length?'<p style="margin-top:16px">Исправьте ошибки в файле и загрузите его снова. До подтверждения данные не изменяются.</p>':'<p style="margin-top:16px">Показаны первые восемь новых записей. Дубликаты будут пропущены.</p>'}`,issues.length||!added?'':submit('Добавить '+added+' записей'),async()=>{
    if(revision!==importDraft.revision)throw Error('Данные изменились. Проверьте файл заново.');
    importDraft.next.imports.push({id:ITO.uid(),filename:file.name,created_at:new Date().toISOString(),added,skipped});
    await persist(importDraft.next);closeModal();render();toast('Добавлено '+added+' записей');importDraft=null;
  });
}
async function previewRestore(file){
  if(demo)throw Error('Восстановление в публичной демонстрации отключено');
  if(!file)return;if(file.size>15000000)throw Error('Слишком большой JSON');
  const raw=JSON.parse(await file.text());
  if(!Array.isArray((raw.data||raw).people)||!Array.isArray((raw.data||raw).tasks))throw Error('Это не резервная копия ИТО');
  const restored=ITO.validate(ITO.normalize(raw));restoreDraft={data:restored,revision};
  modal('Восстановить данные',`<p>${E(file.name)}</p>${table(['Данные','Сейчас','В файле'],[['Сотрудники',S.people.length,restored.people.length],['Задачи',S.tasks.length,restored.tasks.length],['Факт времени',S.actuals.length,restored.actuals.length],['Снимки плана',S.snapshots.length,restored.snapshots.length]])}${note('Текущие данные будут заменены. Перед заменой приложение сохранит резервную копию '+(server?'в папке backups рядом с базой.':'в хранилище браузера; также скачайте JSON перед переносом.'),'amber')}`,submit('Восстановить из файла'),async()=>{
    if(revision!==restoreDraft.revision)throw Error('Данные изменились. Откройте файл заново.');
    await persist(restoreDraft.data,true);closeModal();render();toast('Данные восстановлены');restoreDraft=null;
  });
}
document.addEventListener('click',async event=>{
  if($('sidebar')?.classList.contains('open')&&!event.target.closest('.sidebar')&&!event.target.closest('[data-act="menu"]'))$('sidebar').classList.remove('open');
  const b=event.target.closest('[data-act]');if(!b)return;
  const {act,id,table:tableName}=b.dataset;
  try{
    if(act==='go')go(b.dataset.page);
    if(act==='menu')$('sidebar').classList.toggle('open');
    if(act==='week'){week=ITO.plus(week,Number(b.dataset.offset));render();}
    if(act==='tab'){tab=b.dataset.tab;query='';projectFilter='';statusFilter='';render();}
    if(act==='edit')edit(tableName,id);
    if(act==='close')closeModal();
    if(act==='freeze')freezeDialog();
    if(act==='snapshot')snapshotDialog();
    if(act==='accept')acceptDialog(id);
    if(act==='receipt')receipt(id);
    if(act==='reopen')acceptDialog(id,true);
    if(act==='assess')assessDialog(id);
    if(act==='backup')download('ITO_backup_'+ITO.today()+'.json',JSON.stringify({version:5,data:S},null,2));
    if(act==='previous-backup')download('ITO_before_restore.json',localStorage.getItem(KEY+'_BEFORE_RESTORE'));
    if(act==='report')report();
    if(act==='restore-pick')$('restoreFile').click();
    if(act==='template')download('ITO_Шаблон_факта.csv',csvText([['external_id','task_id','person_id','day','hours'],['example-001',S.tasks[0]?.id||'TASK_ID',S.people[0]?.id||'PERSON_ID',week,2]]),'text/csv;charset=utf-8');
    if(act==='print'){go('results');setTimeout(()=>window.print(),100);}
    if(act==='delete'){
      modal('Удалить запись',`<p>Удалить эту запись ${tableName==='actuals'?'фактического времени':tableName==='assignments'?'назначения':'отсутствия'}? Исходные снимки плана и история приёмки сохранятся.</p>`,submit('Удалить'),async()=>{await mutate('delete',{table:tableName,id});closeModal();toast('Запись удалена');});
    }
  }catch(err){toast(err.message,true);}
});
document.addEventListener('submit',async event=>{
  event.preventDefault();const form=event.target,button=event.submitter;
  if(button)button.disabled=true;
  try{
    if(form.id==='modalForm'&&modalCallback)await modalCallback(form);
    if(form.id==='importForm')await previewImport(form);
  }catch(err){if(form.id==='modalForm'&&$('formError'))$('formError').textContent=err.message;else toast(err.message,true);}
  finally{if(button)button.disabled=false;}
});
document.addEventListener('change',async event=>{
  const t=event.target;
  try{
    if(t.id==='week'){if(!ITO.date(t.value))return;week=ITO.monday(t.value);render();}
    if(t.id==='projectFilter'){projectFilter=t.value;render();}
    if(t.id==='statusFilter'){statusFilter=t.value;render();}
    if(t.id==='restoreFile')await previewRestore(t.files[0]);
    if(t.form?.id==='modalForm'&&['operation_id','qty'].includes(t.name)){
      const form=t.form;if(form.elements.planned)form.elements.planned.value=N(Number(find('operations',form.elements.operation_id.value)?.norm||0)*Number(form.elements.qty.value)).replace(/\s/g,'').replace(',','.');
    }
  }catch(err){toast(err.message,true);}
});
document.addEventListener('input',event=>{
  if(event.target.id!=='search')return;
  const pos=event.target.selectionStart;query=event.target.value;render();const input=$('search');input?.focus();input?.setSelectionRange(pos,pos);
});
window.addEventListener('hashchange',()=>{const next=location.hash.slice(1);if(next!==page){page=next;query='';render();}});
document.addEventListener('keydown',event=>{if(event.key==='Escape')$('sidebar')?.classList.remove('open');});
window.addEventListener('storage',event=>{if(event.key===KEY&&!server&&!demo)toast('Данные обновлены в другом окне. Перезагрузите страницу перед изменением.',true);});
async function boot(){
  try{
    if(demo){S=ITO.validate(ITO.normalize(window.ITO_SEED));}
    else if(server){const res=await api('state');S=ITO.normalize(res.data);revision=res.revision;}
    else{
      const saved=localStorage.getItem(KEY),old=localStorage.getItem(LEGACY_KEY);
      const parsed=saved?JSON.parse(saved):old?JSON.parse(old):window.ITO_SEED;
      S=ITO.validate(ITO.normalize(parsed));revision=saved?parsed.revision:0;
      if(!saved){await persist(S);if(old)toast('Данные версии 0.4 перенесены. Исходная копия сохранена.');}
    }
    if(!S.assignments.some(a=>a.week===week))week=S.assignments.map(a=>a.week).filter(Boolean).sort().at(-1)||week;
    render();
  }catch(err){$('app').innerHTML=`<main style="padding:10vh 8vw;max-width:800px"><h1>Не удалось открыть данные</h1><p style="margin-top:20px">${E(err.message)}</p><p style="margin-top:15px">${server?'Запустите start_windows.bat и откройте адрес http://127.0.0.1:8010.':'Проверьте доступ браузера к локальному хранилищу. Исходные данные не перезаписаны.'}</p>${btn('Повторить','reload','exchange','','style="margin-top:20px"')}</main>`;document.querySelector('[data-act="reload"]').addEventListener('click',()=>location.reload());}
}
boot();
