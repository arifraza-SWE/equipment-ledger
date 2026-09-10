import { expect, test, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { chooseKeeper, waitForHydration } from './helpers';

async function effectiveIssueCount(page: Page, assetId: string): Promise<number> {
  const response = await page.request.get(`http://localhost:4000/assets/${assetId}/history`);
  const history = (await response.json()) as {
    movements: Array<{ movement: { type: string; supersededByCorrectionId: string | null } }>;
  };
  return history.movements.filter(
    (entry) => entry.movement.type === 'issue' && !entry.movement.supersededByCorrectionId,
  ).length;
}

test('an unreachable API never leaves the screen claiming a movement', async ({ page }) => {
  execFileSync('npm', ['run', 'seed', '-s'], { cwd: '../..', stdio: 'ignore' });
  const before = await effectiveIssueCount(page, 'LAD-001');

  await page.goto('/issue?assetId=LAD-001');
  await waitForHydration(page);
  await chooseKeeper(page);
  await page.getByLabel('Worker', { exact: true }).selectOption('WKR-008');

  await page.route('**/movements/issues', (route) => route.abort('failed'));
  await page.getByRole('button', { name: 'Record issue' }).click();

  await expect(page.getByText('did not confirm')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('Issued · LAD-001')).toHaveCount(0);
  expect(await effectiveIssueCount(page, 'LAD-001')).toBe(before);

  // The store comes back and the keeper presses the button again. The key was kept, so the
  // retry is the same logical request and lands once.
  await page.unroute('**/movements/issues');
  await page.getByRole('button', { name: 'Record issue' }).click();
  await expect(page.getByText('Issued · LAD-001')).toBeVisible({ timeout: 10_000 });
  expect(await effectiveIssueCount(page, 'LAD-001')).toBe(before + 1);
});
