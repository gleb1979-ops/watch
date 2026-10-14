(function(){'use strict';
function init(){
 var section=document.querySelector('#v-try')||document.querySelector('#v-tryon'),cv=section&&section.querySelector('canvas'),stage=cv&&cv.parentElement;
 var last=null;
 if(section&&stage){
  var panel=section.querySelector('.panel'),actions=section.querySelector('.photo-actions');
  if(panel&&actions)panel.insertBefore(actions,panel.firstChild);
 }

 function size(){
  if(!stage||!document.body.classList.contains('fitting-workspace'))return;
  var grid=section.querySelector('.try-grid');
  if(grid){var portrait=window.innerWidth<900&&!(window.innerHeight<500&&window.innerWidth>window.innerHeight);
   if(portrait){var preview=Math.max(1,Math.min(grid.clientWidth/ .75,grid.clientHeight-110));grid.style.gridTemplateRows=preview+'px minmax(0,1fr)';}
   else grid.style.gridTemplateRows='';
  }
  var width=Math.max(1,Math.min(stage.clientWidth,stage.clientHeight*.75));cv.style.width=width+'px';cv.style.height=width/ .75+'px';
 }
 function update(){var active=!!section&&!section.hidden;document.body.classList.toggle('fitting-workspace',active);if(last!==active&&window.parent!==window){parent.postMessage({type:'watch-workspace',active:active},location.origin);}last=active;requestAnimationFrame(size);}
 if(section){new MutationObserver(update).observe(section,{attributes:true,attributeFilter:['hidden']});var resize=new ResizeObserver(size);resize.observe(stage);resize.observe(section.querySelector('.try-grid')); window.addEventListener('resize',size);update();}
 var frame=document.querySelector('#catalogFrame');
 if(frame){window.addEventListener('message',function(e){if(e.origin!==location.origin||e.source!==frame.contentWindow||!e.data||e.data.type!=='watch-workspace')return;document.body.classList.toggle('embedded-fitting',e.data.active===true);});
 window.addEventListener('hashchange',function(){if(!['#catalog','#cabinet'].includes(location.hash))document.body.classList.remove('embedded-fitting');});}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

