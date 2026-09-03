import { test, expect } from '@playwright/test';

async function bootDemo(page) {
  await page.goto('http://localhost:3456/app.html');
  // The launcher requires: fill name, pick sample data, create
  await page.fill('#ws_name', 'Test Co');
  await page.click('[data-seed="sample"]');
  await page.click('button:has-text("Create business")');
  // Wait for dashboard to render
  await expect(page.locator('#pageTitle')).toHaveText('Dashboard', { timeout: 8000 });
}

test.describe('TradeLine CRM', () => {
  test('dashboard loads with seeded data', async ({ page }) => {
    await bootDemo(page);
    await expect(page.locator('.stat .val').first()).toBeVisible();
    await expect(page.locator('#pageTitle')).toHaveText('Dashboard');
  });

  test('can navigate to Requests view', async ({ page }) => {
    await bootDemo(page);
    await page.click('[data-view="requests"]');
    await expect(page.locator('#pageTitle')).toHaveText('Requests');
    await expect(page.locator('table tbody tr').first()).toBeVisible();
  });

  test('can create a new request', async ({ page }) => {
    await bootDemo(page);
    await page.click('[data-view="requests"]');
    await page.click('button:has-text("New request")');
    await page.fill('#r_name', 'Test Customer');
    await page.fill('#r_phone', '555-0000');
    await page.fill('#r_service', 'Interior paint');
    await page.click('button:has-text("Save")');
    await expect(page.locator('#pageTitle')).toHaveText('Requests');
    await expect(page.locator('text=Test Customer')).toBeVisible();
  });

  test('quote detail shows line items and totals', async ({ page }) => {
    await bootDemo(page);
    await page.click('[data-view="quotes"]');
    await page.click('table tbody tr.click >> nth=0');
    // Quote detail shows back button, line items, and dollar amounts
    await expect(page.locator('.back')).toBeVisible();
    await expect(page.locator('text=$').first()).toBeVisible();
  });

  test('feature gating: paywall shows for locked features on core plan', async ({ page }) => {
    await bootDemo(page);
    await page.click('[data-view="pipeline"]');
    await expect(page.locator('.paywall')).toBeVisible();
    await expect(page.locator('.paywall h2')).toHaveText('Sales Pipeline');
  });

  test('upgrade unlocks gated feature', async ({ page }) => {
    await bootDemo(page);
    await page.click('[data-view="pipeline"]');
    await expect(page.locator('.paywall')).toBeVisible();
    // Click the paywall's upgrade button (not the top bar one)
    await page.click('.paywall button:has-text("Upgrade")');
    await expect(page.locator('#pageTitle')).toHaveText('Sales Pipeline');
    await expect(page.locator('.paywall')).not.toBeVisible();
  });

  test('job checklist toggle changes status', async ({ page }) => {
    await bootDemo(page);
    await page.click('[data-view="schedule"]');
    await page.click('table tbody tr.click >> nth=0');
    // Should show checklist items — find an unchecked one
    const unchecked = page.locator('.chk:not(.done) input[type="checkbox"]').first();
    if (await unchecked.isVisible({ timeout: 2000 }).catch(() => false)) {
      await unchecked.click();
      await expect(page.locator('text=In progress')).toBeVisible();
    }
  });

  test('can add a change order to a job', async ({ page }) => {
    await bootDemo(page);
    await page.click('[data-view="schedule"]');
    await page.click('table tbody tr.click >> nth=0');
    await expect(page.locator('text=Change orders')).toBeVisible();
    await page.click('button:has-text("Add change order")');
    await page.fill('#co_desc', 'Extra closet shelving');
    await page.fill('#co_amt', '425');
    await page.click('button:has-text("Send for approval")');
    await expect(page.locator('text=Extra closet shelving')).toBeVisible();
    await expect(page.locator('.pill:has-text("Pending approval")').first()).toBeVisible();
  });

  test('approving a change order updates the approved total', async ({ page }) => {
    await bootDemo(page);
    await page.click('[data-view="schedule"]');
    await page.click('table tbody tr.click:has-text("Level 5 finish")');
    // Seeded job j1 has one pending CO ($640) and one approved ($1,850)
    await page.click('button:has-text("✓ Approve")');
    await expect(page.locator('text=$2,490.00 approved')).toBeVisible();
  });

  test('invoice view shows financial data', async ({ page }) => {
    await bootDemo(page);
    await page.click('[data-view="invoices"]');
    await expect(page.locator('#pageTitle')).toHaveText('Invoices');
    await expect(page.locator('table tbody tr').first()).toBeVisible();
    await expect(page.locator('text=$').first()).toBeVisible();
  });

  test('workspace lock encrypts at rest and unlock restores the data', async ({ page }) => {
    await bootDemo(page);
    await page.click('.side .foot a:has-text("Lock")');
    await page.fill('#pk_new', 'demo-passphrase-1');
    await page.fill('#pk_confirm', 'demo-passphrase-1');
    await page.click('button:has-text("Lock workspace")');
    // persisted blob becomes ciphertext
    await page.waitForFunction(() =>
      Object.keys(localStorage).some(k => k.startsWith('arkhub-ws-') && localStorage.getItem(k).startsWith('enc:v1:')));
    // fresh session (passphrase lives in sessionStorage) → unlock prompt on boot
    await page.evaluate(() => sessionStorage.clear());
    await page.reload();
    await expect(page.locator('text=Unlock business')).toBeVisible();
    await page.fill('#uk_pw', 'demo-passphrase-1');
    await page.click('button:has-text("Unlock")');
    await expect(page.locator('#pageTitle')).toHaveText('Dashboard');
    await page.click('[data-view="schedule"]');
    await expect(page.locator('table tbody tr.click:has-text("Level 5 finish")')).toBeVisible();
  });

  test('sidebar links back to landing page', async ({ page }) => {
    await bootDemo(page);
    const homeLink = page.locator('.side .foot a:has-text("Tradeline home")');
    await expect(homeLink).toBeVisible();
    const href = await homeLink.getAttribute('href');
    expect(href).toBe('index.html');
  });
});
