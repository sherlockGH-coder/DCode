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
            { step: '确认待办清单的数据来源与展示状态', status: 'completed' },
            { step: '调整展开面板的尺寸、间距、阴影和颜色', status: 'in_progress' },
            { step: '验证长文本换行及窄窗口定位', status: 'pending' },
            { step: '运行类型检查和界面回归测试', status: 'pending' },
          ],
        })
      : textResponse('继续执行待办事项。')
  ));

  try {
    const { page } = fixture;
    const runtimeErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') runtimeErrors.push(message.text());
    });
    page.on('pageerror', (error) => runtimeErrors.push(error.message));

    const composer = page.getByTestId('chat-input-composer').locator('textarea');
    await composer.fill('执行一个包含多个步骤的任务');
    await composer.press('Enter');

    const accessory = page.getByTestId('task-progress-accessory');
    const trigger = accessory.locator('button');
    await expect(trigger).toBeVisible();
    await trigger.hover();

    const panel = page.getByTestId('task-progress-panel');
    await expect(panel).toBeVisible();
    await expect(panel.locator('[data-todo-status="completed"]')).toHaveCount(1);
    await expect(panel.locator('[data-todo-status="in_progress"]')).toHaveCount(1);
    await expect(panel.locator('[data-todo-status="pending"]')).toHaveCount(2);
    await expect(panel).toHaveCSS('width', '320px');
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
