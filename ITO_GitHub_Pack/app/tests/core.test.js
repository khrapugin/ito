const {test} = require('node:test');
const assert = require('node:assert/strict');
const C = require('../static/core.js');
const pilot = require('../static/seed.json');
function fixture(){
  return C.normalize({people:[{id:'E',name:'Инженер',weekly:40,active:1},{id:'X',name:'Вне состава',weekly:0,active:0}],projects:[{id:'P',name:'Проект'}],operations:[{id:'O',name:'Операция',norm:8}],tasks:[{id:'T',title:'Результат',project_id:'P',operation_id:'O',planned:8,qty:1,accepted:0}],assignments:[{id:1,task_id:'T',person_id:'E',week:'2026-10-19',hours:8}]});
}
const accept=(s,extra={})=>C.apply(s,'accept',{task_id:'T',day:'2026-10-21',result:'Протокол проверен',accepted_by:'Руководитель',actual_complete:true,quality_reviewed:true,...extra});
const fact=(s,id,day,hours,kind='work')=>C.apply(s,'save',{table:'actuals',record:{id,task_id:'T',person_id:'E',day,hours,kind,reason:kind==='loss'?'Ожидание ТЗ':''}});

test('synthetic example has consistent weighted results',()=>{
  const m=C.metrics(C.validate(C.normalize(pilot)),'2026-10-12');
  assert.equal(m.capacity,240);assert.equal(m.plan,216);assert.equal(m.load,90);
  assert.equal(m.done,124);assert.equal(m.original,216);assert.equal(m.ratio,124/128);
  assert.equal(m.quality,92/124*100);assert.equal(m.overloaded.length,2);
});

test('snapshot denominator and original task estimate survive plan changes',()=>{
  let s=C.apply(fixture(),'freeze',{week:'2026-10-19'});
  s=C.apply(s,'save',{table:'assignments',record:{...s.assignments[0],hours:14}});
  s=C.apply(s,'save',{table:'tasks',record:{...s.tasks[0],planned:14}});
  s=fact(s,'A','2026-10-21',10);s=accept(s);
  const m=C.metrics(s,'2026-10-19');assert.equal(m.original,8);assert.equal(m.totalPlan,14);assert.equal(m.done,8);assert.equal(m.completion,100);assert.equal(m.ratio,.8);assert.equal(m.deviation,25);assert.equal(m.quality,100);
  assert.equal(s.events[0].current_plan,14);assert.equal(s.events[0].planned_hours,8);
  assert.throws(()=>C.apply(s,'freeze',{week:'2026-10-19'}),/зафиксирован/);
});
test('accepted full-task hours include prior weeks, unrelated unfinished work is excluded',()=>{
  let s=fixture();s=fact(s,'A','2026-10-12',4);s=fact(s,'B','2026-10-20',6);
  s=C.apply(s,'save',{table:'tasks',record:{...s.tasks[0],id:'T2',title:'Не завершено'}});
  s=C.apply(s,'save',{table:'actuals',record:{id:'C',task_id:'T2',person_id:'E',day:'2026-10-20',hours:50,kind:'work'}});
  s=accept(s);const m=C.metrics(s,'2026-10-19');assert.equal(m.totalFact,56);assert.equal(m.actualDone,10);assert.equal(m.ratio,.8);
  assert.equal(C.metrics(s,'2026-10-12').accepted.length,0);assert.equal(C.metrics(s,'2026-10-26').ratio,null);
});
test('incomplete actuals on any accepted task suppress the coefficient',()=>{
  let s=fixture();s=fact(s,'A','2026-10-20',4);s=accept(s,{actual_complete:false});
  assert.equal(C.metrics(s,'2026-10-19').ratio,null);assert.equal(C.metrics(s,'2026-10-19').deviation,null);
});
test('rework lowers first-pass quality, unknown quality is not zero',()=>{
  let s=fact(fixture(),'A','2026-10-20',3,'rework');s=accept(s);assert.equal(C.metrics(s,'2026-10-19').quality,0);
  s=accept(fact(fixture(),'A','2026-10-20',3),{quality_reviewed:false});assert.equal(C.metrics(s,'2026-10-19').quality,null);
});
test('multiple assignments never double-count accepted actuals',()=>{
  let s=fixture();s=C.apply(s,'save',{table:'assignments',record:{id:2,task_id:'T',person_id:'E',week:'2026-10-19',hours:2}});
  s=C.apply(s,'freeze',{week:'2026-10-19'});s=accept(fact(s,'A','2026-10-20',5));const m=C.metrics(s,'2026-10-19');assert.equal(m.original,10);assert.equal(m.actualDone,5);assert.equal(m.ratio,1.6);
});
test('reopen is append-only and later events preserve the earlier weekly report',()=>{
  let s=fixture();s=fact(s,'A','2026-10-12',4);s=accept(s,{day:'2026-10-13'});
  assert.throws(()=>fact(s,'B','2026-10-21',1),/верните/);
  s=C.apply(s,'reopen',{task_id:'T',day:'2026-10-20',result:'Новая проверка'});
  assert.equal(s.events.length,2);assert.equal(C.metrics(s,'2026-10-12').ratio,2);assert.equal(C.metrics(s,'2026-10-19').accepted.length,0);
});
test('bad dates, negative hours, orphan references and missing loss reasons are rejected',()=>{
  assert.throws(()=>fact(fixture(),'A','2026-02-30',4),/дату/);
  assert.throws(()=>fact(fixture(),'A','2026-10-20',-4),/неотрицательными/);
  assert.throws(()=>C.apply(fixture(),'save',{table:'actuals',record:{id:1,task_id:'missing',person_id:'E',day:'2026-10-20',hours:1,kind:'work'}}),/соответствие/);
  assert.throws(()=>C.apply(fixture(),'save',{table:'actuals',record:{id:1,task_id:'T',person_id:'E',day:'2026-10-20',hours:1,kind:'loss'}}),/причину/);
  assert.throws(()=>C.apply(fixture(),'freeze',{week:'2026-10-20'}),/понедельник/);
});
test('zero capacity never becomes 40 and over-absence is clamped',()=>{
  let s=fixture();s.people[0].weekly=0;assert.equal(C.metrics(s,'2026-10-19').capacity,0);assert.equal(C.metrics(s,'2026-10-19').load,null);
  s.people[0].weekly=40;s.absences=[{id:1,person_id:'E',week:'2026-10-19',hours:60}];assert.equal(C.metrics(s,'2026-10-19').capacity,0);
});
test('no acceptance in future, before facts or without evidence',()=>{
  assert.throws(()=>accept(fixture(),{day:'2099-01-01'}),/будущем/);
  assert.throws(()=>accept(fixture(),{result:''}),/результат/);
  assert.throws(()=>accept(fixture()),/внесите часы/);
  assert.throws(()=>accept(fact(fixture(),'A','2026-10-22',4)),/раньше/);
});
test('new work after baseline stays outside commitment denominator',()=>{
  let s=C.apply(fixture(),'freeze',{week:'2026-10-19'});
  s=C.apply(s,'save',{table:'tasks',record:{...s.tasks[0],id:'NEW'}});
  s=C.apply(s,'save',{table:'assignments',record:{id:'A2',task_id:'NEW',person_id:'E',week:'2026-10-19',hours:12}});
  const m=C.metrics(s,'2026-10-19');assert.equal(m.original,8);assert.equal(m.totalPlan,20);assert.equal(m.newHours,12);
});
test('missing and future actual hours cannot masquerade as recorded time',()=>{
  assert.throws(()=>fact(fixture(),'A','2099-01-01',4),/будущем/);
  assert.throws(()=>C.apply(fixture(),'save',{table:'actuals',record:{id:1,task_id:'T',person_id:'E',day:'2026-10-20',kind:'work'}}),/числовое/);
});
test('backdated previous-week acceptance cannot fulfill this weeks commitment',()=>{
  let s=C.apply(fixture(),'freeze',{week:'2026-10-19'});
  s=fact(s,'A','2026-10-13',4);s=accept(s,{day:'2026-10-14'});
  assert.equal(C.metrics(s,'2026-10-19').done,0);
});
