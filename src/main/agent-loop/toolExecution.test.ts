import { describe, expect, it } from 'vitest';
import type { AgentLoopCallbacks, ToolCall } from '../../shared/types';
import { ToolRegistry, type ToolExecutor } from '../tools/types';
import { executeToolCallsParallel } from './toolExecution';

function call(id: string, name: string): ToolCall {
  return {
    id,
    type: 'function',
    function: { name, arguments: '{}' },
  };
}

function callbacks(onStart?: (name: string) => void): AgentLoopCallbacks {
  return {
    onChunk: () => undefined,
    onReasoningChunk: () => undefined,
    onToolCallStart: (toolCall) => onStart?.(toolCall.function.name),
    onToolCallEnd: () => undefined,
    onDone: () => undefined,
    onError: () => undefined,
  };
}

function register(
  registry: ToolRegistry,
  name: string,
  execute: ToolExecutor['execute'],
  isConcurrencySafe: boolean,
): void {
  registry.register({
    definition: {
      name,
      description: `${name} test tool`,
      input_schema: { type: 'object', properties: {} },
    },
    isConcurrencySafe,
    execute,
  });
}

describe('tool execution scheduling', () => {
  it('runs a contiguous batch of concurrency-safe tools together before the next mutation', async () => {
    const registry = new ToolRegistry();
    const events: string[] = [];
    let safeStarted = 0;
    let releaseSafe!: () => void;
    const safeBarrier = new Promise<void>((resolve) => { releaseSafe = resolve; });

    for (const name of ['safe_a', 'safe_b']) {
      register(registry, name, async () => {
        events.push(`${name}:start`);
        safeStarted++;
        if (safeStarted === 2) releaseSafe();
        await safeBarrier;
        events.push(`${name}:end`);
        return { content: name };
      }, true);
    }
    register(registry, 'write', async () => {
      events.push('write:start');
      return { content: 'write' };
    }, false);

    await executeToolCallsParallel(
      [call('1', 'safe_a'), call('2', 'safe_b'), call('3', 'write')],
      registry,
      { projectPath: '/tmp/project', approvalPolicy: 'auto-approve' },
      callbacks(),
    );

    expect(events.slice(0, 2).sort()).toEqual(['safe_a:start', 'safe_b:start']);
    expect(events.indexOf('write:start')).toBeGreaterThan(events.indexOf('safe_a:end'));
    expect(events.indexOf('write:start')).toBeGreaterThan(events.indexOf('safe_b:end'));
  });

  it('never overlaps tools that are not declared concurrency-safe', async () => {
    const registry = new ToolRegistry();
    let active = 0;
    let maxActive = 0;
    const makeExecutor: ToolExecutor['execute'] = async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await Promise.resolve();
      active--;
      return { content: 'done' };
    };
    register(registry, 'write_a', makeExecutor, false);
    register(registry, 'write_b', makeExecutor, false);

    await executeToolCallsParallel(
      [call('1', 'write_a'), call('2', 'write_b')],
      registry,
      { projectPath: '/tmp/project', approvalPolicy: 'auto-approve' },
      callbacks(),
    );

    expect(maxActive).toBe(1);
  });

  it('does not start a tool after the request has already been aborted', async () => {
    const registry = new ToolRegistry();
    let executed = false;
    register(registry, 'write', async () => {
      executed = true;
      return { content: 'unexpected' };
    }, false);
    const controller = new AbortController();
    controller.abort();

    const [pair] = await executeToolCallsParallel(
      [call('1', 'write')],
      registry,
      { projectPath: '/tmp/project', approvalPolicy: 'auto-approve' },
      callbacks(),
      controller.signal,
    );

    expect(executed).toBe(false);
    expect(pair.result.error).toBe(true);
    expect(pair.result.content).toContain('[Aborted]');
  });
});
