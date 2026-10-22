/* Descriptive summaries only: no identity, diagnosis, network, or KPI linkage. */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PulseAnalysis = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  const metrics=['wellbeing','energy','calm','context'];
  const slots=['morning','evening'];
  const date=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&!isNaN(Date.parse(x))&&new Date(x).toISOString().slice(0,10)===x;
  const plus=(d,n)=>{const t=new Date(d+'T12:00:00Z');t.setUTCDate(t.getUTCDate()+n);return t.toISOString().slice(0,10);};
  const mean=xs=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null;
  function aggregate(rows) {
    const count=rows.reduce((n,r)=>n+r.count,0);
    return {count,means:Object.fromEntries(metrics.map(k=>[k,count?rows.reduce((n,r)=>n+r.means[k]*r.count,0)/count:null]))};
  }
  function personal(records, days, end) {
    if(![7,14,28].includes(days)||!date(end))throw Error('Некорректный период дневника');
    const start=plus(end,1-days), unique=new Map();
    for(const r of records)if(r&&date(r.day)&&r.day>=start&&r.day<=end&&slots.includes(r.slot)&&metrics.every(k=>Number.isInteger(r[k])&&r[k]>=1&&r[k]<=5))unique.set(r.day+r.slot,r);
    const rows=[...unique.values()];
    const bySlot=Object.fromEntries(slots.map(slot=>{
      const rs=rows.filter(r=>r.slot===slot);
      return [slot,{...aggregate(rs.map(r=>({count:1,means:r}))),coverage:rs.length}];
    }));
    const points=Array.from({length:days},(_,i)=>{
      const day=plus(start,i);return {date:day,...Object.fromEntries(slots.map(slot=>[slot,unique.get(day+slot)?.wellbeing??null]))};
    });
    const paired=points.filter(p=>p.morning!==null&&p.evening!==null);
    return {kind:'personal',start,end,span:days,count:rows.length,coverage:new Set(rows.map(r=>r.day)).size,
      overall:mean(rows.map(r=>r.wellbeing)),slots:bySlot,points,
      paired:{count:paired.length,delta:mean(paired.map(p=>p.evening-p.morning))}};
  }
  function team(data, weeks) {
    const current=data.current_week;
    if(![1,4,12].includes(weeks)||!date(current)||new Date(current+'T12:00:00Z').getUTCDay()!==1)throw Error('Некорректный период сводки');
    const start=plus(current,-7*weeks), end=plus(current,-1), unique=new Map();
    const minimum=Math.max(5,Number(data.minimum_browsers)||5);
    for(const w of data.weeks||[])if(w&&date(w.week)&&w.week>=start&&w.week<current&&new Date(w.week+'T12:00:00Z').getUTCDay()===1)unique.set(w.week,w);
    const valid=s=>s?.status==='published'&&Number.isInteger(s.responses)&&s.responses>0&&Number.isInteger(s.browsers)&&s.browsers>=minimum&&metrics.every(k=>Number.isFinite(s.means?.[k])&&s.means[k]>=1&&s.means[k]<=5);
    const points=Array.from({length:weeks},(_,i)=>{
      const day=plus(start,i*7),w=unique.get(day);
      return {date:day,...Object.fromEntries(slots.map(slot=>[slot,valid(w?.slots?.[slot])?w.slots[slot].means.wellbeing:null]))};
    });
    const bySlot=Object.fromEntries(slots.map(slot=>{
      const rows=[...unique.values()].map(w=>w.slots?.[slot]).filter(valid).map(s=>({count:s.responses,means:s.means}));
      return [slot,{...aggregate(rows),coverage:rows.length}];
    }));
    const count=slots.reduce((n,s)=>n+bySlot[s].count,0),coverage=slots.reduce((n,s)=>n+bySlot[s].coverage,0);
    return {kind:'team',start,end,span:weeks,count,coverage,slots:bySlot,points,
      overall:count?slots.reduce((n,s)=>n+(bySlot[s].means.wellbeing??0)*bySlot[s].count,0)/count:null};
  }
  function suggestions(summary) {
    const team=summary.kind==='team';
    const actions=team?{
      energy:'Обсудить объём параллельной работы и возможность перераспределить ближайшие задачи.',
      calm:'Обсудить переключения, конфликтующие приоритеты и доступность помощи.',
      morning_context:'Уточнить первую задачу дня, критерий готовности и ожидаемые исходные данные.',
      evening_context:'Обсудить, что помогло или помешало завершить день, и выбрать одно изменение процесса.'
    }:{
      energy:'Посмотреть, можно ли уменьшить число параллельных задач и предусмотреть паузу.',
      calm:'Выбрать один ближайший приоритет и при необходимости попросить помощи с остальными.',
      morning_context:'Перед началом дня записать первую задачу и понятный признак её завершения.',
      evening_context:'Отметить для себя, что помогло и что мешало дню; выбрать одно небольшое изменение на завтра.'
    };
    return slots.map(slot=>{
      const s=summary.slots[slot];
      // A practical display minimum, not a clinical or statistical threshold.
      if(s.coverage<(team?2:3))return {slot,ready:false};
      const candidates=['energy','calm','context'].map(key=>({key,value:s.means[key]}));
      const low=Math.min(...candidates.map(c=>c.value)), high=Math.max(...candidates.map(c=>c.value));
      if(Math.abs(high-low)<0.05)return {slot,ready:true,balanced:true,action:team?'Спросить команду, какое условие работы стоит сохранить и какое — улучшить.':'Выбрать одно условие, которое хочется сохранить в следующем дне.'};
      const selected=candidates.filter(c=>Math.abs(c.value-low)<0.05);
      return {slot,ready:true,items:selected.map(c=>({...c,action:actions[c.key==='context'?slot+'_context':c.key]}))};
    });
  }
  function trends(summary) {
    return slots.map(slot=>{
      const filled=summary.points.filter(p=>p[slot]!==null);
      if(filled.length<2)return {slot,ready:false};
      const first=filled[0],last=filled.at(-1);
      return {slot,ready:true,first:{date:first.date,value:first[slot]},last:{date:last.date,value:last[slot]},change:last[slot]-first[slot]};
    });
  }
  return {personal,team,suggestions,trends};
});
