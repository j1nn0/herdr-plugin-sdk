import { describe, expect, it } from 'vitest';
import type { EnvSource, HerdrClient, Pane } from '../src/index.js';
import { isPaneAgentStatusChanged, readPluginEvent, readPluginRuntime } from '../src/index.js';
import { createMockHerdrClient, createPluginEnvFixture } from '../src/testing/index.js';

interface CompletionSummary {
  readonly paneId: string;
  readonly agent: string | null;
  readonly status: 'done';
  readonly preview: string;
}

describe('example plugin business logic', () => {
  it('summarizes a completed pane using only a fixture environment and mock client', async () => {
    const pane = panePayload();
    const client = createMockHerdrClient({
      panes: { 'w1G:p4': pane },
      paneReads: { 'w1G:p4': 'finished output\n' },
    });

    await expect(summarizeCompletedPane(eventEnvironment('done'), client)).resolves.toEqual({
      paneId: 'w1G:p4',
      agent: 'pi',
      status: 'done',
      preview: 'finished output\n',
    });
    expect(client.calls).toEqual([
      { operation: 'pane.get', target: 'w1G:p4', options: null },
      {
        operation: 'pane.read',
        target: 'w1G:p4',
        options: { source: 'recent', lines: 20 },
      },
    ]);
  });

  it('leaves statuses outside the example policy untouched', async () => {
    const client = createMockHerdrClient({
      panes: { 'w1G:p4': panePayload() },
      paneReads: { 'w1G:p4': 'should not be read' },
    });

    await expect(summarizeCompletedPane(eventEnvironment('working'), client)).resolves.toBeNull();
    expect(client.calls).toEqual([]);
  });
});

async function summarizeCompletedPane(
  env: EnvSource,
  client: HerdrClient,
): Promise<CompletionSummary | null> {
  const runtime = readPluginRuntime(env);
  if (runtime.invocation.kind !== 'event') {
    return null;
  }

  const event = readPluginEvent(env);
  if (event === null || !isPaneAgentStatusChanged(event)) {
    return null;
  }
  if (event.data.agent_status !== 'done') {
    return null;
  }

  const pane = await client.pane.get(event.data.pane_id);
  const recentOutput = await client.pane.read(event.data.pane_id, {
    source: 'recent',
    lines: 20,
  });
  return {
    paneId: pane.pane_id,
    agent: pane.agent ?? null,
    status: 'done',
    preview: recentOutput,
  };
}

function eventEnvironment(status: 'done' | 'working'): EnvSource {
  return createPluginEnvFixture({
    HERDR_PLUGIN_EVENT: 'pane.agent_status_changed',
    HERDR_PLUGIN_EVENT_JSON: JSON.stringify(createPluginEventFixtureForStatus(status)),
  });
}

function createPluginEventFixtureForStatus(status: 'done' | 'working') {
  return {
    event: 'pane_agent_status_changed',
    data: {
      type: 'pane_agent_status_changed',
      pane_id: 'w1G:p4',
      workspace_id: 'w1G',
      agent_status: status,
      agent: 'pi',
    },
  };
}

function panePayload(): Pane {
  return {
    pane_id: 'w1G:p4',
    terminal_id: 'term-4',
    workspace_id: 'w1G',
    tab_id: 'w1G:t1',
    focused: true,
    agent_status: 'done',
    revision: 1,
    agent: 'pi',
  };
}
