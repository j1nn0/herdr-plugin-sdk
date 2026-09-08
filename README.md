# @j1nn0/herdr-plugin-sdk

> **Unofficial SDK:** This is an unofficial, community-maintained SDK. It is **not** an official Herdr SDK and is not affiliated with or endorsed by the Herdr project.

Herdr Plugin v1 itself remains executable-command based: a `herdr-plugin.toml` manifest plus commands Herdr launches as processes. This SDK does not change that model; it removes the repetitive integration code inside those commands.

## Compatibility and design

- Herdr `>= 0.8.2`
- Node.js `>= 22`
- CLI-first integration through the Herdr CLI

The client shells out to the Herdr CLI. By default it resolves the binary from `HERDR_BIN_PATH` (or uses `herdr` when that variable is not set); `createHerdrClient` also accepts an explicit `binPath`. This is the portable integration path. There is no socket client.

## Installation

```sh
pnpm add @j1nn0/herdr-plugin-sdk
```

npm and Yarn work too. The package has zero runtime dependencies.

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

## Testing without Herdr

The testing entrypoint provides an in-memory client and fixtures. Tests do not need a Herdr installation, a running Herdr server, or a socket.

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

`createMockHerdrClient` records calls and can be configured with agent, pane, read, workspace, and tab results. For code that needs lower-level control, `createHerdrClient` accepts the exported `HerdrCommandExecutor` seam.

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
- Unknown fields in Herdr responses are preserved and never cause failures.
- Commands run with a binary plus an argument vector; they never run through a shell.
- Errors never carry environment contents. `HerdrProcessError` may include only the truncated `stderr` diagnostic described by its API.

## v0.1 scope

v0.1 provides runtime/environment parsing, context and event parsing, typed CLI operations, safe error types, and testing fixtures/mock clients. It is intentionally a small CLI-first SDK for executable Herdr Plugin v1 commands.

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
