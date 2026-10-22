const test=require('node:test');
const assert=require('node:assert/strict');
const A=require('../static/wellbeing-analysis.js');
const record=(day,slot,wellbeing,extra={})=>({day,slot,wellbeing,energy:3,calm:4,context:5,...extra});
const published=(value,n=5,browsers=5)=>({status:'published',responses:n,browsers,means:{wellbeing:value,energy:2,calm:4,context:5}});
test('private periods exclude missing, future and invalid days without replacing them by zero',()=>{
  const r=A.personal([record('2026-10-16','morning',1),record('2026-10-22','morning',5),record('2026-10-15','morning',1),record('2026-10-23','morning',1),record('2026-02-30','morning',2),record('2026-10-21','morning',0)],7,'2026-10-22');
  assert.equal(r.start,'2026-10-16');assert.equal(r.count,2);assert.equal(r.coverage,2);assert.equal(r.overall,3);
  assert.equal(r.points[1].morning,null);assert.equal(r.slots.evening.means.wellbeing,null);
});
test('overall uses wellbeing alone and paired change uses only complete matching days',()=>{
  const r=A.personal([record('2026-10-20','morning',2),record('2026-10-20','evening',4),record('2026-10-21','evening',5)],7,'2026-10-22');
  assert.equal(r.overall,11/3);assert.deepEqual(r.paired,{count:1,delta:2});
  assert.equal(r.slots.morning.means.context,5);
});
test('duplicate personal slots contribute once and latest saved version wins',()=>{
  const r=A.personal([record('2026-10-22','morning',1),record('2026-10-22','morning',5)],7,'2026-10-22');
  assert.equal(r.count,1);assert.equal(r.overall,5);assert.equal(A.suggestions(r)[0].ready,false);
});
test('team weights by response counts, excludes current week and concealed or undersized slices',()=>{
  const r=A.team({current_week:'2026-10-19',minimum_browsers:5,weeks:[
    {week:'2026-10-05',slots:{morning:published(1,5),evening:{status:'insufficient',responses:100,means:published(5).means}}},
    {week:'2026-10-12',slots:{morning:published(5,15),evening:published(5,40,4)}},
    {week:'2026-10-19',slots:{morning:published(1,100)}},
    {week:'2026-09-14',slots:{morning:published(1,100)}}
  ]},4);
  assert.equal(r.count,20);assert.equal(r.overall,4);assert.equal(r.coverage,2);
  assert.equal(r.slots.evening.means.wellbeing,null);assert.equal(r.points[0].morning,null);
  assert.equal(r.points[3].morning,5);assert.equal(r.paired,undefined);
});
test('no published observations produce no score, interpretation or people count',()=>{
  const r=A.team({current_week:'2026-10-19',weeks:[]},12);
  assert.equal(r.overall,null);assert.equal(r.count,0);assert.equal(r.points.length,12);
  assert.ok(A.suggestions(r).every(x=>!x.ready));assert.equal(r.browsers,undefined);
});
test('suggestions keep morning clarity and evening day experience separate',()=>{
  const records=['2026-10-20','2026-10-21','2026-10-22'].flatMap(day=>['morning','evening'].map(slot=>record(day,slot,3,{context:1})));
  const advice=A.suggestions(A.personal(records,7,'2026-10-22'));
  assert.match(advice[0].items[0].action,/первую задачу/);
  assert.match(advice[1].items[0].action,/помогло/);
  const fewer=A.suggestions(A.personal(records.slice(0,4),7,'2026-10-22'));
  assert.ok(fewer.every(x=>!x.ready));
});
test('endpoint comparison uses available dates across gaps and never invents a second observation',()=>{
  const s=A.personal([record('2026-10-17','morning',2),record('2026-10-21','morning',4),record('2026-10-22','evening',1)],7,'2026-10-22');
  const [am,pm]=A.trends(s);
  assert.equal(am.first.date,'2026-10-17');assert.equal(am.last.date,'2026-10-21');assert.equal(am.change,2);
  assert.equal(pm.ready,false);
});
