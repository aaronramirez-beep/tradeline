import { test, expect, devices } from '@playwright/test';

test.use({ ...devices['Pixel 7'] }); // Chromium-based mobile profile (WebKit not installed here)

async function bootField(page) {
  await page.goto('http://localhost:3456/field.html');
  // Fresh context has no workspaces — the picker offers a sample company
  await page.click('button:has-text("Try with a sample company")');
  await expect(page.locator('.jcard').first()).toBeVisible({ timeout: 8000 });
}

test.describe('Tradeline Field (mobile)', () => {
  test('boots with a sample company and lists jobs by bucket', async ({ page }) => {
    await bootField(page);
    await expect(page.locator('#wsName')).toContainText('Sample Finishing Co.');
    await expect(page.locator('.jcard')).toHaveCount(2); // seeded j1 + j2
    await expect(page.locator('.sec:has-text("Done")')).toBeVisible();
  });

  test('job screen shows site, contact, checklist and change orders', async ({ page }) => {
    await bootField(page);
    await page.click('.jcard:has-text("Level 5 finish")');
    await expect(page.locator('.krow:has-text("Site")')).toBeVisible();
    await expect(page.locator('.chk').first()).toBeVisible();
    // Seeded change orders on j1
    await expect(page.locator('.corow')).toHaveCount(2);
    await expect(page.locator('.pill:has-text("Pending approval")')).toBeVisible();
  });

  test('checklist tap moves a scheduled job to in progress', async ({ page }) => {
    await bootField(page);
    await page.click('.jcard:has-text("Level 5 finish")');
    await page.click('.chk:not(.done) >> nth=0');
    await expect(page.locator('.pill:has-text("In progress")').first()).toBeVisible();
  });

  test('can add a change order from the field', async ({ page }) => {
    await bootField(page);
    await page.click('.jcard:has-text("Level 5 finish")');
    await page.click('button:has-text("Change order")');
    await page.fill('#co_desc', 'Extra bedroom ceiling texture');
    await page.fill('#co_amt', '380');
    await page.click('button:has-text("Send for approval")');
    await expect(page.locator('.corow:has-text("Extra bedroom ceiling texture")')).toBeVisible();
  });

  test('field data persists into the office view (shared workspace)', async ({ page }) => {
    await bootField(page);
    await page.click('.jcard:has-text("Level 5 finish")');
    await page.click('button:has-text("Change order")');
    await page.fill('#co_desc', 'Field-logged extra scope');
    await page.fill('#co_amt', '250');
    await page.click('button:has-text("Send for approval")');
    await expect(page.locator('.corow:has-text("Field-logged extra scope")')).toBeVisible();
    // Office view opens the same workspace from localStorage (desktop surface)
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('http://localhost:3456/app.html');
    await expect(page.locator('#pageTitle')).toHaveText('Dashboard', { timeout: 8000 });
    await page.click('[data-view="schedule"]');
    await page.click('table tbody tr.click:has-text("Level 5 finish")');
    await expect(page.locator('text=Field-logged extra scope')).toBeVisible();
  });

  test('crew can attach a job photo and it survives reload', async ({ page }) => {
    await bootField(page);
    await page.click('.jcard:has-text("Level 5 finish")');
    // 1x1 red pixel PNG
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64'
    );
    await page.setInputFiles('.addph input[type="file"]', { name: 'site.png', mimeType: 'image/png', buffer: png });
    await expect(page.locator('.pgrid .ph')).toHaveCount(1);
    await expect(page.locator('.sec:has-text("Photos") .mono')).toHaveText('(1)');
    // metadata + image persist across a reload (localStorage + IndexedDB)
    await page.reload();
    await page.click('.jcard:has-text("Level 5 finish")');
    await expect(page.locator('.pgrid .ph')).toHaveCount(1);
    const src = await page.locator('.pgrid .ph img').getAttribute('src');
    expect(src).toContain('data:image/jpeg');
  });

  test('field photo shows up in the office view', async ({ page }) => {
    await bootField(page);
    await page.click('.jcard:has-text("Level 5 finish")');
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64'
    );
    await page.setInputFiles('.addph input[type="file"]', { name: 'site.png', mimeType: 'image/png', buffer: png });
    await expect(page.locator('.pgrid .ph')).toHaveCount(1);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('http://localhost:3456/app.html');
    await page.click('[data-view="schedule"]');
    await page.click('table tbody tr.click:has-text("Level 5 finish")');
    await expect(page.locator('#pgrid .ph')).toHaveCount(1);
  });

  test('picker offers optional cloud sign-in without blocking local use', async ({ page }) => {
    await page.goto('http://localhost:3456/field.html');
    await expect(page.locator('text=Sync with the office')).toBeVisible();
    await expect(page.locator('#cl_email')).toBeVisible();
    // Local path still works with no account
    await page.click('button:has-text("Try with a sample company")');
    await expect(page.locator('.jcard').first()).toBeVisible();
  });

  test('PWA wiring: manifest and service worker are served', async ({ page, request }) => {
    const mf = await request.get('http://localhost:3456/manifest.webmanifest');
    expect(mf.ok()).toBeTruthy();
    const manifest = await mf.json();
    expect(manifest.start_url).toBe('field.html');
    expect(manifest.display).toBe('standalone');
    const sw = await request.get('http://localhost:3456/sw.js');
    expect(sw.ok()).toBeTruthy();
    for (const icon of manifest.icons) {
      const r = await request.get('http://localhost:3456/' + icon.src);
      expect(r.ok()).toBeTruthy();
    }
  });
});
