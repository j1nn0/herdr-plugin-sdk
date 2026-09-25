import { describe, expect, it } from 'vitest';
/* oxlint-disable max-lines */
import {
  HerdrCliError,
  HerdrError,
  HerdrProcessError,
  HerdrResponseError,
  HerdrTimeoutError,
  createHerdrClient,
  type HerdrClient,
  type HerdrCommandResult,
  type PaneReportMetadataOptions,
  type PluginPaneOpenOptions,
  type PluginPanePlacement,
  type Tab,
  type Workspace,
} from '../src/index.js';
import {
  createCliErrorOutputFixture,
  createPaneFixture,
  createPluginPaneCloseOutputFixture,
  createPluginPaneOpenOutputFixture,
  createRecordingExecutor,
  createTabFixture,
  createTabRenameOutputFixture,
  createWorkspaceFixture,
  createWorkspaceRenameOutputFixture,
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

function clientFor(result: HerdrCommandResult) {
  const recording = createRecordingExecutor(() => result);
  const client = createHerdrClient({ env: {}, executor: recording.executor });
  return { client, recording };
}

function successEnvelope(envelope: unknown): HerdrCommandResult {
  return success(serializeCliOutput(envelope));
}

function errorEnvelope(code = 'fixture_failure'): HerdrCommandResult {
  return success('', {
    exitCode: 1,
    stderr: serializeCliOutput(createCliErrorOutputFixture({ code, message: 'Fixture failure.' })),
  });
}

describe('plugin pane open', () => {
  it('opens a pane with the minimum argv and extracts the nested pane', async () => {
    const pane = createPaneFixture({ pane_id: 'opened-pane' });
    const { client, recording } = clientFor(
      successEnvelope(createPluginPaneOpenOutputFixture({ payload: pane })),
    );

    await expect(
      client.plugin.pane.open({ pluginId: 'example.widget', entrypoint: 'widget' }),
    ).resolves.toEqual(pane);
    expect(recording.calls).toEqual([
      {
        binPath: 'herdr',
        argv: ['plugin', 'pane', 'open', '--plugin', 'example.widget', '--entrypoint', 'widget'],
        timeoutMs: 10_000,
      },
    ]);
  });

  it('forwards every optional flag and preserves each environment entry as one token', async () => {
    const { client, recording } = clientFor(successEnvelope(createPluginPaneOpenOutputFixture()));
    await client.plugin.pane.open({
      pluginId: 'example.widget',
      entrypoint: 'widget',
      placement: 'split',
      workspaceId: 'w1G',
      targetPane: 'w1G:p2',
      direction: 'down',
      cwd: '/tmp/widget',
      env: { FIRST: 'one', SECOND: '' },
      focus: true,
    });
    expect(recording.calls[0]?.argv).toEqual([
      'plugin',
      'pane',
      'open',
      '--plugin',
      'example.widget',
      '--entrypoint',
      'widget',
      '--placement',
      'split',
      '--workspace',
      'w1G',
      '--target-pane',
      'w1G:p2',
      '--direction',
      'down',
      '--cwd',
      '/tmp/widget',
      '--env',
      'FIRST=one',
      '--env',
      'SECOND=',
      '--focus',
    ]);
  });

  it('supports all placements and all three focus states', async () => {
    const placements: readonly PluginPanePlacement[] = [
      'overlay',
      'popup',
      'split',
      'tab',
      'zoomed',
      'fullscreen',
    ];
    for (const placement of placements) {
      const { client, recording } = clientFor(successEnvelope(createPluginPaneOpenOutputFixture()));
      await client.plugin.pane.open({ pluginId: 'p', entrypoint: 'e', placement });
      expect(recording.calls[0]?.argv).toContain(placement);
    }

    for (const [focus, expectedFlag] of [
      [undefined, undefined],
      [true, '--focus'],
      [false, '--no-focus'],
    ] as const) {
      const { client, recording } = clientFor(successEnvelope(createPluginPaneOpenOutputFixture()));
      await client.plugin.pane.open({
        pluginId: 'p',
        entrypoint: 'e',
        ...(focus === undefined ? {} : { focus }),
      });
      expect(recording.calls[0]?.argv).toContain('--entrypoint');
      if (expectedFlag === undefined) {
        expect(recording.calls[0]?.argv).not.toContain('--focus');
        expect(recording.calls[0]?.argv).not.toContain('--no-focus');
      } else {
        expect(recording.calls[0]?.argv).toContain(expectedFlag);
      }
    }
  });

  it('accepts an empty env bag and rejects invalid env keys before execution', async () => {
    const empty = clientFor(successEnvelope(createPluginPaneOpenOutputFixture()));
    await empty.client.plugin.pane.open({ pluginId: 'p', entrypoint: 'e', env: {} });
    expect(empty.recording.calls[0]?.argv).not.toContain('--env');

    for (const key of ['', '  ', 'BAD=KEY']) {
      const { client, recording } = clientFor(successEnvelope(createPluginPaneOpenOutputFixture()));
      await expect(
        client.plugin.pane.open({ pluginId: 'p', entrypoint: 'e', env: { [key]: 'safe' } }),
      ).rejects.toBeInstanceOf(HerdrError);
      expect(recording.calls).toEqual([]);
    }
  });

  it('rejects blank required and optional identifiers before execution', async () => {
    const invalidOptions: unknown[] = [
      { pluginId: '', entrypoint: 'e' },
      { pluginId: '  ', entrypoint: 'e' },
      { pluginId: 'p', entrypoint: '' },
      { pluginId: 'p', entrypoint: ' \t' },
      { pluginId: 'p', entrypoint: 'e', workspaceId: '' },
      { pluginId: 'p', entrypoint: 'e', targetPane: '  ' },
      { pluginId: 'p', entrypoint: 'e', cwd: '\n' },
    ];
    for (const options of invalidOptions) {
      const { client, recording } = clientFor(successEnvelope(createPluginPaneOpenOutputFixture()));
      await expect(
        client.plugin.pane.open(options as PluginPaneOpenOptions),
      ).rejects.toBeInstanceOf(HerdrError);
      expect(recording.calls).toEqual([]);
    }
  });

  it('validates the nested pane and optional agent session but preserves unknown data', async () => {
    const pane = createPaneFixture({
      agent_session: { source: 'runtime', agent: 'pi', kind: 'id', value: 'session-1', extra: 1 },
      future_field: { unchanged: true },
    });
    const { client } = clientFor(
      successEnvelope(createPluginPaneOpenOutputFixture({ payload: pane })),
    );
    await expect(client.plugin.pane.open({ pluginId: 'p', entrypoint: 'e' })).resolves.toEqual(
      pane,
    );

    const invalidSession = {
      id: 'cli:plugin',
      result: {
        type: 'plugin_pane_opened',
        plugin_pane: { pane: { ...pane, agent_session: { source: 'runtime' } } },
      },
    };
    const invalid = clientFor(successEnvelope(invalidSession));
    await expect(
      invalid.client.plugin.pane.open({ pluginId: 'p', entrypoint: 'e' }),
    ).rejects.toBeInstanceOf(HerdrResponseError);
  });

  it('rejects a wrong result type, missing nested pane, and malformed pane', async () => {
    const malformed = [
      { id: 'cli:plugin', result: { type: 'plugin_pane_closed', pane_id: 'p' } },
      { id: 'cli:plugin', result: { type: 'plugin_pane_opened', plugin_pane: {} } },
      {
        id: 'cli:plugin',
        result: { type: 'plugin_pane_opened', plugin_pane: { pane: { pane_id: 'p' } } },
      },
    ];
    for (const envelope of malformed) {
      const { client } = clientFor(successEnvelope(envelope));
      await expect(
        client.plugin.pane.open({ pluginId: 'p', entrypoint: 'e' }),
      ).rejects.toBeInstanceOf(HerdrResponseError);
    }
  });

  it('uses the typed timeout and preserves the centralized CLI error taxonomy', async () => {
    const timedOut = clientFor(success('', { timedOut: true }));
    await expect(
      timedOut.client.plugin.pane.open({ pluginId: 'p', entrypoint: 'e' }),
    ).rejects.toMatchObject({
      operation: 'plugin.pane.open',
      timeoutMs: 10_000,
    } satisfies Partial<HerdrTimeoutError>);
    await expect(
      timedOut.client.plugin.pane.open({ pluginId: 'p', entrypoint: 'e' }),
    ).rejects.toBeInstanceOf(HerdrTimeoutError);

    const failed = clientFor(errorEnvelope('plugin_pane_open_failed'));
    await expect(
      failed.client.plugin.pane.open({ pluginId: 'p', entrypoint: 'e' }),
    ).rejects.toMatchObject({
      operation: 'plugin.pane.open',
      code: 'plugin_pane_open_failed',
    } satisfies Partial<HerdrCliError>);

    const envFailure = clientFor(errorEnvelope());
    let capturedError: unknown;
    try {
      await envFailure.client.plugin.pane.open({
        pluginId: 'p',
        entrypoint: 'e',
        env: { SECRET: 'do-not-leak' },
      });
    } catch (error: unknown) {
      capturedError = error;
    }
    expect(capturedError).toBeInstanceOf(HerdrCliError);
    const cliError = capturedError as HerdrCliError;
    expect(cliError.argv).toContain('<redacted>');
    expect(cliError.argv).not.toContain('SECRET=do-not-leak');
    expect(cliError.message).not.toContain('do-not-leak');
  });
});

describe('plugin pane close', () => {
  it('uses a scalar pane id and treats a structured success as void', async () => {
    const { client, recording } = clientFor(
      successEnvelope(createPluginPaneCloseOutputFixture({ payload: { pane_id: 'p-close' } })),
    );
    await expect(client.plugin.pane.close('p-close')).resolves.toBeUndefined();
    expect(recording.calls[0]?.argv).toEqual(['plugin', 'pane', 'close', 'p-close']);
  });

  it('rejects the wrong response type and propagates CLI failures', async () => {
    const wrongType = clientFor(
      successEnvelope({ id: 'cli:plugin', result: { type: 'plugin_pane_opened' } }),
    );
    await expect(wrongType.client.plugin.pane.close('p')).rejects.toBeInstanceOf(
      HerdrResponseError,
    );

    const failed = clientFor(errorEnvelope('pane_not_found'));
    await expect(failed.client.plugin.pane.close('p')).rejects.toMatchObject({
      operation: 'plugin.pane.close',
      code: 'pane_not_found',
    } satisfies Partial<HerdrCliError>);
  });
});

describe('pane.list', () => {
  it('builds an optional workspace filter and parses empty or multiple panes', async () => {
    const empty = clientFor(
      successEnvelope({ id: 'pane-list', result: { type: 'pane_list', panes: [] } }),
    );
    await expect(empty.client.pane.list()).resolves.toEqual([]);
    expect(empty.recording.calls[0]?.argv).toEqual(['pane', 'list']);

    const panes = [createPaneFixture({ pane_id: 'p1' }), createPaneFixture({ pane_id: 'p2' })];
    const filtered = clientFor(
      successEnvelope({ id: 'pane-list', result: { type: 'pane_list', panes } }),
    );
    await expect(filtered.client.pane.list({ workspaceId: 'w1G' })).resolves.toEqual(panes);
    expect(filtered.recording.calls[0]?.argv).toEqual(['pane', 'list', '--workspace', 'w1G']);
  });

  it('rejects malformed items, the wrong discriminator, and CLI failures', async () => {
    const malformed = [
      { id: 'pane-list', result: { type: 'tab_list', panes: [] } },
      { id: 'pane-list', result: { type: 'pane_list', panes: [{ pane_id: 'p' }] } },
    ];
    for (const envelope of malformed) {
      const { client } = clientFor(successEnvelope(envelope));
      await expect(client.pane.list()).rejects.toBeInstanceOf(HerdrResponseError);
    }
    const failed = clientFor(errorEnvelope('pane_list_failed'));
    await expect(failed.client.pane.list()).rejects.toMatchObject({
      operation: 'pane.list',
      code: 'pane_list_failed',
    } satisfies Partial<HerdrCliError>);
  });
});

describe('pane.reportMetadata', () => {
  it('validates the effective mutation, source, conflicts, token overlap, and TTL bounds', async () => {
    const invalidOptions: unknown[] = [
      {},
      { source: 'plugin:test' },
      { source: 'plugin:test', tokens: {} },
      { source: 'plugin:test', clearTokens: [] },
      { source: 'plugin:test', tokens: {}, clearTokens: [] },
      { source: 'plugin:test', ttlMs: 1000 },
      { source: 'plugin:test', clearTitle: false },
      { source: 'plugin:test', title: '', clearTitle: true },
      { source: '', title: 'title' },
      { source: ' \t', title: 'title' },
      { source: 'plugin:test', tokens: { same: '' }, clearTokens: ['same'] },
      { source: 'plugin:test', title: 'title', ttlMs: 0 },
      { source: 'plugin:test', title: 'title', ttlMs: 86_400_001 },
      { source: 'plugin:test', title: 'title', ttlMs: 1.5 },
    ];
    for (const options of invalidOptions) {
      const { client, recording } = clientFor(success('unparsed success stdout'));
      await expect(
        client.pane.reportMetadata('pane-1', options as PaneReportMetadataOptions),
      ).rejects.toBeInstanceOf(HerdrError);
      expect(recording.calls).toEqual([]);
    }
  });

  it('emits title, token, deduplicated clear-token, and TTL flags in order', async () => {
    const { client, recording } = clientFor(
      success('not JSON; reportMetadata ignores successful stdout'),
    );
    await expect(
      client.pane.reportMetadata('pane-1', {
        source: ' plugin:example ',
        title: '',
        clearTitle: false,
        tokens: { pr: '' },
        clearTokens: ['old', 'old'],
        ttlMs: 86_400_000,
      }),
    ).resolves.toBeUndefined();
    expect(recording.calls[0]?.argv).toEqual([
      'pane',
      'report-metadata',
      'pane-1',
      '--source',
      ' plugin:example ',
      '--title',
      '',
      '--token',
      'pr=',
      '--clear-token',
      'old',
      '--ttl-ms',
      '86400000',
    ]);
  });

  it('leaves token syntax to Herdr and passes empty token values through', async () => {
    const { client, recording } = clientFor(success(''));
    await client.pane.reportMetadata('pane-1', {
      source: 'source',
      tokens: { 'a=b': '' },
      clearTokens: ['old', ''],
      ttlMs: 1,
    });
    expect(recording.calls[0]?.argv).toEqual([
      'pane',
      'report-metadata',
      'pane-1',
      '--source',
      'source',
      '--token',
      'a=b=',
      '--clear-token',
      'old',
      '--clear-token',
      '',
      '--ttl-ms',
      '1',
    ]);
  });

  it('preserves case-sensitive token names when setting and clearing separately', async () => {
    const { client, recording } = clientFor(success(''));
    await client.pane.reportMetadata('pane-1', {
      source: 'source',
      tokens: { Key: 'value' },
      clearTokens: ['key'],
      ttlMs: 42,
    });
    expect(recording.calls[0]?.argv).toEqual([
      'pane',
      'report-metadata',
      'pane-1',
      '--source',
      'source',
      '--token',
      'Key=value',
      '--clear-token',
      'key',
      '--ttl-ms',
      '42',
    ]);
  });

  it('allows a TTL with a clear-only mutation', async () => {
    const { client, recording } = clientFor(success(''));
    await client.pane.reportMetadata('pane-1', {
      source: 'source',
      clearTokens: ['old'],
      ttlMs: 42,
    });
    expect(recording.calls[0]?.argv).toEqual([
      'pane',
      'report-metadata',
      'pane-1',
      '--source',
      'source',
      '--clear-token',
      'old',
      '--ttl-ms',
      '42',
    ]);

    await client.pane.reportMetadata('pane-2', {
      source: 'source',
      clearTitle: true,
      ttlMs: 42,
    });
    expect(recording.calls[1]?.argv).toEqual([
      'pane',
      'report-metadata',
      'pane-2',
      '--source',
      'source',
      '--clear-title',
      '--ttl-ms',
      '42',
    ]);
  });

  it('routes structured and unstructured command failures through the shared taxonomy', async () => {
    const structured = clientFor(errorEnvelope('metadata_rejected'));
    await expect(
      structured.client.pane.reportMetadata('p', { source: 's', title: 't' }),
    ).rejects.toMatchObject({
      operation: 'pane.reportMetadata',
      code: 'metadata_rejected',
    } satisfies Partial<HerdrCliError>);

    const unstructured = clientFor(success('', { exitCode: 9, stderr: 'not structured' }));
    await expect(
      unstructured.client.pane.reportMetadata('p', { source: 's', title: 't' }),
    ).rejects.toBeInstanceOf(HerdrProcessError);
  });
});

describe('tab.rename and workspace.rename', () => {
  it('returns updated resources and keeps whitespace and empty labels as one argv token', async () => {
    const tab: Tab = createTabFixture({ tab_id: 't-renamed', label: 'new tab label' });
    const workspace: Workspace = createWorkspaceFixture({
      workspace_id: 'w-renamed',
      label: 'new workspace',
    });
    const tabResult = clientFor(successEnvelope(createTabRenameOutputFixture({ payload: tab })));
    await expect(tabResult.client.tab.rename('tab-1', 'new tab label')).resolves.toEqual(tab);
    expect(tabResult.recording.calls[0]?.argv).toEqual(['tab', 'rename', 'tab-1', 'new tab label']);

    const workspaceResult = clientFor(
      successEnvelope(createWorkspaceRenameOutputFixture({ payload: workspace })),
    );
    await expect(workspaceResult.client.workspace.rename('workspace-1', '')).resolves.toEqual(
      workspace,
    );
    expect(workspaceResult.recording.calls[0]?.argv).toEqual([
      'workspace',
      'rename',
      'workspace-1',
      '',
    ]);
  });

  it('rejects wrong discriminators, malformed resource payloads, and CLI failures', async () => {
    const malformed = [
      { id: 'tab', result: { type: 'tab_list', tabs: [] } },
      { id: 'tab', result: { type: 'tab_info', tab: { tab_id: 't' } } },
      { id: 'workspace', result: { type: 'workspace_info', workspace: { workspace_id: 'w' } } },
    ];
    for (const envelope of malformed) {
      const { client } = clientFor(successEnvelope(envelope));
      if (envelope.id === 'workspace') {
        await expect(client.workspace.rename('w', 'label')).rejects.toBeInstanceOf(
          HerdrResponseError,
        );
      } else {
        await expect(client.tab.rename('t', 'label')).rejects.toBeInstanceOf(HerdrResponseError);
      }
    }

    const failed = clientFor(errorEnvelope('rename_rejected'));
    await expect(failed.client.tab.rename('t', 'label')).rejects.toMatchObject({
      operation: 'tab.rename',
      code: 'rename_rejected',
    } satisfies Partial<HerdrCliError>);

    const workspaceFailed = clientFor(errorEnvelope('workspace_rename_rejected'));
    await expect(workspaceFailed.client.workspace.rename('w', 'label')).rejects.toMatchObject({
      operation: 'workspace.rename',
      code: 'workspace_rename_rejected',
    } satisfies Partial<HerdrCliError>);
  });

  it('keeps the typed factory assignable to the expanded required client surface', () => {
    const client: HerdrClient = createHerdrClient({
      env: {},
      executor: createRecordingExecutor().executor,
    });
    expect(client.plugin.pane.open).toBeTypeOf('function');
    expect(client.plugin.pane.close).toBeTypeOf('function');
    expect(client.pane.list).toBeTypeOf('function');
    expect(client.pane.reportMetadata).toBeTypeOf('function');
    expect(client.tab.rename).toBeTypeOf('function');
    expect(client.workspace.rename).toBeTypeOf('function');
  });
});
