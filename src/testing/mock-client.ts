/** Configurable in-memory Herdr client for plugin unit tests. */
import { HerdrCliError, HerdrError } from '../errors.js';
import type {
  Agent,
  HerdrClient,
  Pane,
  PaneProcessInfo,
  PaneReportMetadataOptions,
  PluginPaneOpenOptions,
  ReadOptions,
  Tab,
  TabCreateOptions,
  TabCreateResult,
  Workspace,
} from '../client/types.js';

/* oxlint-disable max-lines */

/** A recorded operation made through a mock Herdr client. */
export interface MockHerdrCall {
  readonly operation:
    | 'agent.get'
    | 'agent.read'
    | 'pane.get'
    | 'pane.processInfo'
    | 'pane.list'
    | 'pane.read'
    | 'pane.reportMetadata'
    | 'plugin.pane.close'
    | 'plugin.pane.open'
    | 'tab.list'
    | 'tab.create'
    | 'tab.rename'
    | 'workspace.list'
    | 'workspace.rename'
    | 'cli.run';
  readonly target: string | null;
  readonly options: Readonly<Record<string, unknown>> | null;
  /** The command arguments for a `cli.run` call, copied as recorded. */
  readonly argv?: readonly string[];
}

/** Values used to configure responses from a mock Herdr client. */
export interface MockHerdrClientSetup {
  readonly agents?: Readonly<Record<string, Agent | Error>>;
  readonly panes?: Readonly<Record<string, Pane | Error>>;
  readonly paneProcessInfo?: Readonly<Record<string, PaneProcessInfo | Error>>;
  readonly agentReads?: Readonly<Record<string, string | Error>>;
  readonly paneReads?: Readonly<Record<string, string | Error>>;
  readonly paneList?: readonly Pane[] | Error;
  readonly pluginPaneOpen?: Pane | Error;
  readonly pluginPaneCloseErrors?: Readonly<Record<string, Error>>;
  readonly paneReportMetadataErrors?: Readonly<Record<string, Error>>;
  readonly workspaces?: readonly Workspace[] | Error;
  readonly workspaceRenames?: Readonly<Record<string, Workspace | Error>>;
  readonly tabs?: readonly Tab[] | Error;
  readonly tabRenames?: Readonly<Record<string, Tab | Error>>;
  readonly tabCreate?: TabCreateResult | Error;
  /** Response for an unmodeled CLI command. */
  readonly run?: (argv: readonly string[]) => string | Error;
}

/** Herdr client test double with an inspectable call history. */
export interface MockHerdrClient extends HerdrClient {
  /** Every call made through this client, in order. */
  readonly calls: readonly MockHerdrCall[];
  /** Removes all recorded calls. */
  reset(): void;
}

type MockOperation = MockHerdrCall['operation'];
type TabListOptions = { readonly workspaceId?: string };
type RecordCall = (
  operation: MockOperation,
  target: string | null,
  options?: object | null,
  argv?: readonly string[],
) => void;
type LookupOperation = 'agent.get' | 'agent.read' | 'pane.get' | 'pane.processInfo' | 'pane.read';

/** Creates an in-memory Herdr client whose responses come from `setup`. */
export function createMockHerdrClient(setup: MockHerdrClientSetup = {}): MockHerdrClient {
  const calls: MockHerdrCall[] = [];
  const recordCall: RecordCall = (operation, target, options, argv) => {
    calls.push({
      operation,
      target,
      options: copyOptions(options),
      ...(argv === undefined ? {} : { argv: [...argv] }),
    });
  };

  return {
    get calls(): readonly MockHerdrCall[] {
      return calls.map((call) => copyCall(call));
    },
    reset(): void {
      calls.length = 0;
    },
    run(argv: readonly string[]): Promise<string> {
      const command = [...argv];
      recordCall('cli.run', null, undefined, command);
      const configured = setup.run?.(command);
      return configured instanceof Error
        ? Promise.reject(configured)
        : Promise.resolve(configured ?? '');
    },
    agent: createAgentOperations(setup, recordCall),
    pane: createPaneOperations(setup, recordCall),
    workspace: createWorkspaceOperations(setup, recordCall),
    plugin: createPluginPaneOperations(setup, recordCall),
    tab: createTabOperations(setup, recordCall),
  };
}

function createAgentOperations(
  setup: MockHerdrClientSetup,
  recordCall: RecordCall,
): HerdrClient['agent'] {
  return {
    get(target: string): Promise<Agent> {
      const argv = ['agent', 'get', target];
      recordCall('agent.get', target);
      return resolveLookup(setup.agents?.[target], 'agent.get', argv);
    },
    read(target: string, options?: ReadOptions): Promise<string> {
      const argv = buildReadArgv('agent', target, options);
      recordCall('agent.read', target, options);
      return resolveLookup(setup.agentReads?.[target], 'agent.read', argv);
    },
  };
}

function createPaneOperations(
  setup: MockHerdrClientSetup,
  recordCall: RecordCall,
): HerdrClient['pane'] {
  return {
    get(paneId: string): Promise<Pane> {
      const argv = ['pane', 'get', paneId];
      recordCall('pane.get', paneId);
      return resolveLookup(setup.panes?.[paneId], 'pane.get', argv);
    },
    processInfo(paneId: string): Promise<PaneProcessInfo> {
      const argv = ['pane', 'process-info', '--pane', paneId];
      recordCall('pane.processInfo', paneId);
      return resolveLookup(setup.paneProcessInfo?.[paneId], 'pane.processInfo', argv).then(
        copyPaneProcessInfo,
      );
    },
    list(options?: TabListOptions): Promise<Pane[]> {
      recordCall('pane.list', null, options);
      const configured = setup.paneList;
      if (configured instanceof Error) {
        return Promise.reject(configured);
      }
      const panes = configured ?? [];
      const filtered =
        options?.workspaceId === undefined
          ? panes
          : panes.filter((item) => item.workspace_id === options.workspaceId);
      return Promise.resolve([...filtered]);
    },
    read(paneId: string, options?: ReadOptions): Promise<string> {
      const argv = buildReadArgv('pane', paneId, options);
      recordCall('pane.read', paneId, options);
      return resolveLookup(setup.paneReads?.[paneId], 'pane.read', argv);
    },
    reportMetadata(paneId: string, options: PaneReportMetadataOptions): Promise<void> {
      recordCall('pane.reportMetadata', paneId, options);
      const error = setup.paneReportMetadataErrors?.[paneId];
      return error === undefined ? Promise.resolve() : Promise.reject(error);
    },
  };
}

function createWorkspaceOperations(
  setup: MockHerdrClientSetup,
  recordCall: RecordCall,
): HerdrClient['workspace'] {
  return {
    list(): Promise<Workspace[]> {
      recordCall('workspace.list', null);
      return resolveList(setup.workspaces);
    },
    rename(workspaceId: string, label: string): Promise<Workspace> {
      recordCall('workspace.rename', workspaceId, { label });
      return resolveConfigured(setup.workspaceRenames?.[workspaceId], 'workspaceRenames');
    },
  };
}

function createTabOperations(
  setup: MockHerdrClientSetup,
  recordCall: RecordCall,
): HerdrClient['tab'] {
  return {
    list(options?: TabListOptions): Promise<Tab[]> {
      recordCall('tab.list', null, options);
      const configured = setup.tabs;
      if (configured instanceof Error) {
        return Promise.reject(configured);
      }
      if (configured === undefined) {
        return Promise.resolve([]);
      }
      const tabs =
        options?.workspaceId === undefined
          ? configured
          : configured.filter((item) => item.workspace_id === options.workspaceId);
      return Promise.resolve([...tabs]);
    },
    create(options?: TabCreateOptions): Promise<TabCreateResult> {
      recordCall('tab.create', null, options);
      return resolveConfigured(setup.tabCreate, 'tabCreate').then(({ tab, rootPane }) => {
        // Copy resource records so mutations to this mock result cannot change configured values.
        return { tab: { ...tab }, rootPane: { ...rootPane } };
      });
    },
    rename(tabId: string, label: string): Promise<Tab> {
      recordCall('tab.rename', tabId, { label });
      return resolveConfigured(setup.tabRenames?.[tabId], 'tabRenames');
    },
  };
}

function createPluginPaneOperations(
  setup: MockHerdrClientSetup,
  recordCall: RecordCall,
): HerdrClient['plugin'] {
  return {
    pane: {
      open(options: PluginPaneOpenOptions): Promise<Pane> {
        recordCall('plugin.pane.open', null, options);
        return resolveConfigured(setup.pluginPaneOpen, 'pluginPaneOpen');
      },
      close(paneId: string): Promise<void> {
        recordCall('plugin.pane.close', paneId);
        const error = setup.pluginPaneCloseErrors?.[paneId];
        return error === undefined ? Promise.resolve() : Promise.reject(error);
      },
    },
  };
}

function buildReadArgv(
  namespace: 'agent' | 'pane',
  target: string,
  options?: ReadOptions,
): string[] {
  const argv = [namespace, 'read', target];
  if (options?.source !== undefined) {
    argv.push('--source', options.source);
  }
  if (options?.lines !== undefined) {
    argv.push('--lines', String(options.lines));
  }
  if (options?.format !== undefined) {
    argv.push('--format', options.format);
  }
  return argv;
}

function resolveLookup<T>(
  configured: T | Error | undefined,
  operation: LookupOperation,
  argv: readonly string[],
): Promise<T> {
  if (configured instanceof Error) {
    return Promise.reject(configured);
  }
  if (configured === undefined) {
    return Promise.reject(notFoundError(operation, argv));
  }
  return Promise.resolve(configured);
}

function resolveList<T>(configured: readonly T[] | Error | undefined): Promise<T[]> {
  if (configured instanceof Error) {
    return Promise.reject(configured);
  }
  return Promise.resolve(configured === undefined ? [] : [...configured]);
}

function resolveConfigured<T>(configured: T | Error | undefined, setupField: string): Promise<T> {
  if (configured instanceof Error) {
    return Promise.reject(configured);
  }
  if (configured === undefined) {
    return Promise.reject(new HerdrError({ message: `Mock setup is missing ${setupField}.` }));
  }
  return Promise.resolve(configured);
}

function notFoundError(operation: LookupOperation, argv: readonly string[]): HerdrCliError {
  const agent = operation.startsWith('agent.');
  return new HerdrCliError({
    code: agent ? 'agent_not_found' : 'pane_not_found',
    message: agent ? 'Agent target was not found.' : 'Pane target was not found.',
    operation,
    argv,
    exitCode: 1,
  });
}

function copyPaneProcessInfo(processInfo: PaneProcessInfo): PaneProcessInfo {
  const processes = processInfo.foreground_processes;
  return {
    ...processInfo,
    ...(processes === undefined
      ? {}
      : {
          foreground_processes: processes.map((process) => ({
            ...process,
            ...(process.argv === undefined || process.argv === null
              ? {}
              : { argv: [...process.argv] }),
          })),
        }),
  };
}

function copyOptions(options?: object | null): Readonly<Record<string, unknown>> | null {
  if (options === undefined || options === null) {
    return null;
  }
  return Object.fromEntries(
    Object.entries(options).map(([key, value]) => [key, copyOptionValue(value)]),
  );
}

function copyOptionValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return [...value];
  }
  if (value !== null && typeof value === 'object') {
    return { ...value };
  }
  return value;
}

function copyCall(call: MockHerdrCall): MockHerdrCall {
  return {
    operation: call.operation,
    target: call.target,
    options: copyOptions(call.options),
    ...(call.argv === undefined ? {} : { argv: [...call.argv] }),
  };
}
