// Supabase cloud sync. Plain fetch against the Auth and PostgREST endpoints so
// no SDK is needed and the app stays fully offline-capable. Single-user design:
// one row in foundry_state holding the whole app state as jsonb, last write wins.
//
// One-time Supabase setup (SQL editor):
//   create table foundry_state (
//     user_id uuid primary key references auth.users(id) on delete cascade,
//     data jsonb not null,
//     updated_at timestamptz not null default now()
//   );
//   alter table foundry_state enable row level security;
//   create policy "own row" on foundry_state
//     for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
// Then create your user under Authentication -> Users (email + password).

const SYNC_CFG_KEY = 'foundrySyncCfg_v1';
let syncPushTimer = null;
let syncBusy = false;

// True when the app was deployed with baked-in Supabase credentials, meaning
// users get a plain email/password experience with no connection fields.
function hasBakedConfig(){
  return typeof FOUNDRY_CONFIG !== 'undefined' && !!(FOUNDRY_CONFIG.supabaseUrl && FOUNDRY_CONFIG.supabaseAnonKey);
}

function loadSyncCfg(){
  let cfg = null;
  try{ cfg = JSON.parse(localStorage.getItem(SYNC_CFG_KEY)) || null; }catch(e){}
  if(hasBakedConfig()){
    // Baked credentials always win; stored session/email ride along.
    cfg = cfg || {};
    cfg.url = FOUNDRY_CONFIG.supabaseUrl.replace(/\/+$/, '');
    cfg.anonKey = FOUNDRY_CONFIG.supabaseAnonKey;
  }
  return cfg;
}
function saveSyncCfg(cfg){
  if(cfg) localStorage.setItem(SYNC_CFG_KEY, JSON.stringify(cfg));
  else localStorage.removeItem(SYNC_CFG_KEY);
}
function syncEnabled(){
  const cfg = loadSyncCfg();
  return !!(cfg && cfg.url && cfg.anonKey && cfg.session);
}

function setSyncStatus(text, tone){
  const el = document.getElementById('syncStatus');
  if(!el) return;
  el.textContent = text;
  el.className = 'sync-status' + (tone ? ' ' + tone : '');
}

async function supabaseAuth(cfg, grantType, body){
  const res = await fetch(`${cfg.url}/auth/v1/token?grant_type=${grantType}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': cfg.anonKey },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if(!res.ok) throw new Error(data.error_description || data.msg || 'Auth failed');
  return data;
}

function storeSession(cfg, auth){
  cfg.session = {
    access_token: auth.access_token,
    refresh_token: auth.refresh_token,
    user_id: auth.user.id,
    expires_at: Date.now() + (auth.expires_in - 60) * 1000
  };
  saveSyncCfg(cfg);
}

async function ensureFreshSession(cfg){
  if(Date.now() < cfg.session.expires_at) return cfg;
  const auth = await supabaseAuth(cfg, 'refresh_token', { refresh_token: cfg.session.refresh_token });
  storeSession(cfg, auth);
  return cfg;
}

async function supabaseRest(cfg, path, options){
  await ensureFreshSession(cfg);
  const res = await fetch(`${cfg.url}/rest/v1/${path}`, Object.assign({}, options, {
    headers: Object.assign({
      'apikey': cfg.anonKey,
      'Authorization': `Bearer ${cfg.session.access_token}`,
      'Content-Type': 'application/json'
    }, (options && options.headers) || {})
  }));
  if(res.status === 204) return null;
  const data = await res.json().catch(()=> null);
  if(!res.ok) throw new Error((data && (data.message || data.hint)) || `Sync request failed (${res.status})`);
  return data;
}

// Exchanges an Apple identity token for a Supabase session. Uses the same
// storeSession() shape as email/password sign-in, so everything downstream
// (supabaseRest, ensureFreshSession, syncEnabled) works unchanged.
async function syncSignInWithApple(identityToken, rawNonce){
  const cfg = loadSyncCfg();
  const res = await fetch(`${cfg.url}/auth/v1/token?grant_type=id_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': cfg.anonKey },
    body: JSON.stringify({ provider: 'apple', id_token: identityToken, nonce: rawNonce })
  });
  const data = await res.json();
  if(!res.ok) throw new Error(data.error_description || data.msg || data.error || 'Apple sign-in failed');
  storeSession(cfg, data);
  return cfg;
}

async function syncSignIn(url, anonKey, email, password){
  const cfg = { url: url.replace(/\/+$/, ''), anonKey, email };
  const auth = await supabaseAuth(cfg, 'password', { email, password });
  storeSession(cfg, auth);
  return cfg;
}

// Creates an account. Returns { needsConfirm } when the project requires the
// user to confirm their email before their first sign-in.
async function syncSignUp(url, anonKey, email, password){
  const cfg = { url: url.replace(/\/+$/, ''), anonKey, email };
  const res = await fetch(`${cfg.url}/auth/v1/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': cfg.anonKey },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if(!res.ok) throw new Error(data.error_description || data.msg || 'Sign up failed');
  if(data.access_token){
    storeSession(cfg, data);
    return { needsConfirm: false };
  }
  return { needsConfirm: true };
}

// Sends a password-reset email that links back to this app.
async function syncRecover(email){
  const cfg = loadSyncCfg();
  const res = await fetch(`${cfg.url}/auth/v1/recover`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': cfg.anonKey },
    body: JSON.stringify({ email, gotrue_meta_security: {} })
  });
  if(!res.ok){
    const data = await res.json().catch(()=> ({}));
    throw new Error(data.error_description || data.msg || 'Could not send reset email');
  }
}

// Sets a new password for the signed-in user (used by the recovery flow).
async function syncUpdatePassword(newPassword){
  const cfg = loadSyncCfg();
  await ensureFreshSession(cfg);
  const res = await fetch(`${cfg.url}/auth/v1/user`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'apikey': cfg.anonKey, 'Authorization': `Bearer ${cfg.session.access_token}` },
    body: JSON.stringify({ password: newPassword })
  });
  if(!res.ok){
    const data = await res.json().catch(()=> ({}));
    throw new Error(data.error_description || data.msg || 'Could not update password');
  }
}

// The recovery email opens the app with tokens in the URL hash. Capture them
// as a session so the person can set a new password.
function consumeRecoveryHash(){
  if(!location.hash.includes('access_token')) return false;
  const params = new URLSearchParams(location.hash.slice(1));
  if(params.get('type') !== 'recovery' && params.get('type') !== 'signup') return false;
  const cfg = loadSyncCfg();
  if(!cfg || !cfg.url) return false;
  cfg.session = {
    access_token: params.get('access_token'),
    refresh_token: params.get('refresh_token'),
    user_id: '',
    expires_at: Date.now() + 50 * 60 * 1000
  };
  saveSyncCfg(cfg);
  history.replaceState(null, '', location.pathname);
  return params.get('type') === 'recovery';
}

function syncSignOut(){
  if(hasBakedConfig()){
    // Keep nothing but the baked credentials; drop session and email.
    saveSyncCfg(null);
  } else {
    const cfg = loadSyncCfg();
    if(cfg){ delete cfg.session; saveSyncCfg(cfg); }
  }
  setSyncStatus('Not connected');
}

// Push local state to the cloud row. Called debounced after every save.
async function pushStateToCloud(){
  if(!syncEnabled() || !navigator.onLine || syncBusy) return;
  syncBusy = true;
  try{
    const cfg = loadSyncCfg();
    await supabaseRest(cfg, 'foundry_state', {
      method: 'POST',
      headers: { 'Prefer': 'resolution=merge-duplicates' },
      body: JSON.stringify([{
        user_id: cfg.session.user_id,
        data: state,
        updated_at: state.updatedAt || new Date().toISOString()
      }])
    });
    setSyncStatus(`Synced ${new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`, 'ok');
    pushLeaderboardEntry(cfg);
  }catch(e){
    setSyncStatus('Sync error: ' + e.message, 'err');
  }finally{
    syncBusy = false;
  }
}

// Publishes this user's public stats when sharing is on. Failure is silent;
// the leaderboard is a bonus, never a blocker for the core sync.
async function pushLeaderboardEntry(cfg){
  if(!state.settings.shareStats || !state.settings.displayName) return;
  try{
    const now = Date.now();
    const weekSessions = state.sessions.filter(s => now - new Date(s.date).getTime() <= 7 * 86400000);
    const weekVolume = Math.round(weekSessions.reduce((a,s) => a + (s.volume || 0), 0));
    await supabaseRest(cfg, 'foundry_leaderboard', {
      method: 'POST',
      headers: { 'Prefer': 'resolution=merge-duplicates' },
      body: JSON.stringify([{
        user_id: cfg.session.user_id,
        display_name: state.settings.displayName,
        stats: {
          streak: state.streak || 0,
          weekVolume,
          weekSessions: weekSessions.length,
          units: state.settings.units || 'kg'
        },
        updated_at: new Date().toISOString()
      }])
    });
  }catch(e){ /* non-fatal */ }
}

// Everyone signed in can read the board.
async function fetchLeaderboard(){
  if(!syncEnabled()) return null;
  const cfg = loadSyncCfg();
  return supabaseRest(cfg, 'foundry_leaderboard?select=user_id,display_name,stats,updated_at', { method: 'GET' });
}

// Friend connections: a short shareable code per person, redeemed by an
// actual friend to link accounts. The RLS policy on foundry_leaderboard is
// what actually restricts who sees whose stats, this just manages the codes.
function generateInviteCode(){
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O or 1/I, easy to read aloud
  let code = '';
  for(let i=0;i<6;i++) code += chars[Math.floor(Math.random()*chars.length)];
  return code;
}

async function getOrCreateInviteCode(){
  if(!syncEnabled()) return null;
  const cfg = loadSyncCfg();
  const existing = await supabaseRest(cfg, 'foundry_invite_codes?select=code', { method: 'GET' });
  if(existing && existing.length) return existing[0].code;
  for(let attempt=0; attempt<5; attempt++){
    const code = generateInviteCode();
    try{
      await supabaseRest(cfg, 'foundry_invite_codes', {
        method: 'POST',
        headers: { 'Prefer': 'return=minimal' },
        body: JSON.stringify({ user_id: cfg.session.user_id, code })
      });
      return code;
    }catch(e){
      if(!/duplicate|unique/i.test(e.message)) throw e;
    }
  }
  throw new Error('Could not generate an invite code, try again');
}

async function redeemInviteCode(code){
  if(!syncEnabled()) return { error: 'Sign in to add friends' };
  const cfg = loadSyncCfg();
  return supabaseRest(cfg, 'rpc/redeem_invite_code', {
    method: 'POST',
    body: JSON.stringify({ invite_code: code.trim().toUpperCase() })
  });
}

// Challenges: a named group of connected friends competing on a weekly
// metric already tracked by the leaderboard, no separate stats system.
async function fetchChallenges(){
  if(!syncEnabled()) return [];
  const cfg = loadSyncCfg();
  const myId = cfg.session.user_id;
  const memberships = await supabaseRest(cfg, `foundry_challenge_members?user_id=eq.${myId}&select=challenge_id`, { method: 'GET' });
  if(!memberships || !memberships.length) return [];
  const ids = memberships.map(m => m.challenge_id).join(',');
  return supabaseRest(cfg, `foundry_challenges?id=in.(${ids})&select=id,name,metric,creator_id`, { method: 'GET' });
}

async function fetchChallengeMemberIds(challengeId){
  const cfg = loadSyncCfg();
  const rows = await supabaseRest(cfg, `foundry_challenge_members?challenge_id=eq.${challengeId}&select=user_id`, { method: 'GET' });
  return (rows || []).map(r => r.user_id);
}

async function createChallenge(name, metric, friendIds){
  const cfg = loadSyncCfg();
  return supabaseRest(cfg, 'rpc/create_challenge', {
    method: 'POST',
    body: JSON.stringify({ challenge_name: name, challenge_metric: metric, friend_ids: friendIds })
  });
}

async function leaveChallenge(challengeId){
  const cfg = loadSyncCfg();
  const myId = cfg.session.user_id;
  return supabaseRest(cfg, `foundry_challenge_members?challenge_id=eq.${challengeId}&user_id=eq.${myId}`, { method: 'DELETE' });
}

// Pull the cloud row and adopt it if it is newer than local state.
async function pullStateFromCloud(){
  if(!syncEnabled() || !navigator.onLine) return;
  try{
    const cfg = loadSyncCfg();
    const rows = await supabaseRest(cfg, 'foundry_state?select=data,updated_at', { method: 'GET' });
    if(!rows || rows.length === 0){
      // First run: seed the cloud with local state.
      await pushStateToCloud();
      return;
    }
    const remote = rows[0];
    const remoteTime = new Date(remote.updated_at).getTime();
    const localTime = state.updatedAt ? new Date(state.updatedAt).getTime() : 0;
    if(remoteTime > localTime + 1000){
      state = Object.assign(defaultState(), remote.data);
      state.settings = Object.assign(defaultState().settings, (remote.data.settings) || {});
      state.sessions = (remote.data.sessions || []).map(migrateSession);
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
      if(typeof applyTheme === 'function') applyTheme();
      updateStreak(state);
      render();
      if(currentView === 'progress') renderProgress();
      if(currentView === 'body') renderBody();
      if(currentView === 'settings') renderSettings();
      showToast('Synced newer data from cloud');
    }
    setSyncStatus(`Synced ${new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`, 'ok');
  }catch(e){
    setSyncStatus('Sync error: ' + e.message, 'err');
  }
}

// Debounced push hook, called from saveState.
function scheduleSyncPush(){
  if(!syncEnabled()) return;
  clearTimeout(syncPushTimer);
  syncPushTimer = setTimeout(pushStateToCloud, 2500);
}

// Pull whenever the app comes back to the foreground.
document.addEventListener('visibilitychange', ()=>{
  if(document.visibilityState === 'visible') pullStateFromCloud();
});
window.addEventListener('online', ()=>{ pullStateFromCloud(); });

// Fires after both app.js and sync.js are loaded.
if(typeof maybeShowWelcome === 'function') maybeShowWelcome();
// Covers the case where the recovery email link lands in an already-open app.
window.addEventListener('hashchange', ()=>{
  if(typeof maybeShowWelcome === 'function') maybeShowWelcome();
});

// ---------- Account deletion (App Store guideline 5.1.1(v)) ----------

// Deleting an auth user needs the service role, which must never live in the
// client. So we call a Supabase Edge Function that holds it server-side; the
// function verifies the caller's JWT, then removes their rows and their auth
// account. Returns true on success.
async function deleteAccountCloud(){
  const cfg = loadSyncCfg();
  if(!cfg || !cfg.session) return true; // nothing to delete server-side
  await ensureFreshSession(cfg);
  const res = await fetch(`${cfg.url}/functions/v1/delete-account`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': cfg.anonKey,
      'Authorization': `Bearer ${cfg.session.access_token}`
    }
  });
  if(!res.ok){
    const data = await res.json().catch(()=> ({}));
    throw new Error(data.error || `Delete failed (${res.status})`);
  }
  return true;
}
