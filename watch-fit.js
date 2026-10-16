/* Shared photo wrist placement for the catalog, personal collection and photo editor. */
(function(){'use strict';
window.WatchFit={create:function(o){
 var serial=0,anchor=null,marks=null,manualFactor=1,baseScale=1;
 function busy(value){o.button.disabled=value;o.button.setAttribute&&o.button.setAttribute('aria-busy',String(value));var lang=document.documentElement&&document.documentElement.lang||'ru';o.button.textContent=value?(lang==='he'?'מחפשים את פרק כף היד…':lang==='en'?'Finding wrist…':'Ищем запястье…'):(lang==='he'?'התאמה אוטומטית':lang==='en'?'Automatic fit':'Автоматическая посадка');}
 function status(s){o.status.textContent=s;}
 function cancel(){serial++;busy(false);}
 function dimensions(){var im=o.photo(),k=Math.min(o.width/im.width,o.height/im.height);return {k:k,x:(o.width-im.width*k)/2,y:(o.height-im.height*k)/2};}
 function caseDiameter(){
  var item=o.item&&o.item(),name=item&&item.name||'';
  // Optional structured diameter for future watches; names such as "Daytona 40mm" also work.
  var mm=Number(item&&(item.diameterMm||item.caseDiameterMm));
  if(!(mm>=20&&mm<=65)){var m=name.match(/(?:^|[^\d])(\d{2}(?:[.,]\d)?)\s*mm\b/i);mm=m?Number(m[1].replace(',','.')):40;}
  return mm>=20&&mm<=65?mm:40;
 }
 function place(g){
  anchor=g;
  var tx=o.tx(),img=o.watch();
  tx.x=g.x;tx.y=g.y;tx.r=g.angle;
  if(img&&(img.naturalWidth||img.width)>0){
   var p=window.WatchReal&&WatchReal.prepare(img);
   // The front-view case diameter corresponds to the case WIDTH, not its vertical height.
   // It is independent of how tightly the original watch image was cropped.
   var caseWidth=p?200*p.caseW:200;
   var wristWidth=Math.max(25,g.width);
   // Calibrated against the detected palm-to-wrist estimate: the earlier 62mm
   // reference systematically undersized watch cases on real wrist photos.
   // The wrist width is measured from this user's own image, never from sex or demographic averages.
   var calibrated=Number(o.wristMm&&o.wristMm());
   var referenceMm=calibrated>=25&&calibrated<=110?calibrated:50;
   var paperScale=Number(o.paperScale&&o.paperScale(g.x,g.y));
   // A4 gives photo pixels/mm. Otherwise use measured wrist width or the photo estimate.
   var desired=(paperScale>0&&Number.isFinite(paperScale)?paperScale*caseDiameter():wristWidth*(caseDiameter()/referenceMm));
   baseScale=desired/Math.max(40,caseWidth);
   tx.s=Math.max(.15,Math.min(12,baseScale*manualFactor));
   if(o.report)o.report({mode:paperScale>0?'A4':'estimate',pxPerMm:paperScale,diameterMm:caseDiameter(),targetPx:desired,renderPx:caseWidth*tx.s});
  }
  o.sync();o.draw();
 }
 async function detect(){
  var photo=o.photo();if(!photo){status('Сначала загрузите фото руки.');return;}
  cancel();marks=null;anchor=null;var id=serial;busy(true);
  status('Определяем запястье… При первом запуске загружается модуль распознавания.');
  var timer;
  try{
   if(!window.WristDetection)throw Error('module');
   var g=await Promise.race([WristDetection.detect(photo),new Promise(function(_,reject){timer=setTimeout(function(){reject(Error('timeout'));},20000);})]);
   if(id!==serial||photo!==o.photo())return;
   if(!g){status('Не удалось уверенно определить запястье. Для автоматической посадки снимите руку целиком, включая пальцы. Или нажмите «Указать запястье» и отметьте два края.');return;}
   var d=dimensions();place({x:d.x+g.x*d.k,y:d.y+g.y*d.k,width:g.width*d.k,angle:g.angle});
   status('Запястье найдено. Положение, угол и размер подогнаны автоматически. При необходимости уточните пальцами.');
  }catch(e){if(id===serial)status('Распознавание недоступно. Нажмите «Указать запястье»: два касания подгонят размер и угол.');}
  finally{clearTimeout(timer);if(id===serial)busy(false);}
 }
 document.querySelectorAll('input[type=range]').forEach(function(el){el.addEventListener('input',cancel);});
 o.button.onclick=detect;
 o.mark.onclick=function(){if(!o.photo()){status('Сначала загрузите фото руки.');return;}cancel();o.lock();marks=[];status('Коснитесь двух противоположных краёв запястья там, где будет браслет.');};
 return {photoLoaded:function(){cancel();anchor=null;marks=null;manualFactor=1;o.defaults();detect();},detect:detect,cancel:cancel,
  live:function(g){if(!g)return false;marks=null;place(g);return true;},
  hide:function(){cancel();marks=null;},
  changed:function(){if(anchor)place(anchor);},
  manualUpdated:function(){var t=o.tx();if(anchor){anchor.x=t.x;anchor.y=t.y;anchor.angle=t.r;manualFactor=baseScale>0?t.s/baseScale:1;}},
  point:function(p){if(!marks){cancel();return false;}marks.push(p);if(marks.length===1){status('Теперь коснитесь противоположного края запястья.');return true;}
   var a=marks[0],b=marks[1],width=Math.hypot(b.x-a.x,b.y-a.y);marks=null;
   if(width<25){status('Точки слишком близко. Нажмите «Указать запястье» ещё раз.');return true;}
   place({x:(a.x+b.x)/2,y:(a.y+b.y)/2,width:width,angle:Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI-90});
   status('Посадка настроена по двум точкам. Свет и тень подобраны автоматически.');return true;
  }};
}};
})();

