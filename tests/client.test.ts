import { describe, expect, it } from 'vitest';
/* oxlint-disable max-lines */
import type {
  Agent,
  HerdrCommandExecutor,
  HerdrCommandRequest,
  HerdrCommandResult,
  Pane,
  ReadOptions,
  Tab,
  Workspace,
} from '../src/index.js';
import {
  HerdrCliError,
  HerdrError,
  HerdrProcessError,
  HerdrResponseError,
  HerdrTimeoutError,
  createHerdrClient,
  isHerdrCliError,
} from '../src/index.js';

const agentPayload: Agent = {
  pane_id: 'w1G:p7',
  terminal_id: 'term-7',
  workspace_id: 'w1G',
  tab_id: 'w1G:t1',
  focused: true,
  agent_status: 'working',
  revision: 12,
  agent: 'pi',
  display_agent: 'pi',
  name: 'assistant',
  title: 'SDK work',
  cwd: '/workspace',
  agent_session: {
    agent: 'pi',
    kind: 'id',
    source: 'process',
    value: 'session-7',
  },
  extra_agent_field: { preserved: true },
};

const panePayload: Pane = {
  pane_id: 'w1G:p7',
  terminal_id: 'term-7',
  workspace_id: 'w1G',
  tab_id: 'w1G:t1',
  focused: true,
  agent_status: 'working',
  revision: 13,
  label: 'main',
  scroll: {
    max_offset_from_bottom: 20,
    offset_from_bottom: 0,
    viewport_rows: 40,
  },
  extra_pane_field: 'preserved',
};

const workspacePayload: Workspace = {
  workspace_id: 'w1G',
  active_tab_id: 'w1G:t1',
  label: 'herdr-plugin-sdk',
  number: 1,
  pane_count: 2,
  tab_count: 1,
  agent_status: 'working',
  focused: true,
  extra_workspace_field: ['preserved'],
};

const tabPayload: Tab = {
  tab_id: 'w1G:t1',
  workspace_id: 'w1G',
  label: 'agents',
  number: 1,
  pane_count: 2,
  agent_status: 'working',
  focused: true,
  extra_tab_field: 42,
};

function result(stdout = '', overrides: Partial<HerdrCommandResult> = {}): HerdrCommandResult {
  return {
    stdout,
    stderr: '',
    exitCode: 0,
    signal: null,
    timedOut: false,
    ...overrides,
  };
}

function envelope(type: string, payloadKey: string, payload: unknown): string {
  return JSON.stringify({
    id: `cli:test:${type}`,
    result: { [payloadKey]: payload, type },
  });
}

function responseFor(request: HerdrCommandRequest): HerdrCommandResult {
  const [namespace, command] = request.argv;
  if (command === 'read') {
    return result('read output');
  }

  if (namespace === 'agent') {
    return result(envelope('agent_info', 'agent', agentPayload));
  }
  if (namespace === 'pane') {
    return result(envelope('pane_info', 'pane', panePayload));
  }
  if (namespace === 'workspace') {
    return result(envelope('workspace_list', 'workspaces', [workspacePayload]));
  }
  return result(envelope('tab_list', 'tabs', [tabPayload]));
}

function fakeExecutor(responder: (request: HerdrCommandRequest) => HerdrCommandResult): {
  readonly executor: HerdrCommandExecutor;
  readonly requests: HerdrCommandRequest[];
} {
  const requests: HerdrCommandRequest[] = [];
  const executor: HerdrCommandExecutor = (request) => {
    requests.push(request);
    return responder(request);
  };
  return { executor, requests };
}

describe('Herdr client argv construction', () => {
  it('uses one argv token per argument for every operation', async () => {
    const { executor, requests } = fakeExecutor(responseFor);
    const client = createHerdrClient({ executor, env: {} });
    const dangerousTarget = 'pane; rm -rf / $(whoami)';

    await client.agent.get(dangerousTarget);
    await client.agent.read(dangerousTarget, {
      source: 'visible',
      lines: 7,
      format: 'ansi',
    });
    await client.pane.get('w1G:p7');
    await client.pane.read('w1G:p7', {
      source: 'recent-unwrapped',
      lines: 0,
      format: 'text',
    });
    await client.workspace.list();
    await client.tab.list({ workspaceId: 'w1G;$(workspace)' });

    expect(requests.map(({ argv }) => argv)).toEqual([
      ['agent', 'get', dangerousTarget],
      ['agent', 'read', dangerousTarget, '--source', 'visible', '--lines', '7', '--format', 'ansi'],
      ['pane', 'get', 'w1G:p7'],
      [
        'pane',
        'read',
        'w1G:p7',
        '--source',
        'recent-unwrapped',
        '--lines',
        '0',
        '--format',
        'text',
      ],
      ['workspace', 'list'],
      ['tab', 'list', '--workspace', 'w1G;$(workspace)'],
    ]);
    expect(requests.every(({ argv }) => Array.isArray(argv))).toBe(true);
    expect(requests[0]?.argv).toContain(dangerousTarget);
    expect(requests[0]?.argv).not.toContain('agent get');
    expect(requests[1]?.argv).not.toContain('agent read');
  });

  it.each([
    ['none', {}],
    ['source', { source: 'visible' }],
    ['lines', { lines: 3 }],
    ['format', { format: 'ansi' }],
    ['source and lines', { source: 'recent' as const, lines: 0 }],
    ['source and format', { source: 'detection' as const, format: 'text' as const }],
    ['lines and format', { lines: 12, format: 'ansi' as const }],
    ['all options', { source: 'recent-unwrapped' as const, lines: 99, format: 'text' as const }],
  ])('appends only provided read options: %s', async (_name, options) => {
    const { executor, requests } = fakeExecutor(() => result('output'));
    const client = createHerdrClient({ executor, env: {} });

    await client.agent.read('w1G:p7', options as ReadOptions);

    const expected = ['agent', 'read', 'w1G:p7'];
    const readOptions = options as ReadOptions;
    if (readOptions.source !== undefined) {
      expected.push('--source', readOptions.source);
    }
    if (readOptions.lines !== undefined) {
      expected.push('--lines', String(readOptions.lines));
    }
    if (readOptions.format !== undefined) {
      expected.push('--format', readOptions.format);
    }
    expect(requests[0]?.argv).toEqual(expected);
  });

  it('rejects invalid line counts before invoking the executor', async () => {
    const { executor, requests } = fakeExecutor(() => result('output'));
    const client = createHerdrClient({ executor, env: {} });

    await expect(client.agent.read('w1G:p7', { lines: -1 })).rejects.toBeInstanceOf(HerdrError);
    await expect(client.pane.read('w1G:p7', { lines: 1.5 })).rejects.toBeInstanceOf(HerdrError);
    expect(requests).toHaveLength(0);
  });
});

describe('Herdr client binary resolution', () => {
  it('prefers an explicit path, then HERDR_BIN_PATH, then herdr', async () => {
    const explicit = fakeExecutor(responseFor);
    await createHerdrClient({
      binPath: '/explicit/herdr',
      env: { HERDR_BIN_PATH: '/environment/herdr' },
      executor: explicit.executor,
    }).workspace.list();

    const fromEnvironment = fakeExecutor(responseFor);
    await createHerdrClient({
      env: { HERDR_BIN_PATH: '/environment/herdr' },
      executor: fromEnvironment.executor,
    }).workspace.list();

    const defaultPath = fakeExecutor(responseFor);
    await createHerdrClient({ env: {}, executor: defaultPath.executor }).workspace.list();

    expect(explicit.requests[0]?.binPath).toBe('/explicit/herdr');
    expect(fromEnvironment.requests[0]?.binPath).toBe('/environment/herdr');
    expect(defaultPath.requests[0]?.binPath).toBe('herdr');
  });
});

describe('Herdr client read output', () => {
  it('preserves leading whitespace', async () => {
    const stdout = '  \t  leading\n';
    const { executor } = fakeExecutor(() => result(stdout));
    await expect(createHerdrClient({ executor, env: {} }).agent.read('p1')).resolves.toBe(stdout);
  });

  it('preserves trailing whitespace and a trailing newline', async () => {
    const stdout = 'trailing  \t \n';
    const { executor } = fakeExecutor(() => result(stdout));
    await expect(createHerdrClient({ executor, env: {} }).pane.read('p1')).resolves.toBe(stdout);
  });

  it('preserves interior blank lines', async () => {
    const stdout = 'first\n\n\nthird\n';
    const { executor } = fakeExecutor(() => result(stdout));
    await expect(createHerdrClient({ executor, env: {} }).agent.read('p1')).resolves.toBe(stdout);
  });

  it('preserves Unicode including emoji and CJK', async () => {
    const stdout = '🌍 你好，世界\n🙂 漢字';
    const { executor } = fakeExecutor(() => result(stdout));
    await expect(createHerdrClient({ executor, env: {} }).pane.read('p1')).resolves.toBe(stdout);
  });

  it('returns text that is itself a JSON error envelope', async () => {
    const stdout = '{"error":{"code":"x","message":"y"},"id":"z"}';
    const { executor } = fakeExecutor(() => result(stdout));
    await expect(createHerdrClient({ executor, env: {} }).agent.read('p1')).resolves.toBe(stdout);
  });

  it('preserves a payload of at least 100000 characters', async () => {
    const stdout = 'x'.repeat(100_000);
    const { executor } = fakeExecutor(() => result(stdout));
    await expect(createHerdrClient({ executor, env: {} }).pane.read('p1')).resolves.toBe(stdout);
  });
});

describe('Herdr client structured responses', () => {
  it('parses all resources and preserves unknown resource fields', async () => {
    const { executor } = fakeExecutor(responseFor);
    const client = createHerdrClient({ executor, env: {} });

    await expect(client.agent.get('w1G:p7')).resolves.toEqual(agentPayload);
    await expect(client.pane.get('w1G:p7')).resolves.toEqual(panePayload);
    await expect(client.workspace.list()).resolves.toEqual([workspacePayload]);
    await expect(client.tab.list()).resolves.toEqual([tabPayload]);

    const agent = await client.agent.get('w1G:p7');
    const pane = await client.pane.get('w1G:p7');
    const workspaces = await client.workspace.list();
    const tabs = await client.tab.list();
    expect(agent.extra_agent_field).toEqual({ preserved: true });
    expect(pane.extra_pane_field).toBe('preserved');
    expect(workspaces[0]?.extra_workspace_field).toEqual(['preserved']);
    expect(tabs[0]?.extra_tab_field).toBe(42);
  });
});

describe('Herdr client errors', () => {
  it('maps a structured CLI error and exposes its operation metadata', async () => {
    const { executor } = fakeExecutor(() =>
      result('', {
        stderr:
          '{"error":{"code":"pane_not_found","message":"pane missing"},"id":"cli:pane:get"}\n',
        exitCode: 1,
      }),
    );
    const error = await capture(() =>
      createHerdrClient({ executor, env: {} }).pane.get('w1G:p999'),
    );

    expect(error).toBeInstanceOf(HerdrCliError);
    expect(error).toMatchObject({
      code: 'pane_not_found',
      operation: 'pane.get',
      argv: ['pane', 'get', 'w1G:p999'],
      exitCode: 1,
    });
  });

  it('maps a plain-text usage failure to HerdrProcessError', async () => {
    const stderr = 'unknown command: bogus\n';
    const { executor } = fakeExecutor(() => result('', { stderr, exitCode: 2 }));
    const error = await capture(() => createHerdrClient({ executor, env: {} }).workspace.list());

    expect(error).toBeInstanceOf(HerdrProcessError);
    expect(error).toMatchObject({ operation: 'workspace.list', exitCode: 2, stderr });
  });

  it('maps a spawn failure to HerdrProcessError', async () => {
    const spawnError = new Error('ENOENT');
    const { executor } = fakeExecutor(() => result('', { spawnError, exitCode: null }));
    const error = await capture(() => createHerdrClient({ executor, env: {} }).agent.get('p1'));

    expect(error).toBeInstanceOf(HerdrProcessError);
    expect(error).toMatchObject({ operation: 'agent.get', exitCode: null, cause: spawnError });
  });

  it('maps a timeout and preserves the configured timeout', async () => {
    const { executor } = fakeExecutor(() => result('', { timedOut: true, exitCode: null }));
    const error = await capture(() =>
      createHerdrClient({ executor, env: {}, timeoutMs: 1234 }).tab.list(),
    );

    expect(error).toBeInstanceOf(HerdrTimeoutError);
    expect(error).toMatchObject({ operation: 'tab.list', timeoutMs: 1234 });
  });

  it('maps malformed structured stdout to HerdrResponseError', async () => {
    const { executor } = fakeExecutor(() => result('not JSON'));
    const error = await capture(() => createHerdrClient({ executor, env: {} }).agent.get('p1'));

    expect(error).toBeInstanceOf(HerdrResponseError);
    expect(error).toMatchObject({ operation: 'agent.get', argv: ['agent', 'get', 'p1'] });
  });

  it('maps a missing required resource field to HerdrResponseError', async () => {
    const incomplete = { ...panePayload };
    delete (incomplete as { pane_id?: string }).pane_id;
    const { executor } = fakeExecutor(() => result(envelope('pane_info', 'pane', incomplete)));
    const error = await capture(() => createHerdrClient({ executor, env: {} }).pane.get('p1'));

    expect(error).toBeInstanceOf(HerdrResponseError);
    expect((error as HerdrResponseError).detail).toContain('pane_id');
  });

  it('narrows structured not-found errors by code', async () => {
    const { executor } = fakeExecutor(() =>
      result('', {
        stderr: '{"error":{"code":"pane_not_found","message":"missing"}}',
        exitCode: 1,
      }),
    );
    const error = await capture(() => createHerdrClient({ executor, env: {} }).pane.get('missing'));

    expect(isHerdrCliError(error, 'pane_not_found')).toBe(true);
    expect(isHerdrCliError(error, 'agent_not_found')).toBe(false);
  });

  it('keeps read stdout and environment values out of error messages', async () => {
    const stdoutSecret = 'terminal-output-secret';
    const environmentSecret = 'environment-secret';
    const { executor } = fakeExecutor(() => result(stdoutSecret));
    const error = await capture(() =>
      createHerdrClient({
        executor,
        env: { HERDR_SECRET: environmentSecret },
      }).agent.get('p1'),
    );

    expect(error).toBeInstanceOf(HerdrResponseError);
    expect(error.message).not.toContain(stdoutSecret);
    expect(error.message).not.toContain(environmentSecret);
  });
});

async function capture(action: () => Promise<unknown>): Promise<Error> {
  try {
    await action();
  } catch (error) {
    expect(error).toBeInstanceOf(Error);
    return error as Error;
  }
  throw new Error('Expected action to reject.');
}
