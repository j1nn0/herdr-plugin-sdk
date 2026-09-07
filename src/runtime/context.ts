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

  return sanitizeContext(parsed);
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

function sanitizeContext(value: Record<string, unknown>): PluginContext {
  const context: Record<string, unknown> = { ...value };

  // Drop malformed known fields instead of coercing them; unknown fields remain untouched.
  for (const field of CONTEXT_STRING_FIELDS) {
    if (typeof context[field] !== 'string') {
      delete context[field];
    }
  }

  if ('focused_pane_status' in context && !isAgentStatus(context.focused_pane_status)) {
    delete context.focused_pane_status;
  }

  if ('worktree' in context) {
    const worktree = context.worktree;
    if (isPlainObject(worktree)) {
      context.worktree = sanitizeWorktree(worktree);
    } else {
      delete context.worktree;
    }
  }

  return context as PluginContext;
}

function sanitizeWorktree(value: Record<string, unknown>): Record<string, unknown> {
  const worktree: Record<string, unknown> = { ...value };
  for (const field of WORKTREE_STRING_FIELDS) {
    if (typeof worktree[field] !== 'string') {
      delete worktree[field];
    }
  }
  if ('is_linked_worktree' in worktree && typeof worktree.is_linked_worktree !== 'boolean') {
    delete worktree.is_linked_worktree;
  }
  return worktree;
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
