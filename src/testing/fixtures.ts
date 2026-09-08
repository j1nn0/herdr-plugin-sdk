import type { Agent, Pane, Tab, Workspace } from '../client/types.js';
import type { PluginContext, PaneAgentStatusChangedData } from '../runtime/types.js';

const WORKSPACE_ID = 'w1G';
const TAB_ID = `${WORKSPACE_ID}:t1`;
const PANE_ID = `${WORKSPACE_ID}:p1`;

/** Creates a complete agent payload with coherent fixture identifiers. */
export function createAgentFixture(overrides: Partial<Agent> = {}): Agent {
  return {
    pane_id: PANE_ID,
    terminal_id: 'term-1',
    workspace_id: WORKSPACE_ID,
    tab_id: TAB_ID,
    focused: true,
    agent_status: 'working',
    revision: 1,
    agent: 'pi',
    display_agent: 'pi',
    name: 'assistant',
    title: 'SDK fixture agent',
    cwd: '/workspace',
    ...overrides,
  };
}

/** Creates a complete pane payload with coherent fixture identifiers. */
export function createPaneFixture(overrides: Partial<Pane> = {}): Pane {
  return {
    pane_id: PANE_ID,
    terminal_id: 'term-1',
    workspace_id: WORKSPACE_ID,
    tab_id: TAB_ID,
    focused: true,
    agent_status: 'working',
    revision: 1,
    agent: 'pi',
    display_agent: 'pi',
    label: 'main',
    title: 'SDK fixture pane',
    cwd: '/workspace',
    scroll: {
      max_offset_from_bottom: 20,
      offset_from_bottom: 0,
      viewport_rows: 40,
    },
    ...overrides,
  };
}

/** Creates a complete workspace payload with coherent fixture identifiers. */
export function createWorkspaceFixture(overrides: Partial<Workspace> = {}): Workspace {
  return {
    workspace_id: WORKSPACE_ID,
    active_tab_id: TAB_ID,
    label: 'herdr-plugin-sdk',
    number: 1,
    pane_count: 1,
    tab_count: 1,
    agent_status: 'working',
    focused: true,
    ...overrides,
  };
}

/** Creates a complete tab payload with coherent fixture identifiers. */
export function createTabFixture(overrides: Partial<Tab> = {}): Tab {
  return {
    tab_id: TAB_ID,
    workspace_id: WORKSPACE_ID,
    label: 'agents',
    number: 1,
    pane_count: 1,
    agent_status: 'working',
    focused: true,
    ...overrides,
  };
}

/** Builds a plausible plugin-command environment. */
export function createPluginEnvFixture(
  overrides: Readonly<Record<string, string>> = {},
): Record<string, string> {
  return {
    HERDR_ENV: '1',
    HERDR_PLUGIN_ID: 'example.plugin',
    HERDR_PLUGIN_ROOT: '/plugins/example.plugin',
    HERDR_PLUGIN_CONFIG_DIR: '/config/example.plugin',
    HERDR_PLUGIN_STATE_DIR: '/state/example.plugin',
    HERDR_BIN_PATH: '/usr/local/bin/herdr',
    HERDR_SOCKET_PATH: '/tmp/herdr.sock',
    HERDR_WORKSPACE_ID: WORKSPACE_ID,
    HERDR_TAB_ID: TAB_ID,
    HERDR_PANE_ID: PANE_ID,
    HERDR_PLUGIN_CONTEXT_JSON: JSON.stringify(createPluginContextFixture()),
    ...overrides,
  };
}

/** Creates a complete plugin invocation context with coherent fixture identifiers. */
export function createPluginContextFixture(overrides: Partial<PluginContext> = {}): PluginContext {
  return {
    workspace_id: WORKSPACE_ID,
    workspace_label: 'herdr-plugin-sdk',
    workspace_cwd: '/workspace',
    worktree: {
      repo_key: 'j1nn0/herdr-plugin-sdk',
      repo_name: 'herdr-plugin-sdk',
      repo_root: '/workspace',
      checkout_path: '/workspace',
      is_linked_worktree: false,
    },
    tab_id: TAB_ID,
    tab_label: 'agents',
    focused_pane_id: PANE_ID,
    focused_pane_cwd: '/workspace',
    focused_pane_agent: 'pi',
    focused_pane_status: 'working',
    selected_text: '',
    invocation_source: 'plugin',
    correlation_id: 'fixture-correlation',
    clicked_url: 'https://example.test',
    link_handler_id: 'docs',
    ...overrides,
  };
}

/** Builds an event envelope suitable for HERDR_PLUGIN_EVENT_JSON. */
export function createPluginEventFixture(
  overrides: {
    readonly event?: string;
    readonly data?: Readonly<Record<string, unknown>>;
  } = {},
): { readonly event: string; readonly data: Record<string, unknown> } {
  const data: PaneAgentStatusChangedData = {
    type: 'pane_agent_status_changed',
    pane_id: `${WORKSPACE_ID}:p4`,
    workspace_id: WORKSPACE_ID,
    agent_status: 'done',
    agent: 'pi',
  };
  return {
    event: overrides.event ?? 'pane_agent_status_changed',
    data: { ...data, ...overrides.data },
  };
}
