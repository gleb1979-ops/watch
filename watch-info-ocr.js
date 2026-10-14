(function(){'use strict';
var library;
function parse(text){
 var lines=text.split(/\r?\n/).map(function(s){return s.trim();}).filter(Boolean);
 var priceRe=/(?:[$€£₪]\s*\d[\d.,]*(?:\s*(?:USD|EUR|GBP|ILS))?|\d[\d.,]*\s*(?:USD|EUR|GBP|ILS))/i;
 var at=lines.findIndex(function(s){return priceRe.test(s)&&!/(?:shipping|delivery|save|off|discount)/i.test(s);});
 var price=at>=0?(lines[at].match(priceRe)||[])[0]:'',before=lines.slice(Math.max(0,at-5),at);
 var clean=before.filter(function(s){return !/^(?:new season|new arrival|sale|exclusive|buy now|add to bag|estimated delivery|standard delivery|extra|watch edit)/i.test(s)&&s.length>2;});
 var brands=['Philipp Plein','Patek Philippe','Audemars Piguet','Richard Mille','TAG Heuer','Vacheron Constantin','Jaeger-LeCoultre','IWC','Rolex','Omega','Versace','Seiko','Citizen','Tissot','Casio','Longines','Cartier','Hublot','Breitling','Bulgari','Hamilton','Oris','Rado','Panerai'];
 var brand='',model='';
 clean.forEach(function(s){brands.forEach(function(b){if(s.toLowerCase().includes(b.toLowerCase()))brand=b;});});
 if(brand){var idx=clean.findIndex(function(s){return s.toLowerCase().includes(brand.toLowerCase());});model=clean.slice(idx+1).join(' ').replace(/^watch\s+/i,'').trim();}
 else if(clean.length>=2){brand=clean[clean.length-2];model=clean[clean.length-1].replace(/^watch\s+/i,'');}
 return {brand:brand.slice(0,40),name:model.slice(0,60),price:price};
}
function load(){
 if(window.Tesseract)return Promise.resolve(window.Tesseract);
 if(!library)library=new Promise(function(resolve,reject){var s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';s.onload=function(){resolve(window.Tesseract);};s.onerror=reject;document.head.appendChild(s);}).catch(function(e){library=null;throw e;});
 return library;
}
async function read(file){var w;try{var api=await load();w=await api.createWorker('eng');var result=await w.recognize(file);return parse(result.data.text);}finally{if(w)await w.terminate().catch(function(){});}}
window.WatchInfoOCR={parse:parse,read:read};
function init(){
 var btn=document.querySelector('#readWatchInfo'),file=document.querySelector('#fileWatchInfo'),status=document.querySelector('#watchInfoStatus');if(!btn)return;
 btn.onclick=function(){file.click();};
 file.onchange=async function(){
  var photo=this.files[0];this.value='';if(!photo)return;btn.disabled=true;status.textContent='Читаем данные со скриншота…';var worker;
  try{var api=await load();worker=await api.createWorker('eng');var result=await worker.recognize(photo);var fields=parse(result.data.text),count=0;
   [['inBrand','brand'],['inName','name'],['inPrice','price']].forEach(function(pair){if(fields[pair[1]]){document.getElementById(pair[0]).value=fields[pair[1]];count++;}});
   status.textContent=count?'Данные заполнены. Проверьте бренд, модель, цену и валюту перед сохранением.':'Не удалось прочитать данные. Используйте чёткий скриншот с названием и ценой.';
  }catch(e){status.textContent='Распознавание недоступно. Поля можно заполнить вручную.';}
  finally{if(worker)await worker.terminate().catch(function(){});btn.disabled=false;}
 };
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
