import { HerdrEnvError } from '../errors.js';
import type { EnvSource, PluginInvocation, PluginRuntime } from './types.js';

const REQUIRED_RUNTIME_VARIABLES = [
  'HERDR_PLUGIN_ID',
  'HERDR_PLUGIN_ROOT',
  'HERDR_PLUGIN_CONFIG_DIR',
  'HERDR_PLUGIN_STATE_DIR',
] as const;

/** Reports whether an environment was marked as being launched by Herdr. */
export function isHerdrEnvironment(env: EnvSource = process.env): boolean {
  return env.HERDR_ENV === '1';
}

/** Reads and validates the runtime environment for the current plugin command. */
export function readPluginRuntime(env: EnvSource = process.env): PluginRuntime {
  const pluginId = readRequired(env, REQUIRED_RUNTIME_VARIABLES[0]);
  const pluginRoot = readRequired(env, REQUIRED_RUNTIME_VARIABLES[1]);
  const configDir = readRequired(env, REQUIRED_RUNTIME_VARIABLES[2]);
  const stateDir = readRequired(env, REQUIRED_RUNTIME_VARIABLES[3]);
  const event = env.HERDR_PLUGIN_EVENT;

  let invocation: PluginInvocation;
  if (event === 'startup') {
    invocation = { kind: 'startup' };
  } else if (event !== undefined && event !== '') {
    invocation = { kind: 'event', event };
  } else if (env.HERDR_PLUGIN_ACTION_ID !== undefined && env.HERDR_PLUGIN_ACTION_ID !== '') {
    invocation = {
      kind: 'action',
      actionId: env.HERDR_PLUGIN_ACTION_ID,
      clickedUrl: env.HERDR_PLUGIN_CLICKED_URL ?? null,
      linkHandlerId: env.HERDR_PLUGIN_LINK_HANDLER_ID ?? null,
    };
  } else if (
    env.HERDR_PLUGIN_ENTRYPOINT_ID !== undefined &&
    env.HERDR_PLUGIN_ENTRYPOINT_ID !== ''
  ) {
    invocation = {
      kind: 'pane',
      entrypointId: env.HERDR_PLUGIN_ENTRYPOINT_ID,
    };
  } else {
    invocation = { kind: 'unknown' };
  }

  return {
    pluginId,
    pluginRoot,
    configDir,
    stateDir,
    binPath: readOptional(env, 'HERDR_BIN_PATH'),
    socketPath: readOptional(env, 'HERDR_SOCKET_PATH'),
    workspaceId: readOptional(env, 'HERDR_WORKSPACE_ID'),
    tabId: readOptional(env, 'HERDR_TAB_ID'),
    paneId: readOptional(env, 'HERDR_PANE_ID'),
    invocation,
  };
}

function readRequired(env: EnvSource, variable: string): string {
  const value = env[variable];
  if (value === undefined || value === '') {
    throw new HerdrEnvError({
      variable,
      reason: 'is required and must not be empty.',
    });
  }
  return value;
}

function readOptional(env: EnvSource, variable: string): string | null {
  const value = env[variable];
  return value === undefined || value === '' ? null : value;
}
