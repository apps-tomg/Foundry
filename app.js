let state = loadState();
let activeDay = state.lastDay || 0;
let currentView = 'log';
let restInterval = null;
let calMonth = new Date().getMonth();
let calYear = new Date().getFullYear();
let sessionTimerInterval = null;
let sessionTimerStartedAt = null;   // epoch ms while running
let sessionTimerAccumulated = 0;    // seconds banked from previous run segments
let sessionTimerRunning = false;

// Elapsed session seconds, computed from timestamps so iOS freezing JS while
// the screen is locked doesn't lose time.
function currentSessionSeconds(){
  const live = sessionTimerRunning && sessionTimerStartedAt
    ? (Date.now() - sessionTimerStartedAt) / 1000
    : 0;
  return Math.floor(sessionTimerAccumulated + live);
}

function currentPlan(){ return getPlan(state, state.planKey); }

function formatTime(totalSeconds){
  const m = Math.floor(totalSeconds / 60).toString().padStart(2,'0');
  const s = (totalSeconds % 60).toString().padStart(2,'0');
  return `${m}:${s}`;
}

function renderSessionTimer(){
  document.getElementById('stTime').textContent = formatTime(currentSessionSeconds());
  const mins = currentPlan().minutes;
  document.getElementById('stTarget').textContent = mins ? `of ${mins} min target` : 'session time';
  const btn = document.getElementById('stToggle');
  btn.textContent = sessionTimerRunning ? 'Pause' : (currentSessionSeconds() > 0 ? 'Resume' : 'Start');
  btn.classList.toggle('running', sessionTimerRunning);
}

function toggleSessionTimer(){
  if(sessionTimerRunning){
    sessionTimerAccumulated = currentSessionSeconds();
    sessionTimerStartedAt = null;
    sessionTimerRunning = false;
    clearInterval(sessionTimerInterval);
  } else {
    sessionTimerRunning = true;
    sessionTimerStartedAt = Date.now();
    sessionTimerInterval = setInterval(()=>{
      document.getElementById('stTime').textContent = formatTime(currentSessionSeconds());
    }, 1000);
  }
  renderSessionTimer();
}
document.getElementById('stToggle').onclick = toggleSessionTimer;

function resetSessionTimer(){
  clearInterval(sessionTimerInterval);
  sessionTimerRunning = false;
  sessionTimerStartedAt = null;
  sessionTimerAccumulated = 0;
}

// ---------- Log view ----------

function renderTabs(){
  const el = document.getElementById('daytabs');
  const pill = document.getElementById('daytabsPill');
  el.innerHTML = '';
  if(pill) el.appendChild(pill);
  currentPlan().days.forEach((d, i)=>{
    const tab = document.createElement('div');
    tab.className = 'daytab' + (i===activeDay ? ' active':'');
    tab.textContent = d.name;
    tab.onclick = ()=>{ activeDay = i; state.lastDay = i; saveState(state); resetSessionTimer(); render(); };
    el.appendChild(tab);
  });
  positionDaytabsPill();
}

function positionDaytabsPill(){
  const el = document.getElementById('daytabs');
  const pill = document.getElementById('daytabsPill');
  const activeTab = el && el.querySelector('.daytab.active');
  if(!el || !pill || !activeTab) return;
  pill.style.width = activeTab.offsetWidth + 'px';
  pill.style.transform = 'translateX(' + activeTab.offsetLeft + 'px)';
}

// Builds the tappable instructions panel for an exercise. Falls back to a plain
// message for custom exercises typed in freehand that don't match the library.
function buildInfoPanelHTML(name){
  const info = EXERCISE_INFO[name];
  const muscles = EXERCISE_MUSCLES[name];
  const musclesLine = muscles ? `<p class="info-muscles"><strong>Works:</strong> ${muscles}</p>` : '';
  if(!info){
    return `${musclesLine}<p class="info-empty">No instructions saved for this exercise yet. It'll show up here automatically if you rename it to match a library exercise.</p>`;
  }
  const steps = info.steps.map(s => `<li>${s}</li>`).join('');
  return `${musclesLine}<ol class="info-steps">${steps}</ol><p class="info-tip"><strong>Tip:</strong> ${info.tip}</p>`;
}

function buildSetRowsHTML(setCount, ghosts, exName){
  const isBw = typeof BODYWEIGHT_EXERCISES !== 'undefined' && BODYWEIGHT_EXERCISES.has(exName);
  let html = '';
  for(let s=0; s<setCount; s++){
    // Ghost values: what was lifted for this set last session. Extra sets fall
    // back to the last recorded set so a new S4 still gets a sensible prefill.
    const g = ghosts && ghosts.length ? (ghosts[s] || ghosts[ghosts.length - 1]) : null;
    // Bodyweight exercises log reps only; the weight field becomes optional added load.
    const wPh = g && g.w ? g.w : (isBw ? '+' + WU() : WU());
    html += `
      <div class="set-row${isBw ? ' bw' : ''}">
        <div class="set-tag">S${s+1}</div>
        <input type="number" inputmode="decimal" placeholder="${wPh}" class="wIn" ${g && g.w ? `data-ghost-w="${g.w}"` : ''} ${isBw ? 'data-bw="1"' : ''}>
        <span class="x">x</span>
        <input type="number" inputmode="numeric" placeholder="${g ? g.r : 'reps'}" class="rIn" ${g ? `data-ghost-r="${g.r}"` : ''}>
        <select class="rpe-select">
          <option value="">RPE</option>
          <option value="6">6</option>
          <option value="7">7</option>
          <option value="8">8</option>
          <option value="9">9</option>
          <option value="10">10</option>
        </select>
        <div class="check">&check;</div>
      </div>
    `;
  }
  return html;
}

function wireSetRows(wrap){
  wrap.querySelectorAll('.check').forEach(check=>{
    check.onclick = ()=>{
      check.classList.toggle('on');
      if(check.classList.contains('on')){
        // Tapping done on an untouched row adopts last session's numbers, so
        // repeating a weight is a single tap instead of four.
        const row = check.closest('.set-row');
        const wIn = row.querySelector('.wIn');
        const rIn = row.querySelector('.rIn');
        if(!wIn.value && wIn.dataset.ghostW) wIn.value = wIn.dataset.ghostW;
        if(!rIn.value && rIn.dataset.ghostR) rIn.value = rIn.dataset.ghostR;
        handleSetChecked();
      }
    };
  });
}

function handleSetChecked(){
  const circuitOn = !!state.circuitMode[dayKey(state.planKey, activeDay)];
  if(!circuitOn) startRestTimer();
}

function wireHistory(wrap, exName){
  const btn = wrap.querySelector('.history-btn');
  const panel = wrap.querySelector('.history-panel');
  if(!btn || !panel) return;
  btn.onclick = ()=>{
    if(!panel.classList.contains('show') && !panel.dataset.loaded){
      const rows = exerciseHistory(state, exName, 8);
      panel.innerHTML = rows.length === 0
        ? '<div class="history-empty">No sessions logged for this exercise yet.</div>'
        : rows.map(h => `
            <div class="history-row">
              <span class="hd num">${new Date(h.date).toLocaleDateString(undefined,{month:'short', day:'numeric'})}</span>
              <span class="hs num">${h.sets.map(s => `${s.w}×${s.r}`).join(', ')}</span>
              <span class="he num">e1RM ${h.e1rm}</span>
            </div>`).join('');
      panel.dataset.loaded = '1';
    }
    panel.classList.toggle('show');
  };
}

function wirePlateAndWarmup(wrap){
  const plateBtn = wrap.querySelector('.plate-btn');
  if(plateBtn) plateBtn.onclick = ()=> wrap.querySelector('.plate-calc').classList.toggle('show');
  const plateInput = wrap.querySelector('.plate-target');
  if(plateInput){
    plateInput.oninput = ()=>{
      const val = parseFloat(plateInput.value);
      const resultEl = plateInput.parentElement.querySelector('.plate-result');
      if(!val){ resultEl.textContent = ''; return; }
      const handle = state.settings.handleWeight || 0;
      const { perSide, combo } = platesForWeight(val, handle);
      resultEl.textContent = combo.length === 0
        ? 'Below handle weight'
        : `${perSide.toFixed(2)}${WU()} per side: ${combo.join(' + ')}`;
    };
  }
  const warmupBtn = wrap.querySelector('.warmup-btn');
  if(warmupBtn) warmupBtn.onclick = ()=> wrap.querySelector('.warmup-panel').classList.toggle('show');
  const warmupInput = wrap.querySelector('.warmup-target');
  if(warmupInput){
    warmupInput.oninput = ()=>{
      const val = parseFloat(warmupInput.value);
      const resultEl = warmupInput.parentElement.querySelector('.warmup-result');
      if(!val){ resultEl.innerHTML = ''; return; }
      const ramp = warmupRamp(val);
      resultEl.innerHTML = ramp.map(r => `<div class="warmup-row"><span>${r.pct}%</span><span>${r.weight}${WU()} x ${r.reps}</span></div>`).join('')
        + `<div class="warmup-row"><span>Working</span><span>${val}${WU()}</span></div>`;
    };
  }
}

function renderProgramStrip(){
  const info = programWeekInfo(state);
  const strip = document.getElementById('programStrip');
  const note = document.getElementById('programNote');
  if(!info){ strip.style.display = 'none'; note.style.display = 'none'; return; }
  strip.style.display = 'block';
  const chip = document.getElementById('programChip');
  chip.textContent = info.label;
  chip.classList.toggle('deload', info.isDeload);
  if(info.note){
    note.style.display = 'block';
    note.textContent = info.note;
    note.classList.toggle('deload', info.isDeload);
  } else {
    note.style.display = 'none';
  }
}

function renderDay(){
  renderProgramStrip();
  refreshWarmupLaunch();
  const day = currentPlan().days[activeDay];
  const card = document.getElementById('dayCard');
  card.innerHTML = '';

  const order = getDayOrder(state, state.planKey, activeDay, day.exercises.length);

  order.forEach((baseIdx, pos)=>{
    const baseEx = day.exercises[baseIdx];
    const effective = getEffectiveExercise(state, state.planKey, activeDay, baseIdx, baseEx);
    const parsed = parseTarget(effective.target) || { sets: 3, reps: 10 };
    const setCount = adjustedSetCount(state, parsed.sets);
    const targetReps = parsed.reps;
    const wrap = document.createElement('div');
    wrap.className = 'exercise';
    wrap.dataset.kind = 'base';
    wrap.dataset.baseidx = baseIdx;

    const best = state.bests[effective.name];
    const trend = lastVsPrevDelta(state, effective.name);
    const suggestion = progressionSuggestion(state, effective.name, targetReps);
    const subs = SUBSTITUTIONS[baseEx.name] || [];
    const isSore = !!state.soreFlags[baseEx.name];

    wrap.innerHTML = `
      <div class="ex-head-row">
        <div class="reorder-btns">
          <button class="reorder-up" ${pos === 0 ? 'disabled' : ''}>&and;</button>
          <button class="reorder-down" ${pos === order.length - 1 ? 'disabled' : ''}>&or;</button>
        </div>
        <div class="ex-head">
          <div class="ex-name">${effective.name}${effective.isOverride ? '<span class="swapped-tag">Swapped</span>' : ''}${isSore ? '<span class="sore-tag">Sore</span>' : ''}</div>
          <div class="ex-target">${effective.target}</div>
        </div>
        <button class="info-btn" aria-label="How to perform this exercise">i</button>
      </div>
      <div class="info-panel">${buildInfoPanelHTML(effective.name)}</div>
      ${best ? `<div class="best">BEST E1RM ${best.e1rm}, ${best.weight}x${best.reps}${trend}</div>` : ''}
      ${suggestion ? `<div class="suggestion">${suggestion}</div>` : ''}
      <div class="sets">${buildSetRowsHTML(setCount, lastSessionSets(state, effective.name), effective.name)}</div>
      <textarea class="note-field" placeholder="Notes, form cues, how it felt"></textarea>
      <div class="row-tools">
        <button class="history-btn">History</button>
        ${typeof BODYWEIGHT_EXERCISES !== 'undefined' && BODYWEIGHT_EXERCISES.has(effective.name)
          ? (progressionChainFor(effective.name) ? '<button class="prog-btn">Progression</button>' : '')
          : '<button class="plate-btn">Plate Calculator</button><button class="warmup-btn">Ramp Sets</button>'}
        ${subs.length ? `<button class="swap-btn">Swap Exercise</button>` : ''}
        ${subs.length ? `<button class="sore-btn ${isSore ? 'active' : ''}">${isSore ? 'Clear Sore' : 'Mark Sore'}</button>` : ''}
      </div>
      <div class="history-panel"></div>
      ${(() => {
        const chain = typeof progressionChainFor === 'function' ? progressionChainFor(effective.name) : null;
        if(!chain) return '';
        return `<div class="prog-list">` + chain.map((step, i) => `
          <div class="prog-item ${step === effective.name ? 'current' : ''}" data-name="${step}">
            <span class="prog-level num">L${i+1}</span> ${step}${step === effective.name ? ' <span class="prog-now">current</span>' : ''}
          </div>`).join('') + `</div>`;
      })()}
      <div class="plate-calc">
        <input type="number" placeholder="Target weight per dumbbell, ${WU()}" class="plate-target">
        <div class="plate-result"></div>
      </div>
      <div class="warmup-panel">
        <input type="number" placeholder="Working weight per dumbbell, ${WU()}" class="warmup-target">
        <div class="warmup-result"></div>
      </div>
      ${subs.length ? `<div class="swap-list">
        <div class="swap-item ${!effective.isOverride ? 'current' : ''}" data-name="${baseEx.name}">${baseEx.name} (original)</div>
        ${subs.map(s => `<div class="swap-item ${effective.name === s ? 'current' : ''}" data-name="${s}">${s}</div>`).join('')}
      </div>` : ''}
    `;

    wireSetRows(wrap);
    wirePlateAndWarmup(wrap);
    wireHistory(wrap, effective.name);

    const upBtn = wrap.querySelector('.reorder-up');
    const downBtn = wrap.querySelector('.reorder-down');
    if(upBtn) upBtn.onclick = ()=>{ moveExerciseInDay(state, state.planKey, activeDay, day.exercises.length, pos, pos - 1); saveState(state); renderDay(); };
    if(downBtn) downBtn.onclick = ()=>{ moveExerciseInDay(state, state.planKey, activeDay, day.exercises.length, pos, pos + 1); saveState(state); renderDay(); };

    wrap.querySelector('.info-btn').onclick = ()=> wrap.querySelector('.info-panel').classList.toggle('show');

    const progBtn = wrap.querySelector('.prog-btn');
    if(progBtn) progBtn.onclick = ()=> wrap.querySelector('.prog-list').classList.toggle('show');
    wrap.querySelectorAll('.prog-item').forEach(item=>{
      item.onclick = ()=>{
        const chosen = item.dataset.name;
        const key = overrideKey(state.planKey, activeDay, baseIdx);
        if(chosen === baseEx.name) delete state.overrides[key];
        else state.overrides[key] = chosen;
        saveState(state);
        renderDay();
      };
    });

    const swapBtn = wrap.querySelector('.swap-btn');
    if(swapBtn) swapBtn.onclick = ()=> wrap.querySelector('.swap-list').classList.toggle('show');
    wrap.querySelectorAll('.swap-item').forEach(item=>{
      item.onclick = ()=>{
        const chosen = item.dataset.name;
        const key = overrideKey(state.planKey, activeDay, baseIdx);
        if(chosen === baseEx.name) delete state.overrides[key];
        else state.overrides[key] = chosen;
        saveState(state);
        renderDay();
      };
    });

    const soreBtn = wrap.querySelector('.sore-btn');
    if(soreBtn){
      soreBtn.onclick = ()=>{
        const key = overrideKey(state.planKey, activeDay, baseIdx);
        if(state.soreFlags[baseEx.name]){
          delete state.soreFlags[baseEx.name];
          delete state.overrides[key];
        } else {
          state.soreFlags[baseEx.name] = true;
          if(subs.length) state.overrides[key] = subs[0];
        }
        saveState(state);
        renderDay();
      };
    }

    card.appendChild(wrap);
  });

  getCustomExercises(state, state.planKey, activeDay).forEach(ex=>{
    const setCount = adjustedSetCount(state, (parseTarget(ex.target) || { sets: 3 }).sets);
    const wrap = document.createElement('div');
    wrap.className = 'exercise';
    wrap.dataset.kind = 'custom';
    wrap.dataset.customid = ex.id;
    const best = state.bests[ex.name];
    wrap.innerHTML = `
      <div class="ex-head-row">
        <div class="ex-head">
          <div class="ex-name">${ex.name}</div>
          <div class="ex-target">${ex.target}</div>
        </div>
        <button class="info-btn" aria-label="How to perform this exercise">i</button>
      </div>
      <div class="info-panel">${buildInfoPanelHTML(ex.name)}</div>
      ${best ? `<div class="best">BEST E1RM ${best.e1rm}, ${best.weight}x${best.reps}</div>` : ''}
      <div class="sets">${buildSetRowsHTML(setCount, lastSessionSets(state, ex.name), ex.name)}</div>
      <textarea class="note-field" placeholder="Notes, form cues, how it felt"></textarea>
      <div class="row-tools">
        <button class="history-btn">History</button>
        <button class="plate-btn">Plate Calculator</button>
        <button class="warmup-btn">Ramp Sets</button>
      </div>
      <div class="history-panel"></div>
      <div class="plate-calc">
        <input type="number" placeholder="Target weight per dumbbell, ${WU()}" class="plate-target">
        <div class="plate-result"></div>
      </div>
      <div class="warmup-panel">
        <input type="number" placeholder="Working weight per dumbbell, ${WU()}" class="warmup-target">
        <div class="warmup-result"></div>
      </div>
      <button class="custom-exercise-remove">Remove this exercise</button>
    `;
    wireSetRows(wrap);
    wirePlateAndWarmup(wrap);
    wireHistory(wrap, ex.name);
    wrap.querySelector('.info-btn').onclick = ()=> wrap.querySelector('.info-panel').classList.toggle('show');
    wrap.querySelector('.custom-exercise-remove').onclick = ()=>{
      removeCustomExercise(state, state.planKey, activeDay, ex.id);
      saveState(state);
      renderDay();
    };
    card.appendChild(wrap);
  });

  const suggestion = suggestExerciseForDay(state, state.planKey, activeDay);

  const addBtn = document.createElement('button');
  addBtn.className = 'add-exercise-btn';
  addBtn.textContent = 'Add Custom Exercise';
  addBtn.onclick = ()=>{ document.getElementById('customExForm').classList.toggle('show'); };
  card.appendChild(addBtn);

  if(suggestion){
    const suggestBox = document.createElement('div');
    suggestBox.className = 'suggest-box';
    const reasonText = suggestion.reason === 'missing'
      ? `You haven't hit ${suggestion.muscle} yet this session.`
      : `Session already covers every muscle group, here's an option if you want more.`;
    suggestBox.innerHTML = `
      <div class="suggest-text">${reasonText}<br><strong>${suggestion.name}</strong></div>
      <button class="suggest-add-btn">Add This</button>
    `;
    suggestBox.querySelector('.suggest-add-btn').onclick = ()=>{
      addCustomExercise(state, state.planKey, activeDay, { name: suggestion.name, target: '3 x 12', muscle: suggestion.muscle });
      saveState(state);
      renderDay();
      showToast(`${suggestion.name} added`);
    };
    card.appendChild(suggestBox);
  }

  const libraryByMuscle = {};
  getKnownExerciseLibrary().forEach(e => {
    if(!libraryByMuscle[e.muscle]) libraryByMuscle[e.muscle] = [];
    libraryByMuscle[e.muscle].push(e.name);
  });

  const formWrap = document.createElement('div');
  formWrap.className = 'custom-form';
  formWrap.id = 'customExForm';
  formWrap.innerHTML = `
    <select id="customExName">
      ${MUSCLE_GROUPS.map(m => `
        <optgroup label="${m.charAt(0).toUpperCase() + m.slice(1)}">
          ${(libraryByMuscle[m] || []).map(n => `<option value="${n}">${n}</option>`).join('')}
        </optgroup>
      `).join('')}
      <optgroup label="Other">
        <option value="__other__">Type my own...</option>
      </optgroup>
    </select>
    <input type="text" id="customExOther" placeholder="Exercise name" style="display:none;">
    <input type="text" id="customExTarget" placeholder="Sets x reps, e.g. 3 x 12">
    <select id="customExMuscle">
      ${MUSCLE_GROUPS.map(m => `<option value="${m}">${m}</option>`).join('')}
    </select>
    <button id="customExSave">Add to This Day</button>
  `;
  card.appendChild(formWrap);

  const nameSelect = document.getElementById('customExName');
  const otherInput = document.getElementById('customExOther');
  const muscleSelect = document.getElementById('customExMuscle');

  function syncMuscleFromSelection(){
    if(nameSelect.value === '__other__'){
      otherInput.style.display = 'block';
    } else {
      otherInput.style.display = 'none';
      const match = getKnownExerciseLibrary().find(ex => ex.name === nameSelect.value);
      if(match) muscleSelect.value = match.muscle;
    }
  }
  nameSelect.onchange = syncMuscleFromSelection;
  syncMuscleFromSelection();

  document.getElementById('customExSave').onclick = ()=>{
    const name = nameSelect.value === '__other__' ? otherInput.value.trim() : nameSelect.value;
    const target = document.getElementById('customExTarget').value.trim();
    const muscle = muscleSelect.value;
    if(!name || !parseTarget(target)){ showToast('Enter a name and sets x reps, e.g. 3 x 12'); return; }
    addCustomExercise(state, state.planKey, activeDay, { name, target, muscle });
    saveState(state);
    renderDay();
    showToast('Exercise added');
  };

  if(state.circuitMode[dayKey(state.planKey, activeDay)]){
    const circuitBtn = document.createElement('button');
    circuitBtn.className = 'circuit-rest-btn';
    circuitBtn.textContent = 'Start Round Rest';
    circuitBtn.onclick = startRestTimer;
    card.appendChild(circuitBtn);
  }

  const finishBtn = document.createElement('button');
  finishBtn.className = 'finish';
  finishBtn.textContent = 'Log Session';
  finishBtn.onclick = logSession;
  card.appendChild(finishBtn);
}

function renderCircuitToggle(){
  const key = dayKey(state.planKey, activeDay);
  document.getElementById('circuitToggle').classList.toggle('on', !!state.circuitMode[key]);
}
document.getElementById('circuitToggle').onclick = ()=>{
  const key = dayKey(state.planKey, activeDay);
  state.circuitMode[key] = !state.circuitMode[key];
  saveState(state);
  renderCircuitToggle();
  renderDay();
};

function logSession(){
  const day = currentPlan().days[activeDay];
  const card = document.getElementById('dayCard');
  const exBlocks = card.querySelectorAll('.exercise');
  const record = { date: new Date().toISOString(), day: day.name, plan: state.planKey, lifts:{} };
  let anyLogged = false;
  const prs = [];

  exBlocks.forEach((block)=>{
    let exName;
    if(block.dataset.kind === 'base'){
      const baseIdx = parseInt(block.dataset.baseidx);
      const baseEx = day.exercises[baseIdx];
      exName = getEffectiveExercise(state, state.planKey, activeDay, baseIdx, baseEx).name;
    } else {
      const customList = getCustomExercises(state, state.planKey, activeDay);
      const ex = customList.find(e => e.id === block.dataset.customid);
      exName = ex ? ex.name : null;
    }
    if(!exName) return;

    const isBw = typeof BODYWEIGHT_EXERCISES !== 'undefined' && BODYWEIGHT_EXERCISES.has(exName);
    const rows = block.querySelectorAll('.set-row');
    const note = block.querySelector('.note-field').value.trim();
    const sets = [];
    rows.forEach(row=>{
      const w = parseFloat(row.querySelector('.wIn').value);
      const r = parseFloat(row.querySelector('.rIn').value);
      const rpe = row.querySelector('.rpe-select').value;
      // Bodyweight movements need only reps; any weight entered is added load.
      if(r && (w || isBw)){
        const set = { w: w || 0, r };
        if(rpe) set.rpe = parseInt(rpe);
        sets.push(set);
        anyLogged = true;
      }
    });
    if(sets.length) record.lifts[exName] = { sets, note };
  });

  if(!anyLogged){ showToast('Log at least one set first'); return; }
  finalizeSession(record);
}

// Updates all-time bests from a finished record. Returns exercises that PR'd.
function applyBests(record){
  const prs = [];
  Object.entries(record.lifts).forEach(([exName, lift])=>{
    let bestE1 = 0, bestW = 0, bestR = 0;
    lift.sets.forEach(set=>{
      if(!set.w) return; // pure bodyweight sets have no e1RM
      const e1 = epley(set.w, set.r);
      if(e1 > bestE1){ bestE1 = e1; bestW = set.w; bestR = set.r; }
    });
    if(bestE1 > 0){
      const prev = state.bests[exName];
      if(!prev || bestE1 > prev.e1rm){
        state.bests[exName] = { e1rm: bestE1, weight: bestW, reps: bestR };
        if(prev) prs.push(exName);
      }
    }
  });
  return prs;
}

// Shared tail for both the normal log flow and guided mode.
function finalizeSession(record){
  const prs = applyBests(record);
  record.volume = sessionVolume(record);
  record.durationSeconds = currentSessionSeconds();
  state.sessions.unshift(record);
  updateStreak(state);
  const newBadges = checkBadges(state);
  saveState(state);
  resetSessionTimer();
  render();
  showSessionSummary(record, prs, newBadges);
  if(prs.length) launchConfetti();
}

// Post-workout recap card, the moment of reward after Finish.
function showSessionSummary(record, prs, newBadges){
  const totalSets = Object.values(record.lifts).reduce((a,l) => a + l.sets.length, 0);
  const mins = Math.round((record.durationSeconds || 0) / 60);
  const el = document.getElementById('summaryOverlay');
  el.querySelector('.summary-body').innerHTML = `
    <div class="summary-title">Session Complete</div>
    <div class="summary-day">${record.day}</div>
    <div class="summary-grid">
      <div><div class="sv num">${Math.round(record.volume)}</div><div class="sl">${WU()} volume</div></div>
      <div><div class="sv num">${totalSets}</div><div class="sl">sets</div></div>
      <div><div class="sv num">${Object.keys(record.lifts).length}</div><div class="sl">exercises</div></div>
      <div><div class="sv num">${mins > 0 ? mins : '-'}</div><div class="sl">minutes</div></div>
    </div>
    ${prs.length ? `<div class="summary-prs">PR: ${prs.join(', ')}</div>` : ''}
    ${newBadges && newBadges.length ? `<div class="summary-badges">Badge unlocked: ${newBadges.join(', ')}</div>` : ''}
    <div class="summary-streak">Streak: ${state.streak || 0} day${state.streak === 1 ? '' : 's'}</div>
  `;
  el.classList.add('show');
}
document.getElementById('summaryDone').onclick = ()=> document.getElementById('summaryOverlay').classList.remove('show');

function showPrBanner(prs){
  const el = document.getElementById('prBanner');
  el.innerHTML = `<div class="banner pr"><strong>New PR:</strong> ${prs.join(', ')}</div>`;
  setTimeout(()=>{ el.innerHTML = ''; }, 6000);
}

function setRing(id, pct){
  const circle = document.getElementById(id);
  const r = parseFloat(circle.getAttribute('r'));
  const circumference = 2 * Math.PI * r;
  circle.style.strokeDasharray = circumference;
  circle.style.strokeDashoffset = circumference * (1 - Math.min(1, Math.max(0, pct)));
}

function renderStats(){
  document.getElementById('planTitle').textContent = `Foundry // ${currentPlan().label}`;
  document.getElementById('planSub').textContent = `${currentPlan().minutes} min sessions, dumbbells + bench`;

  const map = weeklyVolumes(state);
  const keys = Object.keys(map).sort();
  const thisWeekVolume = keys.length ? map[keys[keys.length - 1]] : 0;
  const volumeGoal = state.settings.weeklyGoal || 1000;

  const thisWeekKey = isoWeekKey(new Date().toISOString());
  const sessionsThisWeek = state.sessions.filter(s => isoWeekKey(s.date) === thisWeekKey).length;
  const sessionsTarget = currentPlan().days.length;

  const streak = state.streak || 0;
  const streakTarget = 7;

  setRing('ringVolume', thisWeekVolume / volumeGoal);
  setRing('ringSessions', sessionsThisWeek / sessionsTarget);
  setRing('ringStreak', streak / streakTarget);

  document.getElementById('ringVolumeLabel').textContent = `${Math.round(thisWeekVolume)}${WU()}`;
  document.getElementById('ringSessionsLabel').textContent = `${sessionsThisWeek}/${sessionsTarget}`;
  document.getElementById('ringStreakLabel').textContent = `${streak}d`;
}

function renderHistory(){
  const el = document.getElementById('histList');
  el.innerHTML = '';
  if(state.sessions.length === 0){
    el.innerHTML = '<div class="hist-row"><span>No sessions yet, log your first workout above.</span></div>';
    return;
  }
  state.sessions.slice(0,8).forEach(s=>{
    const liftCount = Object.keys(s.lifts).length;
    const vol = s.volume || sessionVolume(s);
    const row = document.createElement('div');
    row.className = 'hist-row';
    const d = new Date(s.date);
    row.innerHTML = `<span>${s.day}, ${liftCount} lifts, ${vol}${WU()} volume</span><span class="d">${d.toLocaleDateString()}</span>`;
    el.appendChild(row);
  });
}

function render(){
  activeDay = Math.min(activeDay, currentPlan().days.length - 1);
  renderTabs();
  renderCircuitToggle();
  renderDay();
  renderStats();
  renderHistory();
  renderSessionTimer();
}

// ---------- View switching ----------

document.querySelectorAll('.viewtab').forEach(tab=>{
  tab.onclick = ()=> goToViewByIndex(VIEW_ORDER.indexOf(tab.dataset.view));
});
const VIEW_ORDER = ['log','cardio','progress','body','settings'];
const VIEW_ELS = { log:'logView', cardio:'cardioView', progress:'progressView', body:'bodyView', settings:'settingsView' };

function hapticLight(){
  try{
    const H = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Haptics;
    if(H) H.impact({ style: 'LIGHT' });
  }catch(e){ /* no-op off-device */ }
}

function switchView(view, dir){
  const previous = currentView;
  currentView = view;
  document.querySelectorAll('.viewtab').forEach(t => t.classList.toggle('active', t.dataset.view === view));
  positionViewtabsPill();
  Object.entries(VIEW_ELS).forEach(([name, id])=>{
    document.getElementById(id).style.display = (name === view) ? 'block' : 'none';
  });
  if(view === 'log') render();
  if(view === 'cardio') renderCardioView();
  if(view === 'progress') renderProgress();
  if(view === 'body') renderBody();
  if(view === 'settings') renderSettings();

  // Animate only when actually changing view, and only if a direction is known.
  if(dir && previous !== view){
    const el = document.getElementById(VIEW_ELS[view]);
    el.classList.remove('view-enter-right','view-enter-left');
    void el.offsetWidth;   // force reflow so the animation replays
    el.classList.add(dir === 1 ? 'view-enter-right' : 'view-enter-left');
  }
}

function goToViewByIndex(i){
  if(i < 0 || i >= VIEW_ORDER.length) return;
  const target = VIEW_ORDER[i];
  if(target === currentView) return;
  const dir = i > VIEW_ORDER.indexOf(currentView) ? 1 : -1;
  hapticLight();
  switchView(target, dir);
}

// Horizontal swipe between the five main views. Deliberately ignores drags
// that begin inside a horizontal scroller (day tabs, photo row, the SQL
// block) or a segmented control, and stays inert while any overlay is open.
(function initViewSwipe(){
  let startX = 0, startY = 0, tracking = false, decided = false, horizontal = false;

  document.body.addEventListener('touchstart', (e)=>{
    if(e.touches.length !== 1){ tracking = false; return; }
    if(document.querySelector('[class*="overlay"].show')){ tracking = false; return; }
    if(e.target.closest('.daytabs, .photo-row, .sync-setup, .seg-control, input, textarea, select, canvas')){
      tracking = false; return;
    }
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    tracking = true; decided = false; horizontal = false;
  }, { passive: true });

  document.body.addEventListener('touchmove', (e)=>{
    if(!tracking) return;
    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;
    // Commit to an interpretation once, early: sideways swipe vs vertical scroll.
    if(!decided && (Math.abs(dx) > 10 || Math.abs(dy) > 10)){
      decided = true;
      horizontal = Math.abs(dx) > Math.abs(dy) * 1.3;
    }
  }, { passive: true });

  document.body.addEventListener('touchend', (e)=>{
    if(!tracking || !horizontal){ tracking = false; return; }
    tracking = false;
    const dx = e.changedTouches[0].clientX - startX;
    if(Math.abs(dx) < 55) return;   // ignore small drags
    const i = VIEW_ORDER.indexOf(currentView);
    goToViewByIndex(dx < 0 ? i + 1 : i - 1);
  }, { passive: true });
})();

function positionViewtabsPill(){
  const el = document.getElementById('viewtabsControl');
  const pill = document.getElementById('viewtabsPill');
  const activeTab = el && el.querySelector('.viewtab.active');
  if(!el || !pill || !activeTab) return;
  pill.style.width = activeTab.offsetWidth + 'px';
  pill.style.transform = 'translateX(' + activeTab.offsetLeft + 'px)';
}

window.addEventListener('resize', ()=>{
  positionViewtabsPill();
  positionDaytabsPill();
});
document.addEventListener('DOMContentLoaded', ()=>{
  setTimeout(()=>{ positionViewtabsPill(); positionDaytabsPill(); }, 50);
});

// ---------- Cardio / Conditioning view ----------

function renderCardioView(){
  const sel = document.getElementById('cardioActivity');
  if(sel.options.length === 0){
    sel.innerHTML = CARDIO_ACTIVITIES.map(a => `<option value="${a}">${a}</option>`).join('');
    sel.onchange = ()=>{
      document.getElementById('cardioCustomName').style.display = sel.value === 'Custom' ? 'block' : 'none';
      renderCardioInfoPanel();
      renderCardioPerf();
    };
    document.getElementById('cardioInfoBtn').onclick = ()=>{
      document.getElementById('cardioInfoPanel').classList.toggle('show');
    };
  }
  renderCardioInfoPanel();
  renderCardioHistory();
  renderCardioPerf();
}

function renderCardioInfoPanel(){
  const activity = document.getElementById('cardioActivity').value;
  const panel = document.getElementById('cardioInfoPanel');
  const cue = CARDIO_INFO[activity];
  panel.innerHTML = cue
    ? `<p class="info-tip">${cue}</p>`
    : `<p class="info-empty">No technique cue saved for this one yet.</p>`;
}

document.getElementById('cardioSave').onclick = ()=>{
  const activitySel = document.getElementById('cardioActivity').value;
  const customName = document.getElementById('cardioCustomName').value.trim();
  const activity = activitySel === 'Custom' ? (customName || 'Custom') : activitySel;
  const minutes = parseFloat(document.getElementById('cardioMinutes').value);
  const distance = parseFloat(document.getElementById('cardioDistance').value) || null;
  const calories = parseFloat(document.getElementById('cardioCalories').value) || null;
  const rpe = document.getElementById('cardioRpe').value || null;
  const notes = document.getElementById('cardioNotes').value.trim();

  if(!minutes || minutes <= 0){ showToast('Enter minutes for this session'); return; }

  state.cardioSessions.unshift({
    date: new Date().toISOString(),
    activity, minutes, distance, calories,
    rpe: rpe ? parseInt(rpe) : null,
    notes
  });
  updateStreak(state);
  const newBadges = checkBadges(state);
  saveState(state);

  document.getElementById('cardioMinutes').value = '';
  document.getElementById('cardioDistance').value = '';
  document.getElementById('cardioCalories').value = '';
  document.getElementById('cardioRpe').value = '';
  document.getElementById('cardioNotes').value = '';
  document.getElementById('cardioCustomName').value = '';

  renderCardioHistory();
  renderCardioPerf();
  renderStats();
  showToast('Conditioning session logged');
  if(newBadges.length) setTimeout(()=> showToast(`Badge unlocked: ${newBadges.join(', ')}`), 1500);
};

function renderCardioHistory(){
  const el = document.getElementById('cardioHistList');
  el.innerHTML = '';
  if(!state.cardioSessions || state.cardioSessions.length === 0){
    el.innerHTML = '<div class="hist-row"><span>No conditioning sessions yet.</span></div>';
    return;
  }
  state.cardioSessions.slice(0, 10).forEach(s=>{
    const d = new Date(s.date);
    const details = [`${s.minutes} min`];
    if(s.distance) details.push(`${s.distance}m`);
    if(s.calories) details.push(`${s.calories} cal`);
    if(s.rpe) details.push(`RPE ${s.rpe}`);
    const row = document.createElement('div');
    row.className = 'hist-row';
    row.innerHTML = `<span>${s.activity}, ${details.join(', ')}</span><span class="d">${d.toLocaleDateString()}</span>`;
    el.appendChild(row);
  });
}

// ---------- Progress view ----------

function renderProgress(){
  renderDeloadBanner();
  renderProgressStats();
  renderInsights();
  renderWeekSummary();
  renderCardioSummary();
  renderGoalBar();
  renderCalendar();
  renderRecovery();
  renderBadges();
  renderTrainingMax();
  renderWeeklyVolumeChart();
  renderMuscleChart();
  renderSetsPerMuscle();
  renderPrTimeline();
  renderVolumeChart();
  populateExSelect();
  renderE1rmChart();
}

function renderBody(){
  document.getElementById('bwInput').placeholder = `${WU()} today`;
  renderBwChart();
  renderMeasurements();
}

function renderInsights(){
  const el = document.getElementById('insightsList');
  el.innerHTML = computeInsights(state).map(i => `
    <div class="insight-card ${i.tone}">
      <div class="insight-bar"></div>
      <div>
        <div class="insight-title">${i.title}</div>
        <div class="insight-text">${i.text}</div>
      </div>
    </div>
  `).join('');
}

function renderWeeklyVolumeChart(){
  const series = weeklyVolumeSeries(state, 12);
  drawBarChart('weeklyChart', series.map(w => w.label), series.map(w => w.volume), weeklyChartRef);
}

function renderSetsPerMuscle(){
  const el = document.getElementById('setsPerMuscle');
  const sets = weeklySetsPerMuscle(state);
  const entries = Object.entries(sets).filter(([,v]) => v > 0).sort((a,b) => b[1] - a[1]);
  if(entries.length === 0){
    el.innerHTML = '<div class="pr-empty">Log a session this week and set counts appear here.</div>';
    return;
  }
  const max = Math.max(20, ...entries.map(e => e[1]));
  el.innerHTML = entries.map(([muscle, count]) => {
    const zone = count < 10 ? 'low' : count <= 20 ? 'in' : 'high';
    const pct = Math.min(100, Math.round((count / max) * 100));
    return `
      <div class="spm-row">
        <span class="spm-name">${muscle}</span>
        <div class="spm-track"><div class="spm-band"></div><div class="spm-fill ${zone}" style="width:${pct}%"></div></div>
        <span class="spm-count num">${count}</span>
      </div>`;
  }).join('') + '<div class="spm-legend">Shaded band = 10-20 sets, the productive weekly range for growth</div>';
}

function renderMuscleChart(){
  const breakdown = muscleVolumeBreakdown(state, 30);
  const entries = Object.entries(breakdown).filter(([,v]) => v > 0).sort((a,b) => b[1] - a[1]);
  drawDoughnutChart('muscleChart', entries.map(e => e[0]), entries.map(e => Math.round(e[1])), muscleChartRef);
}

function renderPrTimeline(){
  const el = document.getElementById('prTimeline');
  const events = prTimeline(state, 8);
  if(events.length === 0){
    el.innerHTML = '<div class="pr-empty">Beat a previous best and it shows up here.</div>';
    return;
  }
  el.innerHTML = events.map(p => `
    <div class="pr-row">
      <span class="ex">${p.exercise}</span>
      <span class="val">${p.e1rm}${WU()} <span style="color:var(--muted); font-weight:400;">+${p.gain}</span></span>
      <span class="d">${new Date(p.date).toLocaleDateString(undefined,{month:'short', day:'numeric'})}</span>
    </div>
  `).join('');
}

// ---------- Body measurements ----------

function todayDateStr(){
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function renderMeasurements(){
  // Build the entry grid once.
  const grid = document.getElementById('measureGrid');
  if(!grid.children.length){
    grid.innerHTML = MEASUREMENT_SITES.map(s => `
      <div class="measure-field">
        <label for="measure_${s.key}">${s.label}</label>
        <input type="number" step="0.1" inputmode="decimal" id="measure_${s.key}" placeholder="cm">
      </div>
    `).join('');
  }
  document.getElementById('measureDate').value = document.getElementById('measureDate').value || todayDateStr();

  // Latest snapshot with deltas.
  const snapEl = document.getElementById('measureSnapshot');
  const snapshot = measurementSnapshot(state);
  if(snapshot.length === 0){
    snapEl.innerHTML = '<div class="measure-empty">No measurements yet. Tape measure, relaxed muscle, same time of day each time.</div>';
  } else {
    snapEl.innerHTML = snapshot.map(s => {
      const deltaHtml = s.deltaPrev === null ? '' :
        s.deltaPrev === 0 ? '<span class="delta flat">FLAT</span>' :
        `<span class="delta ${s.deltaPrev > 0 ? 'up' : 'down'}">${s.deltaPrev > 0 ? '+' : ''}${s.deltaPrev}</span>`;
      const sinceStart = s.deltaFirst === null ? '' :
        ` <span class="d" style="color:var(--muted); font-family:var(--font-mono); font-size:11px;">${s.deltaFirst > 0 ? '+' : ''}${s.deltaFirst} total</span>`;
      return `<div class="measure-row"><span class="site">${s.label}</span>${deltaHtml}${sinceStart}<span class="val num">${s.value}cm</span></div>`;
    }).join('');
  }

  // Trend chart selector, only sites that have 1+ readings.
  const sel = document.getElementById('measureSelect');
  const prevValue = sel.value;
  const measured = MEASUREMENT_SITES.filter(s => measurementSeries(state, s.key).length > 0);
  if(measured.length === 0){
    sel.innerHTML = '<option value="">Log a measurement to unlock this</option>';
  } else {
    sel.innerHTML = measured.map(s => `<option value="${s.key}">${s.label}</option>`).join('');
    if(measured.some(s => s.key === prevValue)) sel.value = prevValue;
  }
  sel.onchange = renderMeasureChart;
  renderMeasureChart();
}

function renderMeasureChart(){
  const key = document.getElementById('measureSelect').value;
  const series = key ? measurementSeries(state, key) : [];
  const labels = series.map(p => new Date(p.date + 'T12:00:00').toLocaleDateString(undefined,{month:'short', day:'numeric'}));
  drawLineChart('measureChart', labels, series.map(p => p.value), measureChartRef);
}

document.getElementById('measureToggleForm').onclick = ()=>{
  document.getElementById('measureForm').classList.toggle('show');
};

document.getElementById('measureSave').onclick = ()=>{
  const dateStr = document.getElementById('measureDate').value || todayDateStr();
  const values = {};
  MEASUREMENT_SITES.forEach(s => {
    const v = parseFloat(document.getElementById('measure_' + s.key).value);
    if(!isNaN(v) && v > 0) values[s.key] = v;
  });
  if(Object.keys(values).length === 0){ showToast('Enter at least one measurement'); return; }
  saveMeasurementEntry(state, dateStr, values);
  saveState(state);
  MEASUREMENT_SITES.forEach(s => document.getElementById('measure_' + s.key).value = '');
  document.getElementById('measureForm').classList.remove('show');
  renderMeasurements();
  showToast('Measurements saved');
};

function renderTrainingMax(){
  const sel = document.getElementById('tmSelect');
  const prevValue = sel.value;
  const names = Object.keys(state.bests);
  if(names.length === 0){
    sel.innerHTML = '<option value="">Log a lift to unlock this</option>';
    document.getElementById('tmResult').innerHTML = '';
    return;
  }
  sel.innerHTML = names.map(n => `<option value="${n}">${n}</option>`).join('');
  if(names.includes(prevValue)) sel.value = prevValue;
  sel.onchange = renderTrainingMax;

  const chosen = sel.value || names[0];
  const best = state.bests[chosen];
  if(!best) return;
  const { trainingMax, rows } = trainingMaxTable(best.e1rm);
  document.getElementById('tmResult').innerHTML = `
    <div class="tm-max">Training max, ${trainingMax}${WU()}</div>
    ${rows.map(r => `<div class="tm-row"><span>${r.pct}%</span><span>${r.weight}${WU()}</span></div>`).join('')}
  `;
}

function renderDeloadBanner(){
  const el = document.getElementById('deloadBanner');
  // A running program owns loading decisions; the reactive suggestion would
  // just be a second voice saying the same thing at the wrong time.
  if(programWeekInfo(state)){ el.innerHTML = ''; return; }
  const trend = checkDeload(state);
  el.innerHTML = trend
    ? `<div class="banner"><strong>Deload suggested:</strong> weekly volume has climbed 4 weeks straight (${trend.map(v=>Math.round(v)).join(' to ')}${WU()}). Consider a lighter week.</div>`
    : '';
}

function renderProgressStats(){
  const el = document.getElementById('progressStats');
  const totalSessions = state.sessions.length;
  const totalVolume = state.sessions.reduce((sum,s)=> sum + (s.volume || sessionVolume(s)), 0);
  const avgVolume = totalSessions ? Math.round(totalVolume / totalSessions) : 0;
  el.innerHTML = `
    <div><div class="v num">${totalSessions}</div><div class="l">Sessions</div></div>
    <div><div class="v num">${totalVolume}</div><div class="l">Total ${WU()}</div></div>
    <div><div class="v num">${avgVolume}</div><div class="l">Avg ${WU()}/session</div></div>
  `;
}

function renderWeekSummary(){
  const el = document.getElementById('weekSummary');
  const now = new Date();
  const thisWeekKey = isoWeekKey(now.toISOString());
  const sessionsThisWeek = state.sessions.filter(s => isoWeekKey(s.date) === thisWeekKey);
  const volumeThisWeek = sessionsThisWeek.reduce((sum,s)=> sum + (s.volume || sessionVolume(s)), 0);
  let topPr = '-';
  sessionsThisWeek.forEach(s => Object.keys(s.lifts).forEach(name=>{
    const e1 = bestE1rmInSession(s, name);
    const best = state.bests[name];
    if(best && best.e1rm === e1) topPr = name;
  }));
  el.innerHTML = `
    <div><div class="v num">${sessionsThisWeek.length}</div><div class="l">Sessions</div></div>
    <div><div class="v num">${Math.round(volumeThisWeek)}</div><div class="l">Kg lifted</div></div>
    <div><div class="v num" style="font-size:12px;">${topPr}</div><div class="l">Top lift</div></div>
  `;
}

function renderCardioSummary(){
  const stats = cardioStats(state);
  document.getElementById('cardioStats').innerHTML = `
    <div><div class="v num">${stats.totalSessions}</div><div class="l">Sessions</div></div>
    <div><div class="v num">${Math.round(stats.totalMinutes)}</div><div class="l">Total minutes</div></div>
  `;
  const breakdownEl = document.getElementById('cardioBreakdown');
  const entries = Object.entries(stats.byActivity);
  if(entries.length === 0){
    breakdownEl.innerHTML = '';
    return;
  }
  breakdownEl.innerHTML = entries
    .sort((a,b) => b[1].minutes - a[1].minutes)
    .map(([name, data]) => `
      <div class="cardio-breakdown-row">
        <span>${name}</span>
        <span class="d">${data.count} session${data.count===1?'':'s'}, ${Math.round(data.minutes)} min</span>
      </div>
    `).join('');
}

function renderGoalBar(){
  const goal = state.settings.weeklyGoal || 0;
  const map = weeklyVolumes(state);
  const keys = Object.keys(map).sort();
  const thisWeek = keys.length ? map[keys[keys.length-1]] : 0;
  const pct = goal > 0 ? Math.min(100, Math.round((thisWeek / goal) * 100)) : 0;
  document.getElementById('goalFill').style.width = pct + '%';
  document.getElementById('goalLabel').textContent = goal > 0
    ? `${Math.round(thisWeek)} / ${goal} ${WU()} this week (${pct}%)`
    : 'Set a weekly goal in Settings to track this.';
}

function renderCalendar(){
  const grid = document.getElementById('calGrid');
  const label = document.getElementById('calLabel');
  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  label.textContent = `${monthNames[calMonth]} ${calYear}`;

  const loggedDays = sessionsForMonth(state, calYear, calMonth);
  const firstDay = new Date(calYear, calMonth, 1);
  const startOffset = (firstDay.getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const today = new Date();

  grid.innerHTML = '';
  for(let i=0; i<startOffset; i++){
    const cell = document.createElement('div');
    cell.className = 'cal-cell empty';
    grid.appendChild(cell);
  }
  for(let d=1; d<=daysInMonth; d++){
    const cell = document.createElement('div');
    let cls = 'cal-cell';
    const schedule = state.settings.trainingDays;
    if(Array.isArray(schedule) && schedule.length && schedule.includes(new Date(calYear, calMonth, d).getDay())) cls += ' planned';
    if(loggedDays.has(d)) cls += ' logged';
    if(today.getFullYear()===calYear && today.getMonth()===calMonth && today.getDate()===d) cls += ' today';
    cell.className = cls;
    cell.textContent = d;
    grid.appendChild(cell);
  }
}
document.getElementById('calPrev').onclick = ()=>{
  calMonth--; if(calMonth < 0){ calMonth = 11; calYear--; }
  renderCalendar();
};
document.getElementById('calNext').onclick = ()=>{
  calMonth++; if(calMonth > 11){ calMonth = 0; calYear++; }
  renderCalendar();
};

function renderRecovery(){
  const el = document.getElementById('recoveryList');
  const rec = muscleRecovery(state);
  el.innerHTML = '';
  MUSCLE_GROUPS.forEach(g=>{
    const days = rec[g];
    let dotClass = 'recovery-fresh', text = 'Not trained yet';
    if(days !== null){
      text = days === 0 ? 'Trained today' : `${days} day${days===1?'':'s'} ago`;
      if(days <= 1) dotClass = 'recovery-fresh';
      else if(days <= 3) dotClass = 'recovery-recovering';
      else dotClass = 'recovery-ready';
    }
    const row = document.createElement('div');
    row.className = 'recovery-row';
    row.innerHTML = `<span class="m"><span class="recovery-dot ${dotClass}"></span>${g}</span><span class="d">${text}</span>`;
    el.appendChild(row);
  });
}

function renderBadges(){
  const el = document.getElementById('badgesList');
  el.innerHTML = '';
  BADGES.forEach(b=>{
    const unlocked = state.unlockedBadges.includes(b.id);
    const badge = document.createElement('div');
    badge.className = 'badge' + (unlocked ? ' unlocked' : '');
    badge.textContent = b.label;
    el.appendChild(badge);
  });
}

function renderVolumeChart(){
  const ordered = [...state.sessions].reverse();
  const labels = ordered.map(s => new Date(s.date).toLocaleDateString(undefined,{month:'short', day:'numeric'}));
  const data = ordered.map(s => s.volume || sessionVolume(s));
  drawLineChart('volumeChart', labels, data, volumeChartRef);
}

function populateExSelect(filterText){
  const sel = document.getElementById('exSelect');
  const prevValue = sel.value;
  const allNames = [];
  Object.values(getAllPlans(state)).forEach(p => p.days.forEach(d => d.exercises.forEach(e => {
    if(!allNames.includes(e.name)) allNames.push(e.name);
  })));
  // Include anything actually logged (custom exercises, swaps) so its trend is viewable.
  state.sessions.forEach(s => Object.keys(s.lifts).forEach(n => {
    if(!allNames.includes(n)) allNames.push(n);
  }));
  const filtered = filterText
    ? allNames.filter(n => n.toLowerCase().includes(filterText.toLowerCase()))
    : allNames;
  sel.innerHTML = filtered.map(n => `<option value="${n}">${n}</option>`).join('');
  if(filtered.includes(prevValue)) sel.value = prevValue;
  sel.onchange = renderE1rmChart;
}
document.getElementById('exSearch').oninput = (e)=>{
  populateExSelect(e.target.value);
  renderE1rmChart();
};

function renderE1rmChart(){
  const exName = document.getElementById('exSelect').value;
  const relevant = [...state.sessions].filter(s => s.lifts[exName]).reverse();
  const labels = relevant.map(s => new Date(s.date).toLocaleDateString(undefined,{month:'short', day:'numeric'}));
  const data = relevant.map(s => bestE1rmInSession(s, exName));
  drawLineChart('e1rmChart', labels, data, e1rmChartRef);
}

function renderBwChart(){
  const trendPoints = computeWeightTrend(state.bodyweights);
  const labels = trendPoints.map(p => new Date(p.date).toLocaleDateString(undefined,{month:'short', day:'numeric'}));
  const rawData = trendPoints.map(p => p.raw);
  const trendData = trendPoints.map(p => p.trend);

  const theme = chartTheme();
  const ctx = document.getElementById('bwChart');
  if(bwChartRef.current) bwChartRef.current.destroy();

  if(typeof Chart === 'undefined' || trendPoints.length === 0){
    ctx.getContext('2d').clearRect(0,0,ctx.width, ctx.height);
  } else {
    bwChartRef.current = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets: [
        {
          label: 'Trend', data: trendData, borderColor: theme.line, backgroundColor: theme.fill,
          fill:true, tension:0.3, pointRadius:0, borderWidth:2.5
        },
        {
          label: 'Daily', data: rawData, borderColor: cssVar('--text'), backgroundColor: 'transparent',
          fill:false, tension:0, pointRadius:2.5, pointBackgroundColor: cssVar('--text'), borderWidth:0, showLine:false
        }
      ]},
      options: {
        plugins:{ legend:{ display:false } },
        scales:{
          x:{ ticks:{ color: theme.text, font:{family: theme.mono, size:10} }, grid:{ color: theme.grid } },
          y:{ ticks:{ color: theme.text, font:{family: theme.mono, size:10} }, grid:{ color: theme.grid } }
        }
      }
    });
  }

  const rateEl = document.getElementById('bwTrendStat');
  if(!rateEl) return;
  if(trendPoints.length === 0){
    rateEl.textContent = 'Log your weight a few times to see a trend.';
    return;
  }
  const current = trendPoints[trendPoints.length - 1].trend;
  const rate = weeklyTrendChange(trendPoints);
  rateEl.innerHTML = rate === null
    ? `Trend: <b>${current}${WU()}</b>, log for a week to see a weekly rate`
    : `Trend: <b>${current}${WU()}</b>, ${rate > 0 ? '+' : ''}${rate}${WU()}/week`;
}

document.getElementById('bwAdd').onclick = ()=>{
  const val = parseFloat(document.getElementById('bwInput').value);
  if(!val){ showToast('Enter a weight first'); return; }
  state.bodyweights.push({ date: new Date().toISOString(), kg: val });
  saveState(state);
  document.getElementById('bwInput').value = '';
  renderBwChart();
  showToast('Bodyweight logged');
};


// ---------- Settings view ----------

function renderSettings(){
  const el = document.getElementById('planOptions');
  el.innerHTML = '';
  Object.entries(getAllPlans(state)).forEach(([key, plan])=>{
    const isCustom = !!(state.customPlans && state.customPlans[key]);
    const div = document.createElement('div');
    div.className = 'plan-option' + (key === state.planKey ? ' active' : '');
    div.innerHTML = `
      <div class="pname">${plan.label}${plan.minutes ? `, ${plan.minutes} min` : ''}</div>
      <div class="pdesc">${plan.desc || `${plan.days.length} day${plan.days.length===1?'':'s'}`}</div>
      ${isCustom ? '<div class="plan-actions"><button class="plan-edit" type="button">Edit</button><button class="plan-delete" type="button">Delete</button></div>' : ''}
    `;
    div.onclick = ()=>{
      state.planKey = key;
      state.lastDay = 0;
      activeDay = 0;
      saveState(state);
      resetSessionTimer();
      renderSettings();
      showToast(`Switched to ${plan.label} plan`);
    };
    if(isCustom){
      div.querySelector('.plan-edit').onclick = (e)=>{ e.stopPropagation(); openPlanBuilder(key); };
      div.querySelector('.plan-delete').onclick = (e)=>{
        e.stopPropagation();
        if(!confirm(`Delete "${plan.label}"? Logged sessions are kept.`)) return;
        deleteCustomPlan(state, key);
        saveState(state);
        renderSettings();
        showToast('Plan deleted');
      };
    }
    el.appendChild(div);
  });
  refreshDeleteAccount();
  renderProgramSettings();
  renderTrainingDayChips();
  document.getElementById('resetCloudNote').textContent =
    (typeof syncEnabled === 'function' && syncEnabled()) ? ' and in the cloud' : '';
  const hintEl = document.getElementById('planCycleHint');
  const chosenN = (state.settings.trainingDays || []).length;
  const planN = getPlan(state, state.planKey).days.length;
  if(chosenN && chosenN !== planN){
    hintEl.style.display = 'block';
    hintEl.textContent = `Your ${chosenN} training days cycle through this plan's ${planN} workouts in order.`;
  } else {
    hintEl.style.display = 'none';
  }
  document.getElementById('goalFocusSelect').value = state.settings.goalFocus || 'muscle';
  document.getElementById('unitsSelect').value = state.settings.units || 'kg';
  document.getElementById('displayNameInput').value = state.settings.displayName || '';
  document.getElementById('shareStatsToggle').classList.toggle('on', !!state.settings.shareStats);
  document.querySelector('label[data-unit-label="goal"]').textContent = `Weekly volume goal, ${WU()}`;
  document.querySelector('label[data-unit-label="handle"]').textContent = `Dumbbell handle weight, ${WU()}`;
  document.querySelector('label[data-unit-label="increment"]').textContent = `Progression increment, ${WU()}`;
  renderSyncSettings();

  document.getElementById('restInput').value = state.settings.restSeconds;
  document.getElementById('goalInput').value = state.settings.weeklyGoal;
  document.getElementById('handleInput').value = state.settings.handleWeight;
  document.getElementById('progressionInput').value = state.settings.progressionIncrement;
  document.querySelectorAll('#themeSegControl .seg-btn').forEach(btn=>{
    btn.classList.toggle('active', btn.dataset.theme === (state.settings.theme || 'system'));
  });
  positionSegPill();
  document.querySelectorAll('#coachSegControl .seg-btn').forEach(btn=>{
    btn.classList.toggle('active', btn.dataset.tone === coachTone());
  });
  positionCoachPill();
  renderCoachToneHint();
  document.getElementById('notifyToggle').classList.toggle('on', !!state.settings.notifyRest);
  document.getElementById('lockToggle').classList.toggle('on', !!state.settings.passcodeEnabled);
}

function systemPrefersLight(){
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
}

function isEffectivelyLight(themeSetting){
  if(themeSetting === 'light') return true;
  if(themeSetting === 'dark') return false;
  return systemPrefersLight();
}

function applyTheme(){
  const themeSetting = (state.settings && state.settings.theme) || 'system';
  const light = isEffectivelyLight(themeSetting);
  document.body.classList.toggle('light', light);
  document.querySelector('meta[name="theme-color"]').setAttribute('content', light ? '#f2f2f7' : '#000000');
  const segButtons = document.querySelectorAll('#themeSegControl .seg-btn');
  segButtons.forEach(btn=>{
    btn.classList.toggle('active', btn.dataset.theme === themeSetting);
  });
  positionSegPill();
}

function positionPillIn(controlId, pillId){
  const control = document.getElementById(controlId);
  const pill = document.getElementById(pillId);
  const activeBtn = control && control.querySelector('.seg-btn.active');
  if(!control || !pill || !activeBtn) return;
  pill.style.width = activeBtn.offsetWidth + 'px';
  pill.style.transform = 'translateX(' + activeBtn.offsetLeft + 'px)';
}
function positionSegPill(){ positionPillIn('themeSegControl','themeSegPill'); }
function positionCoachPill(){ positionPillIn('coachSegControl','coachSegPill'); }

window.addEventListener('resize', ()=>{
  if(document.getElementById('themeSegControl')) positionSegPill();
});

document.querySelectorAll('#themeSegControl .seg-btn').forEach(btn=>{
  btn.onclick = ()=>{
    state.settings.theme = btn.dataset.theme;
    applyTheme();
    saveState(state);
    if(currentView === 'progress') renderProgress();
    if(currentView === 'body') renderBody();
  };
});

if(window.matchMedia){
  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', ()=>{
    if((state.settings && state.settings.theme) === 'system') applyTheme();
  });
}
function renderCoachToneHint(){
  const el = document.getElementById('coachToneHint');
  if(!el) return;
  const tone = coachTone();
  el.textContent = tone === 'off'
    ? 'Just the daily lines. No comment on missed sessions.'
    : tone === 'hard'
      ? 'Blunt and accountability-focused. Calls out missed sessions directly. Built for people who have quit before and want to be held to it.'
      : 'Factual notes on where you are, without the pep talk.';
}

document.querySelectorAll('#coachSegControl .seg-btn').forEach(btn=>{
  btn.onclick = ()=>{
    document.querySelectorAll('#coachSegControl .seg-btn').forEach(b=>b.classList.toggle('active', b===btn));
    state.settings.coachTone = btn.dataset.tone;
    positionCoachPill();
    renderCoachToneHint();
    saveState(state);
    hapticLight();
    renderHeaderQuote();
  };
});

document.getElementById('notifyToggle').onclick = async ()=>{
  const turningOn = !state.settings.notifyRest;
  if(window.debugLog) window.debugLog('toggle clicked, turningOn=' + turningOn);
  if(turningOn && window.FoundryNotify){
    const status = await window.FoundryNotify.checkPermission();
    if(window.debugLog) window.debugLog('checkPermission returned: ' + status);
    if(status === 'denied'){
      showToast('Notifications are off in iOS Settings. Opening Settings\u2026');
      window.FoundryNotify.openSettings();
      return;
    }
    const granted = await window.FoundryNotify.requestPermission();
    if(window.debugLog) window.debugLog('requestPermission returned: ' + granted);
    if(!granted){ showToast('Notification permission denied'); return; }
  }
  state.settings.notifyRest = turningOn;
  if(window.debugLog) window.debugLog('state.settings.notifyRest set to: ' + state.settings.notifyRest);
  document.getElementById('notifyToggle').classList.toggle('on', turningOn);
  saveState(state);
  if(turningOn){
    showToast(window.FoundryNotify && window.FoundryNotify.isNative
      ? 'Rest alerts enabled'
      : 'Note: alerts only fire while the app is open');
  }
};
document.getElementById('restInput').onchange = (e)=>{
  state.settings.restSeconds = parseInt(e.target.value) || 60;
  saveState(state);
};
document.getElementById('goalInput').onchange = (e)=>{
  state.settings.weeklyGoal = parseFloat(e.target.value) || 0;
  saveState(state);
};
document.getElementById('handleInput').onchange = (e)=>{
  state.settings.handleWeight = parseFloat(e.target.value) || 0;
  saveState(state);
};
document.getElementById('progressionInput').onchange = (e)=>{
  state.settings.progressionIncrement = parseFloat(e.target.value) || 2;
  saveState(state);
};

document.getElementById('lockToggle').onclick = ()=>{
  const setup = document.getElementById('passcodeSetup');
  if(state.settings.passcodeEnabled){
    state.settings.passcodeEnabled = false;
    state.settings.passcodeHash = null;
    document.getElementById('lockToggle').classList.remove('on');
    setup.classList.remove('show');
    saveState(state);
    showToast('App lock removed');
  } else {
    setup.classList.add('show');
    document.getElementById('pin1').focus();
  }
};
document.getElementById('pinSave').onclick = async ()=>{
  const pin1 = document.getElementById('pin1').value;
  const pin2 = document.getElementById('pin2').value;
  if(pin1.length < 4){ showToast('Use at least 4 digits'); return; }
  if(pin1 !== pin2){ showToast('Passcodes do not match'); return; }
  state.settings.passcodeHash = await hashPasscode(pin1);
  state.settings.passcodeEnabled = true;
  saveState(state);
  document.getElementById('lockToggle').classList.add('on');
  document.getElementById('passcodeSetup').classList.remove('show');
  document.getElementById('pin1').value = '';
  document.getElementById('pin2').value = '';
  showToast('App lock enabled');
};

document.getElementById('exportBtn').onclick = ()=>{
  const blob = new Blob([JSON.stringify(state, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `foundry-backup-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

function csvEscape(val){
  const str = String(val);
  return str.includes(',') || str.includes('"') || str.includes('\n')
    ? `"${str.replace(/"/g, '""')}"`
    : str;
}

document.getElementById('exportCsvBtn').onclick = ()=>{
  const rows = [['Date','Day','Exercise','Set','Weight (' + WU() + ')','Reps','RPE','Note','Session Volume (' + WU() + ')','Duration (min)']];
  state.sessions.forEach(s=>{
    const date = new Date(s.date).toISOString().slice(0,10);
    const duration = s.durationSeconds ? Math.round(s.durationSeconds / 60) : '';
    const volume = s.volume || sessionVolume(s);
    Object.entries(s.lifts).forEach(([exName, lift])=>{
      lift.sets.forEach((set, i)=>{
        rows.push([date, s.day, exName, i+1, set.w, set.r, set.rpe || '', i===0 ? lift.note : '', volume, duration]);
      });
    });
  });
  const csv = rows.map(row => row.map(csvEscape).join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `foundry-history-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('CSV exported');
};
document.getElementById('exportCardioCsvBtn').onclick = ()=>{
  const rows = [['Date','Activity','Minutes','Distance (m)','Calories','RPE','Notes']];
  (state.cardioSessions || []).forEach(s=>{
    const date = new Date(s.date).toISOString().slice(0,10);
    rows.push([date, s.activity, s.minutes, s.distance || '', s.calories || '', s.rpe || '', s.notes || '']);
  });
  const csv = rows.map(row => row.map(csvEscape).join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `foundry-conditioning-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Conditioning CSV exported');
};
document.getElementById('exportMeasureCsvBtn').onclick = ()=>{
  const rows = [['Date', ...MEASUREMENT_SITES.map(s => s.label + ' (cm)')]];
  (state.measurements || []).forEach(m => {
    rows.push([m.date, ...MEASUREMENT_SITES.map(s => m.values[s.key] != null ? m.values[s.key] : '')]);
  });
  const csv = rows.map(row => row.map(csvEscape).join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `foundry-measurements-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Measurements CSV exported');
};

document.getElementById('importBtn').onclick = ()=> document.getElementById('importFile').click();
document.getElementById('importFile').onchange = (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = ()=>{
    try{
      const data = JSON.parse(reader.result);
      state = Object.assign(defaultState(), data);
      state.settings = Object.assign(defaultState().settings, data.settings || {});
      state.sessions = (data.sessions || []).map(migrateSession);
      applyTheme();
      saveState(state);
      render();
      showToast('Backup restored');
    }catch(err){ showToast('Invalid backup file'); }
  };
  reader.readAsText(file);
};

// ---------- Toast, rest timer, confetti ----------

function showToast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(()=> t.classList.remove('show'), 1800);
}

function beep(){
  try{
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  }catch(e){}
}

let restEndsAt = null; // epoch ms; timestamp-based so the timer survives screen lock

function tickRestTimer(){
  const bar = document.getElementById('restBar');
  const timeEl = document.getElementById('restTime');
  const remaining = Math.ceil((restEndsAt - Date.now()) / 1000);
  if(remaining > 0){
    timeEl.textContent = remaining;
    return;
  }
  clearInterval(restInterval);
  restEndsAt = null;
  bar.classList.remove('show');
  beep();
}

const REST_NOTIF_ID = 424242;

// Requests notification permission once per device, regardless of whether the
// person is a brand-new local user (via onboarding) or signing into an
// existing account (which skips onboarding entirely). Idempotent: safe to
// call from multiple entry points, only ever actually prompts once.
function maybePromptNotifications(){
  if(localStorage.getItem('foundryNotifPrompted')) return;
  localStorage.setItem('foundryNotifPrompted', '1');
  if(window.FoundryNotify){
    window.FoundryNotify.requestPermission().then(granted=>{
      state.settings.notifyRest = granted;
      saveState(state);
      if(currentView === 'settings') renderSettings();
    });
  }
}

function startRestTimer(){
  clearInterval(restInterval);
  restEndsAt = Date.now() + (state.settings.restSeconds || 60) * 1000;
  document.getElementById('restBar').classList.add('show');
  document.getElementById('restTime').textContent = state.settings.restSeconds || 60;
  restInterval = setInterval(tickRestTimer, 250);
  if(window.debugLog) window.debugLog('startRestTimer: notifyRest=' + state.settings.notifyRest + ' FoundryNotify=' + !!window.FoundryNotify);
  if(state.settings.notifyRest && window.FoundryNotify){
    window.FoundryNotify.scheduleAt(REST_NOTIF_ID, 'Rest over', 'Time for your next set.', new Date(restEndsAt));
  }
}

// Catch up instantly when the app wakes from background.
document.addEventListener('visibilitychange', ()=>{
  if(document.visibilityState !== 'visible') return;
  if(restEndsAt) tickRestTimer();
  if(sessionTimerRunning) document.getElementById('stTime').textContent = formatTime(currentSessionSeconds());
});
document.getElementById('restSkip').onclick = ()=>{
  clearInterval(restInterval);
  restEndsAt = null;
  document.getElementById('restBar').classList.remove('show');
  if(window.FoundryNotify) window.FoundryNotify.cancel(REST_NOTIF_ID);
};

function launchConfetti(){
  const canvas = document.getElementById('confettiCanvas');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx = canvas.getContext('2d');
  const colors = ['#ff9f0a', '#30d158', '#0a84ff', '#ffd60a'];
  const pieces = Array.from({length: 80}, () => ({
    x: Math.random() * canvas.width,
    y: -20 - Math.random() * canvas.height * 0.3,
    size: 4 + Math.random() * 5,
    speedY: 2 + Math.random() * 3,
    speedX: (Math.random() - 0.5) * 2,
    rotation: Math.random() * 360,
    rotSpeed: (Math.random() - 0.5) * 10,
    color: colors[Math.floor(Math.random() * colors.length)]
  }));
  let frame = 0;
  function tick(){
    frame++;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pieces.forEach(p => {
      p.y += p.speedY;
      p.x += p.speedX;
      p.rotation += p.rotSpeed;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation * Math.PI / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size);
      ctx.restore();
    });
    if(frame < 150) requestAnimationFrame(tick);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  tick();
}

// ---------- Service worker ----------

// Service worker registration with an "update ready" banner. Vital for the
// home-screen app, which has no address bar and no way to hard-refresh: when a
// new version is waiting, we surface a tap-to-refresh bar instead of silently
// serving the old build until the next cold launch.
if('serviceWorker' in navigator && !(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform())){
  let swRegistration = null;

  function showUpdateBanner(worker){
    const bar = document.getElementById('updateBar');
    bar.classList.add('show');
    bar.onclick = ()=>{
      bar.textContent = 'Updating...';
      worker.postMessage({ type: 'SKIP_WAITING' });
    };
  }

  function watchForWaitingWorker(reg){
    if(reg.waiting){ showUpdateBanner(reg.waiting); return; }
    reg.addEventListener('updatefound', ()=>{
      const fresh = reg.installing;
      if(!fresh) return;
      fresh.addEventListener('statechange', ()=>{
        // 'installed' with an existing controller means an update is queued
        // behind the running version (a first-ever install has no controller).
        if(fresh.state === 'installed' && navigator.serviceWorker.controller){
          showUpdateBanner(fresh);
        }
      });
    });
  }

  window.addEventListener('load', ()=>{
    navigator.serviceWorker.register('sw.js')
      .then(reg => { swRegistration = reg; watchForWaitingWorker(reg); })
      .catch(()=>{});
  });

  // The new worker takes over, then we reload once into the new build.
  let reloadingForUpdate = false;
  navigator.serviceWorker.addEventListener('controllerchange', ()=>{
    if(reloadingForUpdate) return;
    reloadingForUpdate = true;
    location.reload();
  });

  // Standalone apps can stay resident for days; check for a new build every
  // time the app returns to the foreground.
  document.addEventListener('visibilitychange', ()=>{
    if(document.visibilityState === 'visible' && swRegistration){
      swRegistration.update().catch(()=>{});
    }
  });
}

// ---------- Init ----------

// The hero line reads the training context and speaks to it, in priority
// order: fresh PR > deload week > trained today > long gap > scheduled day >
// long-term progress > daily rotation. Deterministic within a day.
// Walks back day by day from yesterday, counting scheduled training days
// with nothing logged. Stops at the first day that was either trained or not
// scheduled, so a rest day never breaks a legitimate streak. Deload weeks
// return 0, since not training then is the plan working, not a failure.
function missedScheduledInARow(){
  const schedule = state.settings.trainingDays;
  if(!Array.isArray(schedule) || !schedule.length) return 0;
  const prog = programWeekInfo(state);
  if(prog && prog.isDeload) return 0;

  const logged = new Set(state.sessions.map(s => new Date(s.date).toDateString()));
  let missed = 0;
  for(let back = 1; back <= 21; back++){
    const d = new Date();
    d.setDate(d.getDate() - back);
    if(!schedule.includes(d.getDay())) continue;      // not a training day
    if(logged.has(d.toDateString())) break;           // trained, streak intact
    missed++;
    if(missed >= 4) break;
  }
  return missed;
}

function coachTone(){
  return (state.settings && state.settings.coachTone) || 'standard';
}

// Returns a message for missed scheduled sessions, or null to fall through to
// the normal quote chain. Off returns null always. Standard states the fact.
// Hard uses the accountability voice, targeting the pattern, never the person.
function coachMissedMessage(who){
  const tone = coachTone();
  if(tone === 'off') return null;
  const missed = missedScheduledInARow();
  if(missed < 1) return null;

  if(tone === 'standard'){
    if(missed === 1) return `One session missed${who}. Today's the one that counts.`;
    return `${missed} scheduled sessions missed${who}. Start with the easy day.`;
  }
  // hard
  if(missed === 1) return `One missed session${who}. That's data, not a disaster. You know what happens if it becomes two.`;
  if(missed === 2) return `Two in a row${who}. This is the exact pattern that ends attempts. Today isn't optional.`;
  return `${missed} missed in a row${who}. This is where it usually gets abandoned quietly. Today, not Monday.`;
}

function renderHeaderQuote(){
  const el = document.getElementById('headerQuote');
  const n = state.settings.firstName;
  const who = n ? `, ${n}` : '';
  const now = Date.now();
  const day = 86400000;

  // 1. A PR in the last 48 hours stays on the marquee.
  const freshPr = prTimeline(state, 5).find(p => now - new Date(p.date).getTime() <= 2 * day);
  if(freshPr){
    el.textContent = `That ${freshPr.exercise} PR is still warm${who}. ${freshPr.e1rm}${WU()} and climbing.`;
    return;
  }

  // 2. Programmed deload week: the message is recovery.
  const prog = programWeekInfo(state);
  if(prog && prog.isDeload){
    el.textContent = `Deload week${who}. Recovery is the workout.`;
    return;
  }

  // 3. Already trained today: bank it.
  const todayStr = new Date().toDateString();
  const todays = state.sessions.find(s => new Date(s.date).toDateString() === todayStr);
  if(todays){
    el.textContent = `${Math.round(todays.volume)}${WU()} banked today${who}. Recover like it matters.`;
    return;
  }

  // 4. Missed scheduled sessions, phrased by the chosen coach tone.
  const coachMsg = coachMissedMessage(who);
  if(coachMsg){ el.textContent = coachMsg; return; }

  // 5. A long gap gets a nudge, or a harder push if the tone asks for one.
  if(state.sessions.length){
    const gap = Math.floor((now - new Date(state.sessions[0].date).getTime()) / day);
    if(gap >= 5){
      el.textContent = coachTone() === 'hard'
        ? `${gap} days${who}. This is the point it usually gets abandoned instead of restarted. Do the short version today.`
        : `${gap} days since your last session${who}. Pick the easy day and just start.`;
      return;
    }
  }

  // 5. Scheduled training day, nothing logged yet: name the work.
  const schedule = state.settings.trainingDays;
  if(Array.isArray(schedule) && schedule.includes(new Date().getDay())){
    const days = currentPlan().days;
    const nextIdx = state.sessions.length ? ((state.lastDay || 0) + 1) % days.length : 0;
    const dayName = days[nextIdx].name;
    const phrase = /^day\b/i.test(dayName) ? `${dayName} today` : `${dayName} day today`;
    el.textContent = `${phrase}${who}. ${dailyGreeting().replace(/, \S+\.$/, '.').replace('{n}', '')}`;
    return;
  }

  // 6. Long-term progress line, rotated deterministically with the greetings.
  const names = Object.keys(state.bests);
  const dayOfYear = Math.floor((now - new Date(new Date().getFullYear(), 0, 0)) / day);
  if(names.length && dayOfYear % 3 === 0){
    const name = names[dayOfYear % names.length];
    const relevant = state.sessions.filter(s => s.lifts[name]).reverse();
    if(relevant.length >= 2){
      const diff = bestE1rmInSession(relevant[relevant.length - 1], name) - bestE1rmInSession(relevant[0], name);
      if(diff > 0){
        el.textContent = `Up ${diff}${WU()} on ${name} since your first log${who}. Quiet work, loud results.`;
        return;
      }
    }
  }

  // 7. Daily rotation.
  el.textContent = dailyGreeting();
}

function initApp(){
  setTimeout(()=>{ if(typeof pullStateFromCloud === 'function') pullStateFromCloud(); }, 400);
  // Monday-morning moment: surface last week's recap once per week, but never
  // over the welcome or onboarding overlays.
  setTimeout(()=>{
    const busy = ['welcomeOverlay','onboardOverlay','recoveryOverlay','tourOverlay'].some(id => {
      const el = document.getElementById(id);
      return el && el.classList.contains('show');
    });
    if(!busy) openRecap(true);
  }, 1200);
  applyTheme();
  updateStreak(state);
  renderHeaderQuote();
  render();
}

async function tryUnlock(){
  const input = document.getElementById('lockInput');
  const errorEl = document.getElementById('lockError');
  const attemptHash = await hashPasscode(input.value);
  if(attemptHash === state.settings.passcodeHash){
    document.getElementById('lockScreen').style.display = 'none';
    initApp();
  } else {
    errorEl.textContent = 'Incorrect passcode';
    const lockEl = document.getElementById('lockScreen');
    lockEl.classList.add('shake');
    setTimeout(()=> lockEl.classList.remove('shake'), 400);
    input.value = '';
  }
}
document.getElementById('lockUnlock').onclick = tryUnlock;
document.getElementById('lockInput').addEventListener('keydown', (e)=>{
  if(e.key === 'Enter') tryUnlock();
});

if(state.settings.passcodeEnabled && state.settings.passcodeHash){
  document.getElementById('lockScreen').style.display = 'flex';
} else {
  initApp();
}

// ---------- Custom plan builder ----------

let builderState = null; // { key, label, minutes, days:[{name, exercises:[{name, muscle, sets, reps}]}] }

function openPlanBuilder(existingKey){
  if(existingKey && state.customPlans && state.customPlans[existingKey]){
    const p = state.customPlans[existingKey];
    builderState = {
      key: existingKey,
      label: p.label,
      minutes: p.minutes || '',
      days: p.days.map(d => ({
        name: d.name,
        exercises: d.exercises.map(e => {
          const t = parseTarget(e.target) || { sets: 3, reps: 10 };
          return { name: e.name, muscle: e.muscle, sets: t.sets, reps: t.reps };
        })
      }))
    };
  } else {
    builderState = {
      key: null,
      label: '',
      minutes: '',
      days: [{ name: 'Day 1', exercises: [{ name: '', muscle: 'chest', sets: 3, reps: 10 }] }]
    };
  }
  document.getElementById('planBuilder').classList.add('show');
  document.getElementById('builderOpenBtn').style.display = 'none';
  renderPlanBuilder();
}

function closePlanBuilder(){
  builderState = null;
  document.getElementById('planBuilder').classList.remove('show');
  document.getElementById('builderOpenBtn').style.display = 'block';
}

function renderPlanBuilder(){
  const wrap = document.getElementById('planBuilder');
  const library = getKnownExerciseLibrary();
  const exOptions = (selected) =>
    '<option value="">Type or pick...</option>' +
    library.map(e => `<option value="${e.name}"${e.name === selected ? ' selected' : ''}>${e.name}</option>`).join('');
  const muscleOptions = (selected) =>
    MUSCLE_GROUPS.map(m => `<option value="${m}"${m === selected ? ' selected' : ''}>${m}</option>`).join('');

  wrap.innerHTML = `
    <div class="builder-head">${builderState.key ? 'Edit Plan' : 'New Plan'}</div>
    <input type="text" class="builder-name" id="builderName" placeholder="Plan name, e.g. Hypertrophy 4-Day" value="${builderState.label.replace(/"/g,'&quot;')}">
    <input type="number" class="builder-minutes" id="builderMinutes" placeholder="Minutes per session (optional)" value="${builderState.minutes}">
    ${builderState.days.map((day, di) => `
      <div class="builder-day">
        <div class="builder-day-head">
          <input type="text" class="builder-day-name" data-di="${di}" value="${day.name.replace(/"/g,'&quot;')}" placeholder="Day name">
          ${builderState.days.length > 1 ? `<button class="builder-remove-day" type="button" data-di="${di}">Remove</button>` : ''}
        </div>
        ${day.exercises.map((ex, ei) => `
          <div class="builder-ex" data-di="${di}" data-ei="${ei}">
            <select class="builder-ex-pick" data-di="${di}" data-ei="${ei}">${exOptions(ex.name)}</select>
            <input type="text" class="builder-ex-name" data-di="${di}" data-ei="${ei}" placeholder="Or type a custom name" value="${(library.some(l => l.name === ex.name) ? '' : ex.name).replace(/"/g,'&quot;')}" ${library.some(l => l.name === ex.name) && ex.name ? 'style="display:none;"' : ''}>
            <div class="builder-ex-row">
              <select class="builder-ex-muscle" data-di="${di}" data-ei="${ei}">${muscleOptions(ex.muscle)}</select>
              <input type="number" class="builder-ex-sets num" data-di="${di}" data-ei="${ei}" min="1" max="10" value="${ex.sets}" placeholder="Sets">
              <span class="x">x</span>
              <input type="number" class="builder-ex-reps num" data-di="${di}" data-ei="${ei}" min="1" max="100" value="${ex.reps}" placeholder="Reps">
              ${day.exercises.length > 1 ? `<button class="builder-remove-ex" type="button" data-di="${di}" data-ei="${ei}">✕</button>` : ''}
            </div>
          </div>
        `).join('')}
        <button class="builder-add-ex" type="button" data-di="${di}">+ Add Exercise</button>
      </div>
    `).join('')}
    <button class="builder-add-day" type="button" id="builderAddDay">+ Add Day</button>
    <div class="builder-actions">
      <button class="builder-cancel" type="button" id="builderCancel">Cancel</button>
      <button class="builder-save" type="button" id="builderSave">Save Plan</button>
    </div>
  `;

  // Sync helpers write straight into builderState so re-renders don't lose input.
  const syncBasics = ()=>{
    builderState.label = document.getElementById('builderName').value;
    builderState.minutes = document.getElementById('builderMinutes').value;
    wrap.querySelectorAll('.builder-day-name').forEach(inp => {
      builderState.days[+inp.dataset.di].name = inp.value;
    });
    wrap.querySelectorAll('.builder-ex').forEach(row => {
      const ex = builderState.days[+row.dataset.di].exercises[+row.dataset.ei];
      const picked = row.querySelector('.builder-ex-pick').value;
      const typed = row.querySelector('.builder-ex-name').value.trim();
      ex.name = typed || picked;
      ex.muscle = row.querySelector('.builder-ex-muscle').value;
      ex.sets = parseInt(row.querySelector('.builder-ex-sets').value) || 3;
      ex.reps = parseInt(row.querySelector('.builder-ex-reps').value) || 10;
    });
  };

  wrap.querySelectorAll('.builder-ex-pick').forEach(sel => {
    sel.onchange = ()=>{
      const row = sel.closest('.builder-ex');
      const typedInput = row.querySelector('.builder-ex-name');
      if(sel.value){
        typedInput.value = '';
        typedInput.style.display = 'none';
        // Auto-fill the muscle group from the library.
        const lib = getKnownExerciseLibrary().find(e => e.name === sel.value);
        if(lib) row.querySelector('.builder-ex-muscle').value = lib.muscle;
      } else {
        typedInput.style.display = 'block';
      }
    };
  });
  wrap.querySelectorAll('.builder-add-ex').forEach(btn => {
    btn.onclick = ()=>{
      syncBasics();
      builderState.days[+btn.dataset.di].exercises.push({ name:'', muscle:'chest', sets:3, reps:10 });
      renderPlanBuilder();
    };
  });
  wrap.querySelectorAll('.builder-remove-ex').forEach(btn => {
    btn.onclick = ()=>{
      syncBasics();
      builderState.days[+btn.dataset.di].exercises.splice(+btn.dataset.ei, 1);
      renderPlanBuilder();
    };
  });
  wrap.querySelectorAll('.builder-remove-day').forEach(btn => {
    btn.onclick = ()=>{
      syncBasics();
      builderState.days.splice(+btn.dataset.di, 1);
      renderPlanBuilder();
    };
  });
  document.getElementById('builderAddDay').onclick = ()=>{
    syncBasics();
    builderState.days.push({ name: `Day ${builderState.days.length + 1}`, exercises: [{ name:'', muscle:'chest', sets:3, reps:10 }] });
    renderPlanBuilder();
  };
  document.getElementById('builderCancel').onclick = closePlanBuilder;
  document.getElementById('builderSave').onclick = ()=>{
    syncBasics();
    if(!builderState.label.trim()){ showToast('Give the plan a name'); return; }
    for(const day of builderState.days){
      if(!day.name.trim()){ showToast('Every day needs a name'); return; }
      const named = day.exercises.filter(e => e.name.trim());
      if(named.length === 0){ showToast(`${day.name} needs at least one exercise`); return; }
      day.exercises = named;
    }
    const key = builderState.key || `custom-${Date.now()}`;
    const plan = {
      label: builderState.label.trim(),
      desc: `Custom, ${builderState.days.length} day${builderState.days.length===1?'':'s'}`,
      minutes: parseInt(builderState.minutes) || 0,
      custom: true,
      days: builderState.days.map(d => ({
        name: d.name.trim(),
        exercises: d.exercises.map(e => ({
          name: e.name.trim(),
          target: `${e.sets} x ${e.reps}`,
          muscle: e.muscle
        }))
      }))
    };
    saveCustomPlan(state, key, plan);
    // Editing the active plan: clamp the day index in case days were removed.
    if(state.planKey === key) activeDay = Math.min(activeDay, plan.days.length - 1);
    saveState(state);
    closePlanBuilder();
    renderSettings();
    showToast(builderState === null ? 'Plan saved' : 'Plan saved');
  };
}

document.getElementById('builderOpenBtn').onclick = ()=> openPlanBuilder(null);
document.getElementById('goalFocusSelect').onchange = (e)=>{
  state.settings.goalFocus = e.target.value;
  saveState(state);
  showToast('Training goal updated');
};

// ---------- Sync settings UI ----------

function renderSyncSettings(){
  const cfg = typeof loadSyncCfg === 'function' ? loadSyncCfg() : null;
  const connected = cfg && cfg.session;
  const baked = typeof hasBakedConfig === 'function' && hasBakedConfig();
  document.getElementById('syncUrl').style.display = baked ? 'none' : 'block';
  document.getElementById('syncAnonKey').style.display = baked ? 'none' : 'block';
  document.getElementById('syncSetupToggle').textContent = baked ? 'Database setup SQL' : 'First-time setup SQL';
  document.getElementById('syncForm').style.display = connected ? 'none' : 'block';
  document.getElementById('syncConnected').style.display = connected ? 'block' : 'none';
  if(connected){
    document.getElementById('syncEmailLabel').textContent = cfg.email;
    if(document.getElementById('syncStatus').textContent === 'Not connected'){
      setSyncStatus('Connected', 'ok');
    }
  } else {
    setSyncStatus('Not connected');
    if(cfg){
      document.getElementById('syncUrl').value = cfg.url || '';
      document.getElementById('syncAnonKey').value = cfg.anonKey || '';
      document.getElementById('syncEmail').value = cfg.email || '';
    }
  }
}

document.getElementById('syncSetupToggle').onclick = ()=>{
  document.getElementById('syncSetup').classList.toggle('show');
};

document.getElementById('syncConnect').onclick = async ()=>{
  const url = document.getElementById('syncUrl').value.trim();
  const anonKey = document.getElementById('syncAnonKey').value.trim();
  const email = document.getElementById('syncEmail').value.trim();
  const password = document.getElementById('syncPassword').value;
  if(!url || !anonKey || !email || !password){ showToast('Fill in all four fields'); return; }
  const btn = document.getElementById('syncConnect');
  btn.textContent = 'Connecting...';
  btn.disabled = true;
  try{
    await syncSignIn(url, anonKey, email, password);
    document.getElementById('syncPassword').value = '';
    renderSyncSettings();
    showToast('Connected to Supabase');
    await pullStateFromCloud();
  }catch(e){
    setSyncStatus(e.message, 'err');
    showToast('Could not connect');
  }finally{
    btn.textContent = 'Connect';
    btn.disabled = false;
  }
};

document.getElementById('syncNowBtn').onclick = async ()=>{
  setSyncStatus('Syncing...');
  await pullStateFromCloud();
  await pushStateToCloud();
};

document.getElementById('syncSignOutBtn').onclick = ()=>{
  syncSignOut();
  renderSyncSettings();
  showToast('Signed out, local data kept');
};


// ---------- Guided workout mode ----------
// Ladder-style follow-along flow: one exercise at a time, one set at a time,
// prefilled from last session, automatic rest countdown between sets, and the
// session summary at the end. Uses the same finalizeSession path as manual logging.

let guided = null; // { exercises:[{name, setCount, targetReps, ghosts, isBw}], exIdx, setIdx, lifts, restTimer }

function guidedExerciseList(){
  const day = currentPlan().days[activeDay];
  const order = getDayOrder(state, state.planKey, activeDay, day.exercises.length);
  const list = order.map(baseIdx => {
    const effective = getEffectiveExercise(state, state.planKey, activeDay, baseIdx, day.exercises[baseIdx]);
    const parsed = parseTarget(effective.target) || { sets: 3, reps: 10 };
    return { name: effective.name, setCount: adjustedSetCount(state, parsed.sets), targetReps: parsed.reps };
  });
  getCustomExercises(state, state.planKey, activeDay).forEach(ex => {
    const parsed = parseTarget(ex.target) || { sets: 3, reps: 10 };
    list.push({ name: ex.name, setCount: adjustedSetCount(state, parsed.sets), targetReps: parsed.reps });
  });
  return list.map(ex => Object.assign(ex, {
    ghosts: lastSessionSets(state, ex.name),
    isBw: typeof BODYWEIGHT_EXERCISES !== 'undefined' && BODYWEIGHT_EXERCISES.has(ex.name)
  }));
}

function startGuided(){
  const exercises = guidedExerciseList();
  if(exercises.length === 0){ showToast('No exercises on this day'); return; }
  guided = { exercises, exIdx: 0, setIdx: 0, lifts: {}, restTimer: null };
  if(!sessionTimerRunning) toggleSessionTimer();
  document.getElementById('guidedOverlay').classList.add('show');
  renderGuidedSet();
}

function stopGuided(commit){
  if(guided && guided.restTimer) clearInterval(guided.restTimer);
  document.getElementById('guidedOverlay').classList.remove('show');
  if(commit && guided && Object.keys(guided.lifts).length){
    const day = currentPlan().days[activeDay];
    const record = { date: new Date().toISOString(), day: day.name, plan: state.planKey, lifts: guided.lifts };
    finalizeSession(record);
  }
  guided = null;
}

function guidedGhostFor(ex, setIdx){
  if(!ex.ghosts || !ex.ghosts.length) return null;
  return ex.ghosts[setIdx] || ex.ghosts[ex.ghosts.length - 1];
}

function renderGuidedSet(){
  const ex = guided.exercises[guided.exIdx];
  const g = guidedGhostFor(ex, guided.setIdx);
  const body = document.getElementById('guidedBody');
  body.innerHTML = `
    <div class="g-progress num">Exercise ${guided.exIdx + 1} of ${guided.exercises.length}</div>
    <div class="g-exname">${ex.name}</div>
    <div class="g-target num">Target ${ex.setCount} x ${ex.targetReps}${ex.isBw ? ' · bodyweight' : ''}</div>
    <div class="g-setlabel">Set ${guided.setIdx + 1} of ${ex.setCount}</div>
    <div class="g-inputs">
      <div class="g-field">
        <label>${ex.isBw ? 'Added ' + WU() : WU()}</label>
        <input type="number" inputmode="decimal" id="gW" value="${g && g.w ? g.w : ''}" placeholder="${ex.isBw ? '0' : WU()}">
      </div>
      <div class="g-field">
        <label>Reps</label>
        <input type="number" inputmode="numeric" id="gR" value="${g ? g.r : ''}" placeholder="${ex.targetReps}">
      </div>
      <div class="g-field">
        <label>RPE</label>
        <select id="gRpe"><option value="">-</option><option>6</option><option>7</option><option>8</option><option>9</option><option>10</option></select>
      </div>
    </div>
    <button class="g-log" id="gLog">Log Set</button>
    <div class="g-secondary">
      <button id="gSkipSet">Skip Set</button>
      <button id="gSkipEx">Skip Exercise</button>
    </div>
  `;
  document.getElementById('gLog').onclick = guidedLogSet;
  document.getElementById('gSkipSet').onclick = ()=> guidedAdvance(false);
  document.getElementById('gSkipEx').onclick = ()=>{ guided.setIdx = guided.exercises[guided.exIdx].setCount - 1; guidedAdvance(false); };
}

function guidedLogSet(){
  const ex = guided.exercises[guided.exIdx];
  const w = parseFloat(document.getElementById('gW').value) || 0;
  const r = parseFloat(document.getElementById('gR').value);
  const rpe = document.getElementById('gRpe').value;
  if(!r || (!w && !ex.isBw)){ showToast(ex.isBw ? 'Enter reps' : 'Enter weight and reps'); return; }
  if(!guided.lifts[ex.name]) guided.lifts[ex.name] = { sets: [], note: '' };
  const set = { w, r };
  if(rpe) set.rpe = parseInt(rpe);
  guided.lifts[ex.name].sets.push(set);
  guidedAdvance(true);
}

function guidedAdvance(rest){
  const ex = guided.exercises[guided.exIdx];
  const lastSetOfExercise = guided.setIdx >= ex.setCount - 1;
  const lastExercise = guided.exIdx >= guided.exercises.length - 1;
  if(lastSetOfExercise && lastExercise){ stopGuided(true); return; }
  if(lastSetOfExercise){ guided.exIdx++; guided.setIdx = 0; }
  else guided.setIdx++;
  if(rest) renderGuidedRest();
  else renderGuidedSet();
}

const GUIDED_REST_NOTIF_ID = 424243;

function renderGuidedRest(){
  const secs = state.settings.restSeconds || 60;
  const endsAt = Date.now() + secs * 1000;
  const nextEx = guided.exercises[guided.exIdx];
  const body = document.getElementById('guidedBody');
  body.innerHTML = `
    <div class="g-progress">Rest</div>
    <div class="g-resttime num" id="gRestTime">${secs}</div>
    <div class="g-next">Next: <b>${nextEx.name}</b>, set ${guided.setIdx + 1} of ${nextEx.setCount}</div>
    <button class="g-log" id="gRestSkip">Skip Rest</button>
  `;
  const finishRest = ()=>{
    clearInterval(guided.restTimer);
    guided.restTimer = null;
    beep();
    renderGuidedSet();
  };
  guided.restTimer = setInterval(()=>{
    const remaining = Math.ceil((endsAt - Date.now()) / 1000);
    const el = document.getElementById('gRestTime');
    if(!el){ clearInterval(guided.restTimer); return; }
    if(remaining > 0) el.textContent = remaining;
    else finishRest();
  }, 250);
  document.getElementById('gRestSkip').onclick = ()=>{
    if(window.FoundryNotify) window.FoundryNotify.cancel(GUIDED_REST_NOTIF_ID);
    finishRest();
  };
  if(window.debugLog) window.debugLog('renderGuidedRest: notifyRest=' + state.settings.notifyRest + ' FoundryNotify=' + !!window.FoundryNotify);
  if(state.settings.notifyRest && window.FoundryNotify){
    window.FoundryNotify.scheduleAt(GUIDED_REST_NOTIF_ID, 'Rest over', 'Time for your next set.', new Date(endsAt));
  }
}

document.getElementById('guidedStartBtn').onclick = startGuided;
document.getElementById('guidedClose').onclick = ()=>{
  if(guided && Object.keys(guided.lifts).length){
    if(confirm('Finish and log what you\'ve done so far?')) stopGuided(true);
    else stopGuided(false);
  } else {
    stopGuided(false);
  }
};

// ---------- Account onboarding (multi-user deployments) ----------

const WELCOME_KEY = 'foundryWelcomeDismissed';

function maybeShowWelcome(){
  if(typeof hasBakedConfig !== 'function' || !hasBakedConfig()) return;
  if(typeof consumeRecoveryHash === 'function' && consumeRecoveryHash()){
    document.getElementById('recoveryOverlay').classList.add('show');
    return;
  }
  const cfg = loadSyncCfg();
  if(cfg && cfg.session) return;                       // already signed in
  if(localStorage.getItem(WELCOME_KEY)) return;        // chose local-only
  document.getElementById('welcomeOverlay').classList.add('show');
}

function welcomeMsg(text, tone){
  const el = document.getElementById('welcomeMsg');
  el.textContent = text;
  el.className = 'welcome-msg' + (tone ? ' ' + tone : '');
}

async function welcomeAuth(mode){
  const email = document.getElementById('wEmail').value.trim();
  const password = document.getElementById('wPassword').value;
  if(!email || !password){ welcomeMsg('Enter your email and a password.'); return; }
  const cfg = loadSyncCfg();
  try{
    if(mode === 'signup'){
      welcomeMsg('Creating your account...');
      const res = await syncSignUp(cfg.url, cfg.anonKey, email, password);
      if(res.needsConfirm){
        welcomeMsg('Almost there. Check your email to confirm your account, then sign in here.', 'ok');
        return;
      }
    } else {
      welcomeMsg('Signing in...');
      await syncSignIn(cfg.url, cfg.anonKey, email, password);
    }
    const stored = loadSyncCfg();
    stored.email = email;
    saveSyncCfg(stored);
    document.getElementById('welcomeOverlay').classList.remove('show');
    showToast(mode === 'signup' ? 'Account created' : 'Signed in');
    await pullStateFromCloud();
    render();
    if(mode === 'signup') showOnboarding();
    maybePromptNotifications();
  }catch(e){
    welcomeMsg(e.message);
  }
}

// Apple embeds the SHA-256 of the nonce we hand it into the identity token;
// Supabase hashes the raw value itself to compare. So Apple gets the hash and
// Supabase gets the original string. Getting this backwards is the usual cause
// of a silent "invalid nonce" rejection.
function randomNonce(){
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}
async function sha256Hex(str){
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

document.getElementById('wApple').onclick = async ()=>{
  const isNative = window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform();
  if(!isNative){ welcomeMsg('Sign in with Apple only works inside the iOS app.'); return; }
  const plugin = window.Capacitor.Plugins && window.Capacitor.Plugins.SignInWithApple;
  if(!plugin){ welcomeMsg('Apple sign-in is unavailable in this build.'); return; }
  try{
    welcomeMsg('Signing in...');
    const rawNonce = randomNonce();
    const result = await plugin.authorize({
      clientId: 'com.tomgarrett.foundry',
      redirectURI: '',
      scopes: 'email name',
      nonce: await sha256Hex(rawNonce)
    });
    const token = result && result.response && result.response.identityToken;
    if(!token) throw new Error('Apple did not return an identity token');
    await syncSignInWithApple(token, rawNonce);

    // Apple only ever sends the name on the very first authorisation, so grab
    // it now if it's there; afterwards it comes back empty forever.
    const given = result.response.givenName;
    if(given && !state.settings.firstName){
      state.settings.firstName = given.slice(0, 20);
      if(!state.settings.displayName) state.settings.displayName = state.settings.firstName;
      saveState(state);
    }

    document.getElementById('welcomeOverlay').classList.remove('show');
    showToast('Signed in');
    await pullStateFromCloud();
    render();
    showOnboarding();
    maybePromptNotifications();
  }catch(e){
    const msg = (e && e.message) || '';
    if(/cancel/i.test(msg)) welcomeMsg('');
    else welcomeMsg(msg || 'Apple sign-in failed');
  }
};
document.getElementById('wSkip').onclick = ()=>{
  localStorage.setItem(WELCOME_KEY, '1');
  document.getElementById('welcomeOverlay').classList.remove('show');
  showOnboarding();
  maybePromptNotifications();
};
const wForgotEl = document.getElementById('wForgot');
if(wForgotEl) wForgotEl.onclick = async ()=>{
  const email = document.getElementById('wEmail').value.trim();
  if(!email){ welcomeMsg('Enter your email first, then tap Forgot password.'); return; }
  try{
    await syncRecover(email);
    welcomeMsg('Reset email sent. Open the link on this device to set a new password.', 'ok');
  }catch(e){ welcomeMsg(e.message); }
};
document.getElementById('recoverySave').onclick = async ()=>{
  const pw = document.getElementById('recoveryPassword').value;
  if(pw.length < 6){ document.getElementById('recoveryMsg').textContent = 'Use at least 6 characters.'; return; }
  try{
    await syncUpdatePassword(pw);
    document.getElementById('recoveryOverlay').classList.remove('show');
    showToast('Password updated');
    await pullStateFromCloud();
    render();
  }catch(e){ document.getElementById('recoveryMsg').textContent = e.message; }
};


// ---------- Friends leaderboard ----------

let friendsCache = { at: 0, rows: null };
let myInviteCodeCache = null;
let challengeMetric = 'weekVolume';
const escHtml = (s) => String(s).replace(/</g,'&lt;').replace(/>/g,'&gt;');

async function renderFriendsBoard(){
  const connectBox = document.getElementById('friendConnectBox');
  const boardEl = document.getElementById('friendsBoard');
  if(typeof syncEnabled !== 'function' || !syncEnabled()){
    connectBox.style.display = 'none';
    boardEl.innerHTML = '<div class="friends-empty">Sign in and turn on cloud sync to connect with friends.</div>';
    return;
  }
  connectBox.style.display = 'flex';

  if(!myInviteCodeCache){
    try{
      myInviteCodeCache = await getOrCreateInviteCode();
      document.getElementById('myInviteCode').textContent = myInviteCodeCache || '------';
    }catch(e){ /* non-critical, leave placeholder */ }
  }

  const board = document.getElementById('friendsBoard');
  if(!friendsCache.rows) board.innerHTML = '<div class="friends-empty">Loading the board...</div>';
  try{
    if(Date.now() - friendsCache.at > 60000){
      friendsCache.rows = await fetchLeaderboard();
      friendsCache.at = Date.now();
    }
  }catch(e){
    board.innerHTML = /relation|does not exist|could not find the table|schema cache|404|PGRST205/i.test(e.message)
      ? '<div class="friends-empty">The friends board table is not set up in Supabase yet. Run the leaderboard SQL from the setup snippet, then pull to refresh.</div>'
      : '<div class="friends-empty">Could not load the board right now. Pull to refresh or check your connection.</div>';
    return;
  }
  const rows = friendsCache.rows || [];
  if(rows.length === 0){
    board.innerHTML = '<div class="friends-empty">No friends connected yet. Share your code above, or enter a friend\'s code to link up.</div>';
    return;
  }
  const myId = (loadSyncCfg().session || {}).user_id;
  rows.sort((a,b) => (b.stats.weekVolume || 0) - (a.stats.weekVolume || 0));
  board.innerHTML = rows.map((r, i) => `
    <div class="friend-row ${r.user_id === myId ? 'me' : ''}">
      <span class="f-rank num">${i + 1}</span>
      <span class="f-name">${escHtml(r.display_name || 'Anon')}${r.user_id === myId ? ' <span class="f-you">you</span>' : ''}</span>
      <span class="f-streak num">${Number(r.stats.streak) || 0}d</span>
      <span class="f-sessions num">${Number(r.stats.weekSessions) || 0} ses</span>
      <span class="f-vol num">${Math.round(Number(r.stats.weekVolume) || 0)}${escHtml(r.stats.units || 'kg')}</span>
    </div>
  `).join('');
}

// New settings handlers
document.getElementById('unitsSelect').onchange = (e)=>{
  state.settings.units = e.target.value;
  saveState(state);
  renderSettings();
  showToast(`Weights now shown in ${e.target.value}`);
};
document.getElementById('displayNameInput').onchange = (e)=>{
  state.settings.displayName = e.target.value.trim().slice(0, 24);
  saveState(state);
};
document.getElementById('friendsIconBtn').onclick = async ()=>{
  document.getElementById('friendsOverlay').classList.add('show');
  await renderFriendsBoard();
  renderChallenges();
};
document.getElementById('friendsClose').onclick = ()=>{
  document.getElementById('friendsOverlay').classList.remove('show');
};

document.getElementById('shareInviteBtn').onclick = async ()=>{
  if(!myInviteCodeCache){
    try{ myInviteCodeCache = await getOrCreateInviteCode(); document.getElementById('myInviteCode').textContent = myInviteCodeCache; }
    catch(e){ showToast('Could not get your code, try again'); return; }
  }
  const text = `Add me on Foundry! Enter my code in the Friends section: ${myInviteCodeCache}`;
  if(navigator.share){
    try{ await navigator.share({ text }); }catch(e){ /* user cancelled, fine */ }
  } else {
    try{
      await navigator.clipboard.writeText(myInviteCodeCache);
      showToast('Code copied to clipboard');
    }catch(e){ showToast(`Your code: ${myInviteCodeCache}`); }
  }
};

document.getElementById('addFriendBtn').onclick = async ()=>{
  const input = document.getElementById('friendCodeInput');
  const code = input.value.trim();
  if(!code){ showToast('Enter a code first'); return; }
  try{
    const result = await redeemInviteCode(code);
    if(result && result.error){ showToast(result.error); return; }
    input.value = '';
    friendsCache.at = 0;
    showToast('Friend added!');
    renderFriendsBoard();
  }catch(e){ showToast('Could not add friend, check the code and try again'); }
};

async function renderChallenges(){
  const el = document.getElementById('challengesList');
  el.innerHTML = '<div class="friends-empty">Loading challenges...</div>';
  try{
    const challenges = await fetchChallenges();
    if(!challenges.length){ el.innerHTML = '<div class="friends-empty">No challenges yet. Create one above.</div>'; return; }
    const myId = (loadSyncCfg().session || {}).user_id;
    const cards = await Promise.all(challenges.map(async ch=>{
      const memberIds = await fetchChallengeMemberIds(ch.id);
      const rows = (friendsCache.rows || []).filter(r => memberIds.includes(r.user_id));
      rows.sort((a,b) => (b.stats[ch.metric] || 0) - (a.stats[ch.metric] || 0));
      const metricLabel = ch.metric === 'weekVolume' ? 'Volume' : 'Sessions';
      const rowsHtml = rows.map((r,i)=>`
        <div class="challenge-standing-row ${r.user_id === myId ? 'me' : ''}">
          <span>${i+1}. ${escHtml(r.display_name || 'Anon')}</span>
          <span class="num">${ch.metric === 'weekVolume' ? Math.round(r.stats.weekVolume||0) + (r.stats.units||'kg') : (r.stats.weekSessions||0)}</span>
        </div>
      `).join('');
      return `
        <div class="challenge-card">
          <div class="challenge-card-head">
            <div>
              <div class="challenge-card-name">${escHtml(ch.name)}</div>
              <div class="challenge-card-metric">${metricLabel} this week</div>
            </div>
            <button class="challenge-leave-btn" data-challenge="${ch.id}">Leave</button>
          </div>
          ${rowsHtml || '<div class="friends-empty">No one has shared stats yet.</div>'}
        </div>
      `;
    }));
    el.innerHTML = cards.join('');
    el.querySelectorAll('.challenge-leave-btn').forEach(btn=>{
      btn.onclick = async ()=>{
        if(!confirm('Leave this challenge?')) return;
        try{ await leaveChallenge(btn.dataset.challenge); renderChallenges(); }
        catch(e){ showToast('Could not leave challenge'); }
      };
    });
  }catch(e){
    el.innerHTML = /relation|does not exist|schema cache|404|PGRST205/i.test(e.message)
      ? '<div class="friends-empty">Challenges aren\'t set up in Supabase yet.</div>'
      : '<div class="friends-empty">Could not load challenges right now.</div>';
  }
}

function positionChallengeMetricPill(){
  const control = document.getElementById('challengeMetricSeg');
  const pill = document.getElementById('challengeMetricPill');
  const activeBtn = control && control.querySelector('.seg-btn.active');
  if(!control || !pill || !activeBtn) return;
  pill.style.width = activeBtn.offsetWidth + 'px';
  pill.style.transform = 'translateX(' + activeBtn.offsetLeft + 'px)';
}

document.querySelectorAll('#challengeMetricSeg .seg-btn').forEach(btn=>{
  btn.onclick = ()=>{
    document.querySelectorAll('#challengeMetricSeg .seg-btn').forEach(b=>b.classList.toggle('active', b===btn));
    challengeMetric = btn.dataset.metric;
    positionChallengeMetricPill();
  };
});

function populateChallengeFriendPicker(){
  const el = document.getElementById('challengeFriendPicker');
  const myId = (loadSyncCfg().session || {}).user_id;
  const friends = (friendsCache.rows || []).filter(r => r.user_id !== myId);
  if(!friends.length){
    el.innerHTML = '<div class="friends-empty">Connect with friends first to start a challenge.</div>';
    return;
  }
  el.innerHTML = friends.map(f => `
    <label class="challenge-friend-chip">
      <input type="checkbox" value="${f.user_id}">
      ${escHtml(f.display_name || 'Anon')}
    </label>
  `).join('');
}

document.getElementById('newChallengeBtn').onclick = ()=>{
  const form = document.getElementById('challengeForm');
  const opening = form.style.display !== 'flex';
  form.style.display = opening ? 'flex' : 'none';
  if(opening){
    populateChallengeFriendPicker();
    setTimeout(positionChallengeMetricPill, 20);
  }
};

document.getElementById('challengeCreateBtn').onclick = async ()=>{
  const name = document.getElementById('challengeName').value.trim();
  if(!name){ showToast('Give your challenge a name'); return; }
  const friendIds = [...document.querySelectorAll('#challengeFriendPicker input:checked')].map(cb => cb.value);
  if(!friendIds.length){ showToast('Pick at least one friend'); return; }
  try{
    const result = await createChallenge(name, challengeMetric, friendIds);
    if(result && result.error){ showToast(result.error); return; }
    document.getElementById('challengeForm').style.display = 'none';
    document.getElementById('challengeName').value = '';
    showToast('Challenge created!');
    renderChallenges();
  }catch(e){ showToast('Could not create challenge'); }
};

document.getElementById('shareStatsToggle').onclick = ()=>{
  state.settings.shareStats = !state.settings.shareStats;
  document.getElementById('shareStatsToggle').classList.toggle('on', state.settings.shareStats);
  if(state.settings.shareStats && !state.settings.displayName){
    showToast('Add a display name so friends know it\'s you');
  }
  saveState(state);
};

// ---------- Cardio performance panel ----------

function renderCardioPerf(){
  const activity = document.getElementById('cardioActivity').value;
  const el = document.getElementById('cardioPerf');
  const wrap = document.getElementById('cardioPaceWrap');
  const series = cardioPaceSeries(state, activity);
  const rec = cardioRecommendation(state, activity);

  let statsHtml = '';
  if(series.length){
    const best = bestCardioPace(series);
    const last = series[series.length - 1];
    const isPB = last.pace.metric === best.pace.metric;
    statsHtml = `
      <div class="cp-stats">
        <div><div class="cp-v num">${best.pace.value}</div><div class="cp-l">Best</div></div>
        <div><div class="cp-v num">${last.pace.value}${isPB ? ' <span class="cp-pb">PB</span>' : ''}</div><div class="cp-l">Last</div></div>
        <div><div class="cp-v num">${series.length}</div><div class="cp-l">Paced sessions</div></div>
      </div>`;
  }
  const recHtml = rec ? `
    <div class="insight-card ${rec.tone}">
      <div class="insight-bar"></div>
      <div>
        <div class="insight-title">${rec.title}</div>
        <div class="insight-text">${rec.text}</div>
      </div>
    </div>` : `<div class="friends-empty">Log a ${activity} session and pacing analysis appears here.</div>`;
  el.innerHTML = statsHtml + recHtml;

  // Pace trend chart, most recent 15 sessions
  if(series.length >= 2){
    wrap.style.display = 'block';
    const recent = series.slice(-15);
    const labels = recent.map(p => new Date(p.date).toLocaleDateString(undefined,{month:'short', day:'numeric'}));
    drawLineChart('cardioPaceChart', labels, recent.map(p => Math.round(p.pace.metric * 10) / 10), cardioPaceChartRef);
  } else {
    wrap.style.display = 'none';
  }
}

// ---------- Onboarding ----------

const ONBOARD_KEY = 'foundryOnboarded';

function wireObSeg(id){
  const seg = document.getElementById(id);
  seg.querySelectorAll('button').forEach(btn => {
    btn.onclick = ()=>{
      seg.querySelectorAll('button').forEach(b => b.classList.remove('on'));
      btn.classList.add('on');
    };
  });
}
['obShare','obGoal','obEquip'].forEach(wireObSeg);
document.querySelectorAll('#obDayChips .day-chip').forEach(chip => {
  chip.onclick = ()=> chip.classList.toggle('on');
});

function showOnboarding(){
  if(localStorage.getItem(ONBOARD_KEY)) return;
  if(state.sessions.length > 0) return; // existing user, nothing to configure
  document.getElementById('onboardOverlay').classList.add('show');
}

// Typing a first name prefills the friends-board name until it's edited.
document.getElementById('obFirstName').oninput = (e)=>{
  const dn = document.getElementById('obDisplayName');
  if(!dn.dataset.touched) dn.value = e.target.value;
};
document.getElementById('obDisplayName').oninput = (e)=>{ e.target.dataset.touched = '1'; };

document.getElementById('obFinish').onclick = ()=>{
  const segVal = (id) => document.querySelector(`#${id} button.on`).dataset.v;
  const firstName = document.getElementById('obFirstName').value.trim().slice(0, 20);
  const displayName = document.getElementById('obDisplayName').value.trim().slice(0, 24);

  state.settings.firstName = firstName;
  state.settings.displayName = displayName || firstName;
  state.settings.shareStats = segVal('obShare') === 'yes' && !!(displayName || firstName);
  state.settings.goalFocus = segVal('obGoal');

  const chosenDays = [...document.querySelectorAll('#obDayChips .day-chip.on')].map(c => +c.dataset.d).sort();
  state.settings.trainingDays = chosenDays.length ? chosenDays : null;
  const dayCount = chosenDays.length || 3;
  state.planKey = segVal('obEquip') === 'bodyweight' ? 'cali3'
    : dayCount >= 5 ? '5x45'
    : dayCount === 4 ? '4x30'
    : '3x20';
  state.lastDay = 0;
  activeDay = 0;

  saveState(state);
  localStorage.setItem(ONBOARD_KEY, '1');
  document.getElementById('onboardOverlay').classList.remove('show');
  resetSessionTimer();

  maybePromptNotifications();
  render();
  renderHeaderQuote();
  if(!localStorage.getItem(TOUR_KEY)) setTimeout(openTour, 250);
  showToast(firstName ? `Locked in. Let's go, ${firstName}.` : 'Locked in. Let\'s go.');
};

// ---------- Daily personalised greeting ----------

function dailyGreeting(){
  const GREETINGS = [
  "Push it today, {n}.",
  "Show up for yourself, {n}.",
  "Strong looks good on you, {n}.",
  "One session closer, {n}.",
  "Earn the shower, {n}.",
  "Iron sharpens iron, {n}.",
  "Today's reps are tomorrow's strength, {n}.",
  "Make it count, {n}.",
  "No shortcuts, no regrets, {n}.",
  "Built in the Foundry, {n}.",
  "Your future self is watching, {n}.",
  "Consistency beats intensity, {n}. But bring both.",
  "The bar doesn't care about your excuses, {n}.",
  "Forge something today, {n}.",
  "You never regret the session you did, {n}.",
  "Quiet work, loud results, {n}.",
  "Stack another brick, {n}.",
  "Discipline is a muscle too, {n}.",
  "Chase the extra rep, {n}.",
  "Sweat now, swagger later, {n}.",
  "Nobody's coming to lift it for you, {n}.",
  "Small hinges swing big doors, {n}.",
  "Respect the process, {n}.",
  "Today is a good day to get stronger, {n}.",
  "Turn up the volume, {n}.",
  "PRs are made on ordinary days, {n}.",
  "Keep the streak honest, {n}.",
  "Do it tired, {n}. That's where it counts."
  ];
  const name = state.settings.firstName;
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  if(name){
    return GREETINGS[dayOfYear % GREETINGS.length].replace('{n}', name);
  }
  return QUOTES[dayOfYear % QUOTES.length];
}

// ---------- Program settings ----------

function renderProgramSettings(){
  const p = state.program;
  const status = document.getElementById('programStatus');
  const startBtn = document.getElementById('programStartBtn');
  const stopBtn = document.getElementById('programStopBtn');
  if(p && p.startDate){
    const info = programWeekInfo(state);
    status.textContent = info ? `Running: ${info.label.toLowerCase()}, repeats every ${p.blockWeeks} weeks.` : 'Program starts Monday.';
    status.className = 'program-status on';
    document.getElementById('programWeeksSelect').value = String(p.blockWeeks);
    document.getElementById('programDeloadToggle').classList.toggle('on', !!p.deloadFinalWeek);
    startBtn.textContent = 'Restart Block This Week';
    stopBtn.style.display = 'block';
  } else {
    status.textContent = 'No program running. Targets stay the same every week.';
    status.className = 'program-status';
    startBtn.textContent = 'Start Block This Week';
    stopBtn.style.display = 'none';
  }
}

document.getElementById('programStartBtn').onclick = ()=>{
  state.program = {
    startDate: startOfWeek(new Date()).toISOString(),
    blockWeeks: parseInt(document.getElementById('programWeeksSelect').value),
    deloadFinalWeek: document.getElementById('programDeloadToggle').classList.contains('on')
  };
  saveState(state);
  renderProgramSettings();
  showToast(`Block started, ${state.program.blockWeeks} weeks`);
};
document.getElementById('programStopBtn').onclick = ()=>{
  state.program = null;
  saveState(state);
  renderProgramSettings();
  showToast('Program ended');
};
document.getElementById('programWeeksSelect').onchange = (e)=>{
  if(state.program){ state.program.blockWeeks = parseInt(e.target.value); saveState(state); renderProgramSettings(); }
};
document.getElementById('programDeloadToggle').onclick = ()=>{
  const t = document.getElementById('programDeloadToggle');
  t.classList.toggle('on');
  if(state.program){ state.program.deloadFinalWeek = t.classList.contains('on'); saveState(state); renderProgramSettings(); }
};

// ---------- Weekly recap ----------

function renderRecap(data){
  const volDelta = data.volumeDeltaPct === null ? ''
    : `<span class="rc-delta ${data.volumeDeltaPct >= 0 ? 'up' : 'down'}">${data.volumeDeltaPct >= 0 ? '+' : ''}${data.volumeDeltaPct}% vs prior</span>`;
  document.getElementById('recapBody').innerHTML = `
    <div class="summary-title">Weekly Recap</div>
    <div class="summary-day">${data.weekLabel}</div>
    <div class="rc-volume"><span class="num">${data.volume}</span><span class="rc-unit">${WU()} lifted</span>${volDelta}</div>
    <div class="summary-grid">
      <div><div class="sv num">${data.sessions}</div><div class="sl">sessions${data.sessionsDelta > 0 ? ' +' + data.sessionsDelta : ''}</div></div>
      <div><div class="sv num">${data.cardioMinutes}</div><div class="sl">cardio min</div></div>
      <div><div class="sv num">${data.prs.length}</div><div class="sl">PRs</div></div>
      <div><div class="sv num">${data.streak}</div><div class="sl">day streak</div></div>
    </div>
    ${data.prs.length ? `<div class="summary-prs">PR: ${data.prs.slice(0,3).join(', ')}${data.prs.length > 3 ? ` +${data.prs.length - 3} more` : ''}</div>` : ''}
    ${data.topLift ? `<div class="summary-streak">Top lift: ${data.topLift.name}, e1RM ${data.topLift.e1rm}${WU()}</div>` : ''}
  `;
  document.getElementById('recapOverlay').classList.add('show');
  document.getElementById('recapOverlay').dataset.week = data.weekKey;
}

function openRecap(auto){
  const data = weeklyRecapData(state);
  if(!data){
    if(!auto) showToast('No training logged last week');
    return;
  }
  if(auto && state.lastRecapWeek === data.weekKey) return; // already seen
  renderRecap(data);
  if(auto){
    state.lastRecapWeek = data.weekKey;
    saveState(state);
  }
}

document.getElementById('recapOpenBtn').onclick = ()=> openRecap(false);
document.getElementById('recapDone').onclick = ()=> document.getElementById('recapOverlay').classList.remove('show');

// Shareable recap image, drawn on canvas in brand style.
document.getElementById('recapShare').onclick = async ()=>{
  const data = weeklyRecapData(state);
  if(!data) return;
  const c = document.getElementById('recapCanvas');
  const x = c.getContext('2d');
  const W = c.width, H = c.height;
  const accent = '#ff9f0a', good = '#30d158', muted = '#8e8e93', text = '#ffffff';
  x.fillStyle = '#000000'; x.fillRect(0, 0, W, H);
  x.fillStyle = '#141414';
  x.beginPath(); x.roundRect(60, 60, W-120, H-120, 48); x.fill();
  x.textAlign = 'center';
  x.fillStyle = accent;
  x.font = '800 92px -apple-system, system-ui, sans-serif';
  x.fillText('FOUNDRY', W/2, 220);
  x.fillStyle = muted;
  x.font = '700 40px -apple-system, system-ui, sans-serif';
  x.fillText('WEEKLY RECAP  ·  ' + data.weekLabel.toUpperCase(), W/2, 300);
  x.fillStyle = text;
  x.font = '800 190px ui-monospace, Menlo, monospace';
  x.fillText(String(data.volume), W/2, 560);
  x.fillStyle = muted;
  x.font = '700 44px -apple-system, system-ui, sans-serif';
  x.fillText(WU().toUpperCase() + ' LIFTED' + (data.volumeDeltaPct !== null ? `  ·  ${data.volumeDeltaPct >= 0 ? '+' : ''}${data.volumeDeltaPct}%` : ''), W/2, 640);
  const cells = [[data.sessions, 'SESSIONS'], [data.cardioMinutes, 'CARDIO MIN'], [data.prs.length, 'PRS'], [data.streak, 'DAY STREAK']];
  cells.forEach(([v, l], i) => {
    const cx = 150 + (i % 2) * ((W - 300) / 2) + (W - 300) / 4;
    const cy = 760 + Math.floor(i / 2) * 220;
    x.fillStyle = '#1f1f1f';
    x.beginPath(); x.roundRect(cx - (W-300)/4 + 12, cy - 90, (W-300)/2 - 24, 190, 28); x.fill();
    x.fillStyle = accent;
    x.font = '800 84px ui-monospace, Menlo, monospace';
    x.fillText(String(v), cx, cy + 10);
    x.fillStyle = muted;
    x.font = '700 30px -apple-system, system-ui, sans-serif';
    x.fillText(l, cx, cy + 70);
  });
  if(data.prs.length){
    x.fillStyle = good;
    x.font = '700 38px -apple-system, system-ui, sans-serif';
    x.fillText('PR: ' + data.prs.slice(0,2).join(', '), W/2, 1230);
  }
  c.toBlob(async (blob)=>{
    const file = new File([blob], 'foundry-recap.png', { type: 'image/png' });
    if(navigator.canShare && navigator.canShare({ files: [file] })){
      try{ await navigator.share({ files: [file], title: 'Foundry Weekly Recap' }); return; }catch(e){}
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'foundry-recap.png'; a.click();
    URL.revokeObjectURL(url);
  }, 'image/png');
};

// ---------- First-time tour ----------

const TOUR_KEY = 'foundryTourSeen';
const TOUR_SLIDES = [
  { title: 'Log your training',
    text: 'Pick your day at the top, enter weight and reps, tap the check to log each set. Leave a row untouched and the check repeats last session\u2019s numbers in one tap.' },
  { title: 'Warm up, then go Guided',
    text: 'Guided Warm-Up gives you a 4-minute routine matched to the day’s muscles. Then tap Guided for a follow-along workout: one set at a time, prefilled targets, automatic rest countdowns.' },
  { title: 'Progress does the thinking',
    text: 'Insights spot trends, stalls, and PRs. Charts track volume and estimated 1RMs. Every Monday you get a recap of last week, shareable as an image.' },
  { title: 'Your schedule, your streak',
    text: 'Your training days ring the calendar and power your streak: rest days never break it, only missed training days do, and bonus sessions still count. Change your days any time in Settings.' },
  { title: 'Track your body too',
    text: 'The Body tab holds bodyweight trends and tape measurements with deltas, so the scale and the tape both get a say in your progress.' },
  { title: 'Bring your friends',
    text: 'Set a display name and turn on sharing in Settings to join the weekly friends board. Only summary stats are shared, never your workout details.' },
  { title: 'Make it yours',
    text: 'Settings has plans and a custom plan builder, program blocks with automatic deload weeks, kg or lb, goals, and cloud sync so your data follows you everywhere.' },
  { title: 'No subscriptions, ever',
    text: 'Foundry is a one-off purchase. No recurring fees, no paywalls, no surprise renewals. Any future premium features will be one-off purchases too, never a subscription.' },
];
let tourIdx = 0;

function renderTourSlide(){
  const s = TOUR_SLIDES[tourIdx];
  document.getElementById('tourSlide').innerHTML = `
    <div class="tour-step num">${tourIdx + 1} / ${TOUR_SLIDES.length}</div>
    <div class="tour-title">${s.title}</div>
    <div class="tour-text">${s.text}</div>`;
  document.getElementById('tourDots').innerHTML =
    TOUR_SLIDES.map((_, i) => `<span class="tour-dot ${i === tourIdx ? 'on' : ''}"></span>`).join('');
  document.getElementById('tourBack').style.visibility = tourIdx === 0 ? 'hidden' : 'visible';
  document.getElementById('tourNext').textContent = tourIdx === TOUR_SLIDES.length - 1 ? 'Start Training' : 'Next';
}

function openTour(){
  tourIdx = 0;
  renderTourSlide();
  document.getElementById('tourOverlay').classList.add('show');
}

function closeTour(){
  localStorage.setItem(TOUR_KEY, '1');
  document.getElementById('tourOverlay').classList.remove('show');
}

document.getElementById('tourNext').onclick = ()=>{
  if(tourIdx >= TOUR_SLIDES.length - 1){ closeTour(); return; }
  tourIdx++;
  renderTourSlide();
};
document.getElementById('tourBack').onclick = ()=>{
  if(tourIdx > 0){ tourIdx--; renderTourSlide(); }
};
document.getElementById('tourSkip').onclick = closeTour;
document.getElementById('tourOpenBtn').onclick = openTour;

// ---------- Guided warm-up ----------

let warmup = null; // { moves, idx, endsAt, timer }

function warmupTotalMins(){
  const { moves } = warmupForToday(state, activeDay);
  return Math.round(moves.reduce((a,m) => a + m.seconds, 0) / 60);
}

function refreshWarmupLaunch(){
  const el = document.getElementById('warmupMins');
  if(el) el.textContent = warmupTotalMins();
}

function startWarmup(){
  const { moves } = warmupForToday(state, activeDay);
  warmup = { moves, idx: 0, timer: null };
  if(!sessionTimerRunning) toggleSessionTimer();
  document.getElementById('warmupOverlay').classList.add('show');
  renderWarmupMove();
}

function stopWarmup(){
  if(warmup && warmup.timer) clearInterval(warmup.timer);
  warmup = null;
  document.getElementById('warmupOverlay').classList.remove('show');
}

function renderWarmupMove(){
  const m = warmup.moves[warmup.idx];
  warmup.endsAt = Date.now() + m.seconds * 1000;
  const body = document.getElementById('warmupBody');
  body.innerHTML = `
    <div class="g-progress">Warm-Up &middot; ${warmup.idx + 1} of ${warmup.moves.length}</div>
    <div class="g-exname">${m.name}</div>
    <div class="g-resttime num" id="wuTime">${m.seconds}</div>
    <div class="wu-cue">${m.cue}</div>
    <button class="g-log" id="wuNext">${warmup.idx === warmup.moves.length - 1 ? 'Finish Warm-Up' : 'Next Move'}</button>
  `;
  document.getElementById('wuNext').onclick = warmupAdvance;
  clearInterval(warmup.timer);
  warmup.timer = setInterval(()=>{
    const el = document.getElementById('wuTime');
    if(!el || !warmup){ clearInterval(warmup && warmup.timer); return; }
    const remaining = Math.ceil((warmup.endsAt - Date.now()) / 1000);
    if(remaining > 0){ el.textContent = remaining; return; }
    beep();
    warmupAdvance();
  }, 250);
}

function warmupAdvance(){
  if(warmup.idx >= warmup.moves.length - 1){
    stopWarmup();
    showToast('Warmed up. Go lift.');
    return;
  }
  warmup.idx++;
  renderWarmupMove();
}

document.getElementById('warmupLaunchBtn').onclick = startWarmup;
document.getElementById('warmupClose').onclick = stopWarmup;

// ---------- Training day schedule ----------

function renderTrainingDayChips(){
  const wrap = document.getElementById('trainingDayChips');
  const labels = ['S','M','T','W','T','F','S']; // getDay() order, Sunday first
  const chosen = state.settings.trainingDays || [];
  wrap.innerHTML = labels.map((l, i) =>
    `<button type="button" class="day-chip ${chosen.includes(i) ? 'on' : ''}" data-d="${i}">${l}</button>`).join('');
  wrap.querySelectorAll('.day-chip').forEach(chip => {
    chip.onclick = ()=>{
      const d = +chip.dataset.d;
      let days = state.settings.trainingDays || [];
      days = days.includes(d) ? days.filter(x => x !== d) : [...days, d].sort();
      state.settings.trainingDays = days.length ? days : null;
      // One system: the day count picks the matching built-in template, so
      // "when" and "what" can't drift apart. Custom and calisthenics plans
      // are left alone; they cycle across whatever days are chosen.
      const builtIns = { 3: '3x20', 4: '4x30', 5: '5x45' };
      if(days.length && ['3x20','4x30','5x45'].includes(state.planKey)){
        const target = builtIns[Math.min(5, Math.max(3, days.length))];
        if(target !== state.planKey){
          state.planKey = target;
          state.lastDay = 0;
          activeDay = 0;
          resetSessionTimer();
          showToast(`Plan matched to ${days.length} training day${days.length===1?'':'s'}`);
        }
      }
      updateStreak(state);
      saveState(state);
      renderSettings();
      renderStats();
    };
  });
}

// ---------- Full reset ----------

async function resetAllData(){
  const signedIn = typeof syncEnabled === 'function' && syncEnabled();
  const scope = signedIn
    ? 'This erases ALL your Foundry data, on this device AND in the cloud: every session, PR, measurement, custom plan, and setting. Your account stays; your data goes. Continue?'
    : 'This erases ALL your Foundry data on this device: every session, PR, measurement, custom plan, and setting. Continue?';
  if(!confirm(scope)) return;
  if(!confirm('Last check: there is no undo. Reset everything and start fresh?')) return;

  // Stop anything running and close every overlay.
  resetSessionTimer();
  clearInterval(restInterval);
  restEndsAt = null;
  document.getElementById('restBar').classList.remove('show');
  if(typeof guided !== 'undefined' && guided) stopGuided(false);
  if(typeof warmup !== 'undefined' && warmup) stopWarmup();
  ['summaryOverlay','recapOverlay','guidedOverlay','warmupOverlay','tourOverlay','friendsOverlay'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.classList.remove('show');
  });

  // Fresh state. saveState stamps updatedAt, making this newer than the cloud
  // copy so a background pull can never resurrect the old data.
  state = defaultState();
  saveState(state);
  localStorage.removeItem(ONBOARD_KEY);
  localStorage.removeItem(TOUR_KEY);

  // Overwrite the cloud row immediately and zero the leaderboard entry so
  // friends don't see stale stats. Both best-effort; local reset never waits
  // on the network to succeed.
  if(signedIn){
    try{
      await pushStateToCloud();
      const cfg = loadSyncCfg();
      await supabaseRest(cfg, 'foundry_leaderboard', {
        method: 'POST',
        headers: { 'Prefer': 'resolution=merge-duplicates' },
        body: JSON.stringify([{
          user_id: cfg.session.user_id,
          display_name: 'Reset',
          stats: { streak: 0, weekVolume: 0, weekSessions: 0, units: 'kg' },
          updated_at: new Date().toISOString()
        }])
      });
    }catch(e){ /* offline reset is still a reset */ }
  }

  // Back to visual defaults, then straight into setup.
  state.settings.theme = 'system';
  applyTheme();
  activeDay = 0;
  friendsCache = { at: 0, rows: null };
  render();
  renderHeaderQuote();
  switchView('log');
  showToast('Fresh start');
  setTimeout(showOnboarding, 400);
}
document.getElementById('resetAllBtn').onclick = resetAllData;

// ---------- Splash ----------

// A brand moment on launch, never a gate: pointer-events stay off so the app
// is tappable underneath from the first frame, and it removes itself from the
// DOM when done.
(function runSplash(){
  const TAGLINES = [
    'Forged, not found.',
    'Stronger than yesterday.',
    'The iron never lies.',
    'Built rep by rep.',
    'Show up. Get strong.',
    'Heat. Pressure. Progress.',
    'Strength is a habit.',
    'Steel sharpens steel.',
    'Your future self is training.',
    'Slow fire, strong steel.',
    'Hammer the work.',
    'Progress loves patience.'
  ];
  const splash = document.getElementById('splash');
  document.getElementById('splashTag').textContent = TAGLINES[Math.floor(Math.random() * TAGLINES.length)];
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hold = reduced ? 600 : 1400;
  setTimeout(()=>{
    splash.classList.add('hide');
    setTimeout(()=> splash.remove(), 450);
  }, hold);
})();

// ---------- Account deletion ----------

function refreshDeleteAccount(){
  const signedIn = typeof syncEnabled === 'function' && syncEnabled();
  document.getElementById('deleteAccountBtn').style.display = signedIn ? 'block' : 'none';
  document.getElementById('deleteAccountHint').style.display = signedIn ? 'block' : 'none';
}

document.getElementById('deleteAccountBtn').onclick = async ()=>{
  if(!confirm('Permanently delete your account and ALL its data from the cloud? Your friends will no longer see you on the board. This cannot be undone.')) return;
  if(!confirm('Final check: this erases your account for good. Delete it?')) return;
  const btn = document.getElementById('deleteAccountBtn');
  btn.textContent = 'Deleting...';
  btn.disabled = true;
  try{
    await deleteAccountCloud();
    // Server-side account is gone; now clear everything local and start clean.
    resetSessionTimer();
    if(typeof guided !== 'undefined' && guided) stopGuided(false);
    if(typeof warmup !== 'undefined' && warmup) stopWarmup();
    syncSignOut();
    state = defaultState();
    localStorage.removeItem(STORE_KEY);
    localStorage.removeItem(ONBOARD_KEY);
    localStorage.removeItem(TOUR_KEY);
    localStorage.removeItem(WELCOME_KEY);
    friendsCache = { at: 0, rows: null };
    document.body.classList.remove('light');
    showToast('Account deleted');
    // Back to the welcome screen for a genuinely fresh start.
    setTimeout(()=> location.reload(), 800);
  }catch(e){
    btn.textContent = 'Delete Account';
    btn.disabled = false;
    showToast('Could not delete account: ' + e.message);
  }
};
