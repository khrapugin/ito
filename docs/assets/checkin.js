'use strict';
const demo=document.body.dataset.mode==='demo';
const RECORDS='ITO_PUBLIC_PERSONAL_DIARY_V1', TOKEN='ITO_PUBLIC_DIARY_WEEK_TOKEN_V1';
const host=document.getElementById('diary');
const online=!demo&&['http:','https:'].includes(location.protocol);
const homeUrl=demo?'index.html':online?'/#overview':'index.html#overview';
for(const id of ['diary-back','diary-home'])document.getElementById(id).href=homeUrl;
document.getElementById('diary-back').addEventListener('click',event=>{
  if(event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
  const navigation=window.navigation;
  const previous=navigation?.entries().find(entry=>entry.index===navigation.currentEntry?.index-1);
  const previousUrl=previous?.url||document.referrer;
  if(previousUrl&&window.history.length>1){
    const url=new URL(previousUrl);
    if(url.origin===location.origin&&url.protocol===location.protocol){event.preventDefault();window.history.back();}
  }
});
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dateText=day=>new Date(day+'T12:00:00Z').toLocaleDateString('ru-RU',{day:'numeric',month:'long'});
let records=demo?ITO_DEMO.diary():[], day=Diary.today(), slot=Number(new Intl.DateTimeFormat('en-GB',{hour:'numeric',hourCycle:'h23',timeZone:'Europe/Moscow'}).format(new Date()))<14?'morning':'evening', busy=false;
let periodDays=7;
function periodInsights(){return PulseInsights.render(PulseAnalysis.personal(records,periodDays,day));}
const questions=()=>[
  ['wellbeing','Как я себя чувствую сейчас?',['Очень тяжело','Скорее тяжело','Нейтрально','Скорее хорошо','Очень хорошо']],
  ['energy','Сколько у меня сейчас сил?',['Почти нет','Мало','Умеренно','Достаточно','Много']],
  ['calm','Насколько спокойно я себя чувствую?',['Очень напряжённо','Скорее напряжённо','Нейтрально','Скорее спокойно','Очень спокойно']],
  slot==='morning'?['context','Насколько мне понятно, с чего начать день?',['Совсем неясно','Скорее неясно','Частично понятно','Скорее ясно','Полностью ясно']]:['context','Как ощущается прошедший рабочий день?',['Очень тяжёлый','Скорее тяжёлый','Нейтральный','Скорее хороший','Очень хороший']]
];
function readRecords(){
  if(demo)return Diary.prune(records,day);
  const parsed=JSON.parse(localStorage.getItem(RECORDS)||'[]');
  if(!Array.isArray(parsed))throw Error('Не удалось прочитать дневник. Сохранённые данные не перезаписаны.');
  return Diary.prune(parsed,day);
}
function writeRecords(next){if(demo){records=next;return;}localStorage.setItem(RECORDS,JSON.stringify(next));records=next;}
function announce(message,error=false){const el=document.getElementById('diary-message');el.className=error?'diary-message error':'diary-message';el.textContent=message;el.focus();}
function refreshDay(){const now=Diary.today();if(now===day)return false;day=now;records=readRecords();render();return true;}
function scales(record){return questions().map(([key,label,anchors],index)=>`<fieldset class="mood-question" ${record?.shared?'disabled':''}><legend><span>0${index+1}</span>${label}</legend><div class="mood-scale">${anchors.map((anchor,i)=>`<label><input type="radio" name="${key}" value="${i+1}" required ${record?.[key]===i+1?'checked':''}><span><b>${i+1}</b><small>${anchor}</small></span></label>`).join('')}</div></fieldset>`).join('');}
function diaryHistory(){
  const rows=Diary.pairs(records);
  if(!rows.length)return '<div class="diary-empty">Здесь появится ваша история. Пропуски останутся пустыми — они не считаются нулевой оценкой.</div>';
  return `<div class="table-wrap"><table><thead><tr><th>День</th><th>Самочувствие утром</th><th>Самочувствие вечером</th><th>Изменение</th><th>Все оценки</th></tr></thead><tbody>${rows.map(r=>{const delta=r.morning&&r.evening?r.evening.wellbeing-r.morning.wellbeing:null;return `<tr><td>${dateText(r.day)}</td><td>${r.morning?r.morning.wellbeing+' / 5':'—'}</td><td>${r.evening?r.evening.wellbeing+' / 5':'—'}</td><td>${delta===null?'—':(delta>0?'+':'')+delta}</td><td><details><summary>Посмотреть</summary><div class="history-detail">${['morning','evening'].map(s=>r[s]?`<p><b>${s==='morning'?'Утро':'Вечер'}:</b> самочувствие ${r[s].wellbeing}; энергия ${r[s].energy}; спокойствие ${r[s].calm}; ${s==='morning'?'ясность':'ощущение от дня'} ${r[s].context}. ${r[s].shared?(r[s].receiptUnverified?'Повтор не учтён; исходный ответ не восстановлен.':'Отправлено без имени.'):'Только здесь.'}</p>`:'').join('')}</div></details></td></tr>`;}).join('')}</tbody></table></div>`;
}
function render(){
  const record=records.find(r=>r.day===day&&r.slot===slot);
  host.innerHTML=`${demo?ITO_DEMO.toolbar():''}<header class="diary-brand"><div class="brand-mark">IT</div><span>ITO / МОЙ ДЕНЬ</span><span class="pill">Личный дневник</span></header>
  <div class="diary-heading"><p class="eyebrow">${esc(dateText(day))} · время Москвы</p><h1>Как проходит ваш день?</h1><p>Минута, чтобы заметить своё состояние. Отметка добровольная: можно пропустить любой день.</p><a class="btn ghost" href="#diary-period" style="margin-top:16px">Моя динамика за период ↓</a></div>
  <div class="diary-layout"><section class="panel diary-form-panel"><div class="diary-tabs" role="group" aria-label="Время отметки">${[['morning','Утро','Перед началом работы'],['evening','Вечер','После рабочего дня']].map(([id,label,desc])=>`<button type="button" data-slot="${id}" aria-pressed="${slot===id}" class="${slot===id?'selected':''}"><b>${label}</b><small>${desc}</small><span>${records.some(r=>r.day===day&&r.slot===id)?'Сохранено':'Нет отметки'}</span></button>`).join('')}</div>
  <form id="checkin-form"><div class="diary-scale-note">Шкала 1–5. Выбирайте то, что ближе сейчас. Здесь нет правильных ответов.</div>${scales(record)}<div class="diary-save"><button class="btn primary" type="submit" ${record?.shared?'disabled':''}>${record?'Сохранить изменения':demo?'Попробовать сохранение':'Сохранить только у себя'}</button><button type="button" class="btn ghost" id="skip">Сейчас пропущу</button></div></form>
  <div id="diary-message" class="diary-message" role="status" tabindex="-1">${record?(record.shared?(record.receiptUnverified?'За этот период уже был отправлен ответ. Оценки здесь могут отличаться; повтор в сводку не добавлен.':'Эта отметка отправлена без имени. Она зафиксирована, чтобы не учитывать её дважды.'):demo?'Учебная отметка есть только в памяти этой страницы.':'Отметка сохранена только в этом браузере.'):'До сохранения ваши ответы никуда не записываются.'}</div>
  ${!demo&&record&&!record.shared?`<section class="share-box"><h2>Поделиться с отделом — по желанию</h2><p>Будут отправлены четыре оценки за выбранные утро или вечер. Имя, должность и задачи не передаются. Ответ добавится к сумме за неделю.</p><p>Сохранённые оценки: ${Diary.metrics.map(k=>record[k]).join(" / ")} (самочувствие, энергия, спокойствие, ${slot==='morning'?'ясность':'ощущение от дня'}). Для изменения сначала сохраните новые оценки.</p><label class="consent-line"><input id="share-consent" type="checkbox" ${!online?'disabled':''}><span>Согласен отправить эту отметку без имени. После объединения с другими ответами удалить её отдельно нельзя.</span></label><button type="button" class="btn" id="share" disabled>Отправить в общую сводку</button>${!online?'<p>В автономном файле доступен только личный дневник. Для отправки нужна серверная версия.</p>':''}</section>`:''}</section>
  <aside class="diary-aside"><section class="panel panel-body prose"><span class="pill green">Только для вас</span><h2>Сначала — заметить</h2><p>Оценки помогают увидеть, как меняется ваше ощущение дня. Они не определяют вашу ценность, компетентность или продуктивность.</p><p>Это короткая самооценка, а не психологическая диагностика и не тест на выгорание.</p><h3>Если день даётся тяжело</h3><p>Можно сделать паузу, выбрать одну посильную задачу или попросить помощи с приоритетами. Если тяжёлое состояние сохраняется и мешает жизни, стоит обратиться за поддержкой к специалисту.</p><p>Форма не отправляет просьбу о помощи руководителю. Для разговора обратитесь к человеку, которому доверяете, напрямую.</p></section>
  <section class="panel panel-body prose"><h2>Кто увидит ответы</h2><p>${demo?'В рабочей версии личный дневник хранится 28 дней в профиле браузера':'Личный дневник хранится 28 дней в этом браузере'} и не отправляется серверу. Любой, у кого есть доступ к этому профилю браузера, сможет его открыть. Используйте своё устройство.</p><p>Сводка отдела публикуется только за закрытую неделю: отдельно для утра и вечера, при ответах минимум из 5 браузеров. Индивидуальных строк в сводке нет.</p><details><summary>Как работает отправка без имени</summary><p>Случайный код браузера меняется каждую неделю и помогает отсечь повторы. Это не подтверждение пяти разных людей. Приложение не сохраняет IP, точное время и индивидуальные оценки на сервере; технический администратор инфраструктуры всё же может видеть соединения. Полной неотслеживаемости этот локальный пилот не гарантирует.</p></details></section></aside></div>
  <section class="panel diary-history" id="diary-period"><div class="panel-head insight-header"><div><h2>Моё самоощущение за период</h2><p>Личная динамика и идеи для следующего дня · только в этом браузере</p></div><label class="insight-select">Период<select id="diary-period-select">${[7,14,28].map(n=>`<option value="${n}" ${periodDays===n?'selected':''}>${n} дней</option>`).join('')}</select></label></div><div class="panel-body" id="diary-period-body">${periodInsights()}</div></section>
  <section class="panel diary-history"><div class="panel-head"><div><h2>${demo?'Учебная история':'Моя история · 28 дней'}</h2><p>Утро и вечер сопоставляются только внутри одного дня.</p></div><button class="btn small ghost" id="clear-history" ${records.length?'':'disabled'}>Очистить историю</button></div>${diaryHistory()}<div class="panel-foot">Разница — изменение самоощущения, а не оценка влияния работы. На состояние могут влиять и события вне работы.</div></section>
  <footer class="diary-footer">Участие не влияет на KPI, оплату и оценку сотрудника. Серверная версия сейчас работает только на локальном компьютере.</footer>`;
}
host.addEventListener('submit',async event=>{
  event.preventDefault();if(busy)return;
  if(refreshDay()){announce('Наступил новый день. Заполните отметку за сегодня.',true);return;}
  try{
    const form=new FormData(event.target),record={day,slot};
    for(const key of Diary.metrics)record[key]=Number(form.get(key));
    writeRecords(Diary.save(readRecords(),record,day));render();announce(demo?'Учебная отметка записана в память страницы. После обновления она исчезнет. Ничего не отправлено.':'Сохранено только у вас. Отправка в сводку — отдельное действие ниже.');
  }catch(error){announce(error.message,true);}
});
host.addEventListener('change',event=>{
  if(event.target.id==='share-consent')document.getElementById('share').disabled=!event.target.checked;
  if(event.target.id==='diary-period-select'){
    periodDays=Number(event.target.value);
    document.getElementById('diary-period-body').innerHTML=periodInsights();
  }
});
host.addEventListener('click',async event=>{
  const button=event.target.closest('button');if(!button||busy)return;
  if(button.dataset.slot){slot=button.dataset.slot;day=Diary.today();records=readRecords();render();return;}
  if(button.id==='skip'){announce('Можно вернуться позже. Новая отметка не сохранена.');return;}
  if(button.id==='clear-history'){
    if(!confirm('Удалить личную историю из этого браузера? Уже отправленные общие суммы останутся без изменений.'))return;
    try{writeRecords([]);render();announce('Личная история удалена.');}catch(error){announce(error.message,true);}return;
  }
  if(demo)return;
  if(button.id!=='share'||!document.getElementById('share-consent')?.checked)return;
  if(refreshDay()){announce('Можно отправить только сегодняшнюю отметку.',true);return;}
  busy=true;button.disabled=true;
  try{
    records=readRecords();const record=records.find(r=>r.day===day&&r.slot===slot);
    if(!record||record.shared)throw Error('Эта отметка уже отправлена или удалена. Обновите страницу.');
    const week=Diary.monday(day);let token=JSON.parse(localStorage.getItem(TOKEN)||'null');
    if(!token||token.week!==week){const bytes=crypto.getRandomValues(new Uint8Array(32));token={week,value:Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('')};localStorage.setItem(TOKEN,JSON.stringify(token));}
    const payload={day,slot,token:token.value,consent:true};for(const key of Diary.metrics)payload[key]=record[key];
    const response=await fetch('/api/wellbeing/checkins',{method:'POST',credentials:'omit',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    const result=await response.json();if(!response.ok)throw Error(typeof result.detail==='string'?result.detail:'Не удалось отправить. Личная запись сохранена, можно повторить позже.');
    if(!['received','already_received'].includes(result.status))throw Error('Сервер не подтвердил получение.');
    record.shared=true;record.receiptUnverified=result.status==='already_received';writeRecords(records);render();announce(result.status==='received'?'Отправлено без имени. Спасибо за обратную связь.':'Повтор не добавлен: сервер уже получил отметку за этот период. Местные оценки могут отличаться от ранее отправленных.');
  }catch(error){announce(error.message,true);button.disabled=false;}
  finally{busy=false;}
});
window.addEventListener('storage',event=>{if(!demo&&event.key===RECORDS&&!busy){try{records=readRecords();render();}catch(error){announce(error.message,true);}}});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!busy)refreshDay();});
try{records=readRecords();writeRecords(records);render();}
catch(error){host.innerHTML=`<section class="panel panel-body prose"><h1>Дневник не открыт</h1><p>${esc(error.message)}</p><p>Проверьте, разрешено ли хранение данных в этом браузере. Ответы не отправлялись.</p></section>`;}
