import { expect, test, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { chooseKeeper, waitForHydration } from './helpers';

async function openIssueFormFor(page: Page, assetId: string): Promise<void> {
  await page.goto(`/issue?assetId=${assetId}`);
  await waitForHydration(page);
  await chooseKeeper(page);
}

async function effectiveIssueCount(page: Page, assetId: string): Promise<number> {
  const response = await page.request.get(`http://localhost:4000/assets/${assetId}/history`);
  const history = (await response.json()) as {
    movements: Array<{ movement: { type: string; supersededByCorrectionId: string | null } }>;
  };
  return history.movements.filter(
    (entry) => entry.movement.type === 'issue' && !entry.movement.supersededByCorrectionId,
  ).length;
}

test('two tabs issuing the same asset leave exactly one holder', async ({ context }) => {
  execFileSync('npm', ['run', 'seed', '-s'], { cwd: '../..', stdio: 'ignore' });
  const probe = await context.newPage();
  const before = await effectiveIssueCount(probe, 'HARN-014');

  const tabs = [await context.newPage(), await context.newPage()];
  await openIssueFormFor(tabs[0]!, 'HARN-014');
  await openIssueFormFor(tabs[1]!, 'HARN-014');
  await tabs[0]!.getByLabel('Worker', { exact: true }).selectOption('WKR-001');
  await tabs[1]!.getByLabel('Worker', { exact: true }).selectOption('WKR-002');

  await Promise.all(tabs.map((tab) => tab.getByRole('button', { name: 'Record issue' }).click()));

  const issued = await Promise.all(tabs.map((tab) => tab.getByText('Issued · HARN-014').count()));
  const refused = await Promise.all(
    tabs.map((tab) => tab.getByText('The store refused this').count()),
  );
  expect(issued.filter((count) => count > 0)).toHaveLength(1);
  expect(refused.filter((count) => count > 0)).toHaveLength(1);
  expect(await effectiveIssueCount(probe, 'HARN-014')).toBe(before + 1);
});
