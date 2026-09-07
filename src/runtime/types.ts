/** Agent status values defined by the Herdr plugin event contract. */
export type AgentStatus = 'idle' | 'working' | 'blocked' | 'done' | 'unknown';

/** Wire-shaped worktree information carried in a plugin invocation context. */
export interface WorkspaceWorktree {
  readonly repo_key?: string;
  readonly repo_name?: string;
  readonly repo_root?: string;
  readonly checkout_path?: string;
  readonly is_linked_worktree?: boolean;
}

/** Wire-shaped plugin invocation context with optional snake_case fields. */
export interface PluginContext {
  readonly workspace_id?: string;
  readonly workspace_label?: string;
  readonly workspace_cwd?: string;
  readonly worktree?: WorkspaceWorktree;
  readonly tab_id?: string;
  readonly tab_label?: string;
  readonly focused_pane_id?: string;
  readonly focused_pane_cwd?: string;
  readonly focused_pane_agent?: string;
  readonly focused_pane_status?: AgentStatus;
  readonly selected_text?: string;
  readonly invocation_source?: string;
  readonly correlation_id?: string;
  readonly clicked_url?: string;
  readonly link_handler_id?: string;
}

/** Identifies the kind of Herdr invocation that launched a plugin command. */
export type PluginInvocation =
  | {
      readonly kind: 'action';
      readonly actionId: string;
      readonly clickedUrl: string | null;
      readonly linkHandlerId: string | null;
    }
  | { readonly kind: 'event'; readonly event: string }
  | { readonly kind: 'startup' }
  | { readonly kind: 'pane'; readonly entrypointId: string }
  | { readonly kind: 'unknown' };

/** Normalized environment information for the current plugin command. */
export interface PluginRuntime {
  readonly pluginId: string;
  readonly pluginRoot: string;
  readonly configDir: string;
  readonly stateDir: string;
  readonly binPath: string | null;
  readonly socketPath: string | null;
  readonly workspaceId: string | null;
  readonly tabId: string | null;
  readonly paneId: string | null;
  readonly invocation: PluginInvocation;
}

/** Generic event data that retains unknown Herdr fields. */
export interface PluginEventData {
  readonly type: string;
  readonly [key: string]: unknown;
}

/** Parsed Herdr plugin event envelope. */
export interface PluginEvent {
  readonly event: string;
  readonly name: string | null;
  readonly data: PluginEventData;
}

/** Read-only environment source accepted by the runtime parsers. */
export type EnvSource = Readonly<Record<string, string | undefined>>;

/** Typed data for a `pane_agent_status_changed` event. */
export interface PaneAgentStatusChangedData extends PluginEventData {
  readonly type: 'pane_agent_status_changed';
  readonly pane_id: string;
  readonly workspace_id: string;
  readonly agent_status: AgentStatus;
  readonly agent?: string;
  readonly title?: string;
  readonly display_agent?: string;
  readonly state_labels?: Readonly<Record<string, string>>;
}
