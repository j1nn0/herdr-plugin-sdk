import { describe, expect, expectTypeOf, it } from 'vitest';
/* oxlint-disable max-lines */
import {
  HerdrCliError,
  HerdrError,
  HerdrProcessError,
  HerdrResponseError,
  createHerdrClient,
  type Agent,
  type HerdrCommandResult,
  type WorkspaceReportMetadataOptions,
} from '../src/index.js';
import {
  createAgentFixture,
  createAgentListOutputFixture,
  createCliErrorOutputFixture,
  createRecordingExecutor,
  createTabListOutputFixture,
  createWorkspaceListOutputFixture,
  serializeCliOutput,
} from '../src/testing/index.js';

const success = (stdout = '', overrides: Partial<HerdrCommandResult> = {}): HerdrCommandResult => ({
  stdout,
  stderr: '',
  exitCode: 0,
  signal: null,
  timedOut: false,
  ...overrides,
});

function clientFor(result: HerdrCommandResult, timeoutMs?: number) {
  const recording = createRecordingExecutor(() => result);
  const client = createHerdrClient({
    env: {},
    executor: recording.executor,
    ...(timeoutMs === undefined ? {} : { timeoutMs }),
  });
  return { client, recording };
}

function clientForEnvelope(envelope: unknown, timeoutMs?: number) {
  return clientFor(success(serializeCliOutput(envelope)), timeoutMs);
}

function agentListEnvelope(agents: unknown, type = 'agent_list') {
  return { id: 'fixture:agent:list', result: { type, agents } };
}

describe('agent.list', () => {
  it('uses exact argv, returns one default agent and preserves the empty list', async () => {
    const defaultOutput = createAgentListOutputFixture();
    const defaultClient = clientForEnvelope(defaultOutput);
    const defaultAgents = await defaultClient.client.agent.list();
    expect(defaultAgents).toEqual(defaultOutput.result.agents);
    expectTypeOf(defaultAgents).toEqualTypeOf<Agent[]>();
    expect(defaultClient.recording.calls).toEqual([
      { binPath: 'herdr', argv: ['agent', 'list'], timeoutMs: 10_000 },
    ]);

    const emptyOutput = createAgentListOutputFixture({ agents: [] });
    const emptyClient = clientForEnvelope(emptyOutput);
    await expect(emptyClient.client.agent.list()).resolves.toEqual([]);
    expect(emptyClient.recording.calls[0]?.argv).toEqual(['agent', 'list']);
  });

  it('preserves Herdr order and unknown fields without sorting', async () => {
    const first = createAgentFixture({ pane_id: 'z-pane', completion_seq: 80 });
    const second = createAgentFixture({ pane_id: 'a-pane', completion_seq: 4 });
    const output = createAgentListOutputFixture({ agents: [first, second] });
    const { client } = clientForEnvelope(output);

    const agents = await client.agent.list();
    expect(agents.map(({ pane_id }) => pane_id)).toEqual(['z-pane', 'a-pane']);
    expect(agents[0]).toMatchObject({ completion_seq: 80 });
    expect(agents[1]).toMatchObject({ completion_seq: 4 });
  });

  it('validates optional agent_session values while preserving its unknown fields', async () => {
    const validSession = {
      source: 'process',
      agent: 'pi',
      kind: 'id',
      value: 'session-1',
    };
    const validSessionWithExtras = {
      ...validSession,
      future_session_field: { retained: true },
    };
    const payloads: Array<{ name: string; payload: Record<string, unknown> }> = [
      { name: 'absent', payload: createAgentFixture() },
      { name: 'null', payload: { ...createAgentFixture(), agent_session: null } },
      { name: 'valid', payload: { ...createAgentFixture(), agent_session: validSession } },
      {
        name: 'valid-with-extras',
        payload: { ...createAgentFixture(), agent_session: validSessionWithExtras },
      },
    ];
    for (const { name, payload } of payloads) {
      const { client } = clientForEnvelope(agentListEnvelope([payload]));
      const [agent] = await client.agent.list();
      expect(agent).toBeDefined();
      if (name === 'absent') {
        expect(agent).not.toHaveProperty('agent_session');
      } else if (name === 'null') {
        expect(agent).toHaveProperty('agent_session', null);
      } else {
        expect(agent?.agent_session).toMatchObject(validSession);
        if (name === 'valid-with-extras') {
          expect(agent?.agent_session).toMatchObject({ future_session_field: { retained: true } });
        }
      }
    }
  });

  it.each([
    ['string', 'invalid'],
    ['number', 42],
    ['array', []],
    ['missing required field', { source: 'process', agent: 'pi', kind: 'id' }],
    ['invalid required field', { source: 'process', agent: 'pi', kind: 'name', value: 'x' }],
  ])('rejects malformed agent_session (%s)', async (_name, session) => {
    const payload = { ...createAgentFixture(), agent_session: session };
    const { client } = clientForEnvelope(agentListEnvelope([payload]));
    await expect(client.agent.list()).rejects.toBeInstanceOf(HerdrResponseError);
  });

  it('rejects wrong discriminators, non-array lists, malformed items, and missing fields', async () => {
    const invalidEnvelopes = [
      agentListEnvelope([], 'agent_info'),
      agentListEnvelope({}),
      agentListEnvelope([null]),
      agentListEnvelope([{ ...createAgentFixture(), revision: undefined }]),
    ];
    for (const envelope of invalidEnvelopes) {
      const { client } = clientForEnvelope(envelope);
      await expect(client.agent.list()).rejects.toBeInstanceOf(HerdrResponseError);
    }
  });

  it('classifies structured CLI errors and leaves unstructured failures as process errors', async () => {
    const structured = clientFor(
      success('', {
        exitCode: 1,
        stderr: serializeCliOutput(
          createCliErrorOutputFixture({ code: 'agent_list_failed', message: 'List failed.' }),
        ),
      }),
    );
    await expect(structured.client.agent.list()).rejects.toMatchObject({
      operation: 'agent.list',
      code: 'agent_list_failed',
    } satisfies Partial<HerdrCliError>);

    const unstructured = clientFor(success('', { exitCode: 2, stderr: 'command failed' }));
    await expect(unstructured.client.agent.list()).rejects.toBeInstanceOf(HerdrProcessError);
  });

  it('uses the typed timeout default and forwards an explicit timeout', async () => {
    const validDefault = clientForEnvelope(createAgentListOutputFixture());
    await validDefault.client.agent.list();
    expect(validDefault.recording.calls[0]?.timeoutMs).toBe(10_000);

    const explicit = clientForEnvelope(createAgentListOutputFixture(), 2345);
    await explicit.client.agent.list();
    expect(explicit.recording.calls[0]?.timeoutMs).toBe(2345);
  });

  it('does not add agent_session validation to workspace or tab list items', async () => {
    const workspace = {
      ...createWorkspaceListOutputFixture().result.workspaces[0],
      agent_session: 'unknown workspace field',
    };
    const tab = {
      ...createTabListOutputFixture().result.tabs[0],
      agent_session: 'unknown tab field',
    };
    const workspaceClient = clientForEnvelope({
      id: 'workspace-list',
      result: { type: 'workspace_list', workspaces: [workspace] },
    });
    const tabClient = clientForEnvelope({
      id: 'tab-list',
      result: { type: 'tab_list', tabs: [tab] },
    });
    await expect(workspaceClient.client.workspace.list()).resolves.toMatchObject([
      { agent_session: 'unknown workspace field' },
    ]);
    await expect(tabClient.client.tab.list()).resolves.toMatchObject([
      { agent_session: 'unknown tab field' },
    ]);
  });
});

describe('workspace.reportMetadata', () => {
  it('rejects blank identifiers and source values before invoking the executor', async () => {
    const invalidCalls: Array<[string, WorkspaceReportMetadataOptions]> = [
      ['', { source: 'example', tokens: { key: 'value' } }],
      [' \t', { source: 'example', tokens: { key: 'value' } }],
      ['workspace-1', { source: '', tokens: { key: 'value' } }],
      ['workspace-1', { source: ' \t', tokens: { key: 'value' } }],
    ];
    for (const [workspaceId, options] of invalidCalls) {
      const { client, recording } = clientFor(success(''));
      await expect(client.workspace.reportMetadata(workspaceId, options)).rejects.toBeInstanceOf(
        HerdrError,
      );
      expect(recording.calls).toEqual([]);
    }
  });

  it('requires a token change, accepts empty token values, and deduplicates clear tokens', async () => {
    const invalidOptions: unknown[] = [
      { source: 'example' },
      { source: 'example', tokens: {} },
      { source: 'example', clearTokens: [] },
      { source: 'example', tokens: {}, clearTokens: [] },
      { source: 'example', tokens: null },
      { source: 'example', tokens: [] },
      { source: 'example', tokens: { key: 1 } },
      { source: 'example', clearTokens: 'old' },
      { source: 'example', clearTokens: [1] },
      { source: 'example', ttlMs: 1000 },
    ];
    for (const options of invalidOptions) {
      const { client, recording } = clientFor(success(''));
      await expect(
        client.workspace.reportMetadata('workspace-1', options as WorkspaceReportMetadataOptions),
      ).rejects.toBeInstanceOf(HerdrError);
      expect(recording.calls).toEqual([]);
    }

    const tokenSet = clientFor(success('ignored stdout'));
    await expect(
      tokenSet.client.workspace.reportMetadata('workspace-1', {
        source: 'example',
        tokens: { status: '' },
      }),
    ).resolves.toBeUndefined();
    expect(tokenSet.recording.calls[0]?.argv).toEqual([
      'workspace',
      'report-metadata',
      'workspace-1',
      '--source',
      'example',
      '--token',
      'status=',
    ]);

    const clearSet = clientFor(success(''));
    await clearSet.client.workspace.reportMetadata('workspace-1', {
      source: 'example',
      clearTokens: ['old', 'old', 'older'],
    });
    expect(clearSet.recording.calls[0]?.argv).toEqual([
      'workspace',
      'report-metadata',
      'workspace-1',
      '--source',
      'example',
      '--clear-token',
      'old',
      '--clear-token',
      'older',
    ]);
  });

  it('rejects ttlMs as a modifier without a token mutation before execution', async () => {
    const { client, recording } = clientFor(success(''));
    await expect(
      client.workspace.reportMetadata('workspace-1', { source: 'example', ttlMs: 1000 }),
    ).rejects.toThrow('at least one token change is required.');
    expect(recording.calls).toEqual([]);
  });

  it('rejects same-name set/clear conflicts and compares token names case-sensitively', async () => {
    const conflict = clientFor(success(''));
    await expect(
      conflict.client.workspace.reportMetadata('workspace-1', {
        source: 'example',
        tokens: { Key: 'value' },
        clearTokens: ['Key', 'Key'],
      }),
    ).rejects.toThrow('a token cannot be set and cleared in the same report.');
    expect(conflict.recording.calls).toEqual([]);

    const differentCase = clientFor(success(''));
    await differentCase.client.workspace.reportMetadata('workspace-1', {
      source: 'example',
      tokens: { Key: 'value' },
      clearTokens: ['key'],
    });
    expect(differentCase.recording.calls[0]?.argv).toEqual([
      'workspace',
      'report-metadata',
      'workspace-1',
      '--source',
      'example',
      '--token',
      'Key=value',
      '--clear-token',
      'key',
    ]);
  });

  it.each([
    ['minimum TTL', { source: 'example', tokens: { minimum: 'yes' }, ttlMs: 1 }],
    ['maximum TTL', { source: 'example', clearTokens: ['old'], ttlMs: 86_400_000 }],
  ])('accepts a token mutation with the %s', async (_name, options) => {
    const { client, recording } = clientFor(success(''));
    await client.workspace.reportMetadata('workspace-1', options);
    expect(recording.calls[0]?.argv.at(-2)).toBe('--ttl-ms');
    expect(recording.calls[0]?.argv.at(-1)).toBe(String(options.ttlMs));
  });

  it.each([
    ['zero', { source: 'example', tokens: { key: 'value' }, ttlMs: 0 }],
    ['above maximum', { source: 'example', clearTokens: ['key'], ttlMs: 86_400_001 }],
    ['non-integer', { source: 'example', tokens: { key: 'value' }, ttlMs: 1.5 }],
    ['modifier only', { source: 'example', ttlMs: 1000 }],
  ])('rejects the %s TTL case before execution', async (_name, options) => {
    const { client, recording } = clientFor(success(''));
    await expect(
      client.workspace.reportMetadata('workspace-1', options as WorkspaceReportMetadataOptions),
    ).rejects.toBeInstanceOf(HerdrError);
    expect(recording.calls).toEqual([]);
  });

  it('emits options in deterministic order, preserves accepted values, and ignores success stdout', async () => {
    const { client, recording } = clientFor(success('not JSON and intentionally ignored'));
    await expect(
      client.workspace.reportMetadata(' workspace-1 ', {
        source: ' source ',
        tokens: { second: '2', first: '' },
        clearTokens: ['old', 'old'],
        ttlMs: 42,
      }),
    ).resolves.toBeUndefined();
    expect(recording.calls[0]?.argv).toEqual([
      'workspace',
      'report-metadata',
      ' workspace-1 ',
      '--source',
      ' source ',
      '--token',
      'second=2',
      '--token',
      'first=',
      '--clear-token',
      'old',
      '--ttl-ms',
      '42',
    ]);
  });

  it('passes workspace_not_found and server token-limit CLI errors through unchanged', async () => {
    for (const code of ['workspace_not_found', 'workspace_metadata_token_limit_exceeded']) {
      const failure = clientFor(
        success('', {
          exitCode: 1,
          stderr: serializeCliOutput(createCliErrorOutputFixture({ code, message: 'Rejected.' })),
        }),
      );
      await expect(
        failure.client.workspace.reportMetadata('workspace-1', {
          source: 'example',
          tokens: { key: 'value' },
        }),
      ).rejects.toMatchObject({
        operation: 'workspace.reportMetadata',
        code,
      } satisfies Partial<HerdrCliError>);
    }
  });

  it('uses the typed timeout and preserves process failure classification', async () => {
    const typedTimeout = clientFor(success(''));
    await typedTimeout.client.workspace.reportMetadata('workspace-1', {
      source: 'example',
      tokens: { key: 'value' },
    });
    expect(typedTimeout.recording.calls[0]?.timeoutMs).toBe(10_000);

    const processFailure = clientFor(success('', { exitCode: 9, stderr: 'not structured' }));
    await expect(
      processFailure.client.workspace.reportMetadata('workspace-1', {
        source: 'example',
        tokens: { key: 'value' },
      }),
    ).rejects.toBeInstanceOf(HerdrProcessError);
  });
});
