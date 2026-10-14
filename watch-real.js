/* Realistic watch rendering for try-on.
   Works for every catalog watch at display time, so watches added later
   get the same treatment without re-processing files.
   - soft anti-aliased edges and removal of the light halo left by background removal
   - bracelet wraps around the wrist (cylinder projection) and darkens as it turns away
   - soft contact shadow shaped like the watch
   - colour and brightness matched to the skin under the watch
   - faint reflection on the case glass */
(function(){
'use strict';
var cache=typeof WeakMap==='function'?new WeakMap():null;
var MAX=900;

function canvas(w,h){var c=document.createElement('canvas');c.width=Math.max(1,Math.round(w));c.height=Math.max(1,Math.round(h));return c;}

function prepare(img){
  var hit=cache&&cache.get(img);
  var iw=img.naturalWidth||img.videoWidth||img.width,ih=img.naturalHeight||img.videoHeight||img.height;
  if(hit&&hit.iw===iw&&hit.ih===ih)return hit;
  var k=Math.min(2,MAX/Math.max(iw,ih)),w=Math.round(iw*k),h=Math.round(ih*k);
  var c=canvas(w,h),x=c.getContext('2d');x.imageSmoothingQuality='high';x.drawImage(img,0,0,w,h);
  var id,ok=true;
  try{id=x.getImageData(0,0,w,h);}catch(e){ok=false;}
  var top=.3,bot=.7,caseW=.95;
  if(ok){
    var d=id.data,n=w*h,a=new Uint8ClampedArray(n),i,yy,xx;
    for(i=0;i<n;i++)a[i]=d[i*4+3];
    // 1. Light halo: near-white, low-saturation pixels touching the transparent area.
    var near=new Uint8Array(n);
    for(yy=0;yy<h;yy++)for(xx=0;xx<w;xx++){
      i=yy*w+xx;if(a[i]<10)continue;
      var edge=false;
      for(var oy=-2;oy<=2&&!edge;oy++)for(var ox=-2;ox<=2;ox++){var X=xx+ox,Y=yy+oy;if(X<0||Y<0||X>=w||Y>=h||a[Y*w+X]<10){edge=true;break;}}
      near[i]=edge?1:0;
      if(edge){var r=d[i*4],g=d[i*4+1],b=d[i*4+2],mx=Math.max(r,g,b),mn=Math.min(r,g,b);if(mn>205&&mx-mn<28)a[i]=Math.round(a[i]*.15);}
    }
    // 2. Anti-alias: 3x3 average of alpha on the edge band only.
    var out=new Uint8ClampedArray(a);
    for(yy=1;yy<h-1;yy++)for(xx=1;xx<w-1;xx++){
      i=yy*w+xx;if(!near[i]&&a[i]>=10)continue;
      var s=0;for(var oy2=-1;oy2<=1;oy2++)for(var ox2=-1;ox2<=1;ox2++)s+=a[(yy+oy2)*w+xx+ox2];
      out[i]=Math.min(a[i]>=10?a[i]:255,Math.round(s/9));
    }
    for(i=0;i<n;i++)d[i*4+3]=out[i];
    x.putImageData(id,0,0);
    // 3. Find the case: the widest rows of the silhouette.
    var widths=new Float32Array(h),maxW=0;
    for(yy=0;yy<h;yy++){var l=-1,rr=-1;for(xx=0;xx<w;xx++)if(out[yy*w+xx]>128){if(l<0)l=xx;rr=xx;}widths[yy]=l<0?0:rr-l+1;if(widths[yy]>maxW)maxW=widths[yy];}
    if(maxW>0){
      var y0=-1,y1=-1;for(yy=0;yy<h;yy++)if(widths[yy]>maxW*.86){if(y0<0)y0=yy;y1=yy;}
      // Only treat as a strap/bracelet watch if there is narrower material above and below.
      if(y0>h*.08&&y1<h*.92&&y1-y0>h*.15){top=y0/h;bot=(y1+1)/h;}
      else{top=.5-Math.min(.5,maxW/h*.55);bot=1-top;}
      caseW=maxW/w;
    }
  }
  var sil=canvas(w,h),sx=sil.getContext('2d');sx.drawImage(c,0,0);sx.globalCompositeOperation='source-in';sx.fillStyle='#000';sx.fillRect(0,0,w,h);
  hit={iw:iw,ih:ih,img:c,sil:sil,w:w,h:h,top:top,bot:bot,caseW:caseW,ok:ok};
  if(cache)cache.set(img,hit);
  return hit;
}

/* Average colour of what is already painted under the watch (the wrist). */
function ambient(ctx,cw,ch){
  try{
    var m=ctx.getTransform(),p=m.transformPoint(new DOMPoint(0,0)),sc=Math.hypot(m.a,m.b);
    var r=Math.max(6,Math.min(160,cw*.45*sc)),c=ctx.canvas;
    var x0=Math.max(0,Math.round(p.x-r)),y0=Math.max(0,Math.round(p.y-r)),x1=Math.min(c.width,Math.round(p.x+r)),y1=Math.min(c.height,Math.round(p.y+r));
    if(x1-x0<4||y1-y0<4)return null;
    var d=ctx.getImageData(x0,y0,x1-x0,y1-y0).data,R=0,G=0,B=0,L=[],step=4*Math.max(1,Math.floor((x1-x0)*(y1-y0)/4000));
    for(var i=0;i<d.length;i+=step){R+=d[i];G+=d[i+1];B+=d[i+2];L.push(.2126*d[i]+.7152*d[i+1]+.0722*d[i+2]);}
    var n=L.length;if(!n)return null;L.sort(function(a,b){return a-b;});
    return {r:R/n,g:G/n,b:B/n,light:L[n>>1],contrast:L[Math.floor(n*.9)]-L[Math.floor(n*.1)]};
  }catch(e){return null;}
}

var work=null;
/* Draws the watch centred at the current origin, width `width` in local units. */
function draw(ctx,img,opt){
  opt=opt||{};
  var P=prepare(img),cw=opt.width||200,ch=cw*P.h/P.w;
  var curve=Math.max(0,Math.min(100,opt.curve==null?40:opt.curve))/100;
  var shadow=Math.max(0,Math.min(1,opt.shadow==null?.25:opt.shadow));
  var amb=opt.ambient===false?null:ambient(ctx,cw,ch);
  var m=ctx.getTransform(),sc=Math.max(.2,Math.hypot(m.a,m.b));

  // Projection: case stays flat; bracelet beyond it wraps around a cylinder.
  var top=P.top*P.h,bot=P.bot*P.h,mid=(top+bot)/2;
  var bandLength=Math.max(.5,Math.min(1.5,(opt.bandlength==null?100:opt.bandlength)/100)),bandWidth=Math.max(.55,Math.min(1.45,(opt.bandwidth==null?100:opt.bandwidth)/100));
  var R=curve>0?P.w*P.caseW*(.62/curve):1e9; // wrist radius in image px
  var lim=Math.PI/2*.96;
  function proj(y){ // returns {y, cos} in image px relative to case centre
    var s=y<top?top-y:y>bot?y-bot:0,sign=y<top?-1:1;
    if(s===0)return {y:y-mid,c:1};
    var t=Math.min(lim,s*bandLength/R);
    return {y:(sign<0?top:bot)-mid+sign*R*Math.sin(t),c:Math.cos(t)};
  }
  var pT=proj(0),pB=proj(P.h),outH=pB.y-pT.y;
  if(!work)work=canvas(1,1);
  var k=Math.min(1,Math.max(.35,cw*sc*1.25/P.w)); // render at screen resolution, never above source
  var W=Math.ceil(P.w*k*Math.max(1,bandWidth)),H=Math.ceil(outH*k)+2;
  if(work.width!==W||work.height!==H){work.width=W;work.height=H;}
  var wx=work.getContext('2d');wx.setTransform(1,0,0,1,0,0);wx.globalCompositeOperation='source-over';wx.globalAlpha=1;wx.clearRect(0,0,W,H);wx.imageSmoothingQuality='high';
  var step=Math.max(1,Math.round(2/k)),y,a,b,yy0,yy1,taper;
  for(y=0;y<P.h;y+=step){
    var h2=Math.min(step,P.h-y);a=proj(y);b=proj(y+h2);
    yy0=(a.y-pT.y)*k;yy1=(b.y-pT.y)*k;if(yy1-yy0<.05)continue;
    taper=1-(1-(a.c+b.c)/2)*.10; // slight narrowing as the band turns away
    var blend=Math.min(1,Math.max(0,y<top?(top-y)/(P.h*.05):y>bot?(y-bot)/(P.h*.05):0));
    var dw=P.w*k*taper*(1+(bandWidth-1)*blend);
    wx.drawImage(P.img,0,y,P.w,h2,(W-dw)/2,yy0,dw,yy1-yy0+.6);
  }
  wx.globalCompositeOperation='source-atop';
  // Shade: bracelet darkens where it turns away from the light.
  var gy=wx.createLinearGradient(0,0,0,H),cTop=(top-mid-pT.y)*k/H,cBot=(bot-mid-pT.y)*k/H;
  gy.addColorStop(0,'rgba(0,0,0,'+(.55*curve+.05)+')');
  gy.addColorStop(Math.max(0,Math.min(1,cTop)),'rgba(0,0,0,0)');
  gy.addColorStop(Math.max(0,Math.min(1,cBot)),'rgba(0,0,0,0)');
  gy.addColorStop(1,'rgba(0,0,0,'+(.62*curve+.07)+')');
  wx.fillStyle=gy;wx.fillRect(0,0,W,H);
  // Side shading across the width (rounded wrist and case flanks).
  var gx=wx.createLinearGradient(0,0,W,0);
  gx.addColorStop(0,'rgba(0,0,0,.14)');gx.addColorStop(.15,'rgba(0,0,0,0)');gx.addColorStop(.85,'rgba(0,0,0,0)');gx.addColorStop(1,'rgba(0,0,0,.18)');
  wx.fillStyle=gx;wx.fillRect(0,0,W,H);
  // Environment colour: metal and glass pick up the colour of the scene.
  if(amb){
    if(!work.mask)work.mask=canvas(1,1);var mk=work.mask;if(mk.width!==W||mk.height!==H){mk.width=W;mk.height=H;}
    var mx2=mk.getContext('2d');mx2.clearRect(0,0,W,H);mx2.drawImage(work,0,0);
    wx.globalAlpha=.22;wx.globalCompositeOperation='soft-light';
    wx.fillStyle='rgb('+Math.round(amb.r)+','+Math.round(amb.g)+','+Math.round(amb.b)+')';wx.fillRect(0,0,W,H);
    wx.globalAlpha=1;wx.globalCompositeOperation='destination-in';wx.drawImage(mk,0,0);
  }
  // Cut ends of the bracelet fade out where it disappears around the wrist.
  if(top>P.h*.04||bot<P.h*.96){
    wx.globalCompositeOperation='destination-out';
    var fe=wx.createLinearGradient(0,0,0,H),f1=Math.min(.05,(top-mid-pT.y)*k/H*.2),f2=1-Math.min(.05,(pB.y-(bot-mid))*k/H*.2);
    fe.addColorStop(0,'rgba(0,0,0,.7)');fe.addColorStop(f1,'rgba(0,0,0,0)');fe.addColorStop(f2,'rgba(0,0,0,0)');fe.addColorStop(1,'rgba(0,0,0,.7)');
    wx.fillStyle=fe;wx.fillRect(0,0,W,H);
  }
  // Faint glass reflection over the case.
  wx.globalCompositeOperation='source-atop';
  var cy0=(top-mid-pT.y)*k,cy1=(bot-mid-pT.y)*k,gl=wx.createLinearGradient(W*.15,cy0,W*.75,cy1);
  gl.addColorStop(0,'rgba(255,255,255,0)');gl.addColorStop(.32,'rgba(255,255,255,.10)');gl.addColorStop(.40,'rgba(255,255,255,.02)');gl.addColorStop(.62,'rgba(255,255,255,0)');
  wx.fillStyle=gl;wx.fillRect(0,cy0,W,cy1-cy0);
  wx.globalCompositeOperation='source-over';

  var outputWidth=W/k/P.w*cw,dx=-outputWidth/2,dy=pT.y/P.w*cw,dh=H/k/P.w*cw;
  ctx.save();
  ctx.shadowColor='transparent';
  // Soft contact shadow, shaped like the watch, slightly below it.
  if(shadow>0){
    var bl=Math.max(2,cw*.06*sc),off=cw*.035;
    ctx.save();
    ctx.shadowColor='rgba(15,8,4,'+Math.min(.9,shadow*1.6)+')';
    ctx.shadowBlur=bl;
    // Draw the shape far off-canvas and let only its shadow land back under the watch.
    var far=5000/sc,ox=off*.35,oy=off;
    ctx.shadowOffsetX=far*m.a+ox*m.a+oy*m.c;ctx.shadowOffsetY=far*m.b+ox*m.b+oy*m.d;
    ctx.translate(-far,0);
    ctx.drawImage(work,dx,dy,outputWidth,dh);
    ctx.restore();
    // Tight contact line right under the edges.
    var o2=cw*.008;
    ctx.save();ctx.shadowColor='rgba(0,0,0,'+Math.min(.75,shadow*1.8)+')';ctx.shadowBlur=Math.max(1,cw*.012*sc);
    ctx.shadowOffsetX=far*m.a+o2*m.c;ctx.shadowOffsetY=far*m.b+o2*m.d;ctx.translate(-far,0);ctx.drawImage(work,dx,dy,outputWidth,dh);ctx.restore();
  }
  // Brightness matched to the scene.
  var light=opt.light!=null?opt.light:amb?Math.max(.8,Math.min(1.06,.98+(amb.light-150)*.0012)):1;
  var hasFilter='filter' in ctx;
  if(hasFilter&&Math.abs(light-1)>.01)ctx.filter='brightness('+light+')';
  ctx.drawImage(work,dx,dy,outputWidth,dh);
  if(hasFilter)ctx.filter='none';
  if(!hasFilter&&light<.99){ // Safari without canvas filters: darken over the watch only
    var t=canvas(work.width,work.height),tx=t.getContext('2d');tx.drawImage(work,0,0);tx.globalCompositeOperation='source-in';tx.fillStyle='rgba(0,0,0,'+(1-light)+')';tx.fillRect(0,0,t.width,t.height);
    ctx.drawImage(t,dx,dy,outputWidth,dh);
  }
  ctx.restore();
}

window.WatchReal={prepare:prepare,draw:draw,ambient:ambient};window.dispatchEvent(new Event('watch-render-ready'));
})();

