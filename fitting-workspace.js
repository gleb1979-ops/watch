(function(){'use strict';
function init(){
 var section=document.querySelector('#v-try')||document.querySelector('#v-tryon'),cv=section&&section.querySelector('canvas'),stage=cv&&cv.parentElement;
 var last=null;
 function size(){if(!stage||!document.body.classList.contains('fitting-workspace'))return;var width=Math.max(1,Math.min(stage.clientWidth,stage.clientHeight*.75));cv.style.width=width+'px';cv.style.height=width/ .75+'px';}
 function update(){var active=!!section&&!section.hidden;document.body.classList.toggle('fitting-workspace',active);if(last!==active&&window.parent!==window){parent.postMessage({type:'watch-workspace',active:active},location.origin);}last=active;requestAnimationFrame(size);}
 if(section){new MutationObserver(update).observe(section,{attributes:true,attributeFilter:['hidden']});new ResizeObserver(size).observe(stage);window.addEventListener('resize',size);update();}
 var frame=document.querySelector('#catalogFrame');
 if(frame){window.addEventListener('message',function(e){if(e.origin!==location.origin||e.source!==frame.contentWindow||!e.data||e.data.type!=='watch-workspace')return;document.body.classList.toggle('embedded-fitting',e.data.active===true);});
 window.addEventListener('hashchange',function(){if(!['#catalog','#cabinet'].includes(location.hash))document.body.classList.remove('embedded-fitting');});}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();