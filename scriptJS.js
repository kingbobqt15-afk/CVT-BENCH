(function(){
'use strict';

/* ================================================================
   CVT BENCH — FRONT-END CALCULATION ENGINE
   Supabase backend is connected for authentication, saved setups and history.
   The calculator remains deterministic and continues to use the local reference data.

   Architecture notes (post "no compatibility gate" revision):
   - Every CVT brand and every pulley set is available for every
     scooter. There is no scooter-based fitment/compatibility check
     anywhere in this file.
   - Different brands/pulley sets still produce different results —
     see cvtHardwareData.js for the per-product rpmEffect/effGain/
     accelGain/topGain deltas that drive that difference.
   - Riding Goal is an active input to the deterministic automatic setup
     solver. Calculate Setup evaluates goal priorities against the same
     calculation model used for the displayed results.
   - The automatic solver fills the existing editable Try My Setup controls;
     users can then manually tune and recalculate.
   ================================================================ */

const {CLASS_DEFAULTS,SCOOTER_DB,keyOf:scooterKeyOf}=window.CVT_SCOOTERS;
const CVT_HW=window.CVT_HARDWARE;
const VALID_SPRINGS=[800,1000,1200,1500,1800,2000];
const REF_RIDER=65;

// Riding Goal target bands used by both the recommendation solver and
// goal-fit explanation.
const GOALS={
  strong:{label:'Strong Acceleration',targetFraction:0.84},
  balanced:{label:'Balanced',targetFraction:0.56},
  topspeed:{label:'Higher Top Speed',targetFraction:0.42},
  daily:{label:'Daily Riding',targetFraction:0.50},
  race:{label:'Racing / Aggressive',targetFraction:0.90},
  efficient:{label:'Fuel Efficient',targetFraction:0.36}
};

const $=id=>document.getElementById(id);
const navButtons=document.querySelectorAll('nav button');
const views=document.querySelectorAll('.view');
function showView(id){
  views.forEach(v=>v.classList.toggle('active',v.id==='view-'+id));
  navButtons.forEach(b=>b.classList.toggle('active',b.dataset.view===id));
  window.scrollTo({top:0,behavior:'smooth'});
}
navButtons.forEach(b=>b.addEventListener('click',()=>showView(b.dataset.view)));
document.querySelectorAll('[data-goto]').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.goto)));

const scooterSelect=$('scooterSelect');
const scooterSpecNote=$('scooterSpecNote');
const cvtBrand=$('cvtBrand');
const configField=$('configField');
const configSelect=$('configSelect');
const configNote=$('configNote');
const flyball1=$('flyball1');
const flyball2=$('flyball2');
const effectiveFlyballReadout=$('effectiveFlyballReadout');
const riderWeight=$('riderWeight');
const centerSpring=$('centerSpring');
const clutchSpring=$('clutchSpring');
const ridingGoal=$('ridingGoal');
const calcBtn=$('calcBtn');
const goalAutoNote=$('goalAutoNote');

const ticket=$('resultTicket'),verdictText=$('verdictText'),verdictNote=$('verdictNote');
const rowScooter=$('rowScooter'),rowCvtBrand=$('rowCvtBrand'),rowCvtConfig=$('rowCvtConfig'),rowPulley=$('rowPulley');
const rowRider=$('rowRider'),rowFlyball=$('rowFlyball'),rowEffective=$('rowEffective'),rowCenter=$('rowCenter'),rowClutch=$('rowClutch');
const rowEngage=$('rowEngage'),rowShift=$('rowShift'),rowOpRange=$('rowOpRange');
const accelPct=$('accelPct'),topPct=$('topPct'),accelFill=$('accelFill'),topFill=$('topFill');
const accelLabel=$('accelLabel'),fuelPct=$('fuelPct'),cvtEfficiencyPct=$('cvtEfficiencyPct'),stressPct=$('stressPct'),cvtBehaviorText=$('cvtBehaviorText'),goalFitText=$('goalFitText'),whyBox=$('whyBox'),whyText=$('whyText');
const rollerCircle=$('rollerCircle'),springPath=$('springPath'),rollerLabel=$('rollerLabel'),springLabel=$('springLabel');
const tachValue=$('tachValue'),tachNeedle=$('tachNeedle'),engageMarker=$('engageMarker'),shiftMarker=$('shiftMarker');

const recFlyball=$('recFlyball'),recEffective=$('recEffective'),recCenter=$('recCenter'),recClutch=$('recClutch');
const recPulley=$('recPulley'),recConfig=$('recConfig'),recRange=$('recRange'),recWhy=$('recWhy'),recGoalFit=$('recGoalFit');
const metricRPM=$('metricRPM'),metricAccel=$('metricAccel'),metricTop=$('metricTop'),metricFuel=$('metricFuel'),metricCVT=$('metricCVT'),visibleOpRange=$('visibleOpRange'),appliedState=$('appliedState');
const perfAccel=$('perfAccel'),perfTop=$('perfTop'),perfFuel=$('perfFuel'),perfCVT=$('perfCVT'),perfStress=$('perfStress');
const perfAccelFill=$('perfAccelFill'),perfTopFill=$('perfTopFill'),perfFuelFill=$('perfFuelFill'),perfCVTFill=$('perfCVTFill'),perfStressFill=$('perfStressFill');
const perfAccelNote=$('perfAccelNote'),perfTopNote=$('perfTopNote'),perfFuelNote=$('perfFuelNote'),perfCVTNote=$('perfCVTNote'),perfStressNote=$('perfStressNote');

const cmpRecRpm=$('cmpRecRpm'),cmpMyRpm=$('cmpMyRpm'),cmpRecAccel=$('cmpRecAccel'),cmpMyAccel=$('cmpMyAccel');
const cmpRecTop=$('cmpRecTop'),cmpMyTop=$('cmpMyTop'),cmpRecCvt=$('cmpRecCvt'),cmpMyCvt=$('cmpMyCvt');
const cmpRecStress=$('cmpRecStress'),cmpMyStress=$('cmpMyStress');

const saveSetupBtn=$('saveSetupBtn'),clearCompareBtn=$('clearCompareBtn'),compareBody=$('compareBody'),compareEmpty=$('compareEmpty');
let lastResult=null,savedSetups=[];

function clamp(v,lo,hi){return Math.max(lo,Math.min(hi,v));}
function roundHalf(v){return Math.round(v*2)/2;}
function fmt(v){return Math.round(v).toLocaleString();}
function getScooterEntry(key){return SCOOTER_DB.find(s=>scooterKeyOf(s)===key)||null;}
function getClass(entry){return CLASS_DEFAULTS[(entry&&entry.classKey)||'mid'];}
function scooterTechnicalReference(entry){
  const cls=getClass(entry);
  const cc=parseFloat(String(entry&&entry.cc||'').replace(/[^0-9.]/g,''))||0;
  const classCc={small:110,mid:125,midhigh:157,big:300,electric:0}[entry&&entry.classKey]||cc||125;
  const ccDelta=clamp(cc-classCc,-80,120);
  // The project only stores verified/public displacement plus class reference
  // tuning data. Use displacement as a small, bounded model-specific modifier
  // rather than inventing a factory CVT curve for each model.
  return {
    cc,
    rpmBias:clamp(ccDelta*2.5,-180,300),
    flyballBias:clamp(ccDelta*0.012,-0.75,1.2),
    loadFactor:clamp(cc>0?125/cc:1,0.80,1.20)
  };
}
function brandName(id){const b=CVT_HW.getBrand(id);return b?b.name:'—';}
function nearestSpring(v){
  return VALID_SPRINGS.reduce((best,s)=>Math.abs(s-v)<Math.abs(best-v)?s:best,VALID_SPRINGS[0]);
}

function populateScooters(){
  const current=scooterSelect.value;
  scooterSelect.innerHTML='';
  const emptyOption=document.createElement('option');
  emptyOption.value='';emptyOption.textContent='Select Scooter';scooterSelect.appendChild(emptyOption);
  const groups={};
  SCOOTER_DB.forEach(s=>{(groups[s.brand]||(groups[s.brand]=[])).push(s);});
  Object.keys(groups).forEach(brand=>{
    const group=document.createElement('optgroup');group.label=brand;
    groups[brand].forEach(s=>{
      const opt=document.createElement('option');
      opt.value=scooterKeyOf(s);opt.textContent=s.model+' ('+s.cc+')';
      group.appendChild(opt);
    });
    scooterSelect.appendChild(group);
  });
  if([...scooterSelect.options].some(o=>o.value===current)) scooterSelect.value=current;
}
function populateBrands(){
  cvtBrand.innerHTML='';
  CVT_HW.CVT_BRANDS.forEach(b=>{const o=document.createElement('option');o.value=b.id;o.textContent=b.name;cvtBrand.appendChild(o);});
  cvtBrand.value='stock';
}

// Every CVT brand is available for every scooter, and every pulley
// set for the chosen brand is always selectable — there is no
// scooter-based fitment restriction here at all.
function isStockBrand(){
  const b=CVT_HW.getBrand(cvtBrand.value);
  return !b||b.isStock;
}
function updateConfigVisibility(){
  const stock=isStockBrand();
  // Stock/OEM has no aftermarket pulley configuration.
  configField.style.display=stock?'none':'';
  configNote.textContent=stock
    ? "Stock/OEM uses the scooter's OEM/reference CVT characteristics."
    : 'Select the CVT configuration to define how the aftermarket CVT setup is evaluated.';
}
function selectedHardwareCharacteristics(){
  if(isStockBrand()) return {rpmEffect:0,effGain:0,accelGain:0,topGain:0};
  const products=CVT_HW.findPulleyProducts(cvtBrand.value)||[];
  if(!products.length) return {rpmEffect:0,effGain:0,accelGain:0,topGain:0};
  // The pulley dropdown is intentionally removed. Use the brand's seeded
  // reference products as a deterministic brand-level characteristic.
  const avg=key=>products.reduce((sum,p)=>sum+(Number(p[key])||0),0)/products.length;
  const config=configSelect.value==='pulley'?'pulley':'full';
  const factor=config==='pulley'?.85:1;
  return {rpmEffect:avg('rpmEffect')*factor,effGain:avg('effGain')*factor,
    accelGain:avg('accelGain')*factor,topGain:avg('topGain')*factor};
}

function readPositive(el,max=250){
  const v=parseFloat(el.value);
  return Number.isFinite(v)&&v>0&&v<=max?v:null;
}
function sanitize(el,max){
  if(el.value==='')return;
  let s=el.value.replace(/[^0-9.]/g,'');
  const parts=s.split('.');
  if(parts.length>2)s=parts[0]+'.'+parts.slice(1).join('');
  const n=parseFloat(s);
  if(!Number.isFinite(n)||n<0){el.value='';return;}
  el.value=String(Math.min(n,max));
}
function sanitizeFlyball(el,max){
  if(el.value==='')return;
  const cleaned=el.value.replace(/[^0-9.]/g,'');
  const n=parseFloat(cleaned);
  if(!Number.isFinite(n)||n<0){el.value='';return;}
  // Standard flyball inputs are whole grams only. Truncate any typed
  // decimal portion rather than turning 10.5 into 105.
  el.value=String(Math.min(Math.floor(n),max));
}
function fmtGram(v){
  if(!Number.isFinite(v))return '—';
  const rounded=Math.round(v*2)/2;
  return Number.isInteger(rounded)?String(rounded):rounded.toFixed(1);
}
function updateFlyballReadout(){
  const a=readPositive(flyball1,40),b=readPositive(flyball2,40);
  if(a!==null&&b!==null&&Number.isInteger(a)&&Number.isInteger(b)){
    const e=(a+b)/2;
    effectiveFlyballReadout.textContent=fmtGram(e)+' g';
    rowFlyball.textContent=fmtGram(a)+' / '+fmtGram(b)+' g';
    rowEffective.textContent=fmtGram(e)+' g';
    updateFlyballVisual(e);
  }else{
    if(effectiveFlyballReadout)effectiveFlyballReadout.textContent='—';
    rowFlyball.textContent='—';rowEffective.textContent='—';
  }
}
function updateFlyballVisual(e){
  if(!rollerCircle||!rollerLabel)return;
  rollerCircle.setAttribute('r',(6+clamp(e-5,0,24)*.7).toFixed(1));
  rollerLabel.textContent='FLYBALL '+fmtGram(e)+'g';
}
function updateSpringVisual(){
  if(!springPath)return;
  const v=parseFloat(centerSpring.value),r=Number.isFinite(v)?v:1000;
  const amp=14-((r-800)/1200)*8;
  let d='M205,120';
  for(let i=1;i<=6;i++){const x=205+i*10,dy=i%2===0?0:(i%4===1?-amp:amp);d+=' L'+x+','+(120+dy);}
  springPath.setAttribute('d',d);
  springLabel.textContent='CENTER '+(Number.isFinite(v)?v+' RPM':'—');
}

const CX=130,CY=150,MAX_DIAL=12,START_ANGLE=-120,SWEEP=240;
function pointAt(r,a){const rad=a*Math.PI/180;return{x:CX+r*Math.sin(rad),y:CY-r*Math.cos(rad)};}
function angleForRpm(rpm){return START_ANGLE+(clamp(rpm/1000,0,MAX_DIAL)/MAX_DIAL)*SWEEP;}
function arc(r,a0,a1){const p0=pointAt(r,a0),p1=pointAt(r,a1),large=(a1-a0)>180?1:0;return`M${p0.x.toFixed(2)},${p0.y.toFixed(2)} A${r},${r} 0 ${large} 1 ${p1.x.toFixed(2)},${p1.y.toFixed(2)}`;}
function svgEl(tag,attrs){const e=document.createElementNS('http://www.w3.org/2000/svg',tag);Object.keys(attrs).forEach(k=>e.setAttribute(k,attrs[k]));return e;}
function buildTach(){
  const face=$('tachFace');face.innerHTML='';
  face.appendChild(svgEl('path',{d:arc(96,START_ANGLE,START_ANGLE+SWEEP),class:'tach-face-arc'}));
  face.appendChild(svgEl('path',{d:arc(96,angleForRpm(10000),angleForRpm(12000)),class:'tach-redline-arc'}));
  for(let i=0;i<=12;i++){
    const a=START_ANGLE+i/10*SWEEP,p1=pointAt(84,a),p2=pointAt(96,a),lp=pointAt(68,a);
    face.appendChild(svgEl('line',{x1:p1.x,y1:p1.y,x2:p2.x,y2:p2.y,class:'tach-tick-line'}));
    const t=svgEl('text',{x:lp.x,y:lp.y+4,class:'tach-tick-label'});t.textContent=i;face.appendChild(t);
  }
}
function marker(rpm){
  const a=angleForRpm(rpm),tip=pointAt(96,a),b1=pointAt(108,a-3),b2=pointAt(108,a+3);
  return`${tip.x},${tip.y} ${b1.x},${b1.y} ${b2.x},${b2.y}`;
}
function setTach(rpm,engage,shift){
  tachNeedle.style.transform='rotate('+angleForRpm(rpm)+'deg)';
  tachValue.textContent=fmt(rpm);
  engageMarker.setAttribute('points',marker(engage));shiftMarker.setAttribute('points',marker(shift));
}

/* ---------------------------------------------------------------
   Deterministic tuning model
   The numbers are bounded reference factors, not dyno measurements.
   Riding Goal is used by the automatic setup recommender, while the
   same calculated hardware values are then passed through this model
   to update Tuning Results / Performance Analysis.
   --------------------------------------------------------------- */

// A brand/pulley set's own characteristics — used identically whether
// the setup came from the recommendation engine or from the user's
// own Try My Setup inputs. No scooter compatibility check anywhere.
function pulleyCharacteristics(product){
  if(!product)return {rpmEffect:0,effGain:0,accelGain:0,topGain:0};
  return {rpmEffect:product.rpmEffect||0,effGain:product.effGain||0,accelGain:product.accelGain||0,topGain:product.topGain||0};
}

function calculateSetup(entry,rider,eff,center,clutch,hardware){
  const cls=getClass(entry);
  const tech=scooterTechnicalReference(entry);
  const band={
    min:cls.opMin+tech.rpmBias,
    max:cls.opMax+tech.rpmBias
  };
  band.center=(band.min+band.max)/2;
  const riderDelta=rider-REF_RIDER;
  const pc=hardware||{rpmEffect:0,effGain:0,accelGain:0,topGain:0};
  const referenceFly=cls.refFlyball+tech.flyballBias;

  // Deterministic CVT model:
  // lighter rollers -> higher operating RPM; heavier rider load -> lower
  // RPM unless the setup compensates; center spring affects shift force.
  const flyEffect=(referenceFly-eff)*175;
  const centerEffect=(center-cls.refCenter)*0.22;
  const loadEffect=-clamp(riderDelta*1.65*tech.loadFactor,-120,220);
  const shiftRPM=clamp(
    band.center+flyEffect+centerEffect+loadEffect+pc.rpmEffect,
    cls.idleRpm+900, cls.redline-350
  );

  const engageRPM=clamp(
    1650 + clutch*0.58 + clamp(riderDelta*0.55,-45,85),
    cls.idleRpm+250, cls.redline-900
  );

  const rangeSpan=band.max-band.min;
  const normalized=(shiftRPM-band.min)/rangeSpan;
  const rpmInRange=clamp(1-Math.abs(shiftRPM-band.center)/(rangeSpan*.65),0,1);

  const lightness=clamp((referenceFly-eff)/5,-1,1);
  const centerAgg=clamp((center-cls.refCenter)/600,-1,1);
  const clutchAgg=clamp((clutch-cls.refClutch)/600,-1,1);
  const highRpm=clamp((shiftRPM-band.min)/rangeSpan,0,1);

  let accel=58 + highRpm*18 + lightness*10 + centerAgg*4 + clutchAgg*7
    - Math.max(0,riderDelta)*0.10 + pc.accelGain;
  let top=58 + clamp(normalized,0,1)*14 - lightness*7
    + (1-Math.abs(centerAgg)) * 3 + pc.topGain;
  let fuel=91 - Math.abs(shiftRPM-(band.min+rangeSpan*.42))*0.035
    - Math.abs(lightness)*5 - Math.abs(centerAgg)*3
    - Math.max(0,riderDelta)*0.045 + pc.effGain;
  let cvt=88 + rpmInRange*9 + pc.effGain
    - Math.abs(lightness)*3 - Math.abs(centerAgg)*2;
  let stress=30 + highRpm*22 + Math.max(0,center-cls.refCenter)*0.018
    + Math.max(0,clutch-cls.refClutch)*0.012
    + Math.max(0,riderDelta)*0.08;

  accel=clamp(accel,0,100);
  top=clamp(top,0,100);
  fuel=clamp(fuel,0,100);
  cvt=clamp(cvt,0,100);
  stress=clamp(stress,0,100);

  let verdict='Balanced Performance Setup',state='state-balanced',
      note='The setup stays near the scooter reference operating band with a balanced trade-off between response, speed and efficiency.';
  if(stress>=70){
    verdict='High-Stress / Aggressive Setup';state='state-arangkada';
    note='The calculated setup is aggressive and operates toward the upper part of the reference range. Validate temperatures and belt behavior during controlled testing.';
  }else if(accel-top>=10){
    verdict='Arangkada Performance Setup';state='state-arangkada';
    note='The current combination favors quicker launch and throttle response over top-speed potential.';
  }else if(top-accel>=10){
    verdict='Top Speed Performance Setup';state='state-topspeed';
    note='The current combination favors high-speed CVT behavior and shift-out potential.';
  }else if(shiftRPM<band.min-150){
    verdict='Low-RPM / Heavy Shift Setup';state='state-topspeed';
    note='The calculated operating RPM is below the scooter reference band; the setup may feel lazy under load.';
  }

  const behavior=shiftRPM>band.max+120?'Above reference operating range':
    shiftRPM<band.min-120?'Below reference operating range':'Within reference operating range';

  return {
    engageRPM,shiftRPM,effOpMin:band.min,effOpMax:band.max,
    accel,topSpeed:top,fuelEfficiency:fuel,cvtEfficiency:cvt,
    engineStress:stress,rpmSuit:clamp(100-Math.abs(shiftRPM-band.center)/18,0,100),
    verdict,state,note,behavior,
    accelDescriptor:accel>=70?'Strong':accel>=45?'Moderate':'Mild'
  };
}
// Describes how the calculated result relates to the selected Riding Goal.
function goalFit(r,goalKey){
  if(!goalKey)return 'Pick a riding goal to see how the current setup fits it.';
  const goal=GOALS[goalKey];
  const profile=GOAL_TUNING_PROFILES[goalKey]||goal;
  const midpoint=r.effOpMin+(r.effOpMax-r.effOpMin)*profile.targetFraction;
  const delta=r.shiftRPM-midpoint;
  if(Math.abs(delta)<=150)return 'Current setup is close to the typical target RPM for '+goal.label.toLowerCase()+'.';
  return delta>0?'Current setup runs about '+fmt(delta)+' RPM above the typical target for '+goal.label.toLowerCase()+'.':
    'Current setup runs about '+fmt(Math.abs(delta))+' RPM below the typical target for '+goal.label.toLowerCase()+'.';
}

/* ---------------------------------------------------------------
   Recommendation engine
   ---------------------------------------------------------------
   Riding Goal is a weighting/target preference, NOT a fixed preset.
   The recommendation is solved from:
     scooter reference band + rider load + selected CVT/pulley data
     + goal target + goal-specific spring preference.

   The flyball is solved by inverting calculateSetup() so the selected
   target RPM is actually produced by the same deterministic model used
   for the results. Springs are selected from the available ratings.
   --------------------------------------------------------------- */

const GOAL_TUNING_PROFILES={
  strong:{targetFraction:.82,accelWeight:1.65,topWeight:.55,fuelWeight:.35,cvtWeight:.55,stressWeight:1.00,rpmPenalty:.035,centerBias:300,clutchBias:450},
  balanced:{targetFraction:.56,accelWeight:1.00,topWeight:1.05,fuelWeight:1.25,cvtWeight:1.40,stressWeight:1.35,rpmPenalty:.020,centerBias:0,clutchBias:0},
  daily:{targetFraction:.48,accelWeight:.85,topWeight:.90,fuelWeight:1.45,cvtWeight:1.45,stressWeight:1.45,rpmPenalty:.020,centerBias:-100,clutchBias:-100},
  efficient:{targetFraction:.38,accelWeight:.55,topWeight:.85,fuelWeight:1.80,cvtWeight:1.65,stressWeight:1.65,rpmPenalty:.022,centerBias:-200,clutchBias:-150},
  topspeed:{targetFraction:.64,accelWeight:.55,topWeight:1.70,fuelWeight:1.20,cvtWeight:1.40,stressWeight:1.20,rpmPenalty:.018,centerBias:-50,clutchBias:-50},
  race:{targetFraction:.90,accelWeight:1.55,topWeight:1.05,fuelWeight:.25,cvtWeight:.55,stressWeight:1.00,rpmPenalty:.040,centerBias:400,clutchBias:550}
};

function selectedGoalProfile(){return GOAL_TUNING_PROFILES[ridingGoal.value]||null;}
function candidateFlyballPairs(referenceFly){
  const min=clamp(Math.round(referenceFly-5),6,25);
  const max=clamp(Math.round(referenceFly+5),6,25);
  const pairs=[];
  for(let w=min;w<=max;w++){
    pairs.push([w,w]);
    if(w<max)pairs.push([w,w+1]);
  }
  return pairs;
}

function chooseGoalSetup(entry,rider,config){
  const profile=selectedGoalProfile();
  if(!profile)return null;
  const cls=getClass(entry);
  const tech=scooterTechnicalReference(entry);
  const hardware=selectedHardwareCharacteristics();
  const riderDelta=rider-REF_RIDER;
  const band={min:cls.opMin+tech.rpmBias,max:cls.opMax+tech.rpmBias};
  const targetRPM=band.min+(band.max-band.min)*profile.targetFraction;
  const referenceFly=cls.refFlyball+tech.flyballBias;

  // Search around this scooter's own reference flyball and spring ratings.
  // No universal roller weight or universal RPM is used.
  const flyMin=clamp(Math.floor(referenceFly-4),5,25);
  const flyMax=clamp(Math.ceil(referenceFly+4),5,25);
  const flyPairs=[];
  for(let a=flyMin;a<=flyMax;a++){
    flyPairs.push([a,a]);
    if(a<flyMax)flyPairs.push([a,a+1]);
  }

  const loadBias=clamp((riderDelta/25),-1,2.5);
  const centerTarget=cls.refCenter + loadBias*70*tech.loadFactor + profile.centerBias;
  const clutchTarget=cls.refClutch + loadBias*45*tech.loadFactor + profile.clutchBias;
  const centerCandidates=[...new Set([
    nearestSpring(centerTarget-300),nearestSpring(centerTarget-150),
    nearestSpring(centerTarget),nearestSpring(centerTarget+150),
    nearestSpring(centerTarget+300)
  ])];
  const clutchCandidates=[...new Set([
    nearestSpring(clutchTarget-300),nearestSpring(clutchTarget-150),
    nearestSpring(clutchTarget),nearestSpring(clutchTarget+150),
    nearestSpring(clutchTarget+300)
  ])];

  let best=null;
  flyPairs.forEach(([fly1,fly2])=>{
    const effective=(fly1+fly2)/2;
    centerCandidates.forEach(center=>{
      clutchCandidates.forEach(clutch=>{
        const r=calculateSetup(entry,rider,effective,center,clutch,hardware);
        const rpmDistance=Math.abs(r.shiftRPM-targetRPM);
        const rpmFit=clamp(100-rpmDistance/8,0,100);
        const flyDirection=clamp((effective-referenceFly)/4,-1,1);

        // Goal-specific preferences are evaluated against actual calculated
        // performance, while flyball/spring direction keeps the strategy
        // physically coherent and scooter-specific.
        let strategy=0;
        if(ridingGoal.value==='strong'){
          strategy += -flyDirection*18 + clamp((r.shiftRPM-targetRPM)/120,-1,1)*8;
        }else if(ridingGoal.value==='balanced'){
          strategy += -Math.abs(flyDirection)*8 - Math.abs((center-cls.refCenter)/600)*5;
        }else if(ridingGoal.value==='daily'){
          strategy += -Math.abs(flyDirection)*6 - Math.abs(r.engineStress-35)*0.12;
        }else if(ridingGoal.value==='efficient'){
          strategy += -flyDirection*10 - r.engineStress*0.10;
        }else if(ridingGoal.value==='topspeed'){
          strategy += flyDirection*8 + r.topSpeed*0.08;
        }else if(ridingGoal.value==='race'){
          strategy += -flyDirection*12 + (r.accel-r.engineStress)*0.08;
        }

        const score=
          r.accel*profile.accelWeight+
          r.topSpeed*profile.topWeight+
          r.fuelEfficiency*profile.fuelWeight+
          r.cvtEfficiency*profile.cvtWeight+
          rpmFit*0.90+
          strategy-
          r.engineStress*profile.stressWeight-
          rpmDistance*profile.rpmPenalty;

        if(!best||score>best.score){
          best={score,fly1,fly2,effective,center,clutch,
            pulleyProduct:null,goalLabel:GOALS[ridingGoal.value].label,band,targetRPM};
        }
      });
    });
  });
  return best;
}
function applyAutomaticRecommendation(){
  const entry=getScooterEntry(scooterSelect.value);
  const rider=readPositive(riderWeight,250);
  if(!entry){ alert('Please select a scooter first.'); scooterSelect.focus(); return false; }
  if(rider===null){ alert('Please enter a valid rider weight.'); riderWeight.focus(); return false; }
  if(!ridingGoal.value){ alert('Please select a riding goal.'); ridingGoal.focus(); return false; }

  const config=isStockBrand()?'full':(configSelect.value==='pulley'?'pulley':'full');
  const rec=chooseGoalSetup(entry,rider,config);
  if(!rec){ alert('Please select a riding goal.'); ridingGoal.focus(); return false; }

  flyball1.value=String(Math.round(rec.fly1));
  flyball2.value=String(Math.round(rec.fly2));
  centerSpring.value=String(rec.center);
  clutchSpring.value=String(rec.clutch);
  updateSpringVisual();
  updateFlyballReadout();
  recalculate({mode:'automatic'});

  if(goalAutoNote) goalAutoNote.textContent='Automatic setup applied for '+rec.goalLabel+'. The recommended values remain editable.';
  if(appliedState) appliedState.textContent='● Automatic goal setup applied';
  return true;
}

function calculateManualSetup(){
  const entry=getScooterEntry(scooterSelect.value);
  const rider=readPositive(riderWeight,250);
  if(!entry){ alert('Please select a scooter first.'); scooterSelect.focus(); return false; }
  if(rider===null){ alert('Please enter a valid rider weight.'); riderWeight.focus(); return false; }
  const a=readIntegerFlyball(flyball1), b=readIntegerFlyball(flyball2);
  if(a===null || b===null){ alert('Please enter both flyball weights.'); (a===null?flyball1:flyball2).focus(); return false; }
  const center=parseInt(centerSpring.value,10), clutch=parseInt(clutchSpring.value,10);
  if(!VALID_SPRINGS.includes(center) || !VALID_SPRINGS.includes(clutch)){
    alert('Please select both spring ratings.'); return false;
  }
  recalculate({mode:'manual'});
  return !!lastResult;
}

function readIntegerFlyball(el){
  const n=Number(String(el.value).trim());
  return Number.isFinite(n)&&n>=1&&n<=40&&Number.isInteger(n)?n:null;
}

function validate(){
  if(!scooterSelect.value){alert('Please select a scooter first.');return false;}
  if(readPositive(riderWeight,250)===null){alert('Please enter a valid rider weight.');riderWeight.focus();return false;}
  return true;
}

function buildWhy(entry,config){
  const p=[];
  p.push('The calculator uses '+entry.brand+' '+entry.model+' as a '+getClass(entry).label.toLowerCase()+' reference and adjusts the result for displacement, rider load and the selected CVT configuration.');
  p.push('Lighter effective flyball generally raises operating RPM, while heavier effective flyball encourages earlier upshift.');
  if(isStockBrand()) p.push('Stock/OEM uses the scooter reference CVT characteristics with no aftermarket pulley adjustment.');
  else if(config==='pulley') p.push('Pulley Set Only evaluates the selected aftermarket brand without changing the user-selected spring ratings automatically.');
  else p.push('Full CVT Set lets the aftermarket brand characteristics participate in the complete recommendation.');
  p.push('Estimated RPM and performance scores are tuning indicators, not dyno or speedometer measurements.');
  return p.join(' ');
}
function score10(v){return (v/10).toFixed(1);}
function setMetricState(r,cls){
  if(!r){
    [metricRPM,metricAccel,metricTop,metricFuel,metricCVT].forEach((el)=>{if(el)el.textContent='—';});
    if(visibleOpRange)visibleOpRange.textContent='—';
    [perfAccel,perfTop,perfFuel,perfCVT,perfStress].forEach(el=>{if(el)el.textContent='—';});
    [perfAccelFill,perfTopFill,perfFuelFill,perfCVTFill,perfStressFill].forEach(el=>{if(el)el.style.width='0%';});
    return;
  }
  if(metricRPM)metricRPM.innerHTML=fmt(r.shiftRPM)+' <small>RPM</small>';
  if(metricAccel)metricAccel.innerHTML=score10(r.accel)+' <small>/ 10</small>';
  if(metricTop)metricTop.innerHTML=score10(r.topSpeed)+' <small>/ 10</small>';
  if(metricFuel)metricFuel.innerHTML=score10(r.fuelEfficiency)+' <small>/ 10</small>';
  if(metricCVT)metricCVT.innerHTML=Math.round(r.cvtEfficiency)+'<small>%</small>';
  if(visibleOpRange)visibleOpRange.textContent=fmt(r.effOpMin)+' – '+fmt(r.effOpMax)+' RPM';
  const vals=[[perfAccel,perfAccelFill,r.accel],[perfTop,perfTopFill,r.topSpeed],[perfFuel,perfFuelFill,r.fuelEfficiency],[perfCVT,perfCVTFill,r.cvtEfficiency],[perfStress,perfStressFill,r.engineStress]];
  vals.forEach(([el,fill,v])=>{if(el)el.textContent=(el===perfCVT?Math.round(v)+'%':score10(v)+'/10');if(fill)fill.style.width=Math.round(v)+'%';});
  if(perfAccelNote)perfAccelNote.textContent=r.accel>=75?'Quick response and strong initial pull.':r.accel>=55?'Good response with a balanced launch.':'Softer acceleration focus.';
  if(perfTopNote)perfTopNote.textContent=r.topSpeed>=75?'Strong high-speed pull potential.':r.topSpeed>=55?'Balanced for mid-to-high RPM pull.':'Acceleration-biased setup.';
  if(perfFuelNote)perfFuelNote.textContent=r.fuelEfficiency>=80?'Good economy with controlled RPM.':r.fuelEfficiency>=60?'Moderate efficiency for the selected setup.':'Higher RPM/load may reduce economy.';
  if(perfCVTNote)perfCVTNote.textContent=r.cvtEfficiency>=80?'Good power transfer with minimal modeled loss.':r.cvtEfficiency>=60?'Reasonable power transfer balance.':'Setup is farther from the modeled efficient range.';
  if(perfStressNote)perfStressNote.textContent=r.engineStress<55?'Low relative stress for this model.':r.engineStress<75?'Moderate relative stress; monitor heat and belt condition.':'Higher relative stress; test conservatively.';
}

function updateRecommendationCard(entry,rider,config){
  if(!entry){
    recFlyball.textContent='—';recEffective.textContent='—';recCenter.textContent='—';recClutch.textContent='—';
    recPulley.textContent='—';recConfig.textContent='—';recRange.textContent='—';
    recWhy.textContent='Select a scooter to generate a technically-calculated recommendation.';
    recGoalFit.textContent='Pick a Riding Goal, then click Calculate Setup to generate the goal-specific automatic setup.';
    setCompareState(null,null);
    return;
  }
  const rec=chooseGoalSetup(entry,rider||REF_RIDER,config);
  if(!rec){
    recFlyball.textContent='—';recEffective.textContent='—';recCenter.textContent='—';recClutch.textContent='—';
    recPulley.textContent=isStockBrand()?'Stock / OEM':brandName(cvtBrand.value)+' reference';
    recConfig.textContent=isStockBrand()?'Stock / OEM':(config==='pulley'?'Pulley Set Only':'Full CVT Set');
    const cls=getClass(entry),tech=scooterTechnicalReference(entry);
    recRange.textContent=fmt(cls.opMin+tech.rpmBias)+'–'+fmt(cls.opMax+tech.rpmBias)+' RPM';
    recWhy.textContent='Select a Riding Goal, then click Calculate Setup to generate the automatic Flyball and spring recommendation.';
    recGoalFit.textContent='Pick a Riding Goal to see a goal-specific recommendation.';
    setCompareState(null,lastResult?lastResult.result:null);
    return;
  }
  recFlyball.textContent=fmtGram(rec.fly1)+' g / '+fmtGram(rec.fly2)+' g';
  recEffective.textContent=fmtGram(rec.effective)+' g';
  recCenter.textContent=rec.center+' RPM';
  recClutch.textContent=rec.clutch+' RPM';
  recPulley.textContent=isStockBrand()?'Stock / OEM':brandName(cvtBrand.value)+' reference';
  recConfig.textContent=isStockBrand()?'Stock / OEM':(config==='pulley'?'Pulley Set Only':'Full CVT Set');
  recRange.textContent=fmt(rec.band.min)+'–'+fmt(rec.band.max)+' RPM';
  recWhy.textContent=buildWhy(entry,config);
  const recResult=calculateSetup(entry,rider||REF_RIDER,rec.effective,rec.center,rec.clutch,selectedHardwareCharacteristics());
  recGoalFit.textContent=goalFit(recResult,ridingGoal.value);
  setCompareState(recResult,lastResult?lastResult.result:null);
}
function setCompareState(recResult,myResult){
  const cells=[[cmpRecRpm,cmpMyRpm,'shiftRPM',v=>fmt(v)+' RPM'],
    [cmpRecAccel,cmpMyAccel,'accel',v=>score10(v)+'/10'],
    [cmpRecTop,cmpMyTop,'topSpeed',v=>score10(v)+'/10'],
    [cmpRecCvt,cmpMyCvt,'cvtEfficiency',v=>Math.round(v)+'%'],
    [cmpRecStress,cmpMyStress,'engineStress',v=>score10(v)+'/10']];
  cells.forEach(([recEl,myEl,key,f])=>{
    if(recEl)recEl.textContent=recResult?f(recResult[key]):'—';
    if(myEl)myEl.textContent=myResult?f(myResult[key]):'—';
  });
}

function recalculate(options={mode:'live'}){
  const entry=getScooterEntry(scooterSelect.value);
  const rider=readPositive(riderWeight,250);
  const a=readIntegerFlyball(flyball1), b=readIntegerFlyball(flyball2);
  const center=parseInt(centerSpring.value,10), clutch=parseInt(clutchSpring.value,10);
  const config=isStockBrand()?'full':(configSelect.value==='pulley'?'pulley':'full');

  rowScooter.textContent=entry?entry.brand+' '+entry.model:'—';
  rowRider.textContent=rider?rider+' kg':'—';
  rowCvtBrand.textContent=brandName(cvtBrand.value);
  rowCvtConfig.textContent=isStockBrand()?'Stock / OEM':(config==='pulley'?'Pulley Set Only':'Full CVT Set');
  const hardware=selectedHardwareCharacteristics();
  rowPulley.textContent=isStockBrand()?'Stock / OEM':brandName(cvtBrand.value)+' reference';

  updateFlyballReadout();
  rowCenter.textContent=VALID_SPRINGS.includes(center)?center+' RPM':'—';
  rowClutch.textContent=VALID_SPRINGS.includes(clutch)?clutch+' RPM':'—';

  if(!entry){
    ticket.className='result-ticket state-idle'; verdictText.textContent='Select your scooter'; verdictNote.textContent='Choose a scooter to load its reference tuning range.';
    rowEngage.textContent='—';rowShift.textContent='—';rowOpRange.textContent='—';accelPct.textContent='—';topPct.textContent='—';
    accelFill.style.width='0%';topFill.style.width='0%';accelLabel.textContent='—';fuelPct.textContent='—';cvtEfficiencyPct.textContent='—';stressPct.textContent='—';cvtBehaviorText.textContent='—';
    goalFitText.textContent='Pick a riding goal above to see how a setup fits it.';whyBox.style.display='none';setTach(0,0,0);setMetricState(null);lastResult=null;updateRecommendationCard(null);return;
  }

  const cls=getClass(entry);
  scooterSpecNote.textContent=entry.cc+' · '+cls.label+' · reference flyball '+cls.refFlyball+' g · reference operating range '+fmt(cls.opMin)+'–'+fmt(cls.opMax)+' RPM. These are class/reference values, not exact per-model factory calibration.';

  // Manual/live analysis needs only complete setup values. Riding Goal is optional.
  if(!rider || a===null || b===null || !VALID_SPRINGS.includes(center) || !VALID_SPRINGS.includes(clutch)){
    ticket.className='result-ticket state-idle'; verdictText.textContent='Awaiting setup values'; verdictNote.textContent='Enter rider weight, both flyball weights, and both spring ratings to calculate.';
    rowOpRange.textContent=fmt(cls.opMin)+'–'+fmt(cls.opMax)+' RPM';rowEngage.textContent='—';rowShift.textContent='—';accelPct.textContent='—';topPct.textContent='—';
    accelFill.style.width='0%';topFill.style.width='0%';accelLabel.textContent='—';fuelPct.textContent='—';cvtEfficiencyPct.textContent='—';stressPct.textContent='—';cvtBehaviorText.textContent='—';
    setTach(cls.idleRpm,cls.idleRpm,cls.idleRpm);setMetricState(null);if(visibleOpRange)visibleOpRange.textContent=fmt(cls.opMin)+' – '+fmt(cls.opMax)+' RPM';
    lastResult=null;updateRecommendationCard(entry,rider,config);return;
  }

  const eff=(a+b)/2;
  const r=calculateSetup(entry,rider,eff,center,clutch,hardware);
  ticket.className='result-ticket '+r.state;verdictText.textContent=r.verdict;verdictNote.textContent=r.note;
  rowOpRange.textContent=fmt(r.effOpMin)+'–'+fmt(r.effOpMax)+' RPM';rowEngage.textContent=fmt(r.engageRPM)+' RPM';rowShift.textContent=fmt(r.shiftRPM)+' RPM';
  accelPct.textContent=Math.round(r.accel)+'%';topPct.textContent=Math.round(r.topSpeed)+'%';accelFill.style.width=Math.round(r.accel)+'%';topFill.style.width=Math.round(r.topSpeed)+'%';
  accelLabel.textContent=r.accelDescriptor;fuelPct.textContent=Math.round(r.fuelEfficiency)+'%';cvtEfficiencyPct.textContent=Math.round(r.cvtEfficiency)+'%';stressPct.textContent=Math.round(r.engineStress)+'%';cvtBehaviorText.textContent=r.behavior;goalFitText.textContent=goalFit(r,ridingGoal.value);
  setTach(r.shiftRPM,r.engageRPM,r.shiftRPM);setMetricState(r,cls);whyBox.style.display='block';whyText.textContent=buildWhy(entry,config);
  if(appliedState && options.mode==='manual') appliedState.textContent='● Manual setup calculated';

  lastResult={scooterLabel:entry.brand+' '+entry.model,riderKg:rider,flyballSetup:fmtGram(a)+' / '+fmtGram(b),effFlyball:eff,centerSpring:center,clutchSpring:clutch,pulley:isStockBrand()?'Stock / OEM':brandName(cvtBrand.value)+' reference',config,goal:ridingGoal.value||'No Specific Goal',shiftRPM:r.shiftRPM,verdict:r.verdict,tagClass:r.state==='state-balanced'?'tag-balanced':r.state==='state-arangkada'?'tag-arangkada':'tag-top',result:r};
  updateRecommendationCard(entry,rider,config);

  // Every successful Calculate Setup becomes a comparison snapshot automatically.
  if(options.mode==='manual' || options.mode==='automatic'){
    savedSetups.push({...lastResult, timestamp:Date.now(), setupNumber:savedSetups.length+1});
    if(savedSetups.length>4) savedSetups.shift();
    renderCompare();
  }
}

function renderCompare(){
  compareBody.innerHTML='';compareEmpty.style.display=savedSetups.length?'none':'block';
  savedSetups.forEach((s,i)=>{
    const tr=document.createElement('tr');
    tr.innerHTML='<td>'+s.scooterLabel+'</td><td>'+s.riderKg+' kg</td><td>'+s.flyballSetup+'</td><td>'+fmtGram(s.effFlyball)+' g</td><td>'+fmt(s.shiftRPM)+' RPM</td><td class="'+s.tagClass+'">'+s.verdict+'</td><td><button class="btn ghost small" data-i="'+i+'">Remove</button></td>';
    compareBody.appendChild(tr);
  });
  compareBody.querySelectorAll('[data-i]').forEach(b=>b.addEventListener('click',()=>{savedSetups.splice(+b.dataset.i,1);renderCompare();}));
}

/* Events */
populateScooters();populateBrands();updateConfigVisibility();buildTach();updateSpringVisual();recalculate();

scooterSelect.addEventListener('change',()=>{recalculate();});
cvtBrand.addEventListener('change',()=>{updateConfigVisibility();recalculate();});
configSelect.addEventListener('change',recalculate);
flyball1.addEventListener('input',()=>{sanitizeFlyball(flyball1,40);recalculate();});
flyball2.addEventListener('input',()=>{sanitizeFlyball(flyball2,40);recalculate();});
riderWeight.addEventListener('input',()=>{sanitize(riderWeight,250);recalculate();});
centerSpring.addEventListener('change',()=>{updateSpringVisual();recalculate();});
clutchSpring.addEventListener('change',recalculate);
ridingGoal.addEventListener('change',recalculate);
calcBtn.addEventListener('click',()=>{
  if(ridingGoal.value) applyAutomaticRecommendation();
  else calculateManualSetup();
  calcBtn.style.transform='scale(1.015)';setTimeout(()=>calcBtn.style.transform='',150);
});
saveSetupBtn.addEventListener('click',async()=>{if(!lastResult){alert('Complete a valid setup first.');return;} savedSetups.push({...lastResult}); if(savedSetups.length>4)savedSetups.shift(); renderCompare(); if(window.CVTBenchSetups){ const result=await window.CVTBenchSetups.saveSetup(lastResult); if(result.success){ console.log('CVT//BENCH: Setup saved to Supabase.'); await window.CVTBenchSetups.addHistory('save_setup',lastResult,result.data&&result.data.id?result.data.id:null); } else if(result.requiresLogin){ console.info('CVT//BENCH: Setup kept in the current comparison list. Log in to sync saved setups to Supabase.'); } else { console.warn('CVT//BENCH: Could not save setup to Supabase:',result.error); } }});
clearCompareBtn.addEventListener('click',()=>{savedSetups=[];renderCompare();});

})();
