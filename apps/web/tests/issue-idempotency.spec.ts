import { expect, test, type Page } from '@playwright/test';
import { chooseKeeper, waitForHydration } from './helpers';

const effectiveIssueEntries = (page: Page) =>
  page.locator('[data-movement-type="issue"][data-superseded="false"]');

test('double-clicking submit issues DRL-003 exactly once', async ({ page }) => {
  await page.goto('/assets/DRL-003');
  const issueEntriesBefore = await effectiveIssueEntries(page).count();

  await page.goto('/issue?assetId=DRL-003');
  await waitForHydration(page);
  await chooseKeeper(page);
  await expect(page.getByLabel('Asset', { exact: true })).toHaveValue('DRL-003');
  await page.getByLabel('Worker', { exact: true }).selectOption('WKR-008');

  await page.getByRole('button', { name: 'Record issue' }).dblclick();

  const result = page.getByRole('status').filter({ hasText: 'Issued · DRL-003' });
  await expect(result).toBeVisible();
  const effectiveTimeText = await result.locator('time').first().innerText();

  await page.goto('/assets/DRL-003');
  await expect(effectiveIssueEntries(page)).toHaveCount(issueEntriesBefore + 1);
  await expect(effectiveIssueEntries(page).filter({ hasText: effectiveTimeText })).toHaveCount(1);
});
