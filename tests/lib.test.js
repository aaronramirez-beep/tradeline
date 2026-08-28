import { describe, it, expect, beforeEach } from 'vitest';

// lib.js uses window.TL in the browser; in Vitest/jsdom we import via globalThis
import '../lib.js';
const TL = globalThis.TL;

describe('money', () => {
  it('formats basic amounts', () => {
    expect(TL.money(42)).toBe('$42.00');
    expect(TL.money(1234.56)).toBe('$1,234.56');
  });

  it('formats zero', () => {
    expect(TL.money(0)).toBe('$0.00');
  });

  it('formats negatives with Unicode minus', () => {
    expect(TL.money(-42)).toBe('\u2212$42.00');
  });

  it('handles null/undefined as zero', () => {
    expect(TL.money(null)).toBe('$0.00');
    expect(TL.money(undefined)).toBe('$0.00');
  });

  it('always shows two decimal places', () => {
    expect(TL.money(10)).toBe('$10.00');
    expect(TL.money(10.1)).toBe('$10.10');
  });
});

describe('dfmt', () => {
  it('formats ISO dates', () => {
    expect(TL.dfmt('2026-07-04')).toBe('Jul 4, 2026');
    expect(TL.dfmt('2026-01-15')).toBe('Jan 15, 2026');
    expect(TL.dfmt('2026-12-31')).toBe('Dec 31, 2026');
  });

  it('returns em-dash for falsy input', () => {
    expect(TL.dfmt(null)).toBe('\u2014');
    expect(TL.dfmt(undefined)).toBe('\u2014');
    expect(TL.dfmt('')).toBe('\u2014');
  });
});

describe('shortDate', () => {
  it('formats without year', () => {
    expect(TL.shortDate('2026-07-04')).toBe('Jul 4');
  });
});

describe('esc', () => {
  it('escapes HTML entities', () => {
    expect(TL.esc('<script>')).toBe('&lt;script&gt;');
    expect(TL.esc('a&b')).toBe('a&amp;b');
    expect(TL.esc('"x"')).toBe('&quot;x&quot;');
  });

  it('handles null/undefined as empty string', () => {
    expect(TL.esc(null)).toBe('');
    expect(TL.esc(undefined)).toBe('');
    expect(TL.esc(0)).toBe('0');
  });
});

describe('uid', () => {
  it('generates unique IDs with prefix', () => {
    const a = TL.uid('c');
    const b = TL.uid('c');
    expect(a).toMatch(/^c\d+$/);
    expect(b).toMatch(/^c\d+$/);
    expect(a).not.toBe(b);
  });

  it('generates IDs without prefix', () => {
    const id = TL.uid();
    expect(id).toMatch(/^\d+$/);
  });
});

describe('quoteTotal / invTotal', () => {
  it('calculates quote total', () => {
    const q = { items: [{ q: 10, p: 5 }, { q: 3, p: 20 }] };
    expect(TL.quoteTotal(q)).toBe(110);
  });

  it('returns 0 for empty items', () => {
    expect(TL.quoteTotal({ items: [] })).toBe(0);
  });

  it('invTotal works the same way', () => {
    const inv = { items: [{ q: 2, p: 100 }] };
    expect(TL.invTotal(inv)).toBe(200);
  });
});

describe('has() feature gating', () => {
  let origState;

  beforeEach(() => {
    origState = TL.state;
    TL.state = TL.seedState();
  });

  afterEach(() => {
    TL.state = origState;
  });

  it('returns true for unknown keys (no FEAT entry)', () => {
    expect(TL.has('nonexistent')).toBe(true);
  });

  it('core plan: denies grow-only features', () => {
    TL.state.plan = 'core';
    expect(TL.has('reports')).toBe(false);
    expect(TL.has('automations')).toBe(false);
  });

  it('core plan: denies plus-only features', () => {
    TL.state.plan = 'core';
    expect(TL.has('pipeline')).toBe(false);
    expect(TL.has('ai')).toBe(false);
    expect(TL.has('marketing')).toBe(false);
  });

  it('grow plan: grants grow features, denies plus features', () => {
    TL.state.plan = 'grow';
    expect(TL.has('reports')).toBe(true);
    expect(TL.has('automations')).toBe(true);
    expect(TL.has('pipeline')).toBe(false);
  });

  it('plus plan: grants everything', () => {
    TL.state.plan = 'plus';
    expect(TL.has('pipeline')).toBe(true);
    expect(TL.has('marketing')).toBe(true);
    expect(TL.has('ai')).toBe(true);
    expect(TL.has('reports')).toBe(true);
  });

  it('addon override unlocks feature on lower plan', () => {
    TL.state.plan = 'core';
    TL.state.addons.pipeline = true;
    expect(TL.has('pipeline')).toBe(true);
  });

  it('addon override works for AI', () => {
    TL.state.plan = 'connect';
    TL.state.addons.ai = true;
    expect(TL.has('ai')).toBe(true);
  });

  it('no addon needed for connect-level features', () => {
    TL.state.plan = 'connect';
    expect(TL.has('timesheets')).toBe(true);
    expect(TL.has('expenses')).toBe(true);
  });
});

describe('state factories', () => {
  it('baseState returns empty arrays and core plan', () => {
    const s = TL.baseState();
    expect(s.plan).toBe('core');
    expect(s.clients).toEqual([]);
    expect(s.quotes).toEqual([]);
    expect(s.automations).toHaveLength(5);
  });

  it('seedState returns populated demo data', () => {
    const s = TL.seedState();
    expect(s.clients.length).toBeGreaterThan(0);
    expect(s.quotes.length).toBeGreaterThan(0);
    expect(s.jobs.length).toBeGreaterThan(0);
    expect(s.invoices.length).toBeGreaterThan(0);
  });
});

describe('PLANS', () => {
  it('has four tiers with increasing prices', () => {
    expect(TL.PLANS).toHaveLength(4);
    const prices = TL.PLANS.map(p => p.mo);
    expect(prices).toEqual([49, 139, 199, 499]);
  });

  it('RANK matches PLANS order', () => {
    expect(TL.RANK.core).toBe(0);
    expect(TL.RANK.connect).toBe(1);
    expect(TL.RANK.grow).toBe(2);
    expect(TL.RANK.plus).toBe(3);
  });
});

describe('statusPill', () => {
  it('returns HTML for known statuses', () => {
    const html = TL.statusPill('paid');
    expect(html).toContain('Paid');
    expect(html).toContain('p-green');
  });

  it('returns fallback for unknown status', () => {
    const html = TL.statusPill('mystery');
    expect(html).toContain('mystery');
    expect(html).toContain('p-slate');
  });
});
