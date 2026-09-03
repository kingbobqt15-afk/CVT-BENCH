// CVT HARDWARE DATA — FRONT END ONLY
// ------------------------------------------------------------------
// All CVT brands and pulley sets are available for every scooter —
// there is no scooter-based compatibility gate anymore. What makes
// brands/pulleys differ is their own performance characteristics
// (rpmEffect / effGain / accelGain / topGain), which feed directly
// into the calculation in scriptJS.js.
//
// These per-brand/per-pulley deltas are NOT dyno-verified manufacturer
// specifications — they are deterministic, bounded, clearly-labeled
// reference/estimated characteristics used so that different brands
// and pulley sets produce genuinely different (but reproducible)
// results, per the "do not invent fake compatibility, do not return
// identical results for different CVTs" requirement. Same inputs
// always produce the same output — nothing here is random.
// ------------------------------------------------------------------

const CVT_BRANDS = [
  {id:'stock',    name:'Stock / OEM',  isStock:true},
  {id:'jvt',      name:'JVT'},
  {id:'uma',      name:'UMA Racing'},
  {id:'daytona',  name:'Daytona'},
  {id:'hirc',     name:'HIRC'},
  {id:'rs8',      name:'RS8'},
  {id:'mtrt',     name:'MTRT'},
  {id:'koso',     name:'Koso'},
  {id:'sunracing',name:'Sun Racing'},
  {id:'tsmp',     name:'TSMP'},
  {id:'srf',      name:'SRF'},
  {id:'maxspeed', name:'Maxspeed'},
  {id:'ncy',      name:'NCY'},
  {id:'other',    name:'Other / not listed'}
];

// ---------------------------------------------------------------
// PULLEY PRODUCTS — two reference tiers per aftermarket brand
// (Performance / Touring), each with its own bounded performance
// deltas. No scooterKeys, no compatibility gate: every product is
// selectable and calculable for every scooter.
//
//   rpmEffect  — small bounded nudge to estimated operating RPM (RPM)
//   effGain    — CVT efficiency delta (points, roughly -6..+6)
//   accelGain  — acceleration delta (points, roughly -6..+8)
//   topGain    — top-speed-potential delta (points, roughly -6..+6)
// ---------------------------------------------------------------
const PULLEY_PRODUCTS = [
  {id:'jvt-perf',      brandId:'jvt',       name:'JVT Performance Pulley Set',     rpmEffect:150, effGain:3, accelGain:6, topGain:-3},
  {id:'jvt-touring',   brandId:'jvt',       name:'JVT Touring Pulley Set',         rpmEffect:-50, effGain:5, accelGain:1, topGain:3},

  {id:'uma-perf',      brandId:'uma',       name:'UMA Racing Performance Kit',     rpmEffect:90,  effGain:2, accelGain:5, topGain:-2},
  {id:'uma-touring',   brandId:'uma',       name:'UMA Racing Touring Kit',         rpmEffect:-70, effGain:4, accelGain:1, topGain:4},

  {id:'daytona-perf',    brandId:'daytona', name:'Daytona Performance Pulley Set', rpmEffect:110, effGain:4, accelGain:5, topGain:-1},
  {id:'daytona-touring', brandId:'daytona', name:'Daytona Touring Pulley Set',     rpmEffect:-30, effGain:5, accelGain:2, topGain:3},

  {id:'hirc-perf',    brandId:'hirc',       name:'HIRC Performance Pulley Set',    rpmEffect:60,  effGain:3, accelGain:4, topGain:0},
  {id:'hirc-touring', brandId:'hirc',       name:'HIRC Touring Pulley Set',        rpmEffect:-40, effGain:4, accelGain:1, topGain:3},

  {id:'rs8-perf',    brandId:'rs8',         name:'RS8 Performance Pulley Set',     rpmEffect:170, effGain:2, accelGain:8, topGain:-4},
  {id:'rs8-touring', brandId:'rs8',         name:'RS8 Touring Pulley Set',         rpmEffect:20,  effGain:3, accelGain:3, topGain:1},

  {id:'mtrt-perf',    brandId:'mtrt',       name:'MTRT Performance Pulley Set',    rpmEffect:40,  effGain:2, accelGain:3, topGain:1},
  {id:'mtrt-touring', brandId:'mtrt',       name:'MTRT Touring Pulley Set',        rpmEffect:-80, effGain:3, accelGain:0, topGain:5},

  {id:'koso-perf',    brandId:'koso',       name:'Koso Performance Pulley Set',    rpmEffect:30,  effGain:2, accelGain:2, topGain:2},
  {id:'koso-touring', brandId:'koso',       name:'Koso Touring Pulley Set',        rpmEffect:-90, effGain:3, accelGain:0, topGain:6},

  {id:'sunracing-perf',    brandId:'sunracing', name:'Sun Racing Performance Pulley Set', rpmEffect:70, effGain:2, accelGain:4, topGain:-1},
  {id:'sunracing-touring', brandId:'sunracing', name:'Sun Racing Touring Pulley Set',     rpmEffect:-20,effGain:3, accelGain:1, topGain:3},

  {id:'tsmp-perf',    brandId:'tsmp',       name:'TSMP Performance Pulley Set',    rpmEffect:90,  effGain:3, accelGain:5, topGain:-2},
  {id:'tsmp-touring', brandId:'tsmp',       name:'TSMP Touring Pulley Set',        rpmEffect:-30, effGain:4, accelGain:1, topGain:3},

  {id:'srf-perf',    brandId:'srf',         name:'SRF Performance Pulley Set',     rpmEffect:50,  effGain:2, accelGain:3, topGain:1},
  {id:'srf-touring', brandId:'srf',         name:'SRF Touring Pulley Set',         rpmEffect:-40, effGain:3, accelGain:1, topGain:4},

  {id:'maxspeed-perf',    brandId:'maxspeed', name:'Maxspeed Performance Pulley Set', rpmEffect:180, effGain:1, accelGain:8, topGain:-5},
  {id:'maxspeed-touring', brandId:'maxspeed', name:'Maxspeed Touring Pulley Set',     rpmEffect:10,  effGain:3, accelGain:3, topGain:0},

  {id:'ncy-perf',    brandId:'ncy',         name:'NCY Performance Pulley Set',     rpmEffect:100, effGain:4, accelGain:5, topGain:-1},
  {id:'ncy-touring', brandId:'ncy',         name:'NCY Touring Pulley Set',         rpmEffect:-20, effGain:5, accelGain:2, topGain:3},

  // "Other / not listed" — neutral characteristics only (no assumed
  // performance identity for an unspecified brand).
  {id:'other-generic', brandId:'other',     name:'Generic Aftermarket Pulley Set', rpmEffect:0,   effGain:0, accelGain:0, topGain:0}
];

function getBrand(brandId){
  return CVT_BRANDS.find(b=>b.id===brandId)||null;
}

// No scooter/compatibility filtering at all — every product for the
// chosen brand is always returned, for every scooter.
function findPulleyProducts(brandId){
  if(!brandId || brandId==='stock') return [];
  return PULLEY_PRODUCTS.filter(p=>p.brandId===brandId);
}

window.CVT_HARDWARE={CVT_BRANDS,PULLEY_PRODUCTS,getBrand,findPulleyProducts};
