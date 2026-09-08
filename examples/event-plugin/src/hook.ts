import { createHerdrClient, HerdrError, type EnvSource } from '@j1nn0/herdr-plugin-sdk';
import { handleEvent } from './handle-event.js';

async function main(env: EnvSource): Promise<void> {
  const result = await handleEvent(env, createHerdrClient());

  if (result.report !== null) {
    console.error(`Ignoring malformed Herdr event: ${result.report}`);
    process.exitCode = 0;
    return;
  }

  if (result.acted) {
    console.log(`Recent pane output:\n${result.paneOutput ?? ''}`);
  }
}

try {
  await main(process.env);
} catch (error: unknown) {
  console.error(
    error instanceof HerdrError ? `Event hook failed: ${error.message}` : 'Event hook failed.',
  );
  process.exitCode = 0;
}
