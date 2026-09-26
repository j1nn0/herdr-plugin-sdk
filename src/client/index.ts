/** Public client API for the Herdr CLI. */
export { createHerdrClient } from './client.js';
export type {
  Agent,
  AgentSession,
  HerdrClient,
  HerdrClientOptions,
  Pane,
  PaneForegroundProcess,
  PaneProcessInfo,
  PaneReportMetadataOptions,
  PaneScroll,
  PluginPaneDirection,
  PluginPaneOpenOptions,
  PluginPanePlacement,
  ReadFormat,
  ReadOptions,
  ReadSource,
  Tab,
  TabCreateOptions,
  TabCreateResult,
  Workspace,
} from './types.js';
export type { HerdrCommandExecutor, HerdrCommandRequest, HerdrCommandResult } from './executor.js';
