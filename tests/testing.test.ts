import { describe, expect, expectTypeOf, it } from 'vitest';
/* oxlint-disable max-lines */
import type {
  Agent,
  HerdrClient,
  HerdrCommandExecutor,
  HerdrCommandRequest,
  HerdrCommandResult,
  Pane,
  PaneForegroundProcess,
  PaneProcessInfo,
  PluginContext,
  Tab,
  TabCreateOptions,
  TabCreateResult,
  Workspace,
} from '../src/index.js';
import {
  HerdrCliError,
  HerdrError,
  createHerdrClient,
  isHerdrCliError,
  isPaneAgentStatusChanged,
  readPluginContext,
  readPluginEvent,
  readPluginRuntime,
} from '../src/index.js';
import {
  createAgentGetOutputFixture,
  createAgentFixture,
  createCliErrorOutputFixture,
  createPaneGetOutputFixture,
  createPaneProcessInfoOutputFixture,
  createPaneFixture,
  createPaneListOutputFixture,
  createPluginContextFixture,
  createPluginEnvFixture,
  createPluginEventFixture,
  createPluginPaneCloseOutputFixture,
  createPluginPaneOpenOutputFixture,
  createRecordingExecutor,
  createTabListOutputFixture,
  createTabCreateOutputFixture,
  createTabFixture,
  createTabRenameOutputFixture,
  createWorkspaceListOutputFixture,
  createWorkspaceFixture,
  createWorkspaceRenameOutputFixture,
  createMockHerdrClient,
  serializeCliOutput,
  type MockHerdrCall,
  type MockHerdrClient,
  type MockHerdrClientSetup,
  type RecordedHerdrCommand,
} from '../src/testing/index.js';
import * as testing from '../src/testing/index.js';

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

  it('records run argv and uses configured stdout or errors', async () => {
    const argv = ['plugin', 'pane', 'open', '--plugin', 'example.plugin'];
    const stdout = '  output\n🌍 你好\n';
    const client = createMockHerdrClient({
      run: (receivedArgv) => {
        expect(receivedArgv).toEqual(argv);
        return stdout;
      },
    });

    await expect(client.run(argv)).resolves.toBe(stdout);
    expect(client.calls).toEqual([{ operation: 'cli.run', target: null, options: null, argv }]);

    const error = new Error('configured run failure');
    const failingClient = createMockHerdrClient({ run: () => error });
    await expect(failingClient.run(argv)).rejects.toBe(error);
  });

  it('returns an empty string for an unconfigured run', async () => {
    const client = createMockHerdrClient();

    await expect(client.run(['plugin', 'list'])).resolves.toBe('');
  });

  it('snapshots run argv in the recorded call history', async () => {
    const argv = ['plugin', 'list'];
    const client = createMockHerdrClient({ run: () => 'output' });
    await client.run(argv);

    const returnedArgv = client.calls[0]?.argv as string[];
    returnedArgv.push('mutated');

    expect(client.calls[0]?.argv).toEqual(argv);
  });
});

describe('testing fixtures', () => {
  it('creates protocol-valid success and error output envelopes', () => {
    expect(createAgentGetOutputFixture()).toEqual({
      id: 'fixture:agent:get',
      result: { type: 'agent_info', agent: createAgentFixture() },
    });
    expect(createPaneGetOutputFixture()).toEqual({
      id: 'fixture:pane:get',
      result: { type: 'pane_info', pane: createPaneFixture() },
    });
    expect(createWorkspaceListOutputFixture()).toEqual({
      id: 'fixture:workspace:list',
      result: { type: 'workspace_list', workspaces: [createWorkspaceFixture()] },
    });
    expect(createTabListOutputFixture()).toEqual({
      id: 'fixture:tab:list',
      result: { type: 'tab_list', tabs: [createTabFixture()] },
    });
    expect(createCliErrorOutputFixture()).toEqual({
      id: 'fixture:error',
      error: { code: 'pane_not_found', message: 'Pane "w1G:p404" not found.' },
    });
  });

  it('supports payload and identifier overrides without mutating them', () => {
    const payload = { title: 'overridden', extra_field: { preserved: true } };
    const error = { code: 'agent_not_found', message: 'Agent "w1G:p404" not found.' };

    expect(createAgentGetOutputFixture({ id: 'custom-id', payload })).toEqual({
      id: 'custom-id',
      result: { type: 'agent_info', agent: { ...createAgentFixture(), ...payload } },
    });
    expect(createCliErrorOutputFixture({ id: 'error-id', ...error })).toEqual({
      id: 'error-id',
      error,
    });
    expect(payload).toEqual({ title: 'overridden', extra_field: { preserved: true } });
    expect(error).toEqual({ code: 'agent_not_found', message: 'Agent "w1G:p404" not found.' });
  });

  it('serializes output envelopes with exactly one protocol trailing newline', () => {
    const envelope = createTabListOutputFixture({ id: 'tab-output' });
    expect(serializeCliOutput(envelope)).toBe(`${JSON.stringify(envelope)}\n`);
  });

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

  it('consumes serialized success and stderr error fixtures through the executor seam', async () => {
    const success = createAgentGetOutputFixture({ payload: { pane_id: 'agent-1' } });
    const successClient = createHerdrClient({
      env: {},
      executor: () => Promise.resolve(commandResult(serializeCliOutput(success))),
    });
    await expect(successClient.agent.get('agent-1')).resolves.toEqual(success.result.agent);

    const error = createCliErrorOutputFixture({
      code: 'agent_not_found',
      message: 'Agent "agent-404" not found.',
    });
    const errorClient = createHerdrClient({
      env: {},
      executor: () =>
        Promise.resolve(commandResult('', { stderr: serializeCliOutput(error), exitCode: 1 })),
    });
    await expect(errorClient.agent.get('agent-404')).rejects.toMatchObject({
      code: 'agent_not_found',
      exitCode: 1,
    });
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
      return Promise.resolve(
        commandResult(
          serializeCliOutput(createAgentGetOutputFixture({ payload: resources.agent })),
        ),
      );
    }
    if (namespace === 'pane' && command === 'get') {
      return Promise.resolve(
        commandResult(serializeCliOutput(createPaneGetOutputFixture({ payload: resources.pane }))),
      );
    }
    if (namespace === 'workspace' && command === 'list') {
      return Promise.resolve(
        commandResult(
          serializeCliOutput(createWorkspaceListOutputFixture({ payload: resources.workspace })),
        ),
      );
    }
    if (namespace === 'tab' && command === 'list') {
      return Promise.resolve(
        commandResult(serializeCliOutput(createTabListOutputFixture({ payload: resources.tab }))),
      );
    }
    return Promise.reject(new Error(`Unexpected fixture command: ${request.argv.join(' ')}`));
  };
}

function commandResult(
  stdout = '',
  overrides: Partial<HerdrCommandResult> = {},
): HerdrCommandResult {
  return {
    stdout,
    stderr: '',
    exitCode: 0,
    signal: null,
    timedOut: false,
    ...overrides,
  };
}

async function capture(action: () => Promise<unknown>): Promise<unknown> {
  try {
    await action();
  } catch (error) {
    return error;
  }
  throw new Error('Expected action to reject.');
}

describe('v0.3 and v0.4 testing helpers', () => {
  it('builds protocol-shaped fixtures with pinned result discriminators and override payloads', () => {
    const pane = createPaneFixture({ pane_id: 'pane-opened', label: 'Widget' });
    const open = createPluginPaneOpenOutputFixture({ id: 'custom-open', payload: pane });
    expect(open).toEqual({
      id: 'custom-open',
      result: {
        type: 'plugin_pane_opened',
        plugin_pane: { plugin_id: 'example.plugin', entrypoint: 'widget', pane },
      },
    });
    expectTypeOf(open.result.type).toEqualTypeOf<'plugin_pane_opened'>();

    const closed = createPluginPaneCloseOutputFixture({ payload: { pane_id: 'pane-closed' } });
    expect(closed).toEqual({
      id: 'fixture:plugin-pane:close',
      result: { type: 'plugin_pane_closed', pane_id: 'pane-closed' },
    });
    expectTypeOf(closed.result.type).toEqualTypeOf<'plugin_pane_closed'>();

    expect(createPaneListOutputFixture()).toMatchObject({
      id: 'fixture:pane:list',
      result: { type: 'pane_list', panes: [createPaneFixture()] },
    });

    const paneListOverride = createPaneListOutputFixture({ id: 'custom-pane-list', payload: pane });
    expect(paneListOverride).toEqual({
      id: 'custom-pane-list',
      result: { type: 'pane_list', panes: [pane] },
    });
    expect(createPluginPaneOpenOutputFixture()).toMatchObject({
      id: 'fixture:plugin-pane:open',
      result: { type: 'plugin_pane_opened' },
    });
    const tab = createTabFixture({ label: 'Renamed tab' });
    expect(createTabRenameOutputFixture({ payload: tab })).toEqual({
      id: 'fixture:tab:rename',
      result: { type: 'tab_info', tab },
    });
    const workspace = createWorkspaceFixture({ label: 'Renamed workspace' });
    expect(createWorkspaceRenameOutputFixture({ payload: workspace })).toEqual({
      id: 'fixture:workspace:rename',
      result: { type: 'workspace_info', workspace },
    });

    for (const fixture of [
      open,
      closed,
      createPaneListOutputFixture(),
      createTabRenameOutputFixture(),
      createWorkspaceRenameOutputFixture(),
    ]) {
      expect(serializeCliOutput(fixture)).toBe(`${JSON.stringify(fixture)}\n`);
    }
  });

  it('exports v0.4 fixtures and types from the public testing and package entrypoints', () => {
    const processInfo = createPaneProcessInfoOutputFixture({
      id: 'custom-process-info',
      payload: { pane_id: 'process-pane', future_field: { preserved: true } },
    });
    expect(processInfo).toMatchObject({
      id: 'custom-process-info',
      result: {
        type: 'pane_process_info',
        process_info: { pane_id: 'process-pane', future_field: { preserved: true } },
      },
    });
    expectTypeOf(processInfo.result.type).toEqualTypeOf<'pane_process_info'>();

    const tabCreate = createTabCreateOutputFixture({
      id: 'custom-tab-create',
      tab: { label: 'Created tab' },
      rootPane: { pane_id: 'root-pane' },
    });
    expect(tabCreate).toMatchObject({
      id: 'custom-tab-create',
      result: {
        type: 'tab_created',
        tab: { label: 'Created tab' },
        root_pane: { pane_id: 'root-pane' },
      },
    });
    expectTypeOf(tabCreate.result.type).toEqualTypeOf<'tab_created'>();
    expect(createPaneProcessInfoOutputFixture).toBeTypeOf('function');
    expect(createTabCreateOutputFixture).toBeTypeOf('function');
    expect(testing).not.toHaveProperty('createPaneProcessInfoFixture');
    expect(testing).not.toHaveProperty('createForegroundProcessFixture');
    expect(testing).not.toHaveProperty('createProcessInfoFixture');
    expect(testing).not.toHaveProperty('createProcessFixture');

    const foregroundProcess: PaneForegroundProcess = {
      pid: 123,
      name: 'node',
      argv: null,
      future_process_field: true,
    };
    const paneProcessInfo: PaneProcessInfo = {
      pane_id: 'p',
      foreground_processes: [foregroundProcess],
    };
    const tabOptions: TabCreateOptions = {
      workspaceId: 'w',
      cwd: '/workspace',
      label: '',
      env: { MODE: 'test' },
      focus: false,
    };
    const tabResult: TabCreateResult = {
      tab: createTabFixture(),
      rootPane: createPaneFixture(),
    };
    expectTypeOf(paneProcessInfo).toEqualTypeOf<PaneProcessInfo>();
    expectTypeOf(tabOptions).toEqualTypeOf<TabCreateOptions>();
    expectTypeOf(tabResult).toEqualTypeOf<TabCreateResult>();
    expect(serializeCliOutput(processInfo)).toBe(`${JSON.stringify(processInfo)}\n`);
    expect(serializeCliOutput(tabCreate)).toBe(`${JSON.stringify(tabCreate)}\n`);
  });

  it('records binary path, argv, timeout, and zero-based sync-or-async responder indexes', async () => {
    const recording = createRecordingExecutor((command, index) =>
      index === 0
        ? commandResult(`sync:${command.argv.join(' ')}`)
        : Promise.resolve(commandResult(`async:${index}`)),
    );
    const request = recordingRequest({
      binPath: '/custom/herdr',
      argv: ['pane', 'list'],
      timeoutMs: 4321,
      env: { PRIVATE_VALUE: 'must not be recorded' },
    });
    const first = await recording.executor(request);
    const second = await recording.executor({ ...request, argv: ['pane', 'get', 'p'] });

    expect(first.stdout).toBe('sync:pane list');
    expect(second.stdout).toBe('async:1');
    expect(recording.calls).toEqual([
      { binPath: '/custom/herdr', argv: ['pane', 'list'], timeoutMs: 4321 },
      { binPath: '/custom/herdr', argv: ['pane', 'get', 'p'], timeoutMs: 4321 },
    ]);
    expect(recording.calls[0]).not.toHaveProperty('env');
  });

  it('defaults to silent success and snapshots argv both on input and when read back', async () => {
    const recording = createRecordingExecutor();
    const argv = ['custom', 'operation'];
    const request = recordingRequest({ argv });
    await expect(recording.executor(request)).resolves.toEqual({
      stdout: '',
      stderr: '',
      exitCode: 0,
      signal: null,
      timedOut: false,
    });
    argv.push('caller-mutated');
    expect(recording.calls[0]?.argv).toEqual(['custom', 'operation']);

    const snapshot = recording.calls as RecordedHerdrCommand[];
    const snapshotArgv = snapshot[0]?.argv;
    if (snapshotArgv === undefined) {
      throw new Error('Expected a recorded argv snapshot.');
    }
    (snapshotArgv as string[]).push('snapshot-mutated');
    expect(recording.calls[0]?.argv).toEqual(['custom', 'operation']);
    recording.reset();
    expect(recording.calls).toEqual([]);
  });

  it('records all new mock operations and defensively copies nested option objects and arrays', async () => {
    const pane = createPaneFixture({ pane_id: 'pane-1' });
    const tab = createTabFixture({ tab_id: 'tab-1' });
    const workspace = createWorkspaceFixture({ workspace_id: 'workspace-1' });
    const closeFailure = new Error('configured close failure');
    const metadataFailure = new Error('configured metadata failure');
    const openOptions = {
      pluginId: 'example.widget',
      entrypoint: 'widget',
      env: { WIDGET_MODE: 'ready' },
      focus: false,
    };
    const reportOptions = {
      source: 'plugin:example.widget',
      tokens: { status: 'ready' },
      clearTokens: ['old-status'],
    };
    const client = createMockHerdrClient({
      paneList: [pane],
      pluginPaneOpen: pane,
      pluginPaneCloseErrors: { 'pane-1': closeFailure },
      paneReportMetadataErrors: { 'pane-1': metadataFailure },
      tabRenames: { 'tab-1': tab },
      workspaceRenames: { 'workspace-1': workspace },
    });

    await expect(client.pane.list({ workspaceId: 'w1G' })).resolves.toEqual([pane]);
    await expect(client.plugin.pane.open(openOptions)).resolves.toEqual(pane);
    await expect(client.plugin.pane.close('pane-1')).rejects.toBe(closeFailure);
    await expect(client.plugin.pane.close('unconfigured-close')).resolves.toBeUndefined();
    await expect(client.pane.reportMetadata('pane-1', reportOptions)).rejects.toBe(metadataFailure);
    await expect(
      client.pane.reportMetadata('unconfigured-report', { source: 'source', title: 'title' }),
    ).resolves.toBeUndefined();
    await expect(client.tab.rename('tab-1', 'Label with spaces')).resolves.toEqual(tab);
    await expect(client.workspace.rename('workspace-1', '')).resolves.toEqual(workspace);

    openOptions.env.WIDGET_MODE = 'mutated';
    reportOptions.tokens.status = 'mutated';
    reportOptions.clearTokens.push('mutated');
    expect(client.calls).toEqual([
      { operation: 'pane.list', target: null, options: { workspaceId: 'w1G' } },
      {
        operation: 'plugin.pane.open',
        target: null,
        options: {
          pluginId: 'example.widget',
          entrypoint: 'widget',
          env: { WIDGET_MODE: 'ready' },
          focus: false,
        },
      },
      { operation: 'plugin.pane.close', target: 'pane-1', options: null },
      { operation: 'plugin.pane.close', target: 'unconfigured-close', options: null },
      {
        operation: 'pane.reportMetadata',
        target: 'pane-1',
        options: {
          source: 'plugin:example.widget',
          tokens: { status: 'ready' },
          clearTokens: ['old-status'],
        },
      },
      {
        operation: 'pane.reportMetadata',
        target: 'unconfigured-report',
        options: { source: 'source', title: 'title' },
      },
      { operation: 'tab.rename', target: 'tab-1', options: { label: 'Label with spaces' } },
      { operation: 'workspace.rename', target: 'workspace-1', options: { label: '' } },
    ]);

    const snapshot = client.calls as MockHerdrCall[];
    const openCall = snapshot[1];
    const reportCall = snapshot[4];
    if (
      openCall === undefined ||
      openCall.options === null ||
      reportCall === undefined ||
      reportCall.options === null
    ) {
      throw new Error('Expected recorded option snapshots.');
    }
    (openCall.options.env as Record<string, string>).WIDGET_MODE = 'snapshot mutation';
    (reportCall.options.clearTokens as string[]).push('snapshot mutation');
    expect(client.calls[1]?.options?.env).toEqual({ WIDGET_MODE: 'ready' });
    expect(client.calls[4]?.options?.clearTokens).toEqual(['old-status']);
  });

  it('uses documented defaults and rejects unconfigured open and rename responses with HerdrError', async () => {
    const client = createMockHerdrClient();
    await expect(client.pane.list()).resolves.toEqual([]);
    await expect(client.plugin.pane.close('pane')).resolves.toBeUndefined();
    await expect(
      client.pane.reportMetadata('pane', { source: 'source', title: 'title' }),
    ).resolves.toBeUndefined();

    for (const action of [
      () => client.plugin.pane.open({ pluginId: 'p', entrypoint: 'e' }),
      () => client.tab.rename('tab', 'label'),
      () => client.workspace.rename('workspace', 'label'),
    ]) {
      const error = await capture(action);
      expect(error).toBeInstanceOf(HerdrError);
      expect(error).not.toBeInstanceOf(HerdrCliError);
      expect((error as Error).message).toMatch(/Mock setup is missing/u);
    }
    expect(client.calls.map(({ operation }) => operation)).toEqual([
      'pane.list',
      'plugin.pane.close',
      'pane.reportMetadata',
      'plugin.pane.open',
      'tab.rename',
      'workspace.rename',
    ]);
  });

  it('honors configured errors for new mock operations and reports missing setup without fabrication', async () => {
    const openFailure = new Error('open failed');
    const tabFailure = new Error('tab rename failed');
    const workspaceFailure = new Error('workspace rename failed');
    const listFailure = new Error('pane list failed');
    const closeFailure = new Error('close failed');
    const metadataFailure = new Error('metadata failed');
    const client = createMockHerdrClient({
      paneList: listFailure,
      pluginPaneOpen: openFailure,
      pluginPaneCloseErrors: { pane: closeFailure },
      paneReportMetadataErrors: { pane: metadataFailure },
      tabRenames: { tab: tabFailure },
      workspaceRenames: { workspace: workspaceFailure },
    });
    await expect(client.pane.list()).rejects.toBe(listFailure);
    await expect(client.plugin.pane.open({ pluginId: 'p', entrypoint: 'e' })).rejects.toBe(
      openFailure,
    );
    await expect(client.plugin.pane.close('pane')).rejects.toBe(closeFailure);
    await expect(client.pane.reportMetadata('pane', { source: 's', title: 't' })).rejects.toBe(
      metadataFailure,
    );
    await expect(client.tab.rename('tab', 'label')).rejects.toBe(tabFailure);
    await expect(client.workspace.rename('workspace', 'label')).rejects.toBe(workspaceFailure);

    const missingTab = await capture(() => client.tab.rename('missing', 'label'));
    const missingWorkspace = await capture(() => client.workspace.rename('missing', 'label'));
    expect(missingTab).toBeInstanceOf(HerdrError);
    expect(missingWorkspace).toBeInstanceOf(HerdrError);
    expect((missingTab as Error).message).toContain('tabRenames');
    expect((missingWorkspace as Error).message).toContain('workspaceRenames');
  });

  it('supports process-info lookups and tab creation with defensive snapshots', async () => {
    const processInfo = createPaneProcessInfoOutputFixture().result.process_info;
    const configuredTab = createTabFixture({ tab_id: 'created-tab' });
    const configuredRootPane = createPaneFixture({ pane_id: 'created-root' });
    const configuredResult: TabCreateResult = { tab: configuredTab, rootPane: configuredRootPane };
    const processFailure = new Error('configured process-info failure');
    const options = { workspaceId: 'workspace-1', label: 'Created', env: { MODE: 'ready' } };
    const client = createMockHerdrClient({
      paneProcessInfo: { 'pane-1': processInfo, 'failed-pane': processFailure },
      tabCreate: configuredResult,
    });

    const processInfoCopy = await client.pane.processInfo('pane-1');
    expect(processInfoCopy).toEqual(processInfo);
    expect(processInfoCopy).not.toBe(processInfo);
    const processes = processInfoCopy.foreground_processes as PaneForegroundProcess[];
    processes[0]!.name = 'mutated';
    (processes[0]!.argv as string[]).push('mutated');
    expect(processInfo.foreground_processes?.[0]?.name).toBe('node');
    expect(processInfo.foreground_processes?.[0]?.argv).not.toContain('mutated');

    await expect(client.pane.processInfo('absent-pane')).rejects.toMatchObject({
      operation: 'pane.processInfo',
      code: 'pane_not_found',
      argv: ['pane', 'process-info', '--pane', 'absent-pane'],
    });
    await expect(client.pane.processInfo('failed-pane')).rejects.toBe(processFailure);

    const createdPromise = client.tab.create(options);
    options.env.MODE = 'mutated';
    const created = await createdPromise;
    expect(created).toEqual(configuredResult);
    expect(created.tab).not.toBe(configuredTab);
    expect(created.rootPane).not.toBe(configuredRootPane);
    (created.tab as { tab_id: string }).tab_id = 'mutated-tab';
    (created.rootPane as { pane_id: string }).pane_id = 'mutated-pane';
    expect(configuredTab.tab_id).toBe('created-tab');
    expect(configuredRootPane.pane_id).toBe('created-root');
    expect(client.calls).toEqual([
      { operation: 'pane.processInfo', target: 'pane-1', options: null },
      { operation: 'pane.processInfo', target: 'absent-pane', options: null },
      { operation: 'pane.processInfo', target: 'failed-pane', options: null },
      {
        operation: 'tab.create',
        target: null,
        options: { workspaceId: 'workspace-1', label: 'Created', env: { MODE: 'ready' } },
      },
    ]);

    const tabFailure = new Error('configured tab creation failure');
    const failedClient = createMockHerdrClient({ tabCreate: tabFailure });
    await expect(failedClient.tab.create()).rejects.toBe(tabFailure);

    const missingClient = createMockHerdrClient();
    const missingError = await capture(() => missingClient.tab.create());
    expect(missingError).toBeInstanceOf(HerdrError);
    expect((missingError as Error).message).toContain('tabCreate');
    expect(missingClient.calls).toEqual([{ operation: 'tab.create', target: null, options: null }]);
  });
  it('keeps both factories assignable to the expanded required client contracts', () => {
    const typed: HerdrClient = createHerdrClient();
    const mock: MockHerdrClient = createMockHerdrClient();
    const mockAsClient: HerdrClient = mock;
    expectTypeOf(typed).toMatchTypeOf<HerdrClient>();
    expectTypeOf(mock).toMatchTypeOf<MockHerdrClient>();
    expectTypeOf(mockAsClient).toMatchTypeOf<HerdrClient>();
    expect(typed.agent.get).toBeTypeOf('function');
    expect(mock.agent.get).toBeTypeOf('function');
    expect(typed.agent.read).toBeTypeOf('function');
    expect(mock.agent.read).toBeTypeOf('function');
    expect(typed.pane.get).toBeTypeOf('function');
    expect(mock.pane.get).toBeTypeOf('function');
    expect(typed.pane.read).toBeTypeOf('function');
    expect(mock.pane.read).toBeTypeOf('function');
    expect(typed.workspace.list).toBeTypeOf('function');
    expect(mock.workspace.list).toBeTypeOf('function');
    expect(typed.tab.list).toBeTypeOf('function');
    expect(mock.tab.list).toBeTypeOf('function');
    expect(typed.run).toBeTypeOf('function');
    expect(mock.run).toBeTypeOf('function');
    expect(typed.pane.processInfo).toBeTypeOf('function');
    expect(typed.tab.create).toBeTypeOf('function');
    expect(mock.pane.processInfo).toBeTypeOf('function');
    expect(mock.tab.create).toBeTypeOf('function');
    expect(mock.plugin.pane.open).toBeTypeOf('function');
    expect(mock.plugin.pane.close).toBeTypeOf('function');
    expect(mock.pane.list).toBeTypeOf('function');
    expect(mock.pane.reportMetadata).toBeTypeOf('function');
    expect(mock.tab.rename).toBeTypeOf('function');
    expect(mock.workspace.rename).toBeTypeOf('function');
  });
});

function recordingRequest(overrides: Partial<HerdrCommandRequest> = {}): HerdrCommandRequest {
  return {
    binPath: 'herdr',
    argv: ['pane', 'list'],
    timeoutMs: 10_000,
    maxBuffer: 1024,
    env: { HERDR_ENV: '1' },
    ...overrides,
  };
}
