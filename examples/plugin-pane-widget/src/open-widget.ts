import { createHerdrClient, readPluginRuntime } from '@j1nn0/herdr-plugin-sdk';

async function main(): Promise<void> {
  const runtime = readPluginRuntime();
  const client = createHerdrClient();
  const pane = await client.plugin.pane.open({
    pluginId: runtime.pluginId,
    entrypoint: 'widget',
    placement: 'overlay',
    focus: false,
  });

  await client.pane.reportMetadata(pane.pane_id, {
    source: `plugin:${runtime.pluginId}`,
    tokens: { status: 'ready' },
  });
  await client.plugin.pane.close(pane.pane_id);
}

try {
  await main();
} catch (error: unknown) {
  console.error(
    error instanceof Error
      ? `Plugin pane widget failed: ${error.message}`
      : 'Plugin pane widget failed.',
  );
  process.exitCode = 1;
}
