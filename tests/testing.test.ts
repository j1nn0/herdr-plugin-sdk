import { describe, expect, it } from 'vitest';
/* oxlint-disable max-lines */
import type {
  Agent,
  HerdrCommandExecutor,
  HerdrCommandResult,
  Pane,
  PluginContext,
  Tab,
  Workspace,
} from '../src/index.js';
import {
  HerdrCliError,
  createHerdrClient,
  isHerdrCliError,
  isPaneAgentStatusChanged,
  readPluginContext,
  readPluginEvent,
  readPluginRuntime,
} from '../src/index.js';
import {
  createAgentFixture,
  createPaneFixture,
  createPluginContextFixture,
  createPluginEnvFixture,
  createPluginEventFixture,
  createTabFixture,
  createWorkspaceFixture,
  createMockHerdrClient,
  type MockHerdrCall,
  type MockHerdrClientSetup,
} from '../src/testing/index.js';

describe('mock Herdr client', () => {
  it('rejects unconfigured agent and pane lookups and reads with not-found errors', async () => {
    const client = createMockHerdrClient();

    const agentGetError = await capture(() => client.agent.get('w1G:p404'));
    expect(agentGetError).toBeInstanceOf(HerdrCliError);
    expect(isHerdrCliError(agentGetError, 'agent_not_found')).toBe(true);
    expect(agentGetError).toMatchObject({
      operation: 'agent.get',
      argv: ['agent', 'get', 'w1G:p404'],
      exitCode: 1,
    });

    const agentReadError = await capture(() =>
      client.agent.read('w1G:p404', { source: 'recent', lines: 5, format: 'text' }),
    );
    expect(isHerdrCliError(agentReadError, 'agent_not_found')).toBe(true);
    expect(agentReadError).toMatchObject({
      operation: 'agent.read',
      argv: ['agent', 'read', 'w1G:p404', '--source', 'recent', '--lines', '5', '--format', 'text'],
      exitCode: 1,
    });

    const paneGetError = await capture(() => client.pane.get('w1G:p404'));
    expect(isHerdrCliError(paneGetError, 'pane_not_found')).toBe(true);
    expect(paneGetError).toMatchObject({
      operation: 'pane.get',
      argv: ['pane', 'get', 'w1G:p404'],
      exitCode: 1,
    });

    const paneReadError = await capture(() => client.pane.read('w1G:p404'));
    expect(isHerdrCliError(paneReadError, 'pane_not_found')).toBe(true);
    expect(paneReadError).toMatchObject({
      operation: 'pane.read',
      argv: ['pane', 'read', 'w1G:p404'],
      exitCode: 1,
    });
  });

  it('throws configured errors, including HerdrCliError instances', async () => {
    const processError = new Error('configured process failure');
    const cliError = new HerdrCliError({
      code: 'configured_cli_failure',
      message: 'configured CLI failure',
      operation: 'fixture',
      argv: ['fixture'],
      exitCode: 7,
    });
    const client = createMockHerdrClient({
      agents: { 'agent-1': processError },
      panes: { 'pane-1': cliError },
      agentReads: { 'agent-1': cliError },
      paneReads: { 'pane-1': processError },
      workspaces: processError,
      tabs: cliError,
    });

    await expect(client.agent.get('agent-1')).rejects.toBe(processError);
    await expect(client.pane.get('pane-1')).rejects.toBe(cliError);
    await expect(client.agent.read('agent-1')).rejects.toBe(cliError);
    await expect(client.pane.read('pane-1')).rejects.toBe(processError);
    await expect(client.workspace.list()).rejects.toBe(processError);
    await expect(client.tab.list()).rejects.toBe(cliError);
  });

  it('records all operations in order, including a call that throws', async () => {
    const agent = createAgentFixture({ pane_id: 'agent-1' });
    const pane = createPaneFixture({ pane_id: 'pane-1' });
    const workspace = createWorkspaceFixture();
    const tab = createTabFixture();
    const failure = new Error('read failed');
    const client = createMockHerdrClient({
      agents: { 'agent-1': agent },
      panes: { 'pane-1': pane },
      agentReads: { 'agent-1': 'agent output' },
      paneReads: { 'pane-1': failure },
      workspaces: [workspace],
      tabs: [tab],
    });

    await client.agent.get('agent-1');
    await client.agent.read('agent-1', { source: 'recent', lines: 4, format: 'ansi' });
    await client.pane.get('pane-1');
    await expect(client.pane.read('pane-1', { source: 'visible' })).rejects.toBe(failure);
    await client.workspace.list();
    await client.tab.list({ workspaceId: 'w1G' });

    expect(client.calls).toEqual([
      { operation: 'agent.get', target: 'agent-1', options: null },
      {
        operation: 'agent.read',
        target: 'agent-1',
        options: { source: 'recent', lines: 4, format: 'ansi' },
      },
      { operation: 'pane.get', target: 'pane-1', options: null },
      { operation: 'pane.read', target: 'pane-1', options: { source: 'visible' } },
      { operation: 'workspace.list', target: null, options: null },
      { operation: 'tab.list', target: null, options: { workspaceId: 'w1G' } },
    ]);
  });

  it('returns a snapshot-safe call history and supports reset', async () => {
    const client = createMockHerdrClient({ agentReads: { p1: 'output' } });
    await client.agent.read('p1', { lines: 2 });

    const returnedCalls = client.calls as MockHerdrCall[];
    returnedCalls.length = 0;
    expect(client.calls).toEqual([
      { operation: 'agent.read', target: 'p1', options: { lines: 2 } },
    ]);

    client.reset();
    expect(client.calls).toEqual([]);
  });

  it('keeps clients made from one setup independent', async () => {
    const setup: MockHerdrClientSetup = { agentReads: { p1: 'same output' } };
    const first = createMockHerdrClient(setup);
    const second = createMockHerdrClient(setup);

    await first.agent.read('p1');
    expect(first.calls).toHaveLength(1);
    expect(second.calls).toEqual([]);

    second.reset();
    expect(first.calls).toHaveLength(1);
  });

  it('filters tabs by workspace only when requested', async () => {
    const first = createTabFixture();
    const second = createTabFixture({ tab_id: 'w2:t1', workspace_id: 'w2' });
    const client = createMockHerdrClient({ tabs: [first, second] });

    await expect(client.tab.list({ workspaceId: 'w1G' })).resolves.toEqual([first]);
    await expect(client.tab.list()).resolves.toEqual([first, second]);
  });

  it('returns empty arrays for unconfigured list operations', async () => {
    const client = createMockHerdrClient();

    await expect(client.workspace.list()).resolves.toEqual([]);
    await expect(client.tab.list()).resolves.toEqual([]);
  });

  it('returns configured read output byte-for-byte', async () => {
    const outputs = {
      leading: '  \t leading\n',
      blank: 'first\n\n\nthird\n',
      unicode: '🌍 你好，世界\n🙂 漢字',
      json: '{"error":{"code":"x","message":"y"},"id":"z"}',
    };
    const client = createMockHerdrClient({ agentReads: outputs });

    for (const [target, output] of Object.entries(outputs)) {
      await expect(client.agent.read(target)).resolves.toBe(output);
    }
  });
});

describe('testing fixtures', () => {
  it('creates a valid default environment with an unknown invocation', () => {
    const env = createPluginEnvFixture();
    const runtime = readPluginRuntime(env);
    const context = readPluginContext(env);

    expect(runtime.invocation).toEqual({ kind: 'unknown' });
    expect(context).toEqual(createPluginContextFixture());
    expect(env.HERDR_ENV).toBe('1');
    expect(env.HERDR_BIN_PATH).toBeTruthy();
    expect(env.HERDR_SOCKET_PATH).toBeTruthy();
    expect(env.HERDR_WORKSPACE_ID).toBe('w1G');
    expect(env.HERDR_TAB_ID).toBe('w1G:t1');
    expect(env.HERDR_PANE_ID).toBe('w1G:p1');
    expect(env).not.toHaveProperty('HERDR_PLUGIN_EVENT');
    expect(env).not.toHaveProperty('HERDR_PLUGIN_EVENT_JSON');
    expect(env).not.toHaveProperty('HERDR_PLUGIN_ACTION_ID');
    expect(env).not.toHaveProperty('HERDR_PLUGIN_ENTRYPOINT_ID');
  });

  it('creates an event environment that the real event parser narrows', () => {
    const eventFixture = createPluginEventFixture();
    const env = createPluginEnvFixture({
      HERDR_PLUGIN_EVENT: 'pane.agent_status_changed',
      HERDR_PLUGIN_EVENT_JSON: JSON.stringify(eventFixture),
    });

    expect(readPluginRuntime(env).invocation).toEqual({
      kind: 'event',
      event: 'pane.agent_status_changed',
    });
    const event = readPluginEvent(env);
    expect(event).toEqual({
      event: 'pane_agent_status_changed',
      name: 'pane.agent_status_changed',
      data: {
        type: 'pane_agent_status_changed',
        pane_id: 'w1G:p4',
        workspace_id: 'w1G',
        agent_status: 'done',
        agent: 'pi',
      },
    });
    if (event === null || !isPaneAgentStatusChanged(event)) {
      throw new Error('Expected a pane agent status change event.');
    }
    expect(event.data.agent_status).toBe('done');
    expect(event.data.pane_id).toBe('w1G:p4');
  });

  it('passes every resource fixture through real client validation', async () => {
    const resources = {
      agent: createAgentFixture(),
      pane: createPaneFixture(),
      workspace: createWorkspaceFixture(),
      tab: createTabFixture(),
    };
    const client = createHerdrClient({
      env: {},
      executor: fixtureExecutor(resources),
    });

    await expect(client.agent.get(resources.agent.pane_id)).resolves.toEqual(resources.agent);
    await expect(client.pane.get(resources.pane.pane_id)).resolves.toEqual(resources.pane);
    await expect(client.workspace.list()).resolves.toEqual([resources.workspace]);
    await expect(client.tab.list()).resolves.toEqual([resources.tab]);
  });

  it('does not mutate any fixture override object', () => {
    const agentOverrides: Partial<Agent> = { title: 'override agent' };
    const paneOverrides: Partial<Pane> = { label: 'override pane' };
    const workspaceOverrides: Partial<Workspace> = { label: 'override workspace' };
    const tabOverrides: Partial<Tab> = { label: 'override tab' };
    const contextOverrides: Partial<PluginContext> = {
      worktree: { repo_name: 'override repository' },
    };
    const envOverrides = { HERDR_PLUGIN_ID: 'override.plugin' };
    const eventOverrides = {
      event: 'custom.event',
      data: { value: 'unchanged' },
    };
    const before = [
      JSON.stringify(agentOverrides),
      JSON.stringify(paneOverrides),
      JSON.stringify(workspaceOverrides),
      JSON.stringify(tabOverrides),
      JSON.stringify(contextOverrides),
      JSON.stringify(envOverrides),
      JSON.stringify(eventOverrides),
    ];

    createAgentFixture(agentOverrides);
    createPaneFixture(paneOverrides);
    createWorkspaceFixture(workspaceOverrides);
    createTabFixture(tabOverrides);
    createPluginContextFixture(contextOverrides);
    createPluginEnvFixture(envOverrides);
    createPluginEventFixture(eventOverrides);

    expect([
      JSON.stringify(agentOverrides),
      JSON.stringify(paneOverrides),
      JSON.stringify(workspaceOverrides),
      JSON.stringify(tabOverrides),
      JSON.stringify(contextOverrides),
      JSON.stringify(envOverrides),
      JSON.stringify(eventOverrides),
    ]).toEqual(before);
  });
});

function fixtureExecutor(resources: {
  readonly agent: Agent;
  readonly pane: Pane;
  readonly workspace: Workspace;
  readonly tab: Tab;
}): HerdrCommandExecutor {
  return (request) => {
    const [namespace, command] = request.argv;
    if (namespace === 'agent' && command === 'get') {
      return Promise.resolve(commandResult(envelope('agent_info', 'agent', resources.agent)));
    }
    if (namespace === 'pane' && command === 'get') {
      return Promise.resolve(commandResult(envelope('pane_info', 'pane', resources.pane)));
    }
    if (namespace === 'workspace' && command === 'list') {
      return Promise.resolve(
        commandResult(envelope('workspace_list', 'workspaces', [resources.workspace])),
      );
    }
    if (namespace === 'tab' && command === 'list') {
      return Promise.resolve(commandResult(envelope('tab_list', 'tabs', [resources.tab])));
    }
    return Promise.reject(new Error(`Unexpected fixture command: ${request.argv.join(' ')}`));
  };
}

function commandResult(stdout = ''): HerdrCommandResult {
  return {
    stdout,
    stderr: '',
    exitCode: 0,
    signal: null,
    timedOut: false,
  };
}

function envelope(type: string, payloadKey: string, payload: unknown): string {
  return JSON.stringify({
    id: 'fixture:test',
    result: { [payloadKey]: payload, type },
  });
}

async function capture(action: () => Promise<unknown>): Promise<unknown> {
  try {
    await action();
  } catch (error) {
    return error;
  }
  throw new Error('Expected action to reject.');
}
