import type { AgentStatus } from '../runtime/types.js';

/** Agent information returned by the Herdr CLI. */
export interface Agent {
  readonly pane_id: string;
  readonly terminal_id: string;
  readonly workspace_id: string;
  readonly tab_id: string;
  readonly focused: boolean;
  readonly agent_status: AgentStatus;
  readonly revision: number;
  readonly agent?: string | null;
  readonly display_agent?: string | null;
  readonly name?: string | null;
  readonly title?: string | null;
  readonly cwd?: string | null;
  readonly foreground_cwd?: string | null;
  readonly terminal_title?: string | null;
  readonly terminal_title_stripped?: string | null;
  readonly agent_session?: AgentSession | null;
  readonly interactive_ready?: boolean | null;
  readonly launch_pending?: boolean | null;
  readonly screen_detection_skipped?: boolean | null;
  readonly state_change_seq?: number | null;
  readonly state_labels?: Readonly<Record<string, string>> | null;
  readonly tokens?: unknown;
  readonly [key: string]: unknown;
}

/** Pane information returned by the Herdr CLI. */
export interface Pane {
  readonly pane_id: string;
  readonly terminal_id: string;
  readonly workspace_id: string;
  readonly tab_id: string;
  readonly focused: boolean;
  readonly agent_status: AgentStatus;
  readonly revision: number;
  readonly agent?: string | null;
  readonly display_agent?: string | null;
  readonly label?: string | null;
  readonly title?: string | null;
  readonly cwd?: string | null;
  readonly foreground_cwd?: string | null;
  readonly terminal_title?: string | null;
  readonly terminal_title_stripped?: string | null;
  readonly agent_session?: AgentSession | null;
  readonly scroll?: PaneScroll | null;
  readonly state_labels?: Readonly<Record<string, string>> | null;
  readonly tokens?: unknown;
  readonly [key: string]: unknown;
}
/** A foreground process reported by the Herdr CLI. */
export interface PaneForegroundProcess {
  readonly pid: number;
  readonly name: string;
  readonly argv0?: string | null;
  readonly argv?: readonly string[] | null;
  readonly cmdline?: string | null;
  readonly cwd?: string | null;
  readonly [key: string]: unknown;
}

/** Process information returned for a pane by the Herdr CLI. */
export interface PaneProcessInfo {
  readonly pane_id: string;
  readonly shell_pid?: number | null;
  readonly foreground_process_group_id?: number | null;
  readonly foreground_processes?: readonly PaneForegroundProcess[];
  readonly [key: string]: unknown;
}

/** Agent session metadata returned as part of an agent or pane payload. */
export interface AgentSession {
  readonly agent: string;
  readonly kind: 'id' | 'path';
  readonly source: string;
  readonly value: string;
  readonly [key: string]: unknown;
}

/** Pane scroll state returned as part of a pane payload. */
export interface PaneScroll {
  readonly max_offset_from_bottom: number;
  readonly offset_from_bottom: number;
  readonly viewport_rows: number;
  readonly [key: string]: unknown;
}

/** Workspace information returned by the Herdr CLI. */
export interface Workspace {
  readonly workspace_id: string;
  readonly active_tab_id: string;
  readonly label: string;
  readonly number: number;
  readonly pane_count: number;
  readonly tab_count: number;
  readonly agent_status: AgentStatus;
  readonly focused: boolean;
  readonly tokens?: unknown;
  readonly worktree?: unknown;
  readonly [key: string]: unknown;
}

/** Tab information returned by the Herdr CLI. */
export interface Tab {
  readonly tab_id: string;
  readonly workspace_id: string;
  readonly label: string;
  readonly number: number;
  readonly pane_count: number;
  readonly agent_status: AgentStatus;
  readonly focused: boolean;
  readonly [key: string]: unknown;
}
/** Options for creating a Herdr tab. */
export interface TabCreateOptions {
  readonly workspaceId?: string;
  readonly cwd?: string;
  readonly label?: string;
  readonly env?: Readonly<Record<string, string>>;
  readonly focus?: boolean;
}

/** Tab and root pane returned after creating a tab. */
export interface TabCreateResult {
  readonly tab: Tab;
  readonly rootPane: Pane;
}

/** Terminal content source accepted by a Herdr read command. */
export type ReadSource = 'visible' | 'recent' | 'recent-unwrapped' | 'detection';

/** Terminal content format accepted by a Herdr read command. */
export type ReadFormat = 'text' | 'ansi';

/** Options forwarded to an agent or pane read command. */
export interface ReadOptions {
  readonly source?: ReadSource;
  readonly lines?: number;
  readonly format?: ReadFormat;
}
/** Plugin pane placement accepted by `plugin pane open`. */
export type PluginPanePlacement = 'overlay' | 'popup' | 'split' | 'tab' | 'zoomed' | 'fullscreen';

/** Split direction accepted by `plugin pane open`. */
export type PluginPaneDirection = 'right' | 'down';

/** Options for opening a plugin pane through the Herdr CLI. */
export interface PluginPaneOpenOptions {
  readonly pluginId: string;
  readonly entrypoint: string;
  readonly placement?: PluginPanePlacement;
  readonly workspaceId?: string;
  readonly targetPane?: string;
  readonly direction?: PluginPaneDirection;
  readonly cwd?: string;
  readonly env?: Readonly<Record<string, string>>;
  readonly focus?: boolean;
}

/** Display-only metadata reported by a pane. */
export interface PaneReportMetadataOptions {
  readonly source: string;
  readonly title?: string;
  readonly clearTitle?: boolean;
  readonly tokens?: Readonly<Record<string, string>>;
  readonly clearTokens?: readonly string[];
  readonly ttlMs?: number;
}

/** Options for creating a typed Herdr CLI client. */
export interface HerdrClientOptions {
  readonly binPath?: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly timeoutMs?: number;
  readonly maxBuffer?: number;
  readonly executor?: import('./executor.js').HerdrCommandExecutor;
}

/** Operations exposed by the Herdr CLI client. */
export interface HerdrClient {
  readonly agent: {
    /** Gets structured information about an agent target. */
    get(target: string): Promise<Agent>;
    /** Reads terminal text associated with an agent target. */
    read(target: string, options?: ReadOptions): Promise<string>;
  };
  readonly pane: {
    /** Gets structured information about a pane. */
    get(paneId: string): Promise<Pane>;
    /** Lists panes, optionally limited to one workspace. */
    list(options?: { readonly workspaceId?: string }): Promise<Pane[]>;
    /** Reads terminal text associated with a pane. */
    read(paneId: string, options?: ReadOptions): Promise<string>;
    /** Reports display-only metadata for a pane. */
    reportMetadata(paneId: string, options: PaneReportMetadataOptions): Promise<void>;
    /** Gets process information for an explicit pane id. */
    processInfo(paneId: string): Promise<PaneProcessInfo>;
  };
  readonly plugin: {
    readonly pane: {
      /** Opens a plugin pane and returns its pane information. */
      open(options: PluginPaneOpenOptions): Promise<Pane>;
      /** Closes a plugin pane. */
      close(paneId: string): Promise<void>;
    };
  };
  readonly workspace: {
    /** Lists workspaces visible to the Herdr CLI. */
    list(): Promise<Workspace[]>;
    /** Renames a workspace. */
    rename(workspaceId: string, label: string): Promise<Workspace>;
  };
  readonly tab: {
    /** Lists tabs, optionally limited to one workspace. */
    list(options?: { readonly workspaceId?: string }): Promise<Tab[]>;
    /** Creates a tab and returns its tab and root pane information. */
    create(options?: TabCreateOptions): Promise<TabCreateResult>;
    /** Renames a tab. */
    rename(tabId: string, label: string): Promise<Tab>;
  };
  /** Runs a Herdr CLI command and returns its stdout unchanged. */
  run(argv: readonly string[]): Promise<string>;
}
