/* Photo-only hand detection. Images stay in the browser. */
(function(){
'use strict';
var pending;
async function detector(){
  if(!pending)pending=(async function(){
    var api=await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/vision_bundle.mjs');
    var files=await api.FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm');
    return api.HandLandmarker.createFromOptions(files,{baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',delegate:'CPU'},runningMode:'IMAGE',numHands:2,minHandDetectionConfidence:.65,minHandPresenceConfidence:.65});
  })().catch(function(e){pending=null;throw e;});
  return pending;
}
function geometry(lm,w,h){
  var p=lm.map(function(p){return {x:p.x*w,y:p.y*h};}),a=p[0],b=p[9],dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy),palm=Math.hypot(p[5].x-p[17].x,p[5].y-p[17].y);
  if(!Number.isFinite(len)||len<20||palm<15||palm>len*2.5)return null;
  // Landmarker point 0 is the wrist boundary: place the case farther toward the forearm.
  // Use the palm-to-wrist axis so this works for either hand and any camera rotation.
  var width=palm*.82, x=a.x-dx*.43,y=a.y-dy*.43;
  if(x<width*.2||x>w-width*.2||y<width*.2||y>h-width*.2)return null;
  return {x:x,y:y,width:width,angle:Math.atan2(dy,dx)*180/Math.PI+90};
}
function unrotate(g,angle,w,h,scale){
  var x=g.x,y=g.y;
  if(angle===90){g.x=y;g.y=h-x;}else if(angle===-90){g.x=w-y;g.y=x;}else if(angle===180){g.x=w-x;g.y=h-y;}
  g.x/=scale;g.y/=scale;g.width/=scale;g.angle-=angle;return g;
}
window.WristDetection={geometry:geometry,unrotate:unrotate,detect:async function(photo){
  var task=await detector(),iw=photo.naturalWidth||photo.width,ih=photo.naturalHeight||photo.height;
  var scale=Math.min(1,960/Math.max(iw,ih)),w=Math.round(iw*scale),h=Math.round(ih*scale);
  // Sideways photos and a turned hand get another orientation attempt.
  for(var angle of [0,90,-90,180]){
    var c=document.createElement('canvas'),quarter=Math.abs(angle)===90;c.width=quarter?h:w;c.height=quarter?w:h;
    var ctx=c.getContext('2d');ctx.translate(c.width/2,c.height/2);ctx.rotate(angle*Math.PI/180);ctx.drawImage(photo,-w/2,-h/2,w,h);
    var result=task.detect(c);
    // Handedness scores classify left/right hands, not detection confidence.
    // Presence and detection thresholds are enforced by the model itself.
    if((result.landmarks||[]).length>1)return null;
    var candidates=(result.landmarks||[]).map(function(lm){return geometry(lm,c.width,c.height);}).filter(Boolean);
    if(candidates.length===1)return unrotate(candidates[0],angle,w,h,scale);
    await new Promise(function(resolve){setTimeout(resolve,0);});
  }
  return null;
}};
})();
