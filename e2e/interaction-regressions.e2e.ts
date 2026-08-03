import { expect, test, type Page } from '@playwright/test';
import {
  type ApiResponder,
  captureVisualQa,
  closeApiFixture as closeFixture,
  launchApiFixture,
  sse,
  textResponse,
  toolResponse,
} from './support/electron';

async function launchFixture(
  responder: ApiResponder<Record<string, unknown>>,
) {
  return launchApiFixture('deepseek-interactions-e2e-', responder);
}

async function sendMessage(page: Page, message: string): Promise<void> {
  const composer = page.getByTestId('chat-input-composer').locator('textarea');
  await composer.fill(message);
  await composer.press('Enter');
}

test('sidebar section action placement and resize guide are measurable in the rendered app', async () => {
  const fixture = await launchFixture(() => textResponse('unused'));
  try {
    const { page } = fixture;
    const projectHeading = page.getByRole('heading', { name: 'Projects' });
    const conversationHeading = page.getByRole('heading', { name: 'Conversations' });
    await expect(projectHeading).toBeVisible();
    await expect(conversationHeading).toBeVisible();

    const metrics = await page.evaluate(() => {
      const sidebar = document.querySelector('.sidebar-surface');
      const projectAction = document.querySelector('button[title="Add project"]');
      const conversationAction = document.querySelector('button[title="New conversation"]');
      const resizeHandle = document.querySelector('button.sidebar-resize-handle');
      const indicator = resizeHandle?.querySelector('.sidebar-resize-indicator');
      if (!sidebar || !projectAction || !conversationAction || !resizeHandle || !indicator) return null;

      const bounds = (element: Element) => {
        const rect = element.getBoundingClientRect();
        return { left: rect.left, right: rect.right, width: rect.width };
      };
      return {
        sidebar: bounds(sidebar),
        projectAction: bounds(projectAction),
        conversationAction: bounds(conversationAction),
        resizeHandle: bounds(resizeHandle),
        indicator: {
          width: getComputedStyle(indicator).width,
          backgroundColor: getComputedStyle(indicator).backgroundColor,
        },
      };
    });
    expect(metrics).not.toBeNull();
    if (!metrics) throw new Error('Sidebar layout metrics were not available');
    expect(metrics.projectAction.right).toBeGreaterThanOrEqual(metrics.resizeHandle.left - 16);
    expect(metrics.conversationAction.right).toBeGreaterThanOrEqual(metrics.resizeHandle.left - 16);
    expect(metrics.projectAction.right).toBe(metrics.conversationAction.right);

    await page.locator('button.sidebar-resize-handle').hover();
    const sidebarIndicator = page.locator('button.sidebar-resize-handle .sidebar-resize-indicator');
    const hoveredIndicator = await sidebarIndicator.evaluate((element) => ({
      width: getComputedStyle(element).width,
      backgroundColor: getComputedStyle(element).backgroundColor,
    }));
    await expect(sidebarIndicator).not.toHaveClass(/group-hover:/);
    await expect(sidebarIndicator).toHaveClass(/group-active:/);
    expect(hoveredIndicator.width).toBe('1px');
    expect(hoveredIndicator.backgroundColor).toMatch(/rgba\(0, 0, 0, 0\)|oklab\(0 0 0 \/ 0\)/);
  } finally {
    await closeFixture(fixture);
  }
});

test('Plan mode is selected from the plus menu and closes from its microphone-adjacent badge', async () => {
  const fixture = await launchFixture(() => textResponse('unused'));
  try {
    const { page } = fixture;
    await page.getByRole('button', { name: 'More options' }).click();
    await page.getByRole('menuitem', { name: 'Plan' }).click();

    const badge = page.getByTestId('plan-mode-indicator');
    await expect(badge).toHaveText(/Plan/);
    const microphone = page.getByRole('button', { name: 'Voice input' });
    const toolbarOrder = await microphone.evaluate((mic, badgeTestId) => {
      const badgeElement = document.querySelector(`[data-testid="${badgeTestId}"]`);
      if (!badgeElement) return null;
      return mic.compareDocumentPosition(badgeElement) & Node.DOCUMENT_POSITION_FOLLOWING;
    }, 'plan-mode-indicator');
    expect(toolbarOrder).toBeTruthy();
    await captureVisualQa(page, 'plan-mode-indicator');

    await badge.hover();
    await page.getByRole('button', { name: 'Close plan mode' }).click();
    await expect(badge).toHaveCount(0);

    await page.getByRole('button', { name: 'More options' }).click();
    await page.getByRole('menuitem', { name: 'Plan' }).click();
    await expect(page.getByTestId('plan-mode-indicator')).toBeVisible();
    await page.getByRole('button', { name: 'More options' }).click();
    await page.getByRole('menuitem', { name: 'Plan' }).click();
    await expect(page.getByTestId('plan-mode-indicator')).toHaveCount(0);
  } finally {
    await closeFixture(fixture);
  }
});

test('completed ask_user_question rows expand to show questions, options, answers, and status', async () => {
  const question = 'Which implementation should be used?';
  const fixture = await launchFixture((requestIndex) => (
    requestIndex === 1
      ? toolResponse('question-1', 'ask_user_question', {
          questions: [{
            question,
            header: 'Approach',
            options: [
              { label: 'Robust', description: 'Use the maintainable implementation.' },
              { label: 'Minimal', description: 'Make only the smallest change.' },
            ],
            multiSelect: false,
          }],
        })
      : textResponse('Question handled')
  ));
  try {
    const { page } = fixture;
    await sendMessage(page, 'Ask me before implementing');
    await expect(page.getByText('Your choice is needed')).toBeVisible();
    await page.getByRole('button', { name: /Robust/ }).click();
    await page.getByRole('button', { name: 'Submit' }).click();
    await expect(page.getByText('Question handled')).toBeVisible();

    await page.getByTestId('processed-summary-toggle').click();
    const row = page.getByTestId('tool-item-row').filter({ hasText: 'Asked' });
    await row.click();
    const detail = page.getByTestId('ask-user-question-detail');
    await expect(detail).toContainText(question);
    await expect(detail).toContainText('Robust');
    await expect(detail).toContainText('Minimal');
    await expect(detail).toContainText('User selection');
    await expect(detail).toContainText('Completed');
    await captureVisualQa(page, 'ask-user-question-detail');
  } finally {
    await closeFixture(fixture);
  }
});

test('approval options default to the first item, wrap with arrow keys, and execute with Enter', async () => {
  const fixture = await launchFixture((requestIndex) => (
    requestIndex === 1
      ? toolResponse('approval-1', 'bash_exec', {
          command: 'printf keyboard-approval',
          description: 'Validate keyboard approval',
        })
      : textResponse('Keyboard approval handled')
  ));
  try {
    const { page } = fixture;
    await sendMessage(page, 'Run the keyboard approval fixture');
    const panel = page.getByTestId('approval-panel');
    await expect(panel).toBeVisible();
    const options = panel.getByTestId('approval-option');
    await expect(options.nth(0)).toHaveAttribute('aria-pressed', 'true');

    await panel.press('ArrowUp');
    await expect(options.nth(2)).toHaveAttribute('aria-pressed', 'true');
    await panel.press('ArrowDown');
    await expect(options.nth(0)).toHaveAttribute('aria-pressed', 'true');
    await panel.press('ArrowDown');
    await expect(options.nth(1)).toHaveAttribute('aria-pressed', 'true');
    await expect(options.nth(0)).toHaveAttribute('aria-pressed', 'false');
    await captureVisualQa(page, 'approval-keyboard-selection');
    await panel.press('Enter');
    await expect(page.getByText('Keyboard approval handled')).toBeVisible();
  } finally {
    await closeFixture(fixture);
  }
});

test('Tab opens rejection feedback, Enter inserts a newline, and Mod+Enter submits', async () => {
  const fixture = await launchFixture((requestIndex) => (
    requestIndex === 1
      ? toolResponse('approval-reject-1', 'bash_exec', {
          command: 'printf should-not-run',
          description: 'Validate rejection feedback input',
        })
      : textResponse('Rejection handled')
  ));
  try {
    const { page, requests } = fixture;
    await sendMessage(page, 'Run the rejection fixture');
    const panel = page.getByTestId('approval-panel');
    await panel.press('ArrowDown');
    await panel.press('ArrowDown');
    await panel.press('Tab');

    const feedback = page.getByPlaceholder('Optional: tell the AI what to do instead…');
    await expect(feedback).toBeFocused();
    await feedback.fill('Keep the first line');
    await feedback.press('Enter');
    await feedback.type('Add the second line');
    await expect(feedback).toHaveValue('Keep the first line\nAdd the second line');
    expect(requests).toHaveLength(1);
    await captureVisualQa(page, 'approval-rejection-feedback');

    await feedback.press(process.platform === 'darwin' ? 'Meta+Enter' : 'Control+Enter');
    await expect(page.getByText('Rejection handled')).toBeVisible();
    expect(JSON.stringify(requests[1])).toContain('Keep the first line\\nAdd the second line');
  } finally {
    await closeFixture(fixture);
  }
});

test('streaming does not pull the viewport back down after the user scrolls up', async () => {
  const initialText = Array.from({ length: 100 }, (_, index) => `Initial stream line ${index}`).join('\n\n');
  const continuedText = Array.from({ length: 100 }, (_, index) => `Continued stream line ${index}`).join('\n\n');
  const fixture = await launchFixture((requestIndex, _body, response) => {
    if (requestIndex !== 1) return textResponse('unused');

    response.write(sse([
      { type: 'message_start', message: { usage: { input_tokens: 10, output_tokens: 0 } } },
      { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
      { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: `${initialText}\n\n` } },
    ]));

    const continuationTimer = setTimeout(() => {
      response.end(sse([
        { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: `${continuedText}\n\nSTREAM_FINISHED_MARKER` } },
        { type: 'content_block_stop', index: 0 },
        { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 200 } },
        { type: 'message_stop' },
      ]));
    }, 5_000);
    response.once('close', () => clearTimeout(continuationTimer));
    return undefined;
  });

  try {
    const { page } = fixture;
    await sendMessage(page, 'Generate a long streaming response');
    const panel = page.locator('.chat-panel');

    await expect.poll(() => panel.evaluate((element) => (
      element.scrollHeight - element.clientHeight
    ))).toBeGreaterThan(500);
    await expect.poll(() => panel.evaluate((element) => (
      element.scrollHeight - element.scrollTop - element.clientHeight
    ))).toBeLessThan(5);

    await panel.evaluate(async (element) => {
      element.dispatchEvent(new WheelEvent('wheel', { deltaY: -30 }));
      element.scrollBy(0, -30);
      await new Promise<void>((resolveFrame) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolveFrame()));
      });
    });
    await expect.poll(() => panel.evaluate((element) => (
      element.scrollHeight - element.scrollTop - element.clientHeight
    ))).toBeGreaterThan(2);
    const distanceAfterUserInput = await panel.evaluate((element) => (
      element.scrollHeight - element.scrollTop - element.clientHeight
    ));
    expect(distanceAfterUserInput).toBeLessThan(120);
    const readViewportAnchor = () => panel.evaluate((element) => {
      const viewport = element.getBoundingClientRect();
      const sampleY = viewport.top + Math.min(160, viewport.height / 3);
      const paragraphs = [...element.querySelectorAll('p')];
      const paragraph = paragraphs.find((candidate) => {
        const bounds = candidate.getBoundingClientRect();
        return bounds.top <= sampleY && bounds.bottom >= sampleY;
      });
      return paragraph?.textContent?.trim() ?? null;
    });
    const viewportAnchorAfterUserInput = await readViewportAnchor();
    expect(viewportAnchorAfterUserInput).toMatch(/^Initial stream line/);

    await expect(page.getByText('STREAM_FINISHED_MARKER')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: 'Send' })).toBeVisible();
    const finalDistanceToBottom = await panel.evaluate((element) => (
      element.scrollHeight - element.scrollTop - element.clientHeight
    ));
    const finalViewportAnchor = await readViewportAnchor();

    expect(finalViewportAnchor).toBe(viewportAnchorAfterUserInput);
    expect(finalDistanceToBottom).toBeGreaterThan(20);
  } finally {
    await closeFixture(fixture);
  }
});

test('chat messages fade beneath the header edge in light and dark themes', async () => {
  const longReply = Array.from({ length: 80 }, (_, index) => `Fade boundary line ${index}`).join('\n\n');
  const fixture = await launchFixture(() => textResponse(longReply));

  try {
    const { page } = fixture;
    await sendMessage(page, 'Generate enough content to scroll beneath the header');
    const panel = page.locator('.chat-panel');
    await expect.poll(() => panel.evaluate((element) => element.scrollHeight - element.clientHeight)).toBeGreaterThan(300);
    await panel.evaluate((element) => {
      element.dispatchEvent(new WheelEvent('wheel', { deltaY: -60 }));
      element.scrollBy(0, -60);
    });

    const fade = page.getByTestId('chat-top-fade');
    await expect(fade).toBeVisible();
    await expect(fade).toHaveCSS('height', '20px');
    await expect(fade).toHaveCSS('pointer-events', 'none');
    await expect(fade).toHaveCSS('background-image', /linear-gradient/);
    await captureVisualQa(page, 'chat-top-fade-light');

    await page.evaluate(() => document.documentElement.classList.add('dark'));
    await expect(fade).toHaveCSS('background-image', /linear-gradient/);
    await captureVisualQa(page, 'chat-top-fade-dark');
  } finally {
    await closeFixture(fixture);
  }
});
