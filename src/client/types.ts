import type { AgentStatus } from "../runtime/types.js";

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

/** Agent session metadata returned as part of an agent or pane payload. */
export interface AgentSession {
  readonly agent: string;
  readonly kind: "id" | "path";
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

/** Terminal content source accepted by a Herdr read command. */
export type ReadSource = "visible" | "recent" | "recent-unwrapped" | "detection";

/** Terminal content format accepted by a Herdr read command. */
export type ReadFormat = "text" | "ansi";

/** Options forwarded to an agent or pane read command. */
export interface ReadOptions {
  readonly source?: ReadSource;
  readonly lines?: number;
  readonly format?: ReadFormat;
}

/** Options for creating a typed Herdr CLI client. */
export interface HerdrClientOptions {
  readonly binPath?: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly timeoutMs?: number;
  readonly maxBuffer?: number;
  readonly executor?: import("./executor.js").HerdrCommandExecutor;
}

/** Typed operations exposed by the Herdr CLI client. */
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
    /** Reads terminal text associated with a pane. */
    read(paneId: string, options?: ReadOptions): Promise<string>;
  };
  readonly workspace: {
    /** Lists workspaces visible to the Herdr CLI. */
    list(): Promise<Workspace[]>;
  };
  readonly tab: {
    /** Lists tabs, optionally limited to one workspace. */
    list(options?: { readonly workspaceId?: string }): Promise<Tab[]>;
  };
}
