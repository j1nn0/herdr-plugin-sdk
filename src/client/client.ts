import { HerdrError } from '../errors.js';
import { createExecFileExecutor } from './exec-file.js';
import {
  parseAgentResponse,
  parsePaneListResponse,
  parsePaneReportMetadataResponse,
  parsePaneResponse,
  parsePaneProcessInfoResponse,
  parsePluginPaneCloseResponse,
  parsePluginPaneOpenResponse,
  parseReadResponse,
  parseRunResponse,
  parseTabRenameResponse,
  parseTabCreateResponse,
  parseTabResponse,
  parseWorkspaceRenameResponse,
  parseWorkspaceResponse,
} from './parse.js';
import type { HerdrCommandExecutor } from './executor.js';
import type {
  HerdrClient,
  HerdrClientOptions,
  PaneReportMetadataOptions,
  PaneProcessInfo,
  PluginPaneOpenOptions,
  ReadOptions,
  TabCreateOptions,
  TabCreateResult,
} from './types.js';

/* oxlint-disable max-lines */

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_BUFFER = 32 * 1024 * 1024;

/** Creates a typed client backed by the Herdr CLI. */
export function createHerdrClient(options: HerdrClientOptions = {}): HerdrClient {
  const env = options.env ?? process.env;
  const binPath = options.binPath ?? env.HERDR_BIN_PATH ?? 'herdr';
  const typedTimeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBuffer = options.maxBuffer ?? DEFAULT_MAX_BUFFER;
  const executor: HerdrCommandExecutor = options.executor ?? createExecFileExecutor();

  const runTimeoutMs = options.timeoutMs ?? 0;

  const execute = (argv: string[], timeoutMs: number) =>
    executor({
      binPath,
      argv,
      timeoutMs,
      maxBuffer,
      env,
    });

  return createOperations(execute, typedTimeoutMs, runTimeoutMs);
}

type ExecuteCommand = (argv: string[], timeoutMs: number) => ReturnType<HerdrCommandExecutor>;

function createOperations(
  execute: ExecuteCommand,
  typedTimeoutMs: number,
  runTimeoutMs: number,
): HerdrClient {
  const run = async (argv: readonly string[]): Promise<string> => {
    if (argv.length === 0) {
      throw new HerdrError({ message: 'Herdr CLI run requires at least one argv token.' });
    }

    const command = [...argv];
    return parseRunResponse(await execute(command, runTimeoutMs), command, runTimeoutMs);
  };

  return {
    ...createResourceOperations(execute, typedTimeoutMs),
    ...createListOperations(execute, typedTimeoutMs),
    ...createPluginPaneOperations(execute, typedTimeoutMs),
    run,
  };
}

function createResourceOperations(
  execute: ExecuteCommand,
  timeoutMs: number,
): Pick<HerdrClient, 'agent' | 'pane'> {
  const agent = {
    async get(target: string) {
      const argv = ['agent', 'get', target];
      return parseAgentResponse(await execute(argv, timeoutMs), argv, timeoutMs);
    },
    async read(target: string, readOptions?: ReadOptions) {
      const argv = buildReadArgv('agent', target, readOptions);
      return parseReadResponse(await execute(argv, timeoutMs), 'agent.read', argv, timeoutMs);
    },
  };

  const pane = {
    async get(paneId: string) {
      const argv = ['pane', 'get', paneId];
      return parsePaneResponse(await execute(argv, timeoutMs), argv, timeoutMs);
    },
    async list(listOptions?: { readonly workspaceId?: string }) {
      const argv = ['pane', 'list'];
      if (listOptions?.workspaceId !== undefined) {
        argv.push('--workspace', listOptions.workspaceId);
      }
      return parsePaneListResponse(await execute(argv, timeoutMs), argv, timeoutMs);
    },
    async read(paneId: string, readOptions?: ReadOptions) {
      const argv = buildReadArgv('pane', paneId, readOptions);
      return parseReadResponse(await execute(argv, timeoutMs), 'pane.read', argv, timeoutMs);
    },
    async processInfo(paneId: string): Promise<PaneProcessInfo> {
      validateNonBlankString(paneId, 'paneId', 'pane.processInfo');
      const argv = ['pane', 'process-info', '--pane', paneId];
      return parsePaneProcessInfoResponse(await execute(argv, timeoutMs), argv, timeoutMs);
    },
    async reportMetadata(paneId: string, reportOptions: PaneReportMetadataOptions) {
      const argv = buildPaneReportMetadataArgv(paneId, reportOptions);
      return parsePaneReportMetadataResponse(await execute(argv, timeoutMs), argv, timeoutMs);
    },
  };

  return { agent, pane };
}

function createListOperations(
  execute: ExecuteCommand,
  timeoutMs: number,
): Pick<HerdrClient, 'workspace' | 'tab'> {
  const workspace = {
    async list() {
      const argv = ['workspace', 'list'];
      return parseWorkspaceResponse(await execute(argv, timeoutMs), argv, timeoutMs);
    },
    async rename(workspaceId: string, label: string) {
      const argv = ['workspace', 'rename', workspaceId, label];
      return parseWorkspaceRenameResponse(await execute(argv, timeoutMs), argv, timeoutMs);
    },
  };

  const tab = {
    async list(listOptions?: { readonly workspaceId?: string }) {
      const argv = ['tab', 'list'];
      if (listOptions?.workspaceId !== undefined) {
        argv.push('--workspace', listOptions.workspaceId);
      }
      return parseTabResponse(await execute(argv, timeoutMs), argv, timeoutMs);
    },
    async create(options: TabCreateOptions = {}): Promise<TabCreateResult> {
      const argv = buildTabCreateArgv(options);
      const result = await execute(argv, timeoutMs);
      return parseTabCreateResponse(result, redactEnvironment(argv), timeoutMs);
    },
    async rename(tabId: string, label: string) {
      const argv = ['tab', 'rename', tabId, label];
      return parseTabRenameResponse(await execute(argv, timeoutMs), argv, timeoutMs);
    },
  };

  return { workspace, tab };
}

function createPluginPaneOperations(
  execute: ExecuteCommand,
  timeoutMs: number,
): Pick<HerdrClient, 'plugin'> {
  return {
    plugin: {
      pane: {
        async open(options: PluginPaneOpenOptions) {
          const argv = buildPluginPaneOpenArgv(options);
          const result = await execute(argv, timeoutMs);
          return parsePluginPaneOpenResponse(result, redactEnvironment(argv), timeoutMs);
        },
        async close(paneId: string) {
          const argv = ['plugin', 'pane', 'close', paneId];
          parsePluginPaneCloseResponse(await execute(argv, timeoutMs), argv, timeoutMs);
        },
      },
    },
  };
}

function buildPluginPaneOpenArgv(options: PluginPaneOpenOptions): string[] {
  validateNonBlankString(options.pluginId, 'pluginId', 'plugin.pane.open');
  validateNonBlankString(options.entrypoint, 'entrypoint', 'plugin.pane.open');

  const argv = [
    'plugin',
    'pane',
    'open',
    '--plugin',
    options.pluginId,
    '--entrypoint',
    options.entrypoint,
  ];
  if (options.placement !== undefined) {
    argv.push('--placement', options.placement);
  }
  appendOptionalNonBlank(
    argv,
    '--workspace',
    options.workspaceId,
    'workspaceId',
    'plugin.pane.open',
  );
  appendOptionalNonBlank(
    argv,
    '--target-pane',
    options.targetPane,
    'targetPane',
    'plugin.pane.open',
  );
  if (options.direction !== undefined) {
    argv.push('--direction', options.direction);
  }
  appendOptionalNonBlank(argv, '--cwd', options.cwd, 'cwd', 'plugin.pane.open');
  appendEnvironment(argv, options.env, 'plugin.pane.open');
  if (options.focus !== undefined) {
    if (typeof options.focus !== 'boolean') {
      throw invalidOption('plugin.pane.open', 'focus must be a boolean.');
    }
    argv.push(options.focus ? '--focus' : '--no-focus');
  }
  return argv;
}

function buildTabCreateArgv(options: TabCreateOptions): string[] {
  const operation = 'tab.create';
  const argv = ['tab', 'create'];
  appendOptionalNonBlank(argv, '--workspace', options.workspaceId, 'workspaceId', operation);
  appendOptionalNonBlank(argv, '--cwd', options.cwd, 'cwd', operation);
  if (options.label !== undefined) {
    argv.push('--label', options.label);
  }
  appendEnvironment(argv, options.env, operation);
  if (options.focus !== undefined) {
    if (typeof options.focus !== 'boolean') {
      throw invalidOption(operation, 'focus must be a boolean.');
    }
    argv.push(options.focus ? '--focus' : '--no-focus');
  }
  return argv;
}

function appendEnvironment(
  argv: string[],
  env: Readonly<Record<string, string>> | undefined,
  operation: string,
): void {
  if (env === undefined) {
    return;
  }
  if (typeof env !== 'object' || env === null || Array.isArray(env)) {
    throw invalidOption(operation, 'env must be a string record.');
  }
  for (const [key, value] of Object.entries(env)) {
    if (key.trim() === '' || key.includes('=')) {
      throw invalidOption(operation, 'env keys must be non-blank and must not contain "=".');
    }
    if (typeof value !== 'string') {
      throw invalidOption(operation, 'env values must be strings.');
    }
    argv.push('--env', `${key}=${value}`);
  }
}

function redactEnvironment(argv: readonly string[]): string[] {
  const diagnosticArgv = [...argv];
  for (let index = 0; index < diagnosticArgv.length - 1; index += 1) {
    if (diagnosticArgv[index] === '--env') {
      diagnosticArgv[index + 1] = '<redacted>';
      index += 1;
    }
  }
  return diagnosticArgv;
}

function buildPaneReportMetadataArgv(paneId: string, options: PaneReportMetadataOptions): string[] {
  validateNonBlankString(options.source, 'source', 'pane.reportMetadata');
  const { tokenEntries, clearTokens } = validatePaneReportMetadataOptions(options);
  const argv = ['pane', 'report-metadata', paneId, '--source', options.source];

  if (options.title !== undefined) {
    argv.push('--title', options.title);
  }
  if (options.clearTitle === true) {
    argv.push('--clear-title');
  }
  for (const [name, value] of tokenEntries) {
    argv.push('--token', `${name}=${value}`);
  }
  for (const name of clearTokens) {
    argv.push('--clear-token', name);
  }
  if (options.ttlMs !== undefined) {
    argv.push('--ttl-ms', String(options.ttlMs));
  }
  return argv;
}

function validatePaneReportMetadataOptions(options: PaneReportMetadataOptions): {
  tokenEntries: [string, string][];
  clearTokens: string[];
} {
  const tokens = options.tokens;
  const clearTokens = options.clearTokens ?? [];
  if (options.title !== undefined && options.clearTitle === true) {
    throw invalidOption('pane.reportMetadata', 'title and clearTitle cannot be used together.');
  }
  if (
    tokens !== undefined &&
    (typeof tokens !== 'object' || tokens === null || Array.isArray(tokens))
  ) {
    throw invalidOption('pane.reportMetadata', 'tokens must be a string record.');
  }
  if (!Array.isArray(clearTokens)) {
    throw invalidOption('pane.reportMetadata', 'clearTokens must be an array of strings.');
  }
  if (tokens !== undefined && Object.values(tokens).some((value) => typeof value !== 'string')) {
    throw invalidOption('pane.reportMetadata', 'token values must be strings.');
  }
  if (clearTokens.some((token) => typeof token !== 'string')) {
    throw invalidOption('pane.reportMetadata', 'clearTokens must contain only strings.');
  }
  if (
    options.ttlMs !== undefined &&
    (!Number.isInteger(options.ttlMs) || options.ttlMs < 1 || options.ttlMs > 86_400_000)
  ) {
    throw invalidOption('pane.reportMetadata', 'ttlMs must be an integer from 1 through 86400000.');
  }

  const tokenEntries = tokens === undefined ? [] : Object.entries(tokens);
  const uniqueClearTokens = [...new Set(clearTokens)];
  if (uniqueClearTokens.some((token) => Object.hasOwn(tokens ?? {}, token))) {
    throw invalidOption(
      'pane.reportMetadata',
      'a token cannot be set and cleared in the same report.',
    );
  }
  if (
    options.title === undefined &&
    options.clearTitle !== true &&
    tokenEntries.length === 0 &&
    uniqueClearTokens.length === 0
  ) {
    throw invalidOption('pane.reportMetadata', 'at least one metadata change is required.');
  }
  return { tokenEntries, clearTokens: uniqueClearTokens };
}

function appendOptionalNonBlank(
  argv: string[],
  flag: string,
  value: string | undefined,
  name: string,
  operation: string,
): void {
  if (value === undefined) {
    return;
  }
  validateNonBlankString(value, name, operation);
  argv.push(flag, value);
}

function validateNonBlankString(value: string, name: string, operation: string): void {
  if (typeof value !== 'string' || value.trim() === '') {
    throw invalidOption(operation, `${name} must be a non-blank string.`);
  }
}

function invalidOption(operation: string, detail: string): HerdrError {
  return new HerdrError({ message: `Invalid ${operation} option: ${detail}` });
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
    if (!Number.isInteger(options.lines) || options.lines < 0) {
      throw new HerdrError({
        message: `Invalid ${namespace}.read option: lines must be a non-negative integer.`,
      });
    }
    argv.push('--lines', String(options.lines));
  }

  if (options?.format !== undefined) {
    argv.push('--format', options.format);
  }

  return argv;
}
