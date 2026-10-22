'use strict';
// This file is loaded only by demonstration pages. No browser storage or requests.
window.ITO_DEMO = {
  toolbar(){return `<div class="demo-bar"><div><span class="pill green">ДЕМО</span><strong>Учебный отдел · вымышленные данные</strong><small>Изменения действуют до перезагрузки. Рабочая база не подключена.</small></div><a class="btn ghost" href="index.html">← К презентации</a><button class="btn ghost" type="button" onclick="location.reload()">Сбросить демо</button></div>`;},
  summary(){
    const current_week=ITO.monday(ITO.today());
    return {current_week,min_browsers:5,weeks:Array.from({length:4},(_,i)=>{
      const week=ITO.plus(current_week,-7*(4-i));
      const slots=Object.fromEntries(['morning','evening'].map(slot=>[slot,{status:'published',browsers:6,responses:24,means:{wellbeing:(slot==='morning'?[3.4,3.6,3.8,4]:[3,3.2,3.4,3.7])[i],energy:3.1,calm:3.6,context:slot==='morning'?4:3.3}}]));
      if(i===1)slots.evening={status:'insufficient'};
      return {week,slots};
    })};
  },
  diary(){
    const today=Diary.today();
    return Array.from({length:6},(_,i)=>{
      const d=new Date(today+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-i-1);
      return ['morning','evening'].map(slot=>({day:d.toISOString().slice(0,10),slot,wellbeing:slot==='morning'?4:3,energy:3,calm:4,context:slot==='morning'?4:3}));
    }).flat();
  }
};
