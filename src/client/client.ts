import { HerdrError } from '../errors.js';
import { createExecFileExecutor } from './exec-file.js';
import {
  parseAgentResponse,
  parsePaneResponse,
  parseReadResponse,
  parseTabResponse,
  parseWorkspaceResponse,
} from './parse.js';
import type { HerdrCommandExecutor } from './executor.js';
import type { HerdrClient, HerdrClientOptions, ReadOptions } from './types.js';

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_BUFFER = 32 * 1024 * 1024;

/** Creates a typed client backed by the Herdr CLI. */
export function createHerdrClient(options: HerdrClientOptions = {}): HerdrClient {
  const env = options.env ?? process.env;
  const binPath = options.binPath ?? env.HERDR_BIN_PATH ?? 'herdr';
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBuffer = options.maxBuffer ?? DEFAULT_MAX_BUFFER;
  const executor: HerdrCommandExecutor = options.executor ?? createExecFileExecutor();

  const execute = (argv: string[]) =>
    executor({
      binPath,
      argv,
      timeoutMs,
      maxBuffer,
      env,
    });

  return createOperations(execute, timeoutMs);
}

type ExecuteCommand = (argv: string[]) => ReturnType<HerdrCommandExecutor>;

function createOperations(execute: ExecuteCommand, timeoutMs: number): HerdrClient {
  const agent = {
    async get(target: string) {
      const argv = ['agent', 'get', target];
      return parseAgentResponse(await execute(argv), argv, timeoutMs);
    },
    async read(target: string, readOptions?: ReadOptions) {
      const argv = buildReadArgv('agent', target, readOptions);
      return parseReadResponse(await execute(argv), 'agent.read', argv, timeoutMs);
    },
  };

  const pane = {
    async get(paneId: string) {
      const argv = ['pane', 'get', paneId];
      return parsePaneResponse(await execute(argv), argv, timeoutMs);
    },
    async read(paneId: string, readOptions?: ReadOptions) {
      const argv = buildReadArgv('pane', paneId, readOptions);
      return parseReadResponse(await execute(argv), 'pane.read', argv, timeoutMs);
    },
  };

  const workspace = {
    async list() {
      const argv = ['workspace', 'list'];
      return parseWorkspaceResponse(await execute(argv), argv, timeoutMs);
    },
  };

  const tab = {
    async list(listOptions?: { readonly workspaceId?: string }) {
      const argv = ['tab', 'list'];
      if (listOptions?.workspaceId !== undefined) {
        argv.push('--workspace', listOptions.workspaceId);
      }
      return parseTabResponse(await execute(argv), argv, timeoutMs);
    },
  };

  return { agent, pane, workspace, tab };
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
