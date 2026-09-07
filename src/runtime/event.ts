import { HerdrEnvError } from "../errors.js";
import type {
  AgentStatus,
  EnvSource,
  PaneAgentStatusChangedData,
  PluginEvent,
  PluginEventData,
} from "./types.js";

const EVENT_VARIABLE = "HERDR_PLUGIN_EVENT_JSON";

/** Parses the optional Herdr plugin event envelope from its JSON environment variable. */
export function readPluginEvent(env: EnvSource = process.env): PluginEvent | null {
  const raw = env[EVENT_VARIABLE];
  if (raw === undefined || raw === "") {
    return null;
  }

  const parsed = parseJson(raw);
  if (!isPlainObject(parsed)) {
    throw invalidEvent("must contain a JSON object.");
  }

  if (typeof parsed.event !== "string" || parsed.event === "") {
    throw invalidEvent('must contain a non-empty string "event".');
  }

  if (!isPlainObject(parsed.data)) {
    throw invalidEvent('must contain an object-valued "data" field.');
  }

  if (typeof parsed.data.type !== "string" || parsed.data.type === "") {
    throw invalidEvent('must contain a non-empty string "data.type".');
  }

  return {
    event: parsed.event,
    name: env.HERDR_PLUGIN_EVENT ?? null,
    data: parsed.data as PluginEventData,
  };
}

/** Narrows an event to a pane agent status change when its required fields are valid. */
export function isPaneAgentStatusChanged(
  event: PluginEvent,
): event is PluginEvent & { data: PaneAgentStatusChangedData } {
  return (
    event.data.type === "pane_agent_status_changed" &&
    typeof event.data.pane_id === "string" &&
    typeof event.data.workspace_id === "string" &&
    isAgentStatus(event.data.agent_status)
  );
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw invalidEvent("must contain valid JSON.");
  }
}

function invalidEvent(reason: string): HerdrEnvError {
  return new HerdrEnvError({ variable: EVENT_VARIABLE, reason });
}

function isAgentStatus(value: unknown): value is AgentStatus {
  return (
    value === "idle" ||
    value === "working" ||
    value === "blocked" ||
    value === "done" ||
    value === "unknown"
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
