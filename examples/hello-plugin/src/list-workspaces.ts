import { createHerdrClient, isHerdrCliError, readPluginRuntime } from '@j1nn0/herdr-plugin-sdk';

async function main(): Promise<void> {
  const runtime = readPluginRuntime();
  const client = createHerdrClient();
  const workspaces = await client.workspace.list();
  const noun = workspaces.length === 1 ? 'workspace' : 'workspaces';

  console.log(`Plugin ${runtime.pluginId} sees ${workspaces.length} ${noun}.`);
  for (const workspace of workspaces) {
    const marker = workspace.workspace_id === runtime.workspaceId ? ' (current)' : '';
    console.log(`- ${workspace.label} [${workspace.workspace_id}]${marker}`);
  }
}

try {
  await main();
} catch (error: unknown) {
  if (isHerdrCliError(error)) {
    console.error(`Herdr protocol error (${error.code}): ${error.message}`);
  } else if (error instanceof Error) {
    console.error(`Hello plugin failed: ${error.message}`);
  } else {
    console.error('Hello plugin failed.');
  }
  process.exitCode = 1;
}
