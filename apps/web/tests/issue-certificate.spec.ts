import { expect, test } from '@playwright/test';
import { chooseKeeper } from './helpers';

test('issuing GAS-005 to WKR-007 shows the API certificate-expired message', async ({ page }) => {
  await page.goto('/issue?assetId=GAS-005');
  await chooseKeeper(page);
  await page.getByLabel('Worker', { exact: true }).selectOption('WKR-007');

  await page.getByRole('button', { name: 'Record issue' }).click();

  const refusal = page.getByRole('status').filter({ hasText: 'The store refused this' });
  await expect(refusal).toContainText('Liam Doherty (WKR-007) cannot receive GAS-005');
  await expect(refusal).toContainText(/Gas Detection certification expired on \d{4}-\d{2}-\d{2}/);
});
