/* ============================================================
   Tradeline — cloud sync (Supabase, no client library)
   Optional accounts + cross-device save. Everything still works
   signed-out and offline; the cloud is a mirror, not a gate.

   Talks straight to Supabase's REST endpoints with fetch:
     /auth/v1  — email+password sessions (GoTrue)
     /rest/v1  — workspaces table (PostgREST, RLS-guarded)

   The publishable key below is designed to be public; row-level
   security in supabase/schema.sql is what protects data.
   Exposed on window.TLC. Loaded by app.html and field.html.
   ============================================================ */

const TLC_URL = 'https://ojsqvnhxszqqwdgxhpjp.supabase.co';
const TLC_KEY = 'sb_publishable_NjFjoXglGaf1r0kzDTx-tw_u37z4Yc7';
const TLC_SESSION_KEY = 'tl-cloud-session';

let tlcSession = null;
try { tlcSession = JSON.parse(localStorage.getItem(TLC_SESSION_KEY)); } catch (e) {}

function tlcSaveSession(s) {
  tlcSession = s;
  try {
    if (s) localStorage.setItem(TLC_SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(TLC_SESSION_KEY);
  } catch (e) {}
}

async function tlcAuth(path, body, headers) {
  const r = await fetch(TLC_URL + '/auth/v1' + path, {
    method: 'POST',
    headers: { apikey: TLC_KEY, 'Content-Type': 'application/json', ...(headers || {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.msg || j.error_description || j.message || ('Auth error ' + r.status));
  return j;
}

function tlcAdopt(j) {
  if (!j || !j.access_token) return null;
  const s = {
    access_token: j.access_token,
    refresh_token: j.refresh_token,
    expires_at: (j.expires_at ? j.expires_at * 1000 : Date.now() + (j.expires_in || 3600) * 1000),
    user: { id: j.user && j.user.id, email: j.user && j.user.email },
  };
  tlcSaveSession(s);
  return s;
}

async function tlcFreshToken() {
  if (!tlcSession) throw new Error('Not signed in');
  if (Date.now() < tlcSession.expires_at - 60000) return tlcSession.access_token;
  const j = await tlcAuth('/token?grant_type=refresh_token', { refresh_token: tlcSession.refresh_token });
  const s = tlcAdopt(j);
  if (!s) { tlcSaveSession(null); throw new Error('Session expired'); }
  return s.access_token;
}

async function tlcRest(path, opts) {
  const token = await tlcFreshToken();
  const r = await fetch(TLC_URL + '/rest/v1' + path, {
    ...(opts || {}),
    headers: {
      apikey: TLC_KEY, Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json', ...((opts || {}).headers || {}),
    },
  });
  if (!r.ok) throw new Error('Cloud error ' + r.status + ': ' + await r.text().catch(() => ''));
  if (r.status === 204) return null;
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}

/* ---------- push queue: debounced, offline-tolerant ---------- */
let tlcTimer = null, tlcPending = null;

function tlcQueuePush(ws, payload) {
  if (!tlcSession || !ws) return;
  tlcPending = {
    key: ws.key, name: ws.name, trade: ws.trade || '', seed: ws.seed || 'blank',
    data: payload, updated_at: new Date().toISOString(),
  };
  clearTimeout(tlcTimer);
  tlcTimer = setTimeout(tlcFlush, 1500);
}

async function tlcFlush() {
  if (!tlcPending || !tlcSession) return;
  const row = tlcPending; tlcPending = null;
  try {
    await tlcRest('/workspaces?on_conflict=user_id,key', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(row),
    });
  } catch (e) { tlcPending = tlcPending || row; } // keep for retry on next persist/online
}
if (typeof addEventListener === 'function') {
  addEventListener('online', () => tlcFlush());
  addEventListener('pagehide', () => { clearTimeout(tlcTimer); tlcFlush(); });
}

window.TLC = {
  user: () => (tlcSession ? tlcSession.user : null),

  async signUp(email, password) {
    const j = await tlcAuth('/signup', { email, password });
    // With email confirmation ON, there is no session yet — caller shows "check your email".
    return { session: tlcAdopt(j), needsConfirm: !j.access_token };
  },
  async signIn(email, password) {
    const j = await tlcAuth('/token?grant_type=password', { email, password });
    if (!tlcAdopt(j)) throw new Error('Sign-in failed');
    return tlcSession.user;
  },
  async signOut() {
    try { if (tlcSession) await tlcAuth('/logout', undefined, { Authorization: 'Bearer ' + tlcSession.access_token }); } catch (e) {}
    tlcSaveSession(null);
  },

  list: () => tlcRest('/workspaces?select=key,name,trade,seed,updated_at&order=updated_at.desc'),
  pull: async key => {
    const rows = await tlcRest('/workspaces?key=eq.' + encodeURIComponent(key) + '&select=data,updated_at');
    return rows && rows[0] ? rows[0] : null;
  },
  push: (ws, payload) => { tlcQueuePush(ws, payload); },
  flush: tlcFlush,
  remove: key => tlcRest('/workspaces?key=eq.' + encodeURIComponent(key), { method: 'DELETE', headers: { Prefer: 'return=minimal' } }),

  /* Merge cloud workspace list into the local one. Returns the merged list
     and which keys exist only locally (callers push those up). */
  async mergeLists(localList) {
    const cloud = await this.list() || [];
    const localKeys = new Set(localList.map(w => w.key));
    const cloudKeys = new Set(cloud.map(w => w.key));
    const added = cloud.filter(w => !localKeys.has(w.key))
      .map(w => ({ key: w.key, name: w.name, trade: w.trade, seed: w.seed, created: (w.updated_at || '').slice(0, 10) }));
    return { list: [...localList, ...added], localOnly: localList.filter(w => !cloudKeys.has(w.key)) };
  },
};
