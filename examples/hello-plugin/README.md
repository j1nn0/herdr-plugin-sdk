# Hello plugin

This small Herdr Plugin v1 example demonstrates an action command that reads the
plugin runtime, creates a typed Herdr client, lists workspaces, and prints a
short summary. A `HerdrCliError` is reported separately from other failures.

## Install

Install the registry dependency in this example directory:

```sh
npm install
```

## Build and typecheck

```sh
npm run typecheck
npm run build
```

This action-only example has no standalone test command; run it through Herdr after linking. The packed-artifact verification still typechecks and builds it without a Herdr installation.

## Link for local development

Build before linking:

```sh
npm run build
herdr plugin link .
```

Herdr does not build a linked plugin for `herdr plugin link`; the compiled
`dist/` directory must already exist. After linking, invoke **List workspaces**
from Herdr's plugin action UI.

## Concepts to notice

- `readPluginRuntime()` supplies the plugin id and optional current workspace id.
- `createHerdrClient().workspace.list()` is the typed CLI operation.
- `isHerdrCliError()` distinguishes a Herdr protocol failure from other errors.
- The manifest action is global and launches an ordinary argv command.
