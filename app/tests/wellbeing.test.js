const test=require('node:test');
const assert=require('node:assert/strict');
const Diary=require('../static/wellbeing-core.js');
const record={day:'2026-10-22',slot:'morning',wellbeing:2,energy:3,calm:4,context:5};
test('only complete integer scores and today may be saved',()=>{
  for(const bad of [{wellbeing:0},{energy:6},{calm:1.5},{context:null},{slot:'night'},{day:'2026-10-21'}])
    assert.throws(()=>Diary.save([],{...record,...bad},'2026-10-22'));
  assert.equal(Diary.save([],record,'2026-10-22').length,1);
});
test('personal edit replaces slot; sent marks are immutable',()=>{
  let records=Diary.save([],record,'2026-10-22');
  records=Diary.save(records,{...record,wellbeing:5},'2026-10-22');
  assert.equal(records.length,1);assert.equal(records[0].wellbeing,5);
  assert.throws(()=>Diary.save([{...record,shared:true}],record,'2026-10-22'));
});
test('28 calendar days retained, gaps never become zero or paired changes',()=>{
  const records=Diary.prune([{...record,day:'2026-09-24'},{...record,day:'2026-09-25'},record,{...record,day:'2026-10-23'}],'2026-10-22');
  assert.equal(records.length,2);
  assert.equal(Diary.pairs(records)[0].evening,undefined);
  assert.equal(Diary.monday('2026-10-25'),'2026-10-19');
  assert.equal(Diary.monday('2026-10-26'),'2026-10-26');
});
