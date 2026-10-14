/* Shared photo wrist placement for the catalog, personal collection and photo editor. */
(function(){'use strict';
window.WatchFit={create:function(o){
 var serial=0,anchor=null,marks=null;
 function status(s){o.status.textContent=s;}
 function cancel(){serial++;o.button.disabled=false;}
 function dimensions(){var im=o.photo(),k=Math.min(o.width/im.width,o.height/im.height);return {k:k,x:(o.width-im.width*k)/2,y:(o.height-im.height*k)/2};}
 function place(g){
  anchor=g;var tx=o.tx(),img=o.watch();tx.x=g.x;tx.y=g.y;tx.r=g.angle;
  if(img&&(img.naturalWidth||img.width)>0){
   var p=window.WatchReal&&WatchReal.prepare(img),height=p?200*(p.bot-p.top)*p.h/p.w:200*(img.naturalHeight||img.height)/(img.naturalWidth||img.width)*.4;
   tx.s=Math.max(.25,Math.min(2.5,g.width*.55/Math.max(20,height)));
  }
  o.defaults();o.sync();o.draw();
 }
 async function detect(){
  var photo=o.photo();if(!photo){status('Сначала загрузите фото руки.');return;}
  cancel();marks=null;anchor=null;var id=serial;o.button.disabled=true;
  status('Определяем запястье… При первом запуске загружается модуль распознавания.');
  var timer;
  try{
   if(!window.WristDetection)throw Error('module');
   var g=await Promise.race([WristDetection.detect(photo),new Promise(function(_,reject){timer=setTimeout(function(){reject(Error('timeout'));},20000);})]);
   if(id!==serial||photo!==o.photo())return;
   if(!g){status('Не удалось уверенно определить запястье. Нажмите «Указать запястье» и отметьте два его края.');return;}
   var d=dimensions();place({x:d.x+g.x*d.k,y:d.y+g.y*d.k,width:g.width*d.k,angle:g.angle});
   status('Запястье найдено. Положение, угол и размер подогнаны автоматически. При необходимости уточните пальцами.');
  }catch(e){if(id===serial)status('Распознавание недоступно. Нажмите «Указать запястье»: два касания подгонят размер и угол.');}
  finally{clearTimeout(timer);if(id===serial)o.button.disabled=false;}
 }
 document.querySelectorAll('input[type=range]').forEach(function(el){el.addEventListener('input',cancel);});
 o.button.onclick=detect;
 o.mark.onclick=function(){if(!o.photo()){status('Сначала загрузите фото руки.');return;}cancel();o.lock();marks=[];status('Коснитесь двух противоположных краёв запястья там, где будет браслет.');};
 return {photoLoaded:function(){cancel();anchor=null;marks=null;o.defaults();detect();},detect:detect,cancel:cancel,
  hide:function(){cancel();marks=null;},
  changed:function(){if(anchor)place(anchor);},
  point:function(p){if(!marks){cancel();return false;}marks.push(p);if(marks.length===1){status('Теперь коснитесь противоположного края запястья.');return true;}
   var a=marks[0],b=marks[1],width=Math.hypot(b.x-a.x,b.y-a.y);marks=null;
   if(width<25){status('Точки слишком близко. Нажмите «Указать запястье» ещё раз.');return true;}
   place({x:(a.x+b.x)/2,y:(a.y+b.y)/2,width:width,angle:Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI-90});
   status('Посадка настроена по двум точкам. Свет и тень подобраны автоматически.');return true;
  }};
}};
})();
