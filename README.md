# @j1nn0/herdr-plugin-sdk

Typed building blocks for Herdr Plugin v1.

[![npm version](https://img.shields.io/npm/v/%40j1nn0%2Fherdr-plugin-sdk.svg)](https://www.npmjs.com/package/@j1nn0/herdr-plugin-sdk) [![CI](https://github.com/j1nn0/herdr-plugin-sdk/actions/workflows/ci.yml/badge.svg)](https://github.com/j1nn0/herdr-plugin-sdk/actions/workflows/ci.yml) [![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE) [![Node >= 22](https://img.shields.io/badge/node-%3E%3D22-339933.svg?logo=node.js&logoColor=white)](https://nodejs.org/)

> **Unofficial community project:** This project is not affiliated with or endorsed by the Herdr project.

Unofficial TypeScript tooling for Herdr Plugin v1 that removes repetitive runtime,
CLI, error-handling, and testing boilerplate. Herdr's official Plugin API remains
command-based: a `herdr-plugin.toml` manifest and ordinary executable commands
that Herdr launches. This package is a convenience layer over that model.

```ts
import { createHerdrClient, readPluginRuntime } from '@j1nn0/herdr-plugin-sdk';

const runtime = readPluginRuntime();
const workspaces = await createHerdrClient().workspace.list();
console.log(`${runtime.pluginId}: ${workspaces.length} workspace(s)`);
```

- Typed Herdr CLI client for `agent`, `pane`, `workspace`, and `tab` operations.
- Plugin runtime and context parsing from Herdr's environment.
- Typed narrowing for supported plugin events.
- Structured Herdr errors for environment, response, process, timeout, and CLI failures.
- Generic `run()` for commands without a typed client method yet.
- **Test Herdr plugins without running Herdr** with fixtures and an in-memory client.
- Zero runtime dependencies in the SDK itself.

## Quick Start

Install the SDK in a TypeScript plugin:

```sh
pnpm add @j1nn0/herdr-plugin-sdk
```

Herdr still launches ordinary executable commands declared in `herdr-plugin.toml`; the SDK does not change that command-based model.

An event command can validate and narrow a payload, then apply the plugin's own policy:

```ts
import {
  createHerdrClient,
  isPaneAgentStatusChanged,
  readPluginEvent,
} from '@j1nn0/herdr-plugin-sdk';

const event = readPluginEvent();
if (event !== null && isPaneAgentStatusChanged(event)) {
  if (event.data.agent_status === 'done') {
    const output = await createHerdrClient().pane.read(event.data.pane_id, {
      source: 'recent',
      lines: 20,
    });
    console.log(output);
  }
}
```

## Plugin runtime

Herdr supplies the plugin environment variables when it launches a command. `readPluginRuntime` validates the required variables and normalizes the invocation into one of the real invocation kinds: `action`, `event`, `startup`, `pane`, or `unknown`.

```ts
import { readPluginRuntime } from '@j1nn0/herdr-plugin-sdk';

const { pluginId, invocation } = readPluginRuntime();

switch (invocation.kind) {
  case 'action':
    console.log(pluginId, invocation.actionId, invocation.clickedUrl);
    break;
  case 'event':
    console.log(pluginId, invocation.event);
    break;
  case 'startup':
    console.log(pluginId, 'startup');
    break;
  case 'pane':
    console.log(pluginId, invocation.entrypointId);
    break;
  case 'unknown':
    console.log(pluginId, 'unknown invocation');
    break;
}
```

## Context and events

`readPluginContext` reads `HERDR_PLUGIN_CONTEXT_JSON`, while `readPluginEvent` reads the optional `HERDR_PLUGIN_EVENT_JSON` envelope. `isPaneAgentStatusChanged` narrows an event after its required fields have been checked.

Only an event-hook command receives `HERDR_PLUGIN_EVENT_JSON`, so `readPluginEvent` returns `null` when the variable is absent. A variable that is present but empty is a broken runtime boundary rather than "not an event hook", and throws `HerdrEnvError`.

```ts
import {
  isPaneAgentStatusChanged,
  readPluginContext,
  readPluginEvent,
} from '@j1nn0/herdr-plugin-sdk';

const context = readPluginContext();
console.log(context.workspace_id, context.focused_pane_id);

const event = readPluginEvent();
if (event !== null && isPaneAgentStatusChanged(event)) {
  const status = event.data.agent_status;
  console.log(event.data.pane_id, status);

  // The SDK applies no policy. `done` means nothing to the SDK;
  // deciding what to do is the plugin's job.
}
```

The SDK does not decide whether an `agent_status` of `done` should trigger an action, notification, or exit. Plugins decide what event data means for their own behavior.

## CLI client

`createHerdrClient` exposes typed `agent`, `pane`, `workspace`, and `tab` operations. Read output is returned as a string.

```ts
import {
  createHerdrClient,
  type ReadOptions,
} from '@j1nn0/herdr-plugin-sdk';

const client = createHerdrClient();
const readOptions: ReadOptions = {
  source: 'recent-unwrapped',
  lines: 80,
  format: 'text',
};

const agent = await client.agent.get('agent-target');
const agentText = await client.agent.read('agent-target', readOptions);
const pane = await client.pane.get('workspace:pane');
const paneText = await client.pane.read('workspace:pane', {
  source: 'recent-unwrapped',
});
const workspaces = await client.workspace.list();
const tabs = await client.tab.list({ workspaceId: 'workspace' });

console.log(agent, agentText, pane, paneText, workspaces, tabs);
```

The client also supports `timeoutMs`, `maxBuffer`, a custom `env`, and an executor seam through `HerdrClientOptions`.

## Generic CLI commands

The Herdr CLI is the official Plugin v1 API. The typed client intentionally starts small. For a Herdr CLI command that does not have a typed method yet, use `run()`:

```ts
import { createHerdrClient } from '@j1nn0/herdr-plugin-sdk';

const herdr = createHerdrClient();
const output = await herdr.run([
  'plugin',
  'pane',
  'open',
  '--plugin',
  'example.plugin',
  '--entrypoint',
  'inbox',
]);
```

`run()` uses the same binary resolution, no-shell execution, buffer limits, timeout, and structured error handling as typed methods. Successful stdout is returned unchanged. Prefer a typed method when the SDK provides one; use `run()` otherwise.

## Testing without Herdr

**You can test Herdr plugin code without a Herdr installation, running server, socket, or subprocess.** The testing entrypoint provides an in-memory client and fixtures:

```ts
import { readPluginRuntime } from '@j1nn0/herdr-plugin-sdk';
import {
  createAgentFixture,
  createMockHerdrClient,
  createPluginEnvFixture,
} from '@j1nn0/herdr-plugin-sdk/testing';

const client = createMockHerdrClient({
  agents: {
    'workspace:pane': createAgentFixture(),
  },
});

const agent = await client.agent.get('workspace:pane');
const runtime = readPluginRuntime(createPluginEnvFixture());

console.log(agent.agent_status, runtime.pluginId);
```

`createMockHerdrClient` records calls and can be configured with agent, pane, read, workspace, tab, and generic `run()` responses. For code that needs lower-level control, `createHerdrClient` accepts the exported `HerdrCommandExecutor` seam.

## Examples

- [`examples/hello-plugin`](examples/hello-plugin) — an action that lists workspaces through the typed client.
- [`examples/event-plugin`](examples/event-plugin) — an event hook that narrows status changes and applies an explicit `done` policy.

Both examples are verified in CI against the packed package artifact.

## Errors

`HerdrError` is the base class. Runtime parsing uses `HerdrEnvError` when required runtime variables are missing or empty, or when context/event JSON is invalid.

The four command/client error classes are:

- `HerdrCliError` is thrown when Herdr exits with a structured CLI error response.
- `HerdrResponseError` is thrown when a successful command returns a response with an invalid shape or missing required fields.
- `HerdrProcessError` is thrown for a spawn failure or an unstructured non-zero process exit.
- `HerdrTimeoutError` is thrown when a command exceeds its configured timeout.

A missing agent or pane always throws `HerdrCliError`; it does not return `null`. Use `isHerdrCliError` to handle a stable protocol code:

```ts
import {
  createHerdrClient,
  isHerdrCliError,
} from '@j1nn0/herdr-plugin-sdk';

try {
  await createHerdrClient().pane.get('missing-pane');
} catch (error: unknown) {
  if (isHerdrCliError(error, 'pane_not_found')) {
    console.log('The pane is not available.');
  }
}
```

The corresponding missing-agent code is `agent_not_found`.

## Guarantees

- Read output is returned exactly as Herdr produced it and is never parsed as JSON.
- Successful stdout from `run()` is returned unchanged and is never parsed.
- Unknown fields in Herdr responses, contexts, and events are preserved and never cause failures. A field whose contract the SDK already models is a different matter: if it is present with an invalid type, parsing throws rather than silently dropping it.
- Commands run with a binary plus an argument vector; they never run through a shell.
- Errors never carry environment contents. `HerdrProcessError` may include only the truncated `stderr` diagnostic described by its API.

## Compatibility and design

- Herdr `>= 0.8.2`
- Node.js `>= 22`
- CLI-first integration through the Herdr CLI

The client shells out to the Herdr CLI. By default it resolves the binary from `HERDR_BIN_PATH` (or uses `herdr` when that variable is not set); `createHerdrClient` also accepts an explicit `binPath`. This is the portable integration path. There is no socket client.

## v0.1 scope

v0.1 provides runtime/environment parsing, context and event parsing, typed and generic CLI operations, safe error types, and testing fixtures/mock clients. It is intentionally a small CLI-first SDK for executable Herdr Plugin v1 commands.

### Not included in v0.1

- Raw socket client
- Event subscriptions
- Manifest generation
- `definePlugin()` or a plugin lifecycle framework
- `create-herdr-plugin` scaffolding CLI
- JSON Schema code generation
- Plugin storage abstraction
- Marketplace integration

## License

MIT
