(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Diary = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  const metrics = ['wellbeing', 'energy', 'calm', 'context'];
  const today = () => new Intl.DateTimeFormat('en-CA', {timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const plus = (day, n) => {const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
  const monday = day => plus(day, -(new Date(day+'T12:00:00Z').getUTCDay()+6)%7);
  function valid(record) {
    return record && /^\d{4}-\d{2}-\d{2}$/.test(record.day) && ['morning','evening'].includes(record.slot) && metrics.every(k=>Number.isInteger(record[k])&&record[k]>=1&&record[k]<=5);
  }
  function prune(records, day=today()) {
    const cutoff=plus(day,-27);
    return records.filter(r=>valid(r)&&r.day>=cutoff&&r.day<=day);
  }
  function save(records, record, day=today()) {
    if (!valid(record)||record.day!==day) throw Error('Выберите четыре оценки от 1 до 5 за сегодня.');
    const existing=records.find(r=>r.day===day&&r.slot===record.slot);
    if(existing?.shared) throw Error('Отправленная отметка за этот период уже зафиксирована.');
    return [...prune(records,day).filter(r=>r.day!==day||r.slot!==record.slot), {...record, shared:false}];
  }
  function pairs(records) {
    return [...new Set(records.map(r=>r.day))].sort().reverse().map(day=>({day,morning:records.find(r=>r.day===day&&r.slot==='morning'),evening:records.find(r=>r.day===day&&r.slot==='evening')}));
  }
  return {metrics,today,plus,monday,valid,prune,save,pairs};
});
