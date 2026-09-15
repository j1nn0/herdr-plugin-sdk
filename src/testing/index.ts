/** Public testing utilities for Herdr plugin unit tests. */
export { createMockHerdrClient } from './mock-client.js';
export type { MockHerdrCall, MockHerdrClient, MockHerdrClientSetup } from './mock-client.js';
export {
  createAgentGetOutputFixture,
  createAgentFixture,
  createCliErrorOutputFixture,
  createPaneGetOutputFixture,
  createPaneFixture,
  createPluginContextFixture,
  createPluginEnvFixture,
  createPluginEventFixture,
  createTabListOutputFixture,
  createTabFixture,
  createWorkspaceListOutputFixture,
  createWorkspaceFixture,
  serializeCliOutput,
} from './fixtures.js';
