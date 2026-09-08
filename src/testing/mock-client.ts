/** Configurable in-memory Herdr client for plugin unit tests. */
import { HerdrCliError } from '../errors.js';
import type { Agent, HerdrClient, Pane, ReadOptions, Tab, Workspace } from '../client/types.js';

/** A recorded operation made through a mock Herdr client. */
export interface MockHerdrCall {
  readonly operation:
    | 'agent.get'
    | 'agent.read'
    | 'pane.get'
    | 'pane.read'
    | 'workspace.list'
    | 'tab.list';
  readonly target: string | null;
  readonly options: Readonly<Record<string, unknown>> | null;
}

/** Values used to configure responses from a mock Herdr client. */
export interface MockHerdrClientSetup {
  readonly agents?: Readonly<Record<string, Agent | Error>>;
  readonly panes?: Readonly<Record<string, Pane | Error>>;
  readonly agentReads?: Readonly<Record<string, string | Error>>;
  readonly paneReads?: Readonly<Record<string, string | Error>>;
  readonly workspaces?: readonly Workspace[] | Error;
  readonly tabs?: readonly Tab[] | Error;
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
type ReadCallOptions = ReadOptions | TabListOptions;
type RecordCall = (
  operation: MockOperation,
  target: string | null,
  options?: ReadCallOptions,
) => void;
type LookupOperation = 'agent.get' | 'agent.read' | 'pane.get' | 'pane.read';

/** Creates an in-memory Herdr client whose responses come from `setup`. */
export function createMockHerdrClient(setup: MockHerdrClientSetup = {}): MockHerdrClient {
  const calls: MockHerdrCall[] = [];
  const recordCall: RecordCall = (operation, target, options) => {
    calls.push({ operation, target, options: copyOptions(options) });
  };

  return {
    get calls(): readonly MockHerdrCall[] {
      return calls.map((call) => copyCall(call));
    },
    reset(): void {
      calls.length = 0;
    },
    agent: createAgentOperations(setup, recordCall),
    pane: createPaneOperations(setup, recordCall),
    workspace: createWorkspaceOperations(setup, recordCall),
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
    read(paneId: string, options?: ReadOptions): Promise<string> {
      const argv = buildReadArgv('pane', paneId, options);
      recordCall('pane.read', paneId, options);
      return resolveLookup(setup.paneReads?.[paneId], 'pane.read', argv);
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

function copyOptions(options?: ReadCallOptions): Readonly<Record<string, unknown>> | null {
  return options === undefined ? null : Object.fromEntries(Object.entries(options));
}

function copyCall(call: MockHerdrCall): MockHerdrCall {
  return {
    operation: call.operation,
    target: call.target,
    options: call.options === null ? null : { ...call.options },
  };
}
