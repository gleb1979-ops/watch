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
  var width=palm*.82, x=a.x-dx*.25,y=a.y-dy*.25;
  if(x<width*.2||x>w-width*.2||y<width*.2||y>h-width*.2)return null;
  return {x:x,y:y,width:width,angle:Math.atan2(dy,dx)*180/Math.PI};
}
window.WristDetection={geometry:geometry,detect:async function(photo){
  var task=await detector(),c=document.createElement('canvas'),scale=Math.min(1,1280/Math.max(photo.naturalWidth||photo.width,photo.naturalHeight||photo.height));
  c.width=Math.round((photo.naturalWidth||photo.width)*scale);c.height=Math.round((photo.naturalHeight||photo.height)*scale);c.getContext('2d').drawImage(photo,0,0,c.width,c.height);
  var result=task.detect(c),candidates=(result.landmarks||[]).map(function(lm,i){var g=geometry(lm,c.width,c.height);if(g)g.score=(result.handedness[i]&&result.handedness[i][0]?result.handedness[i][0].score:0);return g;}).filter(function(g){return g&&g.score>=.7;});
  if(candidates.length!==1)return null;
  var g=candidates[0];g.x/=scale;g.y/=scale;g.width/=scale;return g;
}};
})();
