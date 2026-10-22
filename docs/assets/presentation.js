'use strict';
const summary=ITO.metrics(ITO.validate(ITO.normalize(window.ITO_SEED)),'2026-10-12');
const number=(n,d=1)=>n.toLocaleString('ru-RU',{maximumFractionDigits:d});
document.getElementById('capacity').textContent=number(summary.capacity);
document.getElementById('plan').textContent=number(summary.plan)+' ч';
document.getElementById('load').innerHTML=number(summary.load)+'<span>%</span>';
document.getElementById('completion').innerHTML=number(summary.completion)+'<small>%</small>';
document.getElementById('ratio').innerHTML=number(summary.ratio,2)+'<small>×</small>';
document.getElementById('quality').innerHTML=number(summary.quality)+'<small>%</small>';
document.getElementById('print').addEventListener('click',()=>window.print());
const observer=new IntersectionObserver(entries=>{
  const visible=entries.filter(x=>x.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];
  if(!visible)return;
  document.querySelectorAll('.section-nav a').forEach(a=>{if(a.hash==='#'+visible.target.id)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');});
},{rootMargin:'-15% 0px -45% 0px',threshold:[0,.2,.5]});
document.querySelectorAll('section[id]').forEach(s=>observer.observe(s));
