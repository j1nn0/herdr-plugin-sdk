import {
  HerdrCliError,
  HerdrProcessError,
  HerdrResponseError,
  HerdrTimeoutError,
} from '../errors.js';
import type { HerdrCommandResult } from './executor.js';
import type { Agent, Pane, Tab, Workspace } from './types.js';
/* oxlint-disable max-lines */

interface RequiredField {
  readonly name: string;
  readonly isValid: (value: unknown) => boolean;
}

type ResourceSpec = readonly [
  operation: string,
  expectedType: string,
  payloadKey: string,
  fields: readonly RequiredField[],
];

type CliErrorPayload = { readonly code: string; readonly message: string };

const isString = (value: unknown): boolean => typeof value === 'string';
const isBoolean = (value: unknown): boolean => typeof value === 'boolean';
const isInteger = (value: unknown): boolean => typeof value === 'number' && Number.isInteger(value);

const AGENT_FIELDS: readonly RequiredField[] = [
  required('pane_id', isString),
  required('terminal_id', isString),
  required('workspace_id', isString),
  required('tab_id', isString),
  required('focused', isBoolean),
  required('agent_status', isAgentStatus),
  required('revision', isInteger),
];

const PANE_FIELDS = AGENT_FIELDS;

const WORKSPACE_FIELDS: readonly RequiredField[] = [
  required('workspace_id', isString),
  required('active_tab_id', isString),
  required('label', isString),
  required('number', isInteger),
  required('pane_count', isInteger),
  required('tab_count', isInteger),
  required('agent_status', isAgentStatus),
  required('focused', isBoolean),
];

const TAB_FIELDS: readonly RequiredField[] = [
  required('tab_id', isString),
  required('workspace_id', isString),
  required('label', isString),
  required('number', isInteger),
  required('pane_count', isInteger),
  required('agent_status', isAgentStatus),
  required('focused', isBoolean),
];

const AGENT_SPEC: ResourceSpec = ['agent.get', 'agent_info', 'agent', AGENT_FIELDS];
const PANE_SPEC: ResourceSpec = ['pane.get', 'pane_info', 'pane', PANE_FIELDS];
const WORKSPACE_SPEC: ResourceSpec = [
  'workspace.list',
  'workspace_list',
  'workspaces',
  WORKSPACE_FIELDS,
];
const TAB_SPEC: ResourceSpec = ['tab.list', 'tab_list', 'tabs', TAB_FIELDS];

export function parseAgentResponse(
  result: HerdrCommandResult,
  argv: readonly string[],
  timeoutMs: number,
): Agent {
  return parseResourceResponse(result, argv, timeoutMs, AGENT_SPEC);
}

export function parsePaneResponse(
  result: HerdrCommandResult,
  argv: readonly string[],
  timeoutMs: number,
): Pane {
  return parseResourceResponse(result, argv, timeoutMs, PANE_SPEC);
}

export function parseWorkspaceResponse(
  result: HerdrCommandResult,
  argv: readonly string[],
  timeoutMs: number,
): Workspace[] {
  return parseResourceListResponse(result, argv, timeoutMs, WORKSPACE_SPEC);
}

export function parseTabResponse(
  result: HerdrCommandResult,
  argv: readonly string[],
  timeoutMs: number,
): Tab[] {
  return parseResourceListResponse(result, argv, timeoutMs, TAB_SPEC);
}

/** Handles process status; agent_not_found and pane_not_found errors always throw. */
export function parseReadResponse(
  result: HerdrCommandResult,
  operation: 'agent.read' | 'pane.read',
  argv: readonly string[],
  timeoutMs: number,
): string {
  assertCommandSucceeded(result, operation, argv, timeoutMs);

  // Read output is user/agent content. Herdr signals read failures on stderr with
  // a non-zero exit, so stdout is never an error envelope.
  return readText(result.stdout);
}

/** Runs an unmodeled CLI command without interpreting its stdout. */
export function parseRunResponse(
  result: HerdrCommandResult,
  argv: readonly string[],
  timeoutMs: number,
): string {
  assertCommandSucceeded(result, 'cli.run', argv, timeoutMs);
  return result.stdout;
}

function parseResourceResponse<T>(
  result: HerdrCommandResult,
  argv: readonly string[],
  timeoutMs: number,
  spec: ResourceSpec,
): T {
  const [operation, , payloadKey, fields] = spec;
  const response = parseStructuredEnvelope(result, argv, timeoutMs, spec);
  const payload = response[payloadKey];
  if (!isPlainObject(payload)) {
    throw responseError(operation, argv, `result.${payloadKey} must be an object.`);
  }

  validateRequiredFields(payload, operation, argv, `result.${payloadKey}`, fields);
  return payload as T;
}

function parseResourceListResponse<T>(
  result: HerdrCommandResult,
  argv: readonly string[],
  timeoutMs: number,
  spec: ResourceSpec,
): T[] {
  const [operation, , payloadKey, fields] = spec;
  const response = parseStructuredEnvelope(result, argv, timeoutMs, spec);
  const payload = response[payloadKey];
  if (!Array.isArray(payload)) {
    throw responseError(operation, argv, `result.${payloadKey} must be an array.`);
  }

  return payload.map((item, index) => {
    if (!isPlainObject(item)) {
      throw responseError(operation, argv, `result.${payloadKey}[${index}] must be an object.`);
    }
    validateRequiredFields(item, operation, argv, `result.${payloadKey}[${index}]`, fields);
    return item as T;
  });
}

function parseStructuredEnvelope(
  result: HerdrCommandResult,
  argv: readonly string[],
  timeoutMs: number,
  spec: ResourceSpec,
): Record<string, unknown> {
  const [operation, expectedType] = spec;
  assertCommandSucceeded(result, operation, argv, timeoutMs);

  const parsed = parseJson(readText(result.stdout));
  if (!isPlainObject(parsed)) {
    throw responseError(operation, argv, 'stdout must contain a JSON object.');
  }

  const response = parsed.result;
  if (!isPlainObject(response)) {
    throw responseError(operation, argv, 'stdout is missing a result object.');
  }

  if (response.type !== expectedType) {
    throw responseError(operation, argv, `result.type must be "${expectedType}".`);
  }

  return response;
}

function assertCommandSucceeded(
  result: HerdrCommandResult,
  operation: string,
  argv: readonly string[],
  timeoutMs: number,
): void {
  if (result.spawnError !== undefined) {
    throw new HerdrProcessError({
      operation,
      argv,
      exitCode: null,
      signal: result.signal,
      stderr: readText(result.stderr),
      cause: result.spawnError,
    });
  }

  if (result.timedOut) {
    throw new HerdrTimeoutError({
      operation,
      argv,
      timeoutMs,
    });
  }

  if (result.exitCode !== 0) {
    const cliError = parseCliError(readText(result.stderr));
    if (cliError !== null) {
      throw new HerdrCliError({
        code: cliError.code,
        message: cliError.message,
        operation,
        argv,
        exitCode: result.exitCode,
      });
    }

    throw new HerdrProcessError({
      operation,
      argv,
      exitCode: result.exitCode,
      signal: result.signal,
      stderr: readText(result.stderr),
    });
  }
}

function parseCliError(stderr: string): CliErrorPayload | null {
  const parsed = parseJson(stderr);
  if (!isPlainObject(parsed) || !isPlainObject(parsed.error)) {
    return null;
  }

  if (typeof parsed.error.code !== 'string' || typeof parsed.error.message !== 'string') {
    return null;
  }

  return {
    code: parsed.error.code,
    message: parsed.error.message,
  };
}

function validateRequiredFields(
  payload: Record<string, unknown>,
  operation: string,
  argv: readonly string[],
  path: string,
  fields: readonly RequiredField[],
): void {
  for (const field of fields) {
    if (!Object.hasOwn(payload, field.name) || !field.isValid(payload[field.name])) {
      throw responseError(operation, argv, `${path}.${field.name} is missing or invalid.`);
    }
  }
}

function responseError(
  operation: string,
  argv: readonly string[],
  detail: string,
): HerdrResponseError {
  return new HerdrResponseError({ operation, argv, detail });
}

function required(name: string, isValid: (value: unknown) => boolean): RequiredField {
  return { name, isValid };
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function readText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isAgentStatus(value: unknown): boolean {
  return (
    value === 'idle' ||
    value === 'working' ||
    value === 'blocked' ||
    value === 'done' ||
    value === 'unknown'
  );
}
