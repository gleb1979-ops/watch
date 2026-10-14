/* Shared maker signature for BYD projects. */
(function(){'use strict';
var source=document.currentScript&&document.currentScript.src||document.baseURI;
function init(){
 if(document.querySelector('.byd-credit'))return;
 var style=document.createElement('style');style.textContent='.byd-credit{display:flex;align-items:center;justify-content:center;gap:12px;padding:24px 12px;margin:20px auto 0;border-top:1px solid var(--line,#38413b);max-width:960px;color:var(--muted,#aeb5b0);font:500 13px/1.4 system-ui,sans-serif;direction:ltr}.byd-credit img{display:block;width:46px;height:46px;flex:none;border-radius:11px}.byd-credit span{letter-spacing:.04em}body.fitting-workspace>.byd-credit,body.embedded-fitting>.byd-credit,body[data-embed="true"]>.byd-credit{display:none}';document.head.appendChild(style);
 var footer=document.createElement('footer');footer.className='byd-credit';footer.setAttribute('data-no-translate','');footer.setAttribute('aria-label','Made by BYD');
 var logo=document.createElement('img');logo.src=new URL('byd-logo.svg',source).href;logo.alt='BYD';logo.width=46;logo.height=46;logo.decoding='async';
 var text=document.createElement('span');text.textContent='Made by BYD';footer.appendChild(logo);footer.appendChild(text);document.body.appendChild(footer);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
