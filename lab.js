"use strict";

// Draw and animate the browser-based models in physics.js. No server is needed.
const $ = id => document.getElementById(id);
const COLORS = {blue:"#242620", orange:"#b76732", teal:"#188568", purple:"#77718c", ink:"#242620", muted:"#88867b", grid:"#e9e6dc"};
const DEFAULTS = {
  projectile: {speed:20, angle:45, height:0, gravity:9.81},
  forces: {mass:2, applied:10, mu_static:0.3, mu_kinetic:0.2, v0:0, duration:8},
  vectors: {ax:4, ay:3, bx:-1, by:4, operation:"add"}
};
const PRESETS = {
  projectile: [
    ["Classic 45° launch", {speed:20, angle:45, height:0, gravity:9.81}],
    ["Horizontal launch from a ledge", {speed:15, angle:0, height:10, gravity:9.81}],
    ["Throw upward from a ledge", {speed:12, angle:60, height:15, gravity:9.81}],
    ["Same launch on the Moon", {speed:20, angle:45, height:0, gravity:1.62}]
  ],
  forces: [
    ["Push a cart", {...DEFAULTS.forces}],
    ["Held by static friction", {mass:5, applied:5, mu_static:0.5, mu_kinetic:0.4, v0:0, duration:8}],
    ["Slide to a stop", {mass:3, applied:0, mu_static:0.3, mu_kinetic:0.2, v0:8, duration:8}],
    ["Slow down, then reverse", {mass:2, applied:-10, mu_static:0.3, mu_kinetic:0.2, v0:8, duration:5}]
  ],
  vectors: [
    ["Add two vectors", {...DEFAULTS.vectors}],
    ["A 3–4–5 triangle", {ax:3, ay:0, bx:0, by:4, operation:"add"}],
    ["Equal and opposite", {ax:4, ay:3, bx:-4, by:-3, operation:"add"}],
    ["Subtract two vectors", {ax:4, ay:3, bx:-1, by:4, operation:"subtract"}]
  ]
};
const state = JSON.parse(JSON.stringify(DEFAULTS));
const options = {velocity:true, components:true};
let mode="projectile", data=null, time=0, playing=false, lastFrame=0, debounce, animationId=0;

const fmt = (value, digits=2) => value === null ? "Undefined" : (Math.abs(value)<0.5*10**(-digits) ? 0 : value).toLocaleString("en-US", {maximumFractionDigits:digits, minimumFractionDigits:digits});
const short = value => Math.abs(value)>=10000 ? value.toExponential(1) : Math.abs(value)<1e-9 ? "0" : Number(value.toPrecision(4)).toString();

function control(key, label, min, max, step, unit, help="") {
  const value=state[mode][key];
  const name=key.startsWith("a")&&mode==="vectors"?`Vector A ${label}`:key.startsWith("b")&&mode==="vectors"?`Vector B ${label}`:label;
  const description=help || (unit ? `Measured in ${unit}` : "");
  return `<div class="control"><div class="control-copy"><label for="${key}">${label}${unit?` <span class="unit">${unit}</span>`:""}</label>${description?`<p class="control-help" id="${key}-help">${description}</p>`:""}</div><div class="stepper"><button class="step-button" data-step="-1" data-key="${key}" aria-label="Decrease ${name}" ${value<=min?"disabled":""}>−</button><input class="number" id="${key}" type="number" min="${min}" max="${max}" step="${step}" value="${value}" aria-label="${name}${unit ? ` (${unit})` : ""}" ${description?`aria-describedby="${key}-help"`:""}><button class="step-button" data-step="1" data-key="${key}" aria-label="Increase ${name}" ${value>=max?"disabled":""}>+</button></div></div>`;
}
function checkbox(id, label, checked) {
  return `<label class="check"><span>${label}</span><input id="${id}" type="checkbox" role="switch" ${checked?"checked":""}><span class="switch-track" aria-hidden="true"></span></label>`;
}
function section(label){return `<div class="section-label">${label}</div>`;}
function syncStepper(input){document.querySelectorAll(`.step-button[data-key="${input.id}"]`).forEach(button=>{button.disabled=Number(button.dataset.step)<0?input.valueAsNumber<=Number(input.min):input.valueAsNumber>=Number(input.max);});}
function buildControls(preset="custom") {
  let html=`<div class="preset-wrap"><label class="section-label" for="preset">Experiment</label><select class="preset" id="preset"><option value="custom">Custom experiment</option>${PRESETS[mode].map((p,i)=>`<option value="${i}">${p[0]}</option>`).join("")}</select></div>`;
  if(mode==="projectile") {
    html+=section("Launch");
    html+=control("speed","Speed",0,100,0.5,"m/s","Initial launch speed");
    html+=control("angle","Angle",-90,90,1,"°","Above the horizontal");
    html+=control("height","Height",0,100,0.5,"m","Starting height above ground");
    html+=section("Environment");
    html+=control("gravity","Gravity",0.1,30,0.01,"m/s²","Earth 9.81 · Moon 1.62");
    html+=section("Display")+checkbox("show-velocity","Velocity arrow",options.velocity)+checkbox("show-components","Velocity components",options.components);
  } else if(mode==="forces") {
    html+=section("Motion");
    html+=control("mass","Mass",0.1,50,0.1,"kg","Mass of the block");
    html+=control("applied","Applied force",-100,100,0.5,"N","Positive right · negative left");
    html+=control("v0","Initial velocity",-20,20,0.5,"m/s","Velocity at the start");
    html+=section("Surface");
    html+=control("mu_static","Static friction",0,1.5,0.01,"μs","Friction before sliding");
    html+=control("mu_kinetic","Kinetic friction",0,1.5,0.01,"μk","Friction while sliding · μk ≤ μs");
    html+=section("Simulation");
    html+=control("duration","Duration",1,30,0.5,"s","Time to simulate");
  } else {
    html+=section("Operation")+`<div class="operation" role="group" aria-label="Vector operation"><button data-op="add" class="${state.vectors.operation==="add"?"active":""}" aria-pressed="${state.vectors.operation==="add"}">A + B</button><button data-op="subtract" class="${state.vectors.operation==="subtract"?"active":""}" aria-pressed="${state.vectors.operation==="subtract"}">A − B</button></div>`+section("Vector A");
    html+=control("ax","x component",-20,20,0.5,"");
    html+=control("ay","y component",-20,20,0.5,"");
    html+=section("Vector B");
    html+=control("bx","x component",-20,20,0.5,"");
    html+=control("by","y component",-20,20,0.5,"");
    html+=section("Display")+checkbox("show-components","Resultant components",options.components);
  }
  $("controls").innerHTML=html;
  $("preset").value=String(preset);
  $("preset").addEventListener("change",e=>{
    if(e.target.value==="custom")return;
    const selected=e.target.value;
    state[mode]={...PRESETS[mode][Number(selected)][1]};
    buildControls(selected); calculateModel();
  });
  document.querySelectorAll(".number").forEach(input=>input.addEventListener("input",()=>{
    pause();
    if(input.value==="" || !Number.isFinite(input.valueAsNumber) || input.valueAsNumber<Number(input.min) || input.valueAsNumber>Number(input.max)) {
      clearTimeout(debounce); setError(`${input.getAttribute("aria-label")} must be between ${input.min} and ${input.max}.`); setBusy(true); return;
    }
    state[mode][input.id]=input.valueAsNumber;
    syncStepper(input);
    $("preset").value="custom"; scheduleModel();
  }));
  document.querySelectorAll(".step-button").forEach(button=>button.addEventListener("click",()=>{
    const input=$(button.dataset.key);
    const current=Number.isFinite(input.valueAsNumber)?input.valueAsNumber:state[mode][input.id];
    const value=Math.min(Number(input.max),Math.max(Number(input.min),Number((current+Number(button.dataset.step)*Number(input.step)).toFixed(8))));
    input.value=String(value);state[mode][input.id]=value;syncStepper(input);
    $("preset").value="custom";scheduleModel();
  }));
  document.querySelectorAll("[data-op]").forEach(button=>button.addEventListener("click",()=>{
    state.vectors.operation=button.dataset.op;
    document.querySelectorAll("[data-op]").forEach(b=>{b.classList.toggle("active",b===button);b.setAttribute("aria-pressed",String(b===button));});
    $("preset").value="custom";calculateModel();
  }));
  if($("show-velocity"))$("show-velocity").addEventListener("change",e=>{options.velocity=e.target.checked;drawAll();});
  if($("show-components"))$("show-components").addEventListener("change",e=>{options.components=e.target.checked;drawAll();});
}

function setError(message="") {$("error").textContent=message;$("error").hidden=!message;}
function setBusy(value){$("play").disabled=value;$("timeline").disabled=value;}
function scheduleModel(){pause();setBusy(true);clearTimeout(debounce);debounce=setTimeout(calculateModel,100);}
function calculateModel(){
  clearTimeout(debounce);pause();setBusy(true);
  for(const input of document.querySelectorAll(".number")){
    if(input.value==="" || !Number.isFinite(input.valueAsNumber) || input.valueAsNumber<Number(input.min) || input.valueAsNumber>Number(input.max)){
      setError(`${input.getAttribute("aria-label")} must be between ${input.min} and ${input.max}.`);return;
    }
  }
  try{
    const result=Physics[mode](state[mode]);
    data=result;time=0;setError();setBusy(false);updateContent();drawAll();
  }catch(error){setError(error.message || "The model could not be calculated.");}
}
function setMode(next){
  mode=next;data=null;time=0;pause();setError();
  document.querySelectorAll(".tab").forEach(button=>{const active=button.dataset.mode===mode;button.classList.toggle("active",active);button.setAttribute("aria-pressed",String(active));});
  const titles={projectile:"Trajectory",forces:"Forces & motion",vectors:"Vector construction"};
  $("scene-title").textContent=titles[mode];
  $("scene").setAttribute("aria-label",titles[mode]+". Calculated values appear below the plot.");
  $("analysis-label").textContent=mode==="vectors"?"Components & equations":"Graphs & equations";
  $("transport").hidden=mode==="vectors";$("vector-caption").hidden=mode!=="vectors";
  $("charts").hidden=mode==="vectors";$("vector-details").hidden=mode!=="vectors";
  $("scene-badge").textContent="Calculating…";
  buildControls();calculateModel();
}
function metric(label,value,unit,hint){return `<div class="metric" title="${hint}"><span class="metric-label">${label}</span><div class="metric-value">${value}<small>${unit}</small></div></div>`;}
function updateContent(){
  if(!data)return;
  const p=data.parameters;
  if(mode==="projectile"){
    $("legend").innerHTML='<span><i></i> Path</span><span><i class="orange"></i> Velocity</span><span><i class="teal"></i> Components</span>';
    const s=data.summary;
    $("metrics").innerHTML=metric("Horizontal range",fmt(s.range),"m","At ground contact")+metric("Maximum height",fmt(s.peak_height),"m","Above the ground")+metric("Flight time",fmt(s.flight_time),"s","Until ground contact")+metric("Impact speed",fmt(s.impact_speed),"m/s","At the end of the flight");
    $("chart-title-a").innerHTML='Height over time <span>m</span>';$("chart-title-b").innerHTML='Vertical velocity <span>m/s</span>';
    $("explain-title").textContent="Horizontal and vertical motion are independent.";
    $("equations").innerHTML='x = (v₀ cos θ)t<br>y = h₀ + (v₀ sin θ)t − ½gt²<br>vₓ = v₀ cos θ &nbsp;·&nbsp; vᵧ = v₀ sin θ − gt';
    $("assumptions").textContent="Model: a point object, uniform gravity, level ground at y = 0, and no air resistance. The flight ends at first ground contact. Velocity arrows use a separate scale from position.";
    $("chart-a").setAttribute("aria-label","Height in meters versus time in seconds");$("chart-b").setAttribute("aria-label","Vertical velocity in meters per second versus time in seconds");
  }else if(mode==="forces"){
    $("legend").innerHTML='<span><i></i> Applied</span><span><i class="orange"></i> Friction</span><span><i class="teal"></i> Normal</span><span><i class="purple"></i> Weight</span>';
    $("chart-title-a").innerHTML='Position over time <span>m</span>';$("chart-title-b").innerHTML='Velocity over time <span>m/s</span>';
    $("explain-title").textContent="Net force determines acceleration, not velocity.";
    $("equations").innerHTML='ΣFₓ = F + f = ma &nbsp;·&nbsp; N = mg<br>At rest: |fₛ| ≤ μₛN<br>While sliding: |fₖ| = μₖN';
    $("assumptions").textContent=`Model: constant horizontal force, a level surface, gravity = 9.81 m/s², and Coulomb friction. Static limit = ${fmt(data.summary.static_limit)} N; sliding friction = ${fmt(data.summary.kinetic_magnitude)} N. Positive motion is rightward; x starts at 0.`;
    $("chart-a").setAttribute("aria-label","Position in meters versus time in seconds");$("chart-b").setAttribute("aria-label","Velocity in meters per second versus time in seconds");
  }else{
    const r=data.result, subtract=p.operation==="subtract";
    $("legend").innerHTML=`<span><i></i> A</span><span><i class="orange"></i> ${subtract?"−B":"B"}</span><span><i class="teal"></i> Resultant R</span>`;
    $("metrics").innerHTML=metric("Resultant magnitude",fmt(r.magnitude),"","Length of R")+metric("Resultant direction",r.angle===null?"—":fmt(r.angle,1),r.angle===null?"":"°",r.angle===null?"Zero vector: undefined":"Counterclockwise from +x")+metric("Dot product A · B",fmt(data.dot),"","Uses the original A and B")+metric("Angle between A & B",data.separation===null?"—":fmt(data.separation,1),data.separation===null?"":"°",data.separation===null?"Undefined for a zero vector":"Between the original vectors");
    $("vector-details").innerHTML=`<h2>Components & direction</h2><table><thead><tr><th>Vector</th><th>x</th><th>y</th><th>Magnitude</th><th>Direction</th></tr></thead><tbody>${[["A",data.a,"a"],["B",data.b,"b"],[subtract?"R = A − B":"R = A + B",r,"r"]].map(([label,v,color])=>`<tr><td class="dot-${color}">${label}</td><td>${fmt(v.x)}</td><td>${fmt(v.y)}</td><td>${fmt(v.magnitude)}</td><td>${v.angle===null?"Undefined":fmt(v.angle,1)+"°"}</td></tr>`).join("")}</tbody></table>`;
    $("explain-title").textContent=subtract?"Subtracting B is the same as adding −B.":"Add components along each axis independently.";
    $("equations").innerHTML=`Rₓ = Aₓ ${subtract?"−":"+"} Bₓ &nbsp;·&nbsp; Rᵧ = Aᵧ ${subtract?"−":"+"} Bᵧ<br>|R| = √(Rₓ² + Rᵧ²)<br>θ = atan2(Rᵧ, Rₓ), expressed in 0°–360°`;
    $("assumptions").textContent="Vectors are drawn on equal-scale axes in arbitrary, consistent units. The dot product and angle between vectors always refer to the original A and B. A zero vector has no defined direction.";
    $("vector-caption").textContent=subtract?"The orange arrow is −B, translated to the tip of A. R connects the origin to the final tip.":"The orange arrow is B, translated to the tip of A. R connects the origin to the final tip.";
  }
}

// Canvas drawing helpers. Spatial plots always preserve equal x/y scales.
function context(id){
  const canvas=$(id),rect=canvas.getBoundingClientRect(),dpr=window.devicePixelRatio||1;
  const width=Math.max(1,rect.width),height=Math.max(1,rect.height);
  if(canvas.width!==Math.round(width*dpr)||canvas.height!==Math.round(height*dpr)){canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);}
  const ctx=canvas.getContext("2d");ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);ctx.lineCap="round";ctx.lineJoin="round";
  return {ctx,w:width,h:height};
}
function line(ctx,x1,y1,x2,y2,color,width=1,dash=[]){ctx.save();ctx.beginPath();ctx.strokeStyle=color;ctx.lineWidth=width;ctx.setLineDash(dash);ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();ctx.restore();}
function text(ctx,str,x,y,color=COLORS.muted,size=11,align="left"){ctx.save();ctx.fillStyle=color;ctx.font=`${size}px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif`;ctx.textAlign=align;ctx.fillText(str,x,y);ctx.restore();}
function circle(ctx,x,y,r,color,stroke=null){ctx.beginPath();ctx.arc(x,y,r,0,2*Math.PI);ctx.fillStyle=color;ctx.fill();if(stroke){ctx.lineWidth=2;ctx.strokeStyle=stroke;ctx.stroke();}}
function arrow(ctx,x1,y1,x2,y2,color,width=2.5,dash=[]){
  const length=Math.hypot(x2-x1,y2-y1);if(length<0.5)return;
  line(ctx,x1,y1,x2,y2,color,width,dash);
  const angle=Math.atan2(y2-y1,x2-x1),size=Math.min(9,length*.38);
  ctx.beginPath();ctx.moveTo(x2,y2);ctx.lineTo(x2-size*Math.cos(angle-.42),y2-size*Math.sin(angle-.42));ctx.lineTo(x2-size*Math.cos(angle+.42),y2-size*Math.sin(angle+.42));ctx.closePath();ctx.fillStyle=color;ctx.fill();
}
function niceStep(span,target=7){const rough=span/target,power=10**Math.floor(Math.log10(rough||1));const fraction=rough/power;return (fraction<=1?1:fraction<=2?2:fraction<=5?5:10)*power;}
function plane(ctx,w,h,bounds,xLabel="x (m)",yLabel="y (m)"){
  const box={left:57,right:w-30,top:35,bottom:h-36};
  const scale=Math.min((box.right-box.left)/(bounds.xmax-bounds.xmin),(box.bottom-box.top)/(bounds.ymax-bounds.ymin));
  const centerX=(bounds.xmin+bounds.xmax)/2,centerY=(bounds.ymin+bounds.ymax)/2;
  const x=v=>(box.left+box.right)/2+(v-centerX)*scale,y=v=>(box.top+box.bottom)/2-(v-centerY)*scale;
  const xmin=centerX-(box.right-box.left)/2/scale,xmax=centerX+(box.right-box.left)/2/scale;
  const ymin=centerY-(box.bottom-box.top)/2/scale,ymax=centerY+(box.bottom-box.top)/2/scale;
  const step=niceStep(Math.max(xmax-xmin,ymax-ymin),w<450?6:10);
  const axisX=Math.min(box.right,Math.max(box.left,x(0))),axisY=Math.min(box.bottom,Math.max(box.top,y(0)));
  for(let v=Math.ceil(xmin/step)*step;v<=xmax+step*1e-6;v+=step){line(ctx,x(v),box.top,x(v),box.bottom,COLORS.grid);text(ctx,short(v),x(v),box.bottom+17,COLORS.muted,10,"center");}
  for(let v=Math.ceil(ymin/step)*step;v<=ymax+step*1e-6;v+=step){line(ctx,box.left,y(v),box.right,y(v),COLORS.grid);text(ctx,short(v),box.left-9,y(v)+3,COLORS.muted,10,"right");}
  line(ctx,box.left,axisY,box.right,axisY,"#d5d0c4");line(ctx,axisX,box.top,axisX,box.bottom,"#d5d0c4");
  text(ctx,xLabel,box.right,h-4,COLORS.muted,10,"right");text(ctx,yLabel,box.left,18,COLORS.muted,10);
  return {x,y,scale,box};
}
function path(ctx,samples,x,y,xKey,yKey,color,width=2.5,dash=[]){ctx.save();ctx.strokeStyle=color;ctx.lineWidth=width;ctx.setLineDash(dash);ctx.beginPath();samples.forEach((s,i)=>i?ctx.lineTo(x(s[xKey]),y(s[yKey])):ctx.moveTo(x(s[xKey]),y(s[yKey])));ctx.stroke();ctx.restore();}
function sampleAt(t){
  const samples=data.samples;if(samples.length===1||t<=0)return {...samples[0]};
  if(t>=data.duration)return {...samples[samples.length-1]};
  let lo=0,hi=samples.length-1;
  while(lo+1<hi){const mid=(lo+hi)>>1;if(samples[mid].t<=t)lo=mid;else hi=mid;}
  const left=samples[lo],right=samples[hi],dt=right.t-left.t,q=dt?(t-left.t)/dt:0;
  const s={...left,t};
  for(const key of ["x","y","v","vx","vy"]){if(key in left)s[key]=left[key]+(right[key]-left[key])*q;}
  // Hermite position interpolation preserves constant-acceleration segments.
  const hermite=(p0,p1,v0,v1)=>(2*q**3-3*q*q+1)*p0+(q**3-2*q*q+q)*dt*v0+(-2*q**3+3*q*q)*p1+(q**3-q*q)*dt*v1;
  if(data.kind==="forces")s.x=hermite(left.x,right.x,left.v,right.v);
  else {s.x=hermite(left.x,right.x,left.vx,right.vx);s.y=Math.max(0,hermite(left.y,right.y,left.vy,right.vy));}
  return s;
}
function drawProjectile(){
  const {ctx,w,h}=context("scene"),s=sampleAt(time),summary=data.summary;
  const xmax=Math.max(5,summary.range),ymax=Math.max(3,summary.peak_height);
  const p=plane(ctx,w,h,{xmin:-xmax*.04,xmax:xmax*1.12,ymin:-ymax*.05,ymax:ymax*1.2});
  ctx.save();ctx.beginPath();ctx.rect(p.box.left,p.box.top,p.box.right-p.box.left,p.box.bottom-p.box.top);ctx.clip();
  ctx.fillStyle="#eeeee2";ctx.fillRect(p.box.left,p.y(0),p.box.right-p.box.left,p.box.bottom-p.y(0));
  line(ctx,p.box.left,p.y(0),p.box.right,p.y(0),"#cbcaba",1.4);
  if(data.parameters.height>0){line(ctx,p.x(0),p.y(0),p.x(0),p.y(data.parameters.height),"#c5c1b5",6);}
  path(ctx,data.samples,p.x,p.y,"x","y","#b7b7a9",2,[5,5]);
  const trail=data.samples.filter(point=>point.t<time);trail.push(s);path(ctx,trail,p.x,p.y,"x","y",COLORS.blue,3);
  const x=p.x(s.x),y=p.y(s.y);
  const velocityScale=Math.min(75,w*.16)/Math.max(1,data.parameters.speed,summary.impact_speed);
  if(options.components){arrow(ctx,x,y,x+s.vx*velocityScale,y,COLORS.teal,1.7,[3,3]);arrow(ctx,x,y,x,y-s.vy*velocityScale,COLORS.teal,1.7,[3,3]);}
  if(options.velocity)arrow(ctx,x,y,x+s.vx*velocityScale,y-s.vy*velocityScale,COLORS.orange,2.5);
  circle(ctx,p.x(0),p.y(data.parameters.height),4,"white",COLORS.blue);circle(ctx,x,y,10,"#24262015");circle(ctx,x,y,5,COLORS.blue,"white");
  ctx.restore();
  text(ctx,`x ${fmt(s.x)} m   y ${fmt(s.y)} m`,p.box.left, h-3,COLORS.ink,10);
  const label=time===0?(data.duration===0?"Already at ground level":"Ready to launch"):time>=data.duration?"Ground contact":`vₓ ${fmt(s.vx,1)} · vᵧ ${fmt(s.vy,1)} m/s`;
  $("scene-badge").textContent=label;
}
function drawForces(){
  const {ctx,w,h}=context("scene"),s=sampleAt(time),p=data.parameters;
  const left=45,right=w-35,trackY=h-53;
  const xs=data.samples.map(s=>s.x),minimum=Math.min(0,...xs),maximum=Math.max(0,...xs),span=Math.max(4,maximum-minimum);
  const low=minimum-span*.08,high=Math.max(maximum,minimum+4)+span*.08;
  const position=x=>left+(x-low)/(high-low)*(right-left);
  text(ctx,"POSITION ON THE SURFACE",left,trackY-36,COLORS.muted,9);
  line(ctx,left,trackY,right,trackY,"#d7d3c6",2);
  const step=niceStep(high-low,w<450?4:7);
  for(let x=Math.ceil(low/step)*step;x<=high;x+=step){line(ctx,position(x),trackY-4,position(x),trackY+4,"#c4c0b4");text(ctx,short(x),position(x),trackY+20,COLORS.muted,10,"center");}
  text(ctx,"x (m)",right,h-7,COLORS.muted,10,"right");
  ctx.fillStyle=COLORS.blue;ctx.fillRect(position(s.x)-9,trackY-19,18,18);
  if(Math.abs(s.v)>.01)arrow(ctx,position(s.x),trackY-24,position(s.x)+Math.sign(s.v)*26,trackY-24,COLORS.teal,1.6);
  // A separate diagram keeps force magnitudes comparable as the block travels.
  const cx=w/2,cy=(trackY-50)/2+8,block=42;
  const longest=Math.max(p.mass*p.gravity,Math.abs(p.applied),Math.abs(s.friction),1);
  const scale=Math.min(w*.23,(trackY-78)/2)/longest;
  text(ctx,"FREE-BODY DIAGRAM",23,22,COLORS.muted,9);
  ctx.fillStyle="#efecdf";ctx.fillRect(cx-21,cy-21,block,block);ctx.strokeStyle="#bcb8a9";ctx.lineWidth=1.5;ctx.strokeRect(cx-21,cy-21,block,block);
  text(ctx,`${short(p.mass)} kg`,cx,cy+4,COLORS.ink,11,"center");
  // Arrow tails start at the center; force labels use separate lanes if both
  // horizontal forces happen to point in the same direction while braking.
  const appliedY=cy-7,frictionY=cy+9;
  const aEnd=cx+p.applied*scale,fEnd=cx+s.friction*scale;
  arrow(ctx,cx,appliedY,aEnd,appliedY,COLORS.blue);
  arrow(ctx,cx,frictionY,fEnd,frictionY,COLORS.orange);
  text(ctx,`F = ${fmt(p.applied,1)} N`,cx+(p.applied>=0?30:-30),appliedY-13,COLORS.blue,11,p.applied>=0?"left":"right");
  text(ctx,`f = ${fmt(s.friction,1)} N`,cx+(s.friction>=0?30:-30),frictionY+21,COLORS.orange,11,s.friction>=0?"left":"right");
  arrow(ctx,cx,cy,cx,cy-s.normal*scale,COLORS.teal);
  arrow(ctx,cx,cy,cx,cy+s.weight*scale,COLORS.purple);
  text(ctx,`N = ${fmt(s.normal,1)} N`,cx+10,cy-s.normal*scale+5,COLORS.teal,11);
  text(ctx,`mg = ${fmt(s.weight,1)} N`,cx+10,cy+s.weight*scale+2,COLORS.purple,11);
  $("scene-badge").textContent=s.regime==="static"?"Static friction · at rest":"Kinetic friction · sliding";
  $("metrics").innerHTML=metric("Net horizontal force",fmt(s.net),"N","Applied force + friction")+metric("Acceleration",fmt(s.a),"m/s²","Net force ÷ mass")+metric("Velocity now",fmt(s.v),"m/s",`At t = ${fmt(time)} s`)+metric("Position now",fmt(s.x),"m","Measured from the start");
}
function drawVectors(){
  const {ctx,w,h}=context("scene"),a=data.a,b=data.b,r=data.result,e=data.effective_b;
  const points=[{x:0,y:0},a,b,e,r],xmin=Math.min(...points.map(v=>v.x)),xmax=Math.max(...points.map(v=>v.x)),ymin=Math.min(...points.map(v=>v.y)),ymax=Math.max(...points.map(v=>v.y));
  const extent=Math.max(5,xmax-xmin,ymax-ymin),padding=extent*.22;
  const p=plane(ctx,w,h,{xmin:xmin-padding,xmax:xmax+padding,ymin:ymin-padding,ymax:ymax+padding},"x","y");
  const ox=p.x(0),oy=p.y(0);
  if(options.components){line(ctx,ox,oy,p.x(r.x),oy,"#68af94",1.5,[4,4]);line(ctx,p.x(r.x),oy,p.x(r.x),p.y(r.y),"#68af94",1.5,[4,4]);text(ctx,`Rₓ = ${short(r.x)}`,(ox+p.x(r.x))/2,oy+19,COLORS.teal,10,"center");text(ctx,`Rᵧ = ${short(r.y)}`,p.x(r.x)+8,(oy+p.y(r.y))/2+4,COLORS.teal,10);}
  ctx.save();ctx.globalAlpha=.28;arrow(ctx,ox,oy,p.x(e.x),p.y(e.y),COLORS.orange,1.8,[4,4]);ctx.restore();
  arrow(ctx,ox,oy,p.x(r.x),p.y(r.y),COLORS.teal,4);
  arrow(ctx,ox,oy,p.x(a.x),p.y(a.y),COLORS.blue,2.8);
  arrow(ctx,p.x(a.x),p.y(a.y),p.x(r.x),p.y(r.y),COLORS.orange,2.8);
  if(a.magnitude)text(ctx,"A",(ox+p.x(a.x))/2-12,(oy+p.y(a.y))/2-9,COLORS.blue,13);
  if(e.magnitude)text(ctx,data.parameters.operation==="subtract"?"−B":"B",(p.x(a.x)+p.x(r.x))/2+12,(p.y(a.y)+p.y(r.y))/2,COLORS.orange,13);
  if(r.magnitude)text(ctx,"R",p.x(r.x)+12,p.y(r.y)-11,COLORS.teal,13);
  else text(ctx,"R = 0",ox+12,oy-13,COLORS.teal,12);
  circle(ctx,ox,oy,3,COLORS.ink);circle(ctx,p.x(r.x),p.y(r.y),3,COLORS.teal);
  $("scene-badge").textContent=`R = ⟨${short(r.x)}, ${short(r.y)}⟩`;
}
function drawChart(id,key,color){
  const {ctx,w,h}=context(id),samples=data.samples,values=samples.map(s=>s[key]);
  let min=Math.min(0,...values),max=Math.max(0,...values);if(max-min<.01){max+=1;min-=1;}
  const margin=(max-min)*.12;min-=margin;max+=margin;
  const box={left:43,right:w-12,top:18,bottom:h-28};
  const duration=data.duration||1,x=t=>box.left+t/duration*(box.right-box.left),y=v=>box.bottom-(v-min)/(max-min)*(box.bottom-box.top);
  const step=niceStep(max-min,3);
  for(let v=Math.ceil(min/step)*step;v<=max;v+=step){line(ctx,box.left,y(v),box.right,y(v),COLORS.grid);text(ctx,short(v),box.left-6,y(v)+3,COLORS.muted,9,"right");}
  for(let i=0;i<=4;i++){const t=data.duration*i/4;text(ctx,short(t),x(t),h-11,COLORS.muted,9,"center");}
  line(ctx,box.left,y(0),box.right,y(0),"#d8d2c6");
  path(ctx,samples,x,y,"t",key,color,2);
  const s=sampleAt(time);line(ctx,x(time),box.top,x(time),box.bottom,"#c1bcaf",1,[3,3]);circle(ctx,x(time),y(s[key]),3.5,color,"white");
  text(ctx,"t (s)",box.right,h-1,COLORS.muted,9,"right");
}
function drawAll(){
  if(!data||data.kind!==mode)return;
  if(mode==="vectors"){drawVectors();return;}
  if(mode==="projectile"){drawProjectile();drawChart("chart-a","y",COLORS.blue);drawChart("chart-b","vy",COLORS.orange);}
  else {drawForces();drawChart("chart-a","x",COLORS.blue);drawChart("chart-b","v",COLORS.teal);}
  $("clock").textContent=`${fmt(time)} / ${fmt(data.duration)} s`;
  $("timeline").value=data.duration?time/data.duration*1000:0;
  $("timeline").setAttribute("aria-valuetext",`${fmt(time)} seconds of ${fmt(data.duration)} seconds`);
}
function pause(){playing=false;cancelAnimationFrame(animationId);$("play").textContent="▶ Play";$("play").setAttribute("aria-label","Play animation");lastFrame=0;}
function frame(timestamp){
  if(!playing||!data||mode==="vectors")return;
  if(lastFrame)time=Math.min(data.duration,time+Math.min((timestamp-lastFrame)/1000,.1)*Number($("playback").value));
  lastFrame=timestamp;drawAll();
  if(time>=data.duration)pause();else animationId=requestAnimationFrame(frame);
}
document.querySelectorAll(".tab").forEach(button=>button.addEventListener("click",()=>setMode(button.dataset.mode)));
$("play").addEventListener("click",()=>{
  if(!data||!data.duration)return;if(playing){pause();return;}if(time>=data.duration)time=0;
  playing=true;lastFrame=0;$("play").textContent="Ⅱ Pause";$("play").setAttribute("aria-label","Pause animation");animationId=requestAnimationFrame(frame);
});
$("rewind").addEventListener("click",()=>{pause();time=0;drawAll();});
$("timeline").addEventListener("input",()=>{if(!data)return;pause();time=Number($("timeline").value)/1000*data.duration;drawAll();});
$("reset").addEventListener("click",()=>{state[mode]={...DEFAULTS[mode]};buildControls(0);calculateModel();});
document.addEventListener("visibilitychange",()=>{if(document.hidden)pause();});
window.addEventListener("resize",drawAll);
$("analysis").addEventListener("toggle",drawAll);
setMode("projectile");
