# Changelog

All notable user-facing changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Maintenance convention: Work lands under [Unreleased]. Before a release, it moves to a concrete `## [X.Y.Z] - YYYY-MM-DD` section; only categories with entries appear.

## [Unreleased]

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

[Unreleased]: https://github.com/j1nn0/herdr-plugin-sdk/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/j1nn0/herdr-plugin-sdk/releases/tag/v0.1.0
