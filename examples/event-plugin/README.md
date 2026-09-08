# Event plugin

This small Herdr Plugin v1 example handles the
`pane.agent_status_changed` event. The SDK parses and narrows the event; the
example's own policy treats `agent_status === "done"` as interesting and reads
the pane's recent output. Malformed event payloads are reported on stderr and
exit successfully, while events outside that policy are ignored quietly.

## Install

Install the registry dependency in this example directory:

```sh
npm install
```

## Build, typecheck, and test

```sh
npm run typecheck
npm run build
npm test
```

The test uses `createPluginEnvFixture()` and `createMockHerdrClient()` only; it
needs no Herdr installation, server, socket, or subprocess.

## Link for local development

Build before linking:

```sh
npm run build
herdr plugin link .
```

Herdr does not build a linked plugin for `herdr plugin link`; the compiled
`dist/` directory must already exist. After linking, Herdr invokes `dist/hook.js`
for `pane.agent_status_changed` events.

## Concepts to notice

- `readPluginEvent()` returns `null` when `HERDR_PLUGIN_EVENT_JSON` is absent.
- `isPaneAgentStatusChanged()` validates and narrows the event contract.
- The SDK assigns no meaning to `done`; deciding that it is interesting is this
  example's application policy.
- `createMockHerdrClient()` tests the policy without Herdr or a subprocess.
