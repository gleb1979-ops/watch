(function(){'use strict';
function init(){
 var section=document.querySelector('#v-try')||document.querySelector('#v-tryon'),cv=section&&section.querySelector('canvas'),stage=cv&&cv.parentElement;
 var last=null;
 if(section&&stage){
  var panel=section.querySelector('.panel'),dock=document.createElement('div'),toggle=document.createElement('button');
  dock.className='fitting-dock';toggle.type='button';toggle.className='btn fitting-settings';toggle.setAttribute('aria-expanded','false');
  function label(){var lang=document.documentElement.lang||'ru';toggle.textContent=lang==='he'?'הגדרות ושעונים':lang==='en'?'Settings & watches':'Настройки и часы';}
  label();new MutationObserver(label).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  if(panel){panel.id=panel.id||'fittingControls';toggle.setAttribute('aria-controls',panel.id);panel.inert=true;}
  toggle.onclick=function(){var open=section.classList.toggle('controls-open');toggle.setAttribute('aria-expanded',String(open));if(panel)panel.inert=!open;};
  var actions=section.querySelector('.photo-actions');if(actions)dock.appendChild(actions);dock.appendChild(toggle);section.appendChild(dock);
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&section.classList.contains('controls-open'))toggle.click();});
 }

 function size(){if(!stage||!document.body.classList.contains('fitting-workspace'))return;var width=Math.max(1,Math.min(stage.clientWidth,stage.clientHeight*.75));cv.style.width=width+'px';cv.style.height=width/ .75+'px';}
 function update(){var active=!!section&&!section.hidden;document.body.classList.toggle('fitting-workspace',active);if(last!==active&&window.parent!==window){parent.postMessage({type:'watch-workspace',active:active},location.origin);}last=active;requestAnimationFrame(size);}
 if(section){new MutationObserver(update).observe(section,{attributes:true,attributeFilter:['hidden']});new ResizeObserver(size).observe(stage);window.addEventListener('resize',size);update();}
 var frame=document.querySelector('#catalogFrame');
 if(frame){window.addEventListener('message',function(e){if(e.origin!==location.origin||e.source!==frame.contentWindow||!e.data||e.data.type!=='watch-workspace')return;document.body.classList.toggle('embedded-fitting',e.data.active===true);});
 window.addEventListener('hashchange',function(){if(!['#catalog','#cabinet'].includes(location.hash))document.body.classList.remove('embedded-fitting');});}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
