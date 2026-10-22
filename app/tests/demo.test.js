const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assets=path.resolve(__dirname,'../../docs/assets');

function sandbox(page='overview'){
  const elements=new Map(),listeners={};
  const element=id=>{if(!elements.has(id))elements.set(id,{id,innerHTML:'',href:'',className:'',textContent:'',addEventListener(type,fn){listeners[id+':'+type]=fn;},focus(){},insertAdjacentHTML(_,html){this.innerHTML+=html;}});return elements.get(id);};
  const context={console,Date,Intl,URL,Map,Set,setTimeout,clearTimeout,
    location:{hash:'#'+page,protocol:'https:',pathname:'/repository/app.html',origin:'https://example.test'},
    document:{body:{dataset:{mode:'demo'}},getElementById:element,addEventListener(){},querySelector(){return null;}},
    localStorage:{getItem(){throw Error('Storage read forbidden in demo');},setItem(){throw Error('Storage write forbidden in demo');}},
    fetch(){throw Error('Network forbidden in demo');},
    addEventListener(){},scrollTo(){},history:{length:1},confirm(){return true;},
    PulseInsights:{render(){return '<div>demo chart</div>';}}
  };
  context.window=context;vm.createContext(context);
  const run=name=>vm.runInContext(fs.readFileSync(path.join(assets,name),'utf8'),context,{filename:name});
  return {context,element,listeners,run};
}

test('demo app renders and edits in memory without storage or API access',async()=>{
  const t=sandbox();for(const f of ['seed.js','core.js','demo-support.js','wellbeing-dashboard.js','app.js'])t.run(f);
  assert.match(t.element('app').innerHTML,/Учебный отдел/);
  assert.doesNotMatch(t.element('app').innerHTML,/Не удалось открыть данные/);
  await vm.runInContext("persist(ITO.clone(S))",t.context);
  await assert.rejects(vm.runInContext("api('state')",t.context),/не подключена/);
  await assert.rejects(vm.runInContext("previewRestore({})",t.context),/отключено/);
  await assert.rejects(vm.runInContext("previewImport({})",t.context),/отключён/);
  vm.runInContext("go('exchange')",t.context);
  assert.match(t.element('app').innerHTML,/Импорт и восстановление.*отключены/);
});

test('demo diary never reads or writes the personal browser diary',()=>{
  const t=sandbox();for(const f of ['wellbeing-core.js','wellbeing-analysis.js','demo-support.js','checkin.js'])t.run(f);
  assert.match(t.element('diary').innerHTML,/Учебный отдел/);
  assert.doesNotMatch(t.element('diary').innerHTML,/Дневник не открыт/);
  assert.equal(vm.runInContext('readRecords().length',t.context),12);
  vm.runInContext('writeRecords([]);render()',t.context);
  assert.equal(vm.runInContext('readRecords().length',t.context),0);
  assert.equal(t.element('diary-home').href,'index.html');
  assert.equal(vm.runInContext('online',t.context),false);
});

test('published example has only allowed summary slices',()=>{
  const t=sandbox();for(const f of ['core.js','wellbeing-analysis.js','demo-support.js'])t.run(f);
  const data=vm.runInContext('ITO_DEMO.summary()',t.context);
  assert.equal(data.weeks.length,4);
  assert.ok(data.weeks.every(w=>w.week<data.current_week));
  const summary=vm.runInContext('PulseAnalysis.team(ITO_DEMO.summary(),4)',t.context);
  assert.equal(summary.coverage,7);assert.equal(summary.count,168);
});
