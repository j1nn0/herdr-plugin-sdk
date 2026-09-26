import type { Agent, Pane, PaneProcessInfo, Tab, Workspace } from '../client/types.js';
import type { PluginContext, PaneAgentStatusChangedData } from '../runtime/types.js';
/* oxlint-disable max-lines */

const WORKSPACE_ID = 'w1G';
const TAB_ID = `${WORKSPACE_ID}:t1`;
const PANE_ID = `${WORKSPACE_ID}:p1`;

type OutputFixtureOverrides<T> = {
  readonly payload?: Partial<T>;
  readonly id?: string;
};

type CliErrorFixtureOverrides = {
  readonly code?: string;
  readonly message?: string;
  readonly id?: string;
};

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

/** Builds a successful `agent get` CLI output envelope. */
export function createAgentGetOutputFixture(overrides: OutputFixtureOverrides<Agent> = {}): {
  readonly id: string;
  readonly result: { readonly type: 'agent_info'; readonly agent: Agent };
} {
  return {
    id: overrides.id ?? 'fixture:agent:get',
    result: {
      type: 'agent_info',
      agent: createAgentFixture(overrides.payload),
    },
  };
}

/** Builds a successful `pane get` CLI output envelope. */
export function createPaneGetOutputFixture(overrides: OutputFixtureOverrides<Pane> = {}): {
  readonly id: string;
  readonly result: { readonly type: 'pane_info'; readonly pane: Pane };
} {
  return {
    id: overrides.id ?? 'fixture:pane:get',
    result: {
      type: 'pane_info',
      pane: createPaneFixture(overrides.payload),
    },
  };
}

/** Builds a successful `pane process-info` CLI output envelope. */
export function createPaneProcessInfoOutputFixture(
  overrides: OutputFixtureOverrides<PaneProcessInfo> = {},
): {
  readonly id: string;
  readonly result: { readonly type: 'pane_process_info'; readonly process_info: PaneProcessInfo };
} {
  return {
    id: overrides.id ?? 'fixture:pane:process-info',
    result: {
      type: 'pane_process_info',
      process_info: {
        pane_id: PANE_ID,
        shell_pid: 4200,
        foreground_process_group_id: 4200,
        foreground_processes: [
          {
            pid: 4201,
            name: 'node',
            argv0: 'node',
            argv: ['node', 'plugin.js'],
            cmdline: 'node plugin.js',
            cwd: '/workspace',
          },
        ],
        ...overrides.payload,
      },
    },
  };
}

/** Builds a successful `workspace list` CLI output envelope. */
export function createWorkspaceListOutputFixture(
  overrides: OutputFixtureOverrides<Workspace> = {},
): {
  readonly id: string;
  readonly result: { readonly type: 'workspace_list'; readonly workspaces: readonly Workspace[] };
} {
  return {
    id: overrides.id ?? 'fixture:workspace:list',
    result: {
      type: 'workspace_list',
      workspaces: [createWorkspaceFixture(overrides.payload)],
    },
  };
}

/** Builds a successful `tab list` CLI output envelope. */
export function createTabListOutputFixture(overrides: OutputFixtureOverrides<Tab> = {}): {
  readonly id: string;
  readonly result: { readonly type: 'tab_list'; readonly tabs: readonly Tab[] };
} {
  return {
    id: overrides.id ?? 'fixture:tab:list',
    result: {
      type: 'tab_list',
      tabs: [createTabFixture(overrides.payload)],
    },
  };
}

/** Builds a successful `tab create` CLI output envelope. */
export function createTabCreateOutputFixture(
  overrides: {
    readonly tab?: Partial<Tab>;
    readonly rootPane?: Partial<Pane>;
    readonly id?: string;
  } = {},
): {
  readonly id: string;
  readonly result: { readonly type: 'tab_created'; readonly tab: Tab; readonly root_pane: Pane };
} {
  return {
    id: overrides.id ?? 'fixture:tab:create',
    result: {
      type: 'tab_created',
      tab: createTabFixture(overrides.tab),
      root_pane: createPaneFixture(overrides.rootPane),
    },
  };
}

/** Builds a successful `pane list` CLI output envelope. */
export function createPaneListOutputFixture(overrides: OutputFixtureOverrides<Pane> = {}): {
  readonly id: string;
  readonly result: { readonly type: 'pane_list'; readonly panes: readonly Pane[] };
} {
  return {
    id: overrides.id ?? 'fixture:pane:list',
    result: {
      type: 'pane_list',
      panes: [createPaneFixture(overrides.payload)],
    },
  };
}

/** Builds a successful `plugin pane close` CLI output envelope. */
export function createPluginPaneCloseOutputFixture(
  overrides: OutputFixtureOverrides<{ readonly pane_id: string }> = {},
): {
  readonly id: string;
  readonly result: { readonly type: 'plugin_pane_closed'; readonly pane_id: string };
} {
  return {
    id: overrides.id ?? 'fixture:plugin-pane:close',
    result: {
      type: 'plugin_pane_closed',
      pane_id: overrides.payload?.pane_id ?? PANE_ID,
    },
  };
}

/** Builds a successful `plugin pane open` CLI output envelope. */
export function createPluginPaneOpenOutputFixture(overrides: OutputFixtureOverrides<Pane> = {}): {
  readonly id: string;
  readonly result: {
    readonly type: 'plugin_pane_opened';
    readonly plugin_pane: {
      readonly plugin_id: string;
      readonly entrypoint: string;
      readonly pane: Pane;
    };
  };
} {
  return {
    id: overrides.id ?? 'fixture:plugin-pane:open',
    result: {
      type: 'plugin_pane_opened',
      plugin_pane: {
        plugin_id: 'example.plugin',
        entrypoint: 'widget',
        pane: createPaneFixture(overrides.payload),
      },
    },
  };
}

/** Builds a successful `tab rename` CLI output envelope. */
export function createTabRenameOutputFixture(overrides: OutputFixtureOverrides<Tab> = {}): {
  readonly id: string;
  readonly result: { readonly type: 'tab_info'; readonly tab: Tab };
} {
  return {
    id: overrides.id ?? 'fixture:tab:rename',
    result: {
      type: 'tab_info',
      tab: createTabFixture(overrides.payload),
    },
  };
}

/** Builds a successful `workspace rename` CLI output envelope. */
export function createWorkspaceRenameOutputFixture(
  overrides: OutputFixtureOverrides<Workspace> = {},
): {
  readonly id: string;
  readonly result: { readonly type: 'workspace_info'; readonly workspace: Workspace };
} {
  return {
    id: overrides.id ?? 'fixture:workspace:rename',
    result: {
      type: 'workspace_info',
      workspace: createWorkspaceFixture(overrides.payload),
    },
  };
}

/** Builds a structured CLI error output envelope. */
export function createCliErrorOutputFixture(overrides: CliErrorFixtureOverrides = {}): {
  readonly id: string;
  readonly error: { readonly code: string; readonly message: string };
} {
  return {
    id: overrides.id ?? 'fixture:error',
    error: {
      code: overrides.code ?? 'pane_not_found',
      message: overrides.message ?? 'Pane "w1G:p404" not found.',
    },
  };
}

/** Serializes a CLI output envelope with the protocol trailing newline. */
export function serializeCliOutput(envelope: unknown): string {
  return `${JSON.stringify(envelope)}\n`;
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
