import {
  HerdrEnvError,
  isPaneAgentStatusChanged,
  readPluginEvent,
  type EnvSource,
  type HerdrClient,
} from '@j1nn0/herdr-plugin-sdk';

export interface EventHandlingResult {
  readonly acted: boolean;
  readonly report: string | null;
  readonly paneOutput: string | null;
}

export async function handleEvent(
  env: EnvSource,
  client: HerdrClient,
): Promise<EventHandlingResult> {
  let event;
  try {
    event = readPluginEvent(env);
  } catch (error: unknown) {
    if (error instanceof HerdrEnvError) {
      return { acted: false, report: error.message, paneOutput: null };
    }
    throw error;
  }

  if (event === null || !isPaneAgentStatusChanged(event)) {
    return ignored();
  }

  // The SDK assigns no meaning to "done"; treating it as interesting is this plugin author's policy.
  if (event.data.agent_status !== 'done') {
    return ignored();
  }

  const paneOutput = await client.pane.read(event.data.pane_id, {
    source: 'recent',
    lines: 10,
  });
  return { acted: true, report: null, paneOutput };
}

function ignored(): EventHandlingResult {
  return { acted: false, report: null, paneOutput: null };
}
