import { expect, test } from '@playwright/test';
import {
  captureVisualQa,
  closeApiFixture,
  launchApiFixture,
  textResponse,
  toolResponse,
} from './support/electron';

test('task progress expands into a read-only checklist anchored to its trigger', async () => {
  const fixture = await launchApiFixture('deepseek-task-progress-e2e-', (requestIndex) => (
    requestIndex === 1
      ? toolResponse('task-progress-plan', 'update_plan', {
          plan: [
            { step: 'Inspect the todo data source', status: 'completed' },
            { step: 'Update the panel layout', status: 'in_progress' },
            { step: 'Test the narrow viewport', status: 'pending' },
            { step: 'Run regression checks', status: 'pending' },
          ],
        })
      : textResponse('Continue with the task list.')
  ));

  try {
    const { page } = fixture;
    const runtimeErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') runtimeErrors.push(message.text());
    });
    page.on('pageerror', (error) => runtimeErrors.push(error.message));

    const composer = page.getByTestId('chat-input-composer').locator('textarea');
    await composer.fill('Run a task with multiple steps');
    await composer.press('Enter');

    const accessory = page.getByTestId('task-progress-accessory');
    const trigger = accessory.locator('button');
    await expect(trigger).toBeVisible();
    await expect(trigger).toContainText('Step 2 / 4');
    await expect(trigger).toHaveAttribute('aria-label', 'Expand task list');
    await trigger.hover();

    const panel = page.getByTestId('task-progress-panel');
    await expect(panel).toBeVisible();
    await expect(panel.locator('[data-todo-status="completed"]')).toHaveCount(1);
    await expect(panel.locator('[data-todo-status="in_progress"]')).toHaveCount(1);
    await expect(panel.locator('[data-todo-status="pending"]')).toHaveCount(2);
    const panelWidth = await panel.evaluate((element) => element.getBoundingClientRect().width);
    expect(panelWidth).toBeGreaterThan(0);
    expect(panelWidth).toBeLessThan(320);
    await expect(panel).toHaveCSS('border-radius', '12px');
    await expect(panel).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await expect(panel.getByTestId('task-progress-item').first().locator('span').last()).toHaveCSS('font-size', '13px');

    await page.waitForTimeout(250);
    await captureVisualQa(page, 'task-progress-expanded', 200);
    const geometry = await Promise.all([trigger.boundingBox(), panel.boundingBox()]);
    expect(geometry[0]).not.toBeNull();
    expect(geometry[1]).not.toBeNull();
    expect(Math.abs((geometry[0]!.x + geometry[0]!.width / 2) - (geometry[1]!.x + geometry[1]!.width / 2))).toBeLessThan(1);
    expect(geometry[1]!.y + geometry[1]!.height).toBeLessThanOrEqual(geometry[0]!.y);

    await page.setViewportSize({ width: 520, height: 700 });
    await trigger.hover();
    await page.waitForTimeout(250);
    const narrowPanel = await panel.boundingBox();
    expect(narrowPanel).not.toBeNull();
    expect(narrowPanel!.x).toBeGreaterThanOrEqual(16);
    expect(narrowPanel!.x + narrowPanel!.width).toBeLessThanOrEqual(504);
    expect(runtimeErrors).toEqual([]);

  } finally {
    await closeApiFixture(fixture);
  }
});

test('task progress caps long checklist text and wraps it inside the hover panel', async () => {
  const fixture = await launchApiFixture('deepseek-task-progress-long-e2e-', (requestIndex) => (
    requestIndex === 1
      ? toolResponse('task-progress-long-plan', 'update_plan', {
          plan: [{
            step: 'Inspect the complete task progress checklist, including all data sources, layout behavior, responsive wrapping, and regression coverage before finishing',
            status: 'in_progress',
          }],
        })
      : textResponse('Continue with the checklist.')
  ));

  try {
    const { page } = fixture;
    const composer = page.getByTestId('chat-input-composer').locator('textarea');
    await composer.fill('Run a long checklist');
    await composer.press('Enter');

    const accessory = page.getByTestId('task-progress-accessory');
    const trigger = accessory.locator('button');
    await expect(trigger).toContainText('Step 1 / 1');
    await trigger.hover();

    const panel = page.getByTestId('task-progress-panel');
    await expect(panel).toBeVisible();
    const panelBox = await panel.boundingBox();
    expect(panelBox).not.toBeNull();
    expect(panelBox!.width).toBe(320);

    const itemBox = await panel.getByTestId('task-progress-item').boundingBox();
    expect(itemBox).not.toBeNull();
    expect(itemBox!.height).toBeGreaterThan(18);
  } finally {
    await closeApiFixture(fixture);
  }
});
