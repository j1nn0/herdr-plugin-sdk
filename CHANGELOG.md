# Changelog

All notable user-facing changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Maintenance convention: Work lands under [Unreleased]. Before a release, it moves to a concrete `## [X.Y.Z] - YYYY-MM-DD` section; only categories with entries appear.

## [Unreleased]

### Added

- Typed `plugin.pane.open()` / `close()`, `pane.list()` / `reportMetadata()`, `tab.rename()`, and `workspace.rename()` operations.
- Testing output fixtures, `createRecordingExecutor()`, and expanded mock-client coverage for the new operations.
- The `examples/plugin-pane-widget` plugin pane lifecycle example.

### Changed

- `HerdrClient` now requires the new operation groups, which is source-breaking for manual client implementers. Clients created by `createHerdrClient()` and `createMockHerdrClient()` need no migration.

## [0.2.1] - 2026-09-24

### Fixed

- Typed CLI operations retain a 10,000 ms default SDK process timeout while generic `run()` defaults to no SDK process timeout; an explicit client timeout applies to both.
- Explicit `null` on optional context fields is normalized to absence, while null values inside a worktree object remain invalid.
- Child-process output-buffer overflows surface as `HerdrProcessError` with the underlying error preserved as `cause`.

## [0.2.0] - 2026-09-15

### Added

- Wire-payload fixtures and CLI output serialization helpers under the `testing` entrypoint.

### Changed

- Runtime validation now checks the optional `agent_session` contract in agent and pane responses.

## [0.1.0] - 2026-09-08

### Added

- Plugin runtime parsing with `readPluginRuntime` and `isHerdrEnvironment`.
- Plugin context parsing with `readPluginContext`.
- Plugin event parsing with `readPluginEvent` and `pane.agent_status_changed` narrowing through `isPaneAgentStatusChanged`.
- Typed `agent`, `pane`, `workspace`, and `tab` CLI operations through `createHerdrClient`.
- Generic `HerdrClient.run(argv)` support for commands without a typed method.
- Structured errors through `HerdrError`, `HerdrEnvError`, `HerdrCliError`, `HerdrResponseError`, `HerdrProcessError`, `HerdrTimeoutError`, and `isHerdrCliError`.
- The `@j1nn0/herdr-plugin-sdk/testing` entrypoint with a mock client and fixtures.
- Support for testing plugin logic without a running Herdr instance.
- Zero runtime dependencies.
- Compatibility with Herdr `>= 0.8.2` and Node.js `>= 22`.
- The `hello-plugin` and `event-plugin` examples.

[Unreleased]: https://github.com/j1nn0/herdr-plugin-sdk/compare/v0.2.1...HEAD
[0.2.1]: https://github.com/j1nn0/herdr-plugin-sdk/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/j1nn0/herdr-plugin-sdk/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/j1nn0/herdr-plugin-sdk/releases/tag/v0.1.0
