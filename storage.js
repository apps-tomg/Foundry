const STORE_KEY = "ironPlanData_v3";

function defaultState(){
  return {
    planKey: "3x20",
    updatedAt: null,
    sessions: [],
    cardioSessions: [],
    bests: {},
    lastDay: 0,
    bodyweights: [],
    measurements: [],
    photos: [],
    unlockedBadges: [],
    overrides: {},
    dayOrder: {},
    customExercises: {},
    customPlans: {},
    tierLadder: [],
    machineSetups: {},
    program: null,
    lastRecapWeek: null,
    soreFlags: {},
    circuitMode: {},
    settings: {
      theme:'system', coachTone:'standard', weeklySessionTarget:3, weeklySessionFloor:2, travelMode:false, restSeconds:60, weeklyGoal:0, handleWeight:2.5, notifyRest:false,
      progressionIncrement: 2, passcodeEnabled:false, passcodeHash: null, goalFocus:'muscle',
      units:'kg', displayName:'', shareStats:false, firstName:'', trainingDays:null
    }
  };
}

function migrateSession(s){
  const lifts = {};
  Object.entries(s.lifts || {}).forEach(([name, val])=>{
    if(Array.isArray(val)) lifts[name] = { sets: val, note: '' };
    else lifts[name] = { sets: val.sets || [], note: val.note || '' };
  });
  return Object.assign({}, s, { lifts });
}

function loadState(){
  const base = defaultState();
  try{
    const raw = localStorage.getItem(STORE_KEY);
    if(raw){
      const parsed = JSON.parse(raw);
      const merged = Object.assign(base, parsed);
      merged.settings = Object.assign(base.settings, parsed.settings || {});
      merged.sessions = (parsed.sessions || []).map(migrateSession);
      merged.unlockedBadges = parsed.unlockedBadges || [];
      merged.overrides = parsed.overrides || {};
      merged.dayOrder = parsed.dayOrder || {};
      merged.customExercises = parsed.customExercises || {};
      merged.customPlans = parsed.customPlans || {};
      merged.tierLadder = parsed.tierLadder || [];
      merged.machineSetups = parsed.machineSetups || {};
      merged.soreFlags = parsed.soreFlags || {};
      merged.circuitMode = parsed.circuitMode || {};
      merged.cardioSessions = parsed.cardioSessions || [];
      merged.measurements = parsed.measurements || [];
      return merged;
    }
  }catch(e){}
  return base;
}

// Display label for weights. Data is stored as entered; this only labels it,
// so someone who logs in pounds sees pounds everywhere, consistently.
function WU(){
  try{ return (state && state.settings && state.settings.units) === 'lb' ? 'lb' : 'kg'; }
  catch(e){ return 'kg'; }
}

function saveState(state){
  try{
    state.updatedAt = new Date().toISOString();
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
    if(typeof scheduleSyncPush === 'function') scheduleSyncPush();
    return true;
  }catch(e){
    return false;
  }
}

function epley(weight, reps){
  if(!weight || !reps) return 0;
  return Math.round(weight * (1 + reps/30));
}

function sessionVolume(record){
  let total = 0;
  Object.values(record.lifts).forEach(l => l.sets.forEach(s => total += s.w * s.r));
  return Math.round(total);
}

function bestE1rmInSession(record, exName){
  const lift = record.lifts[exName];
  if(!lift) return null;
  let best = 0;
  lift.sets.forEach(s => best = Math.max(best, epley(s.w, s.r)));
  return best;
}

function lastVsPrevDelta(state, exName){
  const relevant = state.sessions.filter(s => s.lifts[exName]);
  if(relevant.length < 2) return '';
  const latest = bestE1rmInSession(relevant[0], exName);
  const prev = bestE1rmInSession(relevant[1], exName);
  if(latest === prev) return `<span class="delta flat">FLAT</span>`;
  const diff = latest - prev;
  const cls = diff > 0 ? 'up' : 'down';
  const sign = diff > 0 ? '+' : '';
  return `<span class="delta ${cls}">${sign}${diff} vs last</span>`;
}

function isoWeekKey(dateStr){
  const d = new Date(dateStr);
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const week = 1 + Math.round(((target - firstThursday) / 86400000 - 3 + ((firstThursday.getDay() + 6) % 7)) / 7);
  return `${target.getFullYear()}-W${week}`;
}

function weeklyVolumes(state){
  const map = {};
  state.sessions.forEach(s => {
    const key = isoWeekKey(s.date);
    map[key] = (map[key] || 0) + (s.volume || sessionVolume(s));
  });
  return map;
}

function checkDeload(state){
  const map = weeklyVolumes(state);
  const keys = Object.keys(map).sort();
  if(keys.length < 4) return null;
  const last4 = keys.slice(-4).map(k => map[k]);
  let increasing = true;
  for(let i=1;i<last4.length;i++){ if(last4[i] <= last4[i-1]) increasing = false; }
  return increasing ? last4 : null;
}

function platesForWeight(targetTotal, handleWeight){
  let perSide = (targetTotal - handleWeight) / 2;
  if(perSide <= 0) return { perSide:0, combo:[] };
  const combo = [];
  let remaining = perSide;
  PLATE_SET.forEach(p => {
    while(remaining >= p - 0.001){ combo.push(p); remaining -= p; }
  });
  return { perSide, combo };
}

function updateStreak(state){
  const allDates = [
    ...state.sessions.map(s => s.date.slice(0,10)),
    ...(state.cardioSessions || []).map(s => s.date.slice(0,10))
  ];
  if(allDates.length === 0){ state.streak = 0; return; }
  const trained = new Set(allDates);
  const schedule = state.settings.trainingDays; // e.g. [1,3,5] = Mon/Wed/Fri

  if(Array.isArray(schedule) && schedule.length){
    // Schedule-aware streak: only scheduled days count and only missed
    // scheduled days break it. A planned rest day is never a broken streak,
    // and today doesn't count against you until it's over.
    const dateStr = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    let streak = 0;
    const cursor = new Date();
    cursor.setHours(0,0,0,0);
    for(let i = 0; i < 730; i++){
      const isScheduled = schedule.includes(cursor.getDay());
      const didTrain = trained.has(dateStr(cursor));
      if(isScheduled){
        if(didTrain) streak++;
        else if(i > 0) break; // today pending is fine; a past miss ends it
      } else if(didTrain){
        streak++; // bonus sessions on rest days still count
      }
      cursor.setDate(cursor.getDate() - 1);
    }
    state.streak = streak;
    return;
  }

  // Legacy behaviour with no schedule: any gap over 3 days breaks the chain.
  const days = [...new Set(allDates)].sort().reverse();
  let streak = 1;
  for(let i=0; i<days.length-1; i++){
    const diff = (new Date(days[i]) - new Date(days[i+1])) / 86400000;
    if(diff <= 3) streak++; else break;
  }
  state.streak = streak;
}

// Days since each muscle group was last trained, based on the exercise-to-muscle
// mapping in plans.js. Returns { chest: 2, back: 0, ... } or null for never trained.
function muscleRecovery(state){
  const lastTrained = {};
  MUSCLE_GROUPS.forEach(g => lastTrained[g] = null);

  const allExercises = {};
  Object.values(getAllPlans(state)).forEach(p => p.days.forEach(d => d.exercises.forEach(e => {
    allExercises[e.name] = e.muscle;
  })));

  state.sessions.forEach(s => {
    const sessionDate = new Date(s.date);
    Object.keys(s.lifts).forEach(exName => {
      const muscle = allExercises[exName];
      if(!muscle) return;
      if(lastTrained[muscle] === null || sessionDate > lastTrained[muscle]){
        lastTrained[muscle] = sessionDate;
      }
    });
  });

  const now = new Date();
  const result = {};
  MUSCLE_GROUPS.forEach(g => {
    if(lastTrained[g] === null){ result[g] = null; return; }
    result[g] = Math.floor((now - lastTrained[g]) / 86400000);
  });
  return result;
}

function checkBadges(state){
  const newly = [];
  BADGES.forEach(b => {
    if(!state.unlockedBadges.includes(b.id) && b.check(state)){
      state.unlockedBadges.push(b.id);
      newly.push(b.label);
    }
  });
  return newly;
}

// Extracts {sets, reps} from a target string regardless of case or spacing,
// e.g. "3 x 12", "3X12", "3  x   12" all parse the same way. Returns null if
// the string doesn't contain a recognizable "number x number" pattern.
function parseTarget(target){
  const match = String(target || '').match(/(\d+)\s*x\s*(\d+)/i);
  if(!match) return null;
  return { sets: parseInt(match[1]), reps: parseInt(match[2]) };
}

function overrideKey(planKey, dayIndex, exIndex){
  return `${planKey}|${dayIndex}|${exIndex}`;
}

function getEffectiveExercise(state, planKey, dayIndex, exIndex, baseEx){
  const key = overrideKey(planKey, dayIndex, exIndex);
  const overrideName = state.overrides[key];
  if(overrideName) return { name: overrideName, target: baseEx.target, muscle: baseEx.muscle, isOverride:true, baseName: baseEx.name };
  return { name: baseEx.name, target: baseEx.target, muscle: baseEx.muscle, isOverride:false, baseName: baseEx.name };
}

// Suggests a weight bump when the top set has hit the target rep count
// at the same weight for the last two logged sessions of that exercise.
function progressionSuggestion(state, exName, targetReps){
  // During a programmed deload week, don't nudge the weight up.
  const prog = programWeekInfo(state);
  if(prog && prog.isDeload) return null;
  const relevant = state.sessions.filter(s => s.lifts[exName]).slice(0, 2);
  if(relevant.length < 2) return null;

  const topSets = relevant.map(s => {
    const sets = s.lifts[exName].sets;
    return sets.reduce((best, cur) => (cur.w > best.w ? cur : best), sets[0]);
  });

  const bothHitTarget = topSets.every(t => t.r >= targetReps);
  const sameWeight = topSets[0].w === topSets[1].w;
  if(bothHitTarget && sameWeight){
    const increment = state.settings.progressionIncrement || 2;
    // RPE feedback shapes the jump: easy sets earn double, grinders hold.
    const latestSets = relevant[0].lifts[exName].sets.filter(x => x.rpe);
    if(latestSets.length){
      const avgRpe = latestSets.reduce((a,x) => a + x.rpe, 0) / latestSets.length;
      if(avgRpe <= 7) return `Felt easy (RPE ${avgRpe.toFixed(1)}), jump to ${topSets[0].w + increment * 2}${WU()}`;
      if(avgRpe >= 9.5) return `RPE ${avgRpe.toFixed(1)} last time, stay at ${topSets[0].w}${WU()} and own the reps`;
    }
    return `Try ${topSets[0].w + increment}${WU()} next session`;
  }
  // Bodyweight movements progress by reps, then by harder variation.
  if(typeof BODYWEIGHT_EXERCISES !== 'undefined' && BODYWEIGHT_EXERCISES.has(exName) && bothHitTarget){
    const chain = progressionChainFor(exName);
    const next = chain ? chain[chain.indexOf(exName) + 1] : null;
    return next
      ? `Target reps hit twice. Add reps, or step up to ${next}`
      : `Target reps hit twice. Add a rep per set or slow the tempo`;
  }
  return null;
}

async function hashPasscode(pin){
  const enc = new TextEncoder().encode(pin);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

function dayKey(planKey, dayIndex){ return `${planKey}|${dayIndex}`; }

// Returns the display order of base exercise indices for a day, defaulting to
// natural order [0, 1, 2, ...] until the user rearranges it.
function getDayOrder(state, planKey, dayIndex, baseCount){
  const key = dayKey(planKey, dayIndex);
  const stored = state.dayOrder[key];
  if(stored && stored.length === baseCount) return stored;
  return Array.from({length: baseCount}, (_, i) => i);
}

function moveExerciseInDay(state, planKey, dayIndex, baseCount, fromPos, toPos){
  const key = dayKey(planKey, dayIndex);
  const order = getDayOrder(state, planKey, dayIndex, baseCount).slice();
  if(toPos < 0 || toPos >= order.length) return;
  const [moved] = order.splice(fromPos, 1);
  order.splice(toPos, 0, moved);
  state.dayOrder[key] = order;
}

function getCustomExercises(state, planKey, dayIndex){
  return state.customExercises[dayKey(planKey, dayIndex)] || [];
}

function addCustomExercise(state, planKey, dayIndex, ex){
  const key = dayKey(planKey, dayIndex);
  if(!state.customExercises[key]) state.customExercises[key] = [];
  state.customExercises[key].push(Object.assign({ id: `custom-${Date.now()}` }, ex));
}

function removeCustomExercise(state, planKey, dayIndex, id){
  const key = dayKey(planKey, dayIndex);
  if(!state.customExercises[key]) return;
  state.customExercises[key] = state.customExercises[key].filter(e => e.id !== id);
}

// Suggests one extra exercise for the current day, preferring a muscle group
// that isn't already covered by what's already in the session (base + custom
// exercises), so an "extra" addition rounds the session out rather than piling
// more onto an already-covered area. Falls back to any unused library exercise
// if every muscle group is already represented.
function suggestExerciseForDay(state, planKey, dayIndex){
  const day = getPlan(state, planKey).days[dayIndex];
  const custom = getCustomExercises(state, planKey, dayIndex);
  const usedNames = new Set([...day.exercises.map(e => e.name), ...custom.map(e => e.name)]);
  const coveredMuscles = new Set([...day.exercises.map(e => e.muscle), ...custom.map(e => e.muscle)]);
  const missingMuscles = MUSCLE_GROUPS.filter(m => !coveredMuscles.has(m));

  const library = getKnownExerciseLibrary();
  const unused = library.filter(e => !usedNames.has(e.name));

  const fromMissing = unused.filter(e => missingMuscles.includes(e.muscle));
  if(fromMissing.length){
    const pick = fromMissing[Math.floor(Math.random() * fromMissing.length)];
    return { ...pick, reason: 'missing' };
  }
  if(unused.length){
    const pick = unused[Math.floor(Math.random() * unused.length)];
    return { ...pick, reason: 'extra' };
  }
  return null;
}

// Warm-up ramp as a percentage of the working weight, per dumbbell.
function warmupRamp(workingWeight){
  const steps = [
    { pct: 40, reps: 10 },
    { pct: 60, reps: 6 },
    { pct: 80, reps: 3 },
  ];
  return steps.map(s => ({
    pct: s.pct,
    reps: s.reps,
    weight: Math.round((workingWeight * s.pct / 100) * 2) / 2
  }));
}

// Percentage table from an estimated 1-rep max, useful for programming.
function trainingMaxTable(e1rm){
  const trainingMax = Math.round(e1rm * 0.9 * 2) / 2;
  const percents = [100, 95, 90, 85, 80, 75, 70, 65, 60, 50];
  return {
    trainingMax,
    rows: percents.map(p => ({ pct: p, weight: Math.round((trainingMax * p / 100) * 2) / 2 }))
  };
}

// Additional exercise names for the custom exercise editor's suggestions, not tied
// to any built-in plan day. Generic exercise terminology, not copyrighted content.
const EXTRA_EXERCISES = [
  { name:"DB Tricep Extension", muscle:"arms" },
  { name:"DB Wrist Curl", muscle:"arms" },
  { name:"DB Grip Curl", muscle:"arms" },
  { name:"DB Hammer Curl", muscle:"arms" },
  { name:"DB Concentration Curl", muscle:"arms" },
  { name:"DB Shoulder Shrug", muscle:"shoulders" },
  { name:"DB Alternating Front Raise", muscle:"shoulders" },
  { name:"DB Side Raise", muscle:"shoulders" },
  { name:"DB Reverse Fly", muscle:"shoulders" },
  { name:"DB Chest Fly", muscle:"chest" },
  { name:"DB Bow Extension", muscle:"core" },
  { name:"DB Russian Twist", muscle:"core" },
  { name:"DB V-Up", muscle:"core" },
  { name:"DB V-Sit Cross Jab", muscle:"core" },
  { name:"DB Side Bend", muscle:"core" },
  { name:"DB Single Arm Row", muscle:"back" },
  { name:"DB Seesaw Row", muscle:"back" },
  { name:"DB Floor T Raise", muscle:"back" },
  { name:"DB Rolls", muscle:"back" },
  { name:"DB Deadlift", muscle:"legs" },
  { name:"DB Squat", muscle:"legs" },
  { name:"DB Sumo Squat", muscle:"legs" },
  { name:"DB Side Lunge", muscle:"legs" },
  { name:"DB Hip Raise", muscle:"legs" },
  { name:"DB Farmer's Walk", muscle:"core" },
  { name:"DB Swing", muscle:"legs" },
  { name:"DB Plank T", muscle:"core" },
  { name:"DB Woodchop", muscle:"core" },

  // Chest
  { name:"DB Decline Press", muscle:"chest" },
  { name:"DB Incline Fly", muscle:"chest" },
  { name:"DB Squeeze Press", muscle:"chest" },
  { name:"DB Single-Arm Press", muscle:"chest" },
  { name:"DB Floor Press", muscle:"chest" },

  // Back
  { name:"DB Chest-Supported Row", muscle:"back" },
  { name:"DB Kroc Row", muscle:"back" },
  { name:"DB Yates Row", muscle:"back" },

  // Legs
  { name:"DB Bulgarian Split Squat", muscle:"legs" },
  { name:"DB Single-Leg Deadlift", muscle:"legs" },
  { name:"DB Curtsy Lunge", muscle:"legs" },
  { name:"DB Reverse Lunge", muscle:"legs" },
  { name:"DB Box Step-Down", muscle:"legs" },
  { name:"DB Glute Bridge", muscle:"legs" },

  // Shoulders
  { name:"DB Arnold Press", muscle:"shoulders" },
  { name:"DB Upright Row", muscle:"shoulders" },
  { name:"DB Cuban Press", muscle:"shoulders" },
  { name:"DB W Raise", muscle:"shoulders" },
  { name:"DB Push Press", muscle:"shoulders" },

  // Arms
  { name:"DB Incline Curl", muscle:"arms" },
  { name:"DB Zottman Curl", muscle:"arms" },
  { name:"DB Skull Crusher", muscle:"arms" },
  { name:"DB Close-Grip Press", muscle:"arms" },
  { name:"DB Preacher Curl", muscle:"arms" },
  { name:"DB Reverse Curl", muscle:"arms" },
  { name:"DB Tricep Dip", muscle:"arms" },

  // Core
  { name:"DB Sit-Up", muscle:"core" },
  { name:"DB Dead Bug", muscle:"core" },
  { name:"DB Overhead Carry", muscle:"core" },
  { name:"DB Suitcase Carry", muscle:"core" },
  { name:"DB Toe Touch", muscle:"core" },
];

// Combines every exercise already used across the built-in plans with the
// extra library, deduped by name, for use as suggestions in the exercise editor.
const CALISTHENICS_EXERCISES = [
  { name:"Push-Up", muscle:"chest" }, { name:"Knee Push-Up", muscle:"chest" },
  { name:"Incline Push-Up", muscle:"chest" }, { name:"Decline Push-Up", muscle:"chest" },
  { name:"Diamond Push-Up", muscle:"arms" }, { name:"Archer Push-Up", muscle:"chest" },
  { name:"Pike Push-Up", muscle:"shoulders" }, { name:"Wall Handstand Push-Up", muscle:"shoulders" },
  { name:"Pull-Up", muscle:"back" }, { name:"Chin-Up", muscle:"arms" },
  { name:"Negative Pull-Up", muscle:"back" }, { name:"Australian Row", muscle:"back" },
  { name:"Dip", muscle:"chest" }, { name:"Bench Dip", muscle:"arms" },
  { name:"Bodyweight Squat", muscle:"legs" }, { name:"Split Squat", muscle:"legs" },
  { name:"Shrimp Squat", muscle:"legs" }, { name:"Pistol Squat", muscle:"legs" },
  { name:"Glute Bridge", muscle:"legs" }, { name:"Nordic Curl", muscle:"legs" },
  { name:"Plank", muscle:"core" }, { name:"Side Plank", muscle:"core" },
  { name:"Hollow Hold", muscle:"core" }, { name:"L-Sit", muscle:"core" },
  { name:"Hanging Knee Raise", muscle:"core" }, { name:"Hanging Leg Raise", muscle:"core" },
  { name:"Burpee", muscle:"core" }
];

function getKnownExerciseLibrary(){
  const seen = new Map();
  Object.values(PLANS).forEach(p => p.days.forEach(d => d.exercises.forEach(e => {
    if(!seen.has(e.name)) seen.set(e.name, { name: e.name, muscle: e.muscle });
  })));
  EXTRA_EXERCISES.forEach(e => {
    if(!seen.has(e.name)) seen.set(e.name, e);
  });
  CALISTHENICS_EXERCISES.forEach(e => {
    if(!seen.has(e.name)) seen.set(e.name, e);
  });
  return Array.from(seen.values()).sort((a,b) => a.name.localeCompare(b.name));
}

// Smooths day-to-day bodyweight noise (water, food, sodium) into an underlying
// trend line using exponential smoothing, the same approach apps like Trendweight
// or Happy Scale use. Returns entries in date order with both raw and trend values.
function computeWeightTrend(bodyweights, alpha = 0.1){
  const ordered = [...bodyweights].sort((a,b) => new Date(a.date) - new Date(b.date));
  let trend = null;
  return ordered.map(entry => {
    trend = trend === null ? entry.kg : alpha * entry.kg + (1 - alpha) * trend;
    return { date: entry.date, raw: entry.kg, trend: Math.round(trend * 10) / 10 };
  });
}

// Rate of change over the last ~7 days of trend data, in kg per week.
// Returns null if there isn't at least a week of spread between entries.
function weeklyTrendChange(trendPoints){
  if(trendPoints.length < 2) return null;
  const latest = trendPoints[trendPoints.length - 1];
  const latestDate = new Date(latest.date);
  let weekAgoPoint = null;
  for(let i = trendPoints.length - 1; i >= 0; i--){
    const daysBack = (latestDate - new Date(trendPoints[i].date)) / 86400000;
    if(daysBack >= 7){ weekAgoPoint = trendPoints[i]; break; }
  }
  if(!weekAgoPoint) return null;
  return Math.round((latest.trend - weekAgoPoint.trend) * 10) / 10;
}

function cardioStats(state){
  const sessions = state.cardioSessions || [];
  const totalMinutes = sessions.reduce((sum, s) => sum + (s.minutes || 0), 0);
  const byActivity = {};
  sessions.forEach(s => {
    if(!byActivity[s.activity]) byActivity[s.activity] = { count: 0, minutes: 0 };
    byActivity[s.activity].count++;
    byActivity[s.activity].minutes += (s.minutes || 0);
  });
  return { totalSessions: sessions.length, totalMinutes, byActivity };
}

function sessionsForMonth(state, year, month){
  const set = new Set();
  [...state.sessions, ...(state.cardioSessions || [])].forEach(s => {
    const d = new Date(s.date);
    if(d.getFullYear() === year && d.getMonth() === month){
      set.add(d.getDate());
    }
  });
  return set;
}

// ---------- Body measurements ----------

// Measurement sites tracked in cm. Order here controls display order.
const MEASUREMENT_SITES = [
  { key:'neck',     label:'Neck' },
  { key:'shoulders',label:'Shoulders' },
  { key:'chest',    label:'Chest' },
  { key:'waist',    label:'Waist' },
  { key:'hips',     label:'Hips' },
  { key:'bicepL',   label:'Bicep L' },
  { key:'bicepR',   label:'Bicep R' },
  { key:'forearmL', label:'Forearm L' },
  { key:'forearmR', label:'Forearm R' },
  { key:'thighL',   label:'Thigh L' },
  { key:'thighR',   label:'Thigh R' },
  { key:'calfL',    label:'Calf L' },
  { key:'calfR',    label:'Calf R' },
];

// Entries are stored as { date: 'YYYY-MM-DD', values: { waist: 86.5, ... } }.
// Saving on a date that already has an entry merges new values into it, so a
// partial re-measure updates just the sites entered.
function saveMeasurementEntry(state, dateStr, values){
  if(!state.measurements) state.measurements = [];
  const existing = state.measurements.find(m => m.date === dateStr);
  if(existing){
    Object.assign(existing.values, values);
  } else {
    state.measurements.push({ date: dateStr, values });
    state.measurements.sort((a,b) => a.date.localeCompare(b.date));
  }
}

function deleteMeasurementEntry(state, dateStr){
  state.measurements = (state.measurements || []).filter(m => m.date !== dateStr);
}

// Per-site history in date order: [{date, value}, ...]
function measurementSeries(state, siteKey){
  return (state.measurements || [])
    .filter(m => m.values[siteKey] != null)
    .map(m => ({ date: m.date, value: m.values[siteKey] }));
}

// Latest value per site plus deltas vs the previous reading and the first
// reading of that site. Sites never measured are omitted.
function measurementSnapshot(state){
  const out = [];
  MEASUREMENT_SITES.forEach(site => {
    const series = measurementSeries(state, site.key);
    if(series.length === 0) return;
    const latest = series[series.length - 1];
    const prev = series.length >= 2 ? series[series.length - 2] : null;
    const first = series[0];
    out.push({
      key: site.key,
      label: site.label,
      value: latest.value,
      date: latest.date,
      deltaPrev: prev ? Math.round((latest.value - prev.value) * 10) / 10 : null,
      deltaFirst: series.length >= 2 ? Math.round((latest.value - first.value) * 10) / 10 : null,
    });
  });
  return out;
}

// ---------- Analytics ----------

// Name -> muscle map across built-in plans, extra library, and the user's
// custom exercises, so analytics cover everything that can be logged.
function exerciseMuscleMap(state){
  const map = {};
  getKnownExerciseLibrary().forEach(e => map[e.name] = e.muscle);
  Object.values(state.customPlans || {}).forEach(p => p.days.forEach(d => d.exercises.forEach(e => {
    if(e.name && e.muscle) map[e.name] = e.muscle;
  })));
  Object.values(state.customExercises || {}).forEach(list => list.forEach(e => {
    if(e.name && e.muscle) map[e.name] = e.muscle;
  }));
  return map;
}

// Volume (kg) per muscle group over the last `days` days.
function muscleVolumeBreakdown(state, days){
  const cutoff = Date.now() - days * 86400000;
  const map = exerciseMuscleMap(state);
  const totals = {};
  state.sessions.forEach(s => {
    if(new Date(s.date).getTime() < cutoff) return;
    Object.entries(s.lifts).forEach(([name, lift]) => {
      const muscle = map[name] || 'other';
      let vol = 0;
      lift.sets.forEach(set => vol += (set.w || 0) * (set.r || 0));
      totals[muscle] = (totals[muscle] || 0) + vol;
    });
  });
  return totals;
}

// Volume per ISO week for the last `nWeeks` weeks including the current one,
// with zero-filled gaps so the bar chart shows missed weeks honestly.
function weeklyVolumeSeries(state, nWeeks){
  const map = weeklyVolumes(state);
  const out = [];
  const now = new Date();
  for(let i = nWeeks - 1; i >= 0; i--){
    const d = new Date(now.getTime() - i * 7 * 86400000);
    const key = isoWeekKey(d.toISOString());
    out.push({ key, label: key.split('-')[1], volume: Math.round(map[key] || 0) });
  }
  return out;
}

// Walks history oldest -> newest and records every time an exercise's best
// estimated 1RM improved. Returns newest first, capped at `limit`.
function prTimeline(state, limit){
  const events = [];
  const running = {};
  [...state.sessions].reverse().forEach(s => {
    Object.keys(s.lifts).forEach(name => {
      const e1 = bestE1rmInSession(s, name);
      if(!e1) return;
      if(running[name] == null){
        running[name] = e1;
      } else if(e1 > running[name]){
        events.push({ date: s.date, exercise: name, e1rm: e1, gain: e1 - running[name] });
        running[name] = e1;
      }
    });
  });
  return events.reverse().slice(0, limit || 10);
}

// Best e1RM for an exercise within a date window, or null.
function bestE1rmInWindow(state, exName, fromTs, toTs){
  let best = null;
  state.sessions.forEach(s => {
    const t = new Date(s.date).getTime();
    if(t < fromTs || t > toTs || !s.lifts[exName]) return;
    const e1 = bestE1rmInSession(s, exName);
    if(e1 && (best === null || e1 > best)) best = e1;
  });
  return best;
}

// Generates plain-language insight cards from the logged data. Each insight is
// { tone: 'good'|'warn'|'info', title, text }. Returns up to 5, most useful first.
function computeInsights(state){
  const insights = [];
  const now = Date.now();
  const day = 86400000;

  if(state.sessions.length < 2){
    return [{ tone:'info', title:'Not enough data yet', text:'Log a few sessions and this section starts spotting trends, stalls, and PRs for you.' }];
  }

  // Consistency, last 28 days vs the plan's days-per-week.
  const last28 = state.sessions.filter(s => now - new Date(s.date).getTime() <= 28 * day);
  const perWeek = Math.round((last28.length / 4) * 10) / 10;
  const plan = getAllPlans(state)[state.planKey];
  const planDays = (Array.isArray(state.settings.trainingDays) && state.settings.trainingDays.length)
    ? state.settings.trainingDays.length
    : (plan ? plan.days.length : 3);
  if(last28.length > 0){
    if(perWeek >= planDays){
      insights.push({ tone:'good', title:'Consistency on point', text:`Averaging ${perWeek} sessions/week over the last 4 weeks, right on your ${planDays}-day plan.` });
    } else {
      insights.push({ tone:'info', title:'Consistency', text:`Averaging ${perWeek} sessions/week over the last 4 weeks against a ${planDays}-day plan.` });
    }
  } else {
    insights.push({ tone:'warn', title:'No sessions in 4 weeks', text:'Pick the lightest day on your plan and just get one in. Momentum beats planning.' });
  }

  // Hypertrophy: hard sets per muscle in the last 7 days vs the 10-20 band.
  const goalFocus = state.settings.goalFocus || 'muscle';
  if(goalFocus === 'muscle' && last28.length > 0){
    const sets = weeklySetsPerMuscle(state);
    const trained = Object.entries(sets).filter(([,v]) => v > 0);
    if(trained.length){
      const low = trained.filter(([,v]) => v < 10).map(([g,v]) => `${g} (${v})`);
      const high = trained.filter(([,v]) => v > 22);
      if(low.length){
        insights.push({ tone:'warn', title:'Under-stimulated this week', text:`Below 10 hard sets: ${low.join(', ')}. 10-20 weekly sets per muscle is the productive range for growth.` });
      } else {
        const top = trained.sort((a,b) => b[1] - a[1])[0];
        insights.push({ tone:'good', title:'Growth volume on track', text:`Every trained muscle hit 10+ hard sets this week. ${top[0]} leads with ${top[1]} sets.` });
      }
      if(high.length){
        insights.push({ tone:'info', title:'Very high volume', text:`${high.map(([g,v]) => `${g} (${v} sets)`).join(', ')} is past the point where extra sets usually add growth. Recovery matters more here.` });
      }
    }
  }

  // Bulk pace from the bodyweight trend, interpreted for the muscle goal.
  if(goalFocus === 'muscle' && (state.bodyweights || []).length >= 4){
    const trendPoints = computeWeightTrend(state.bodyweights);
    const rate = weeklyTrendChange(trendPoints);
    if(rate !== null){
      if(rate >= 0.1 && rate <= 0.5){
        insights.push({ tone:'good', title:'Lean bulk pace', text:`Bodyweight trending +${rate}${WU()}/week, a sensible rate for adding muscle without excess fat.` });
      } else if(rate > 0.5){
        insights.push({ tone:'warn', title:'Fast weight gain', text:`+${rate}${WU()}/week is quicker than muscle can be built. Some of the surplus is likely going to fat.` });
      } else if(rate < -0.1){
        insights.push({ tone:'info', title:'Weight trending down', text:`${rate}${WU()}/week while trying to build muscle usually means eating below maintenance. Growth is slow in a deficit.` });
      }
    }
  }

  // Tape measure proof: biggest measurement gain since first log.
  const growthSites = ['chest','shoulders','bicepL','bicepR','thighL','thighR','calfL','calfR'];
  let bestGrowth = null;
  measurementSnapshot(state).forEach(m => {
    if(growthSites.includes(m.key) && m.deltaFirst !== null && m.deltaFirst > 0){
      if(!bestGrowth || m.deltaFirst > bestGrowth.deltaFirst) bestGrowth = m;
    }
  });
  if(bestGrowth){
    insights.push({ tone:'good', title:'The tape agrees', text:`${bestGrowth.label} is up ${bestGrowth.deltaFirst}cm since your first measurement. That's real tissue.` });
  }

  // Fastest improving and stalled lifts over the last 30 vs prior 30 days.
  const map = exerciseMuscleMap(state);
  let bestGain = null, stalled = null;
  Object.keys(state.bests).forEach(name => {
    const recent = bestE1rmInWindow(state, name, now - 30 * day, now);
    const before = bestE1rmInWindow(state, name, now - 60 * day, now - 30 * day);
    if(recent && before){
      const pct = Math.round(((recent - before) / before) * 100);
      if(pct > 0 && (!bestGain || pct > bestGain.pct)) bestGain = { name, pct, recent };
    }
    // Stall: 3+ sessions of this lift in the last 45 days with no e1RM improvement.
    const recentSessions = state.sessions.filter(s => s.lifts[name] && now - new Date(s.date).getTime() <= 45 * day);
    if(recentSessions.length >= 3){
      const e1s = recentSessions.map(s => bestE1rmInSession(s, name));
      const newest = e1s[0];
      if(newest !== null && Math.max(...e1s.slice(1)) >= newest && !stalled){
        stalled = { name, count: recentSessions.length };
      }
    }
  });
  if(bestGain) insights.push({ tone:'good', title:'Fastest climber', text:`${bestGain.name} is up ${bestGain.pct}% this month, estimated 1RM now ${bestGain.recent}${WU()}.` });
  if(stalled) insights.push({ tone:'warn', title:'Possible stall', text:`${stalled.name} has gone ${stalled.count} sessions without a new estimated 1RM. Consider a small deload or a rep-range change.` });

  // Volume momentum: last 7 days vs the average of the prior 3 weeks.
  const vol = (from, to) => state.sessions
    .filter(s => { const t = now - new Date(s.date).getTime(); return t >= from * day && t < to * day; })
    .reduce((sum, s) => sum + (s.volume || sessionVolume(s)), 0);
  const week0 = vol(0, 7);
  const prior3Avg = (vol(7, 14) + vol(14, 21) + vol(21, 28)) / 3;
  if(prior3Avg > 0 && week0 > 0){
    const pct = Math.round(((week0 - prior3Avg) / prior3Avg) * 100);
    if(pct >= 15) insights.push({ tone:'good', title:'Volume climbing', text:`This week's volume is ${pct}% above your 3-week average (${Math.round(week0)}${WU()} vs ${Math.round(prior3Avg)}${WU()}).` });
    else if(pct <= -25) insights.push({ tone:'info', title:'Lighter week', text:`Volume is ${Math.abs(pct)}% below your 3-week average. Fine if intentional, worth noticing if not.` });
  }

  // Muscle balance over the last 30 days.
  const breakdown = muscleVolumeBreakdown(state, 30);
  const entries = Object.entries(breakdown).filter(([,v]) => v > 0);
  if(entries.length >= 2){
    const total = entries.reduce((s,[,v]) => s + v, 0);
    entries.sort((a,b) => b[1] - a[1]);
    const topShare = Math.round((entries[0][1] / total) * 100);
    if(topShare >= 45){
      insights.push({ tone:'info', title:'Muscle balance', text:`${entries[0][0]} is ${topShare}% of your last 30 days of volume. ${entries[entries.length-1][0]} is getting the least.` });
    }
  }

  // Recent PRs.
  const prs14 = prTimeline(state, 50).filter(p => now - new Date(p.date).getTime() <= 14 * day);
  if(prs14.length >= 2){
    insights.push({ tone:'good', title:'PR streak', text:`${prs14.length} estimated-1RM PRs in the last 2 weeks. Whatever you're doing, keep doing it.` });
  }

  return insights.slice(0, 6);
}

// ---------- Custom plans ----------

// Built-in and user-created plans merged into one lookup. User plans live in
// state.customPlans keyed by 'custom-<timestamp>'.
function getAllPlans(state){
  return Object.assign({}, PLANS, state.customPlans || {});
}

function getPlan(state, key){
  return getAllPlans(state)[key] || PLANS['3x20'];
}

function saveCustomPlan(state, key, plan){
  if(!state.customPlans) state.customPlans = {};
  state.customPlans[key] = plan;
}

function deleteCustomPlan(state, key){
  if(state.customPlans) delete state.customPlans[key];
  if(state.planKey === key) state.planKey = '3x20';
}

// ---------- Hypertrophy analytics ----------

// Hard sets per muscle group over the last 7 days. The 10-20 sets/week band is
// the commonly cited productive range for hypertrophy.
function weeklySetsPerMuscle(state){
  const cutoff = Date.now() - 7 * 86400000;
  const map = exerciseMuscleMap(state);
  const totals = {};
  MUSCLE_GROUPS.forEach(g => totals[g] = 0);
  state.sessions.forEach(s => {
    if(new Date(s.date).getTime() < cutoff) return;
    Object.entries(s.lifts).forEach(([name, lift]) => {
      const muscle = map[name];
      if(!muscle || totals[muscle] === undefined) return;
      totals[muscle] += lift.sets.length;
    });
  });
  return totals;
}

// Sets from the most recent session containing this exercise, for ghost prefill.
function lastSessionSets(state, exName){
  const s = state.sessions.find(sess => sess.lifts[exName]);
  return s ? s.lifts[exName].sets : null;
}

// Recent history rows for one exercise: date, sets, best e1RM that day.
function exerciseHistory(state, exName, limit){
  return state.sessions
    .filter(s => s.lifts[exName])
    .slice(0, limit || 8)
    .map(s => ({
      date: s.date,
      sets: s.lifts[exName].sets,
      e1rm: bestE1rmInSession(s, exName)
    }));
}

// ---------- Cardio performance ----------

// How each activity's pace is expressed. 'split500': time per 500m, lower is
// better (Concept2 convention). 'minkm': minutes per km, lower is better.
// 'kmh': speed, higher is better. 'calmin': calories per minute, higher is better.
const CARDIO_PACE_MODES = {
  "Concept2 RowErg": "split500",
  "Concept2 SkiErg": "split500",
  "Concept2 BikeErg": "kmh",
  "Running": "minkm",
  "Cycling": "kmh",
  "Assault Bike": "calmin",
  "Stair Climber": "calmin",
};

function fmtSplit(seconds){
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2,'0')}`;
}

// Computes the pace of one logged session, or null when the needed fields are
// missing. Returns { value: display string, metric: number, higherIsBetter }.
function cardioPace(session){
  const mode = CARDIO_PACE_MODES[session.activity];
  if(!mode || !session.minutes) return null;
  if(mode === 'split500'){
    if(!session.distance) return null;
    const secPer500 = (session.minutes * 60) / (session.distance / 500);
    return { value: fmtSplit(secPer500) + '/500m', metric: secPer500, higherIsBetter: false };
  }
  if(mode === 'minkm'){
    if(!session.distance) return null;
    const minPerKm = session.minutes / (session.distance / 1000);
    return { value: fmtSplit(minPerKm * 60) + '/km', metric: minPerKm * 60, higherIsBetter: false };
  }
  if(mode === 'kmh'){
    if(!session.distance) return null;
    const kmh = (session.distance / 1000) / (session.minutes / 60);
    return { value: kmh.toFixed(1) + ' km/h', metric: kmh, higherIsBetter: true };
  }
  if(mode === 'calmin'){
    if(!session.calories) return null;
    const cm = session.calories / session.minutes;
    return { value: cm.toFixed(1) + ' cal/min', metric: cm, higherIsBetter: true };
  }
  return null;
}

// All paced sessions for an activity, oldest first: [{date, pace, minutes, rpe}]
function cardioPaceSeries(state, activity){
  return [...(state.cardioSessions || [])]
    .filter(s => s.activity === activity)
    .reverse()
    .map(s => ({ date: s.date, pace: cardioPace(s), minutes: s.minutes, rpe: s.rpe }))
    .filter(x => x.pace);
}

function bestCardioPace(series){
  if(series.length === 0) return null;
  return series.reduce((best, cur) =>
    (cur.pace.higherIsBetter ? cur.pace.metric > best.pace.metric : cur.pace.metric < best.pace.metric) ? cur : best
  );
}

// Personalised next-session suggestion for one activity, built from recent
// pace, duration, and effort. Plain rules, honestly framed.
function cardioRecommendation(state, activity){
  const series = cardioPaceSeries(state, activity);
  const all = (state.cardioSessions || []).filter(s => s.activity === activity);
  const mode = CARDIO_PACE_MODES[activity];

  if(all.length === 0) return null;
  if(series.length < 2){
    const withDist = mode === 'calmin' ? 'calories' : 'distance';
    return { tone:'info', title:'Log ' + withDist + ' to unlock pacing',
      text:`Add ${withDist} to your ${activity} sessions and Foundry starts tracking pace, PBs, and tailored targets.` };
  }

  const best = bestCardioPace(series);
  const last = series[series.length - 1];
  const recent = series.slice(-3);
  const avgRecent = recent.reduce((a,x) => a + x.pace.metric, 0) / recent.length;
  const older = series.slice(0, -3);
  const better = (a, b) => last.pace.higherIsBetter ? a > b : a < b; // is a better than b
  const improving = older.length
    ? better(avgRecent, older.reduce((a,x) => a + x.pace.metric, 0) / older.length)
    : better(last.pace.metric, series[0].pace.metric);
  const avgRpe = recent.filter(x => x.rpe).reduce((a,x,_,arr) => a + x.rpe / arr.length, 0) || null;
  const avgMins = Math.round(recent.reduce((a,x) => a + x.minutes, 0) / recent.length);

  // Interval target: slightly better than the current best pace.
  let intervalTarget = '';
  if(mode === 'split500') intervalTarget = fmtSplit(Math.max(60, best.pace.metric - 2)) + '/500m';
  if(mode === 'minkm')    intervalTarget = fmtSplit(Math.max(120, best.pace.metric - 5)) + '/km';
  if(mode === 'kmh')      intervalTarget = (best.pace.metric + 0.5).toFixed(1) + ' km/h';
  if(mode === 'calmin')   intervalTarget = (best.pace.metric + 0.5).toFixed(1) + ' cal/min';
  const intervalShape = mode === 'split500' ? '6 x 500m with 90s rest'
    : mode === 'minkm' ? '5 x 3 min with 2 min easy between'
    : '8 x 1 min hard, 1 min easy';

  if(avgRpe && avgRpe >= 8.5 && !improving){
    return { tone:'warn', title:'Ease off before you push on',
      text:`Recent ${activity} efforts average RPE ${avgRpe.toFixed(1)} with pace flat. Take the next one easy: ${Math.max(15, avgMins)} min well below best pace, then retest.` };
  }
  if(improving){
    return { tone:'good', title:'Pace is trending the right way',
      text:`Recent average beats your earlier sessions, best is ${best.pace.value}. Cash it in with intervals: ${intervalShape} at ${intervalTarget}.` };
  }
  if(avgRpe && avgRpe <= 6){
    return { tone:'info', title:'Room to push',
      text:`Effort has been comfortable (RPE ~${avgRpe.toFixed(1)}) and pace is steady. Either add ${Math.max(5, Math.round(avgMins*0.2))} min to your steady sessions, or chase ${intervalTarget} with ${intervalShape}.` };
  }
  return { tone:'info', title:'Break the plateau',
    text:`Pace has settled around ${last.pace.value} (best ${best.pace.value}). Swap one steady session for intervals: ${intervalShape} at ${intervalTarget}.` };
}

// ---------- Training program (periodisation) ----------

// A program is a repeating block of N weeks anchored to a start date, with an
// optional programmed deload on the final week. Stored as
// state.program = { startDate, blockWeeks, deloadFinalWeek }.

function startOfWeek(d){
  const date = new Date(d);
  const day = (date.getDay() + 6) % 7; // Monday = 0
  date.setHours(0,0,0,0);
  date.setDate(date.getDate() - day);
  return date;
}

// Current position in the block, or null when no program is running.
function programWeekInfo(state){
  const p = state.program;
  if(!p || !p.startDate) return null;
  const weeks = Math.floor((startOfWeek(new Date()) - startOfWeek(new Date(p.startDate))) / (7 * 86400000));
  if(weeks < 0) return null;
  const week = (weeks % p.blockWeeks) + 1;
  const isDeload = !!p.deloadFinalWeek && week === p.blockWeeks;
  return {
    week,
    of: p.blockWeeks,
    isDeload,
    label: isDeload ? `Deload, week ${week} of ${p.blockWeeks}` : `Week ${week} of ${p.blockWeeks}`,
    // Week-specific coaching note shown above the day's exercises.
    note: isDeload
      ? `Programmed deload: fewer sets, around 85% of your usual weight, everything two reps shy of failure. Recovery is where the growth lands.`
      : week === p.blockWeeks - (p.deloadFinalWeek ? 1 : 0)
        ? `Peak week of the block: push the top sets, chase the PRs, then back off.`
        : null
  };
}

// During a deload week, prescribed sets drop to ~60% (minimum 2).
function adjustedSetCount(state, sets){
  const info = programWeekInfo(state);
  if(info && info.isDeload) return Math.max(2, Math.round(sets * 0.6));
  return sets;
}

// ---------- Weekly recap ----------

// Stats for the last completed Monday-Sunday week, with deltas vs the week
// before it. Returns null when that week had no training at all.
function weeklyRecapData(state){
  const thisMonday = startOfWeek(new Date());
  const prevMonday = new Date(thisMonday.getTime() - 7 * 86400000);
  const priorMonday = new Date(thisMonday.getTime() - 14 * 86400000);
  const within = (s, from, to) => { const t = new Date(s.date).getTime(); return t >= from.getTime() && t < to.getTime(); };

  const prevSessions = state.sessions.filter(s => within(s, prevMonday, thisMonday));
  const priorSessions = state.sessions.filter(s => within(s, priorMonday, prevMonday));
  const prevCardio = (state.cardioSessions || []).filter(s => within(s, prevMonday, thisMonday));
  if(prevSessions.length === 0 && prevCardio.length === 0) return null;

  const vol = arr => Math.round(arr.reduce((a,s) => a + (s.volume || 0), 0));
  const prevVol = vol(prevSessions), priorVol = vol(priorSessions);
  const prs = prTimeline(state, 100).filter(p => within(p, prevMonday, thisMonday));
  let topLift = null;
  prevSessions.forEach(s => Object.entries(s.lifts).forEach(([name, lift]) => {
    lift.sets.forEach(set => {
      if(!set.w) return;
      const e1 = epley(set.w, set.r);
      if(!topLift || e1 > topLift.e1rm) topLift = { name, e1rm: e1 };
    });
  }));

  return {
    weekLabel: `${prevMonday.toLocaleDateString(undefined,{month:'short', day:'numeric'})} to ${new Date(thisMonday - 86400000).toLocaleDateString(undefined,{month:'short', day:'numeric'})}`,
    weekKey: isoWeekKey(prevMonday.toISOString()),
    sessions: prevSessions.length,
    sessionsDelta: prevSessions.length - priorSessions.length,
    volume: prevVol,
    volumeDeltaPct: priorVol > 0 ? Math.round(((prevVol - priorVol) / priorVol) * 100) : null,
    cardioMinutes: Math.round(prevCardio.reduce((a,s) => a + s.minutes, 0)),
    prs: prs.map(p => p.exercise),
    topLift,
    streak: state.streak || 0
  };
}


// ---------- Guided warm-up ----------

// Equipment-free dynamic warm-ups, roughly 4 minutes each, chosen to match
// what the day is about to load.
const WARMUP_ROUTINES = {
  push: [
    { name: 'Arm Circles', seconds: 30, cue: 'Big slow circles forward, then backward. Loosen the whole shoulder.' },
    { name: 'Shoulder Rolls', seconds: 30, cue: 'Roll shoulders up, back, and down. Exaggerate the range.' },
    { name: 'Scapular Push-Ups', seconds: 40, cue: 'In a plank, arms straight, pinch and spread the shoulder blades.' },
    { name: 'Cat-Cow', seconds: 40, cue: 'On all fours, arch and round the spine with your breath.' },
    { name: 'Push-Up to Down Dog', seconds: 45, cue: 'One slow push-up, then push hips high. Flow between them.' },
    { name: 'Torso Twists', seconds: 30, cue: 'Feet planted, rotate side to side, arms loose.' },
  ],
  pull: [
    { name: 'Arm Swings', seconds: 30, cue: 'Swing arms across the chest and open wide. Progressively bigger.' },
    { name: 'Shoulder Rolls', seconds: 30, cue: 'Roll shoulders up, back, and down. Exaggerate the range.' },
    { name: 'Reverse Flys, No Weight', seconds: 40, cue: 'Hinge forward, squeeze shoulder blades as arms sweep back.' },
    { name: 'Thoracic Rotations', seconds: 45, cue: 'On all fours, hand behind head, rotate elbow to ceiling. Both sides.' },
    { name: 'Scapular Pulls', seconds: 40, cue: 'Hang from a bar if you have one, or wall slides if not. Shrug down, not up.' },
    { name: 'Cat-Cow', seconds: 40, cue: 'On all fours, arch and round the spine with your breath.' },
  ],
  legs: [
    { name: 'March in Place', seconds: 40, cue: 'Knees high, arms driving. Get the heart rate moving.' },
    { name: 'Leg Swings', seconds: 40, cue: 'Hold something for balance, swing each leg forward and back.' },
    { name: 'Hip Circles', seconds: 30, cue: 'Hands on hips, big slow circles each direction.' },
    { name: 'Bodyweight Squats', seconds: 40, cue: 'Slow and deep, heels down, chest up.' },
    { name: 'Walking Lunges', seconds: 45, cue: 'Long steps, back knee kisses the floor.' },
    { name: 'Glute Bridges', seconds: 40, cue: 'Squeeze hard at the top of each rep. Wake the glutes before they work.' },
  ],
  full: [
    { name: 'Jumping Jacks', seconds: 40, cue: 'Easy pace, full range. Just raising the temperature.' },
    { name: 'Arm Circles', seconds: 30, cue: 'Big slow circles forward, then backward.' },
    { name: 'Hip Circles', seconds: 30, cue: 'Hands on hips, big slow circles each direction.' },
    { name: 'Bodyweight Squats', seconds: 40, cue: 'Slow and deep, heels down, chest up.' },
    { name: 'Torso Twists', seconds: 30, cue: 'Feet planted, rotate side to side, arms loose.' },
    { name: 'Inchworms', seconds: 45, cue: 'Walk hands out to a plank, walk feet to hands, stand tall.' },
  ]
};

// Reads the day's muscle mix and picks the matching routine.
function warmupForToday(state, activeDay){
  const day = getPlan(state, state.planKey).days[activeDay];
  if(!day) return { key: 'full', moves: WARMUP_ROUTINES.full };
  const counts = { push: 0, pull: 0, legs: 0 };
  day.exercises.forEach(e => {
    if(e.muscle === 'chest' || e.muscle === 'shoulders') counts.push++;
    else if(e.muscle === 'back' || e.muscle === 'arms') counts.pull++;
    else if(e.muscle === 'legs') counts.legs++;
  });
  const top = Object.entries(counts).sort((a,b) => b[1] - a[1])[0];
  const total = counts.push + counts.pull + counts.legs;
  // A clear majority picks the focused routine; a mixed day warms everything.
  const key = (total > 0 && top[1] / total > 0.55) ? top[0] : 'full';
  return { key, moves: WARMUP_ROUTINES[key] };
}
