import { HerdrEnvError } from '../errors.js';
import type { EnvSource, PluginContext } from './types.js';

const CONTEXT_VARIABLE = 'HERDR_PLUGIN_CONTEXT_JSON';
const CONTEXT_STRING_FIELDS = [
  'workspace_id',
  'workspace_label',
  'workspace_cwd',
  'tab_id',
  'tab_label',
  'focused_pane_id',
  'focused_pane_cwd',
  'focused_pane_agent',
  'selected_text',
  'invocation_source',
  'correlation_id',
  'clicked_url',
  'link_handler_id',
] as const;
const WORKTREE_STRING_FIELDS = ['repo_key', 'repo_name', 'repo_root', 'checkout_path'] as const;

/** Parses the Herdr plugin invocation context from its JSON environment variable. */
export function readPluginContext(env: EnvSource = process.env): PluginContext {
  const raw = env[CONTEXT_VARIABLE];
  if (raw === undefined || raw === '') {
    throw new HerdrEnvError({
      variable: CONTEXT_VARIABLE,
      reason: 'is required and must contain a JSON object.',
    });
  }

  const parsed = parseJson(raw, CONTEXT_VARIABLE);
  if (!isPlainObject(parsed)) {
    throw new HerdrEnvError({
      variable: CONTEXT_VARIABLE,
      reason: 'must contain a JSON object.',
    });
  }

  return validateContext(parsed);
}

function parseJson(raw: string, variable: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new HerdrEnvError({
      variable,
      reason: 'must contain valid JSON.',
    });
  }
}

function validateContext(value: Record<string, unknown>): PluginContext {
  for (const field of CONTEXT_STRING_FIELDS) {
    if (field in value && typeof value[field] !== 'string') {
      throw invalidContextField(field, 'must be a string');
    }
  }

  if ('focused_pane_status' in value && !isAgentStatus(value.focused_pane_status)) {
    throw invalidContextField('focused_pane_status', 'must be a valid agent status');
  }

  if ('worktree' in value) {
    if (!isPlainObject(value.worktree)) {
      throw invalidContextField('worktree', 'must be a plain object');
    }
    validateWorktree(value.worktree);
  }

  return value as PluginContext;
}

function validateWorktree(value: Record<string, unknown>): void {
  for (const field of WORKTREE_STRING_FIELDS) {
    if (field in value && typeof value[field] !== 'string') {
      throw invalidContextField(`worktree.${field}`, 'must be a string');
    }
  }

  if ('is_linked_worktree' in value && typeof value.is_linked_worktree !== 'boolean') {
    throw invalidContextField('worktree.is_linked_worktree', 'must be a boolean');
  }
}

function invalidContextField(path: string, expected: string): HerdrEnvError {
  return new HerdrEnvError({
    variable: CONTEXT_VARIABLE,
    reason: `field "${path}" ${expected}.`,
  });
}

function isAgentStatus(
  value: unknown,
): value is 'idle' | 'working' | 'blocked' | 'done' | 'unknown' {
  return (
    value === 'idle' ||
    value === 'working' ||
    value === 'blocked' ||
    value === 'done' ||
    value === 'unknown'
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
