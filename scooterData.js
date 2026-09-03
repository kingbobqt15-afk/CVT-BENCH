// ================================================================
// SCOOTER DATABASE
// ------------------------------------------------------------------
// Structured, brand-grouped list of Philippine-market automatic
// scooters. Kept deliberately simple/extensible: to add a model,
// add one entry to SCOOTER_DB with {brand, model, cc, classKey}.
//
// IMPORTANT — what's real vs. what's a reference default:
//   - brand / model / approximate engine displacement (cc) are the
//     model's known public specs.
//   - Exact stock roller weight, stock RPM curves, and stock clutch
//     engagement RPM are NOT reliably documented per model and are
//     NOT invented here. Instead every model is bucketed into an
//     ENGINE CLASS (see CLASS_DEFAULTS below), and the class carries
//     one clearly-labeled set of reference/default values used as a
//     stand-in baseline for the calculation. This keeps the tool
//     honest: it never pretends to know a spec it doesn't.
// ================================================================

const CLASS_DEFAULTS = {
  small: {
    label: 'Small automatic (~100-115cc)',
    idleRpm: 1500,
    redline: 8500,
    refFlyball: 8,     // g, class reference/stock flyball weight
    rollerCount: 6,
    refCenter: 1000,   // RPM rating
    refClutch: 1000,   // RPM rating
    // opMin/opMax: recommended operating band, calibrated against what
    // computeSetup() can actually produce for this class (see the
    // formula in scriptJS.js) so "within range" is a reachable result,
    // not a target the math can never hit.
    opMin: 5200,
    opMax: 7000
  },
  mid: {
    label: '125cc automatic',
    idleRpm: 1500,
    redline: 8800,
    refFlyball: 12,
    rollerCount: 6,
    refCenter: 1000,
    refClutch: 1000,
    opMin: 5200,
    opMax: 7000
  },
  midhigh: {
    label: '150-160cc automatic',
    idleRpm: 1400,
    redline: 9000,
    refFlyball: 15,
    rollerCount: 6,
    refCenter: 1200,
    refClutch: 1200,
    opMin: 5400,
    opMax: 7200
  },
  big: {
    label: '250cc+ automatic',
    idleRpm: 1300,
    redline: 9500,
    refFlyball: 20,
    rollerCount: 6,
    refCenter: 1500,
    refClutch: 1500,
    opMin: 5600,
    opMax: 7400
  },
  electric: {
    label: 'Electric drivetrain (reference only — no combustion redline)',
    idleRpm: 0,
    redline: 6000,
    refFlyball: 12,
    rollerCount: 0,
    refCenter: 1000,
    refClutch: 1000,
    opMin: 3000,
    opMax: 5500
  }
};

// Each entry: brand, model (display name), cc (display string —
// "—" where a displacement isn't applicable/known), classKey (which
// CLASS_DEFAULTS bucket supplies the reference baseline).
const SCOOTER_DB = [
  // ---------------- HONDA ----------------
  { brand: 'Honda', model: 'BeAT', cc: '110cc', classKey: 'small' },
  { brand: 'Honda', model: 'Click 125', cc: '125cc', classKey: 'mid' },
  { brand: 'Honda', model: 'Click 160', cc: '157cc', classKey: 'midhigh' },
  { brand: 'Honda', model: 'ADV160', cc: '157cc', classKey: 'midhigh' },
  { brand: 'Honda', model: 'PCX160', cc: '157cc', classKey: 'midhigh' },
  { brand: 'Honda', model: 'Air Blade', cc: '125cc', classKey: 'mid' },
  { brand: 'Honda', model: 'Vario', cc: '125cc', classKey: 'mid' },
  { brand: 'Honda', model: 'Scoopy', cc: '110cc', classKey: 'small' },
  { brand: 'Honda', model: 'Giorno', cc: '110cc', classKey: 'small' },
  { brand: 'Honda', model: 'Genio', cc: '110cc', classKey: 'small' },
  { brand: 'Honda', model: 'Dio', cc: '110cc', classKey: 'small' },
  { brand: 'Honda', model: 'Navi', cc: '109cc', classKey: 'small' },

  // ---------------- YAMAHA ----------------
  { brand: 'Yamaha', model: 'Mio Sporty', cc: '115cc', classKey: 'small' },
  { brand: 'Yamaha', model: 'Mio i 125', cc: '125cc', classKey: 'mid' },
  { brand: 'Yamaha', model: 'Mio i 125 S', cc: '125cc', classKey: 'mid' },
  { brand: 'Yamaha', model: 'Mio Soul i 125', cc: '125cc', classKey: 'mid' },
  { brand: 'Yamaha', model: 'Mio Soul i 125 S', cc: '125cc', classKey: 'mid' },
  { brand: 'Yamaha', model: 'Mio Gear', cc: '125cc', classKey: 'mid' },
  { brand: 'Yamaha', model: 'Mio Gear S', cc: '125cc', classKey: 'mid' },
  { brand: 'Yamaha', model: 'Mio Gravis', cc: '125cc', classKey: 'mid' },
  { brand: 'Yamaha', model: 'Fazzio', cc: '125cc', classKey: 'mid' },
  { brand: 'Yamaha', model: 'Grand Filano', cc: '125cc', classKey: 'mid' },
  { brand: 'Yamaha', model: 'Aerox', cc: '155cc', classKey: 'midhigh' },
  { brand: 'Yamaha', model: 'Aerox S', cc: '155cc', classKey: 'midhigh' },
  { brand: 'Yamaha', model: 'Aerox SP', cc: '155cc', classKey: 'midhigh' },
  { brand: 'Yamaha', model: 'NMAX', cc: '155cc', classKey: 'midhigh' },
  { brand: 'Yamaha', model: 'NMAX ABS', cc: '155cc', classKey: 'midhigh' },
  { brand: 'Yamaha', model: 'XMAX', cc: '250cc', classKey: 'big' },

  // ---------------- SUZUKI ----------------
  { brand: 'Suzuki', model: 'Skydrive Sport', cc: '113cc', classKey: 'small' },
  { brand: 'Suzuki', model: 'Skydrive Crossover', cc: '113cc', classKey: 'small' },
  { brand: 'Suzuki', model: 'Avenis', cc: '125cc', classKey: 'mid' },
  { brand: 'Suzuki', model: 'Burgman Street', cc: '124cc', classKey: 'mid' },
  { brand: 'Suzuki', model: 'Burgman Street 125 EX', cc: '124cc', classKey: 'mid' },
  { brand: 'Suzuki', model: 'Access', cc: '124cc', classKey: 'mid' },
  { brand: 'Suzuki', model: 'Access Ride Connect', cc: '124cc', classKey: 'mid' },

  // ---------------- KYMCO ----------------
  { brand: 'Kymco', model: 'Like 125', cc: '125cc', classKey: 'mid' },
  { brand: 'Kymco', model: 'Like 150i', cc: '150cc', classKey: 'midhigh' },
  { brand: 'Kymco', model: 'Visa R', cc: '110cc', classKey: 'small' },
  { brand: 'Kymco', model: 'Agility', cc: '125cc', classKey: 'mid' },
  { brand: 'Kymco', model: 'Agility ECO 125', cc: '125cc', classKey: 'mid' },
  { brand: 'Kymco', model: 'DTX 360', cc: '278cc', classKey: 'big' },
  { brand: 'Kymco', model: 'Xciting', cc: '300cc', classKey: 'big' },
  { brand: 'Kymco', model: 'Xciting X350', cc: '350cc', classKey: 'big' },
  { brand: 'Kymco', model: 'Xciting VS 400', cc: '400cc', classKey: 'big' },
  { brand: 'Kymco', model: 'AK 550', cc: '550cc', classKey: 'big' },
  { brand: 'Kymco', model: 'AK 550 Premium', cc: '550cc', classKey: 'big' },

  // ---------------- VESPA ----------------
  { brand: 'Vespa', model: 'S', cc: '150cc', classKey: 'midhigh' },
  { brand: 'Vespa', model: 'Primavera', cc: '150cc', classKey: 'midhigh' },
  { brand: 'Vespa', model: 'Sprint', cc: '150cc', classKey: 'midhigh' },
  { brand: 'Vespa', model: 'GTS', cc: '300cc', classKey: 'big' },
  { brand: 'Vespa', model: 'GTV', cc: '300cc', classKey: 'big' },

  // ---------------- MOTORSTAR ----------------
  { brand: 'MotorStar', model: 'Viber', cc: '125cc', classKey: 'mid' },
  { brand: 'MotorStar', model: 'Elite350i', cc: '350cc', classKey: 'big' },
  { brand: 'MotorStar', model: 'Urban125', cc: '125cc', classKey: 'mid' },
  { brand: 'MotorStar', model: 'Co-in125', cc: '125cc', classKey: 'mid' },
  { brand: 'MotorStar', model: 'e-Scooter (electric)', cc: 'Electric', classKey: 'electric' },

  // ---------------- BRISTOL ----------------
  { brand: 'Bristol', model: 'ADX 160', cc: '160cc', classKey: 'midhigh' },
  { brand: 'Bristol', model: 'Zontes 400M', cc: '400cc', classKey: 'big' },
];

function scooterKeyOf(entry) {
  return (entry.brand + '_' + entry.model).replace(/[^a-zA-Z0-9]+/g, '_');
}

// Exposed globally (plain <script> include, no bundler in this project)
window.CVT_SCOOTERS = {
  CLASS_DEFAULTS: CLASS_DEFAULTS,
  SCOOTER_DB: SCOOTER_DB,
  keyOf: scooterKeyOf
};
