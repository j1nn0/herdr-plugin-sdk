import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import type { EnvSource } from '@j1nn0/herdr-plugin-sdk';
import {
  createMockHerdrClient,
  createPluginEnvFixture,
  createPluginEventFixture,
} from '@j1nn0/herdr-plugin-sdk/testing';
import { handleEvent } from './handle-event.js';

test('a done event acts and reads recent pane output', async () => {
  const client = createMockHerdrClient({
    paneReads: { 'w1G:p4': 'last output\n' },
  });

  const result = await handleEvent(eventEnvironment('done'), client);

  assert.deepEqual(result, {
    acted: true,
    report: null,
    paneOutput: 'last output\n',
  });
  assert.deepEqual(client.calls, [
    {
      operation: 'pane.read',
      target: 'w1G:p4',
      options: { source: 'recent', lines: 10 },
    },
  ]);
});

test('a working event does not act', async () => {
  const client = createMockHerdrClient({
    paneReads: { 'w1G:p4': 'must not be read' },
  });

  const result = await handleEvent(eventEnvironment('working'), client);

  assert.deepEqual(result, { acted: false, report: null, paneOutput: null });
  assert.deepEqual(client.calls, []);
});

test('a malformed event is reported without acting', async () => {
  const client = createMockHerdrClient();
  const env = createPluginEnvFixture({
    HERDR_PLUGIN_EVENT: 'pane.agent_status_changed',
    HERDR_PLUGIN_EVENT_JSON: '{not-json',
  });

  const result = await handleEvent(env, client);

  assert.equal(result.acted, false);
  assert.match(result.report ?? '', /HERDR_PLUGIN_EVENT_JSON/u);
  assert.equal(result.paneOutput, null);
  assert.deepEqual(client.calls, []);
});

test('an absent event payload is ignored', async () => {
  const client = createMockHerdrClient();

  const result = await handleEvent(createPluginEnvFixture(), client);

  assert.deepEqual(result, { acted: false, report: null, paneOutput: null });
  assert.deepEqual(client.calls, []);
});

function eventEnvironment(status: 'done' | 'working'): EnvSource {
  return createPluginEnvFixture({
    HERDR_PLUGIN_EVENT: 'pane.agent_status_changed',
    HERDR_PLUGIN_EVENT_JSON: JSON.stringify(
      createPluginEventFixture({ data: { agent_status: status } }),
    ),
  });
}
