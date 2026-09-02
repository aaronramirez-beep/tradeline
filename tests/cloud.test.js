import { describe, it, expect, beforeEach, vi } from 'vitest';

// cloud.js reads localStorage at import time and exposes window.TLC
import '../cloud.js';
const TLC = globalThis.TLC;

const tokenPayload = (overrides = {}) => ({
  access_token: 'at-1', refresh_token: 'rt-1', expires_in: 3600,
  user: { id: 'u1', email: 'a@b.co' }, ...overrides,
});

const okJson = data => Promise.resolve({
  ok: true, status: 200,
  json: () => Promise.resolve(data),
  text: () => Promise.resolve(JSON.stringify(data)),
});

beforeEach(async () => {
  globalThis.fetch = vi.fn(() => Promise.reject(new Error('offline')));
  await TLC.signOut(); // clears any session from a previous test
  vi.clearAllMocks();
});

describe('TLC auth', () => {
  it('starts signed out', () => {
    expect(TLC.user()).toBeNull();
  });

  it('signIn stores the session and exposes the user', async () => {
    globalThis.fetch = vi.fn(() => okJson(tokenPayload()));
    const user = await TLC.signIn('a@b.co', 'secret1');
    expect(user.email).toBe('a@b.co');
    expect(TLC.user().id).toBe('u1');
    const [url, opts] = fetch.mock.calls[0];
    expect(url).toContain('/auth/v1/token?grant_type=password');
    expect(opts.headers.apikey).toBeTruthy();
  });

  it('signUp with confirmation ON reports needsConfirm and stays signed out', async () => {
    globalThis.fetch = vi.fn(() => okJson({ id: 'u2', confirmation_sent_at: 'now' }));
    const r = await TLC.signUp('new@b.co', 'secret1');
    expect(r.needsConfirm).toBe(true);
    expect(TLC.user()).toBeNull();
  });

  it('signUp with confirmation OFF signs straight in', async () => {
    globalThis.fetch = vi.fn(() => okJson(tokenPayload({ user: { id: 'u3', email: 'new@b.co' } })));
    const r = await TLC.signUp('new@b.co', 'secret1');
    expect(r.needsConfirm).toBe(false);
    expect(TLC.user().email).toBe('new@b.co');
  });

  it('surfaces auth error messages', async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve({
      ok: false, status: 400,
      json: () => Promise.resolve({ msg: 'Invalid login credentials' }),
      text: () => Promise.resolve(''),
    }));
    await expect(TLC.signIn('a@b.co', 'nope')).rejects.toThrow('Invalid login credentials');
  });
});

describe('TLC workspaces', () => {
  beforeEach(async () => {
    globalThis.fetch = vi.fn(() => okJson(tokenPayload()));
    await TLC.signIn('a@b.co', 'secret1');
    vi.clearAllMocks();
  });

  it('push + flush upserts with conflict target and auth headers', async () => {
    globalThis.fetch = vi.fn(() => okJson([]));
    TLC.push({ key: 'w1', name: 'Biz', trade: 'Drywall', seed: 'sample' }, { UID: 1200, state: { plan: 'core' } });
    await TLC.flush();
    const [url, opts] = fetch.mock.calls[0];
    expect(url).toContain('/rest/v1/workspaces?on_conflict=user_id,key');
    expect(opts.method).toBe('POST');
    expect(opts.headers.Prefer).toContain('merge-duplicates');
    expect(opts.headers.Authorization).toBe('Bearer at-1');
    const body = JSON.parse(opts.body);
    expect(body.key).toBe('w1');
    expect(body.data.state.plan).toBe('core');
    expect(body.updated_at).toBeTruthy();
  });

  it('pull returns the first row or null', async () => {
    globalThis.fetch = vi.fn(() => okJson([{ data: { UID: 1, state: {} }, updated_at: '2026-09-01T00:00:00Z' }]));
    const row = await TLC.pull('w1');
    expect(row.updated_at).toBe('2026-09-01T00:00:00Z');
    globalThis.fetch = vi.fn(() => okJson([]));
    expect(await TLC.pull('missing')).toBeNull();
  });

  it('mergeLists adds cloud-only workspaces and flags local-only ones', async () => {
    globalThis.fetch = vi.fn(() => okJson([
      { key: 'wCloud', name: 'Cloud Co', trade: 'HVAC', seed: 'blank', updated_at: '2026-09-01T10:00:00Z' },
      { key: 'wBoth', name: 'Both Co', trade: '', seed: 'sample', updated_at: '2026-09-01T10:00:00Z' },
    ]));
    const local = [{ key: 'wBoth', name: 'Both Co' }, { key: 'wLocal', name: 'Local Co' }];
    const merged = await TLC.mergeLists(local);
    expect(merged.list.map(w => w.key).sort()).toEqual(['wBoth', 'wCloud', 'wLocal']);
    expect(merged.localOnly.map(w => w.key)).toEqual(['wLocal']);
  });

  it('refreshes an expired session before REST calls', async () => {
    // Sign in with an already-expired token
    await TLC.signOut(); vi.clearAllMocks();
    globalThis.fetch = vi.fn(() => okJson(tokenPayload({ expires_in: -10 })));
    await TLC.signIn('a@b.co', 'secret1');
    vi.clearAllMocks();
    globalThis.fetch = vi.fn(url => url.includes('grant_type=refresh_token')
      ? okJson(tokenPayload({ access_token: 'at-2' }))
      : okJson([]));
    await TLC.list();
    const urls = fetch.mock.calls.map(c => c[0]);
    expect(urls[0]).toContain('grant_type=refresh_token');
    expect(fetch.mock.calls[1][1].headers.Authorization).toBe('Bearer at-2');
  });
});
