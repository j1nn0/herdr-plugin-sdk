# Plugin pane widget

This small Herdr Plugin v1 example opens a plugin-owned pane, reports display-only
metadata, and closes the pane through the typed CLI client. It uses no socket,
worker, persistence layer, or UI framework.

## Build and typecheck

```sh
npm install
npm run typecheck
npm run build
```

The manifest declares the `widget` pane entrypoint and launches
`dist/open-widget.js`. Herdr provides the plugin id to `readPluginRuntime()`; the
example then uses that id with `plugin.pane.open()` and reports a `status=ready`
token before closing the pane.
