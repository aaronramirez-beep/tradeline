import { describe, it, expect } from 'vitest';

import '../lib.js';
const TL = globalThis.TL;

const cryptoAvailable = () => !!(globalThis.crypto && globalThis.crypto.subtle);

describe('at-rest encryption (WebCrypto)', () => {
  it('round-trips a workspace blob with the same passphrase', async () => {
    if (!cryptoAvailable()) return; // environments without WebCrypto
    const plain = JSON.stringify({ state: { plan: 'plus', clients: [{ name: 'Whitmore' }] } });
    const enc = await TL.encryptWorkspace('correct horse battery staple', plain);
    expect(enc).toBeTruthy();
    expect(enc).not.toContain('plus');
    expect(enc).not.toContain('Whitmore');
    const dec = await TL.decryptWorkspace('correct horse battery staple', enc);
    expect(dec).toBe(plain);
  });

  it('produces different ciphertext per encryption (nonce) even for same input', async () => {
    if (!cryptoAvailable()) return;
    const plain = JSON.stringify({ n: 42 });
    const a = await TL.encryptWorkspace('pw', plain);
    const b = await TL.encryptWorkspace('pw', plain);
    expect(a).not.toBe(b);
  });

  it('rejects a wrong passphrase', async () => {
    if (!cryptoAvailable()) return;
    const enc = await TL.encryptWorkspace('right', '{"a":1}');
    await expect(TL.decryptWorkspace('wrong', enc)).rejects.toThrow();
  });

  it('rejects tampered ciphertext', async () => {
    if (!cryptoAvailable()) return;
    const enc = await TL.encryptWorkspace('pw', '{"a":1}');
    const flipped = enc.slice(0, -1) + (enc.endsWith('A') ? 'B' : 'A');
    await expect(TL.decryptWorkspace('pw', flipped)).rejects.toThrow();
  });
});

describe('photo upload validation', () => {
  const base = { name: 'a.jpg', size: 1024, type: 'image/jpeg' };

  it('accepts allowed image types under the size limit', () => {
    expect(TL.validatePhoto(base)).toEqual({ ok: true });
    expect(TL.validatePhoto({ ...base, type: 'image/png' }).ok).toBe(true);
    expect(TL.validatePhoto({ ...base, type: 'image/webp' }).ok).toBe(true);
  });

  it('rejects non-image or unlisted types', () => {
    expect(TL.validatePhoto({ ...base, type: 'text/html' }).ok).toBe(false);
    expect(TL.validatePhoto({ ...base, type: 'image/gif' }).ok).toBe(false);
    expect(TL.validatePhoto({ ...base, type: 'application/pdf' }).ok).toBe(false);
  });

  it('rejects files over the size limit', () => {
    const over = { ...base, size: TL.PHOTO_MAX_BYTES + 1 };
    expect(TL.validatePhoto(over).ok).toBe(false);
  });
});

describe('field validation', () => {
  it('requires and length-limits fields', () => {
    expect(TL.validateField('   ').ok).toBe(true); // whitespace only is fine unless required
    expect(TL.validateField('', { required: true }).ok).toBe(false);
    expect(TL.validateField('hello', { maxLength: 3 }).ok).toBe(false);
    expect(TL.validateField('hi', { minLength: 3 }).ok).toBe(false);
    expect(TL.validateField('hello', { minLength: 3, maxLength: 10 }).ok).toBe(true);
  });

  it('applies regex patterns', () => {
    expect(TL.validateField('a@b.co', { pattern: TL.EMAIL_RE }).ok).toBe(true);
    expect(TL.validateField('nope', { pattern: TL.EMAIL_RE }).ok).toBe(false);
    expect(TL.validateField('(303) 555-0100', { pattern: TL.PHONE_RE }).ok).toBe(true);
    expect(TL.validateField('12', { pattern: TL.PHONE_RE }).ok).toBe(false);
  });

  it('applies numeric bounds', () => {
    expect(TL.validateField('8', { min: 0, max: 24 }).ok).toBe(true);
    expect(TL.validateField('25', { min: 0, max: 24 }).ok).toBe(false);
    expect(TL.validateField('-1', { min: 0 }).ok).toBe(false);
  });
});
