/** Public testing utilities for Herdr plugin unit tests. */
export { createMockHerdrClient } from './mock-client.js';
export type { MockHerdrCall, MockHerdrClient, MockHerdrClientSetup } from './mock-client.js';
export {
  createAgentFixture,
  createPaneFixture,
  createPluginContextFixture,
  createPluginEnvFixture,
  createPluginEventFixture,
  createTabFixture,
  createWorkspaceFixture,
} from './fixtures.js';
