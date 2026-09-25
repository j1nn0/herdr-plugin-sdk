/** Public testing utilities for Herdr plugin unit tests. */
export {
  createAgentFixture,
  createAgentGetOutputFixture,
  createCliErrorOutputFixture,
} from './fixtures.js';
export { createMockHerdrClient } from './mock-client.js';
export {
  createPaneFixture,
  createPaneGetOutputFixture,
  createPaneListOutputFixture,
} from './fixtures.js';
export {
  createPluginContextFixture,
  createPluginEnvFixture,
  createPluginEventFixture,
  createPluginPaneCloseOutputFixture,
  createPluginPaneOpenOutputFixture,
} from './fixtures.js';
export { createRecordingExecutor } from './recording-executor.js';
export {
  createTabFixture,
  createTabListOutputFixture,
  createTabRenameOutputFixture,
} from './fixtures.js';
export {
  createWorkspaceFixture,
  createWorkspaceListOutputFixture,
  createWorkspaceRenameOutputFixture,
} from './fixtures.js';
export { serializeCliOutput } from './fixtures.js';
export type { MockHerdrCall, MockHerdrClient, MockHerdrClientSetup } from './mock-client.js';
export type { RecordedHerdrCommand, RecordingExecutor } from './recording-executor.js';
