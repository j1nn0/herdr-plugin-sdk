import { describe, expect, it } from "vitest";
import type { EnvSource } from "../src/index.js";
import {
  HerdrEnvError,
  isHerdrEnvironment,
  isPaneAgentStatusChanged,
  readPluginContext,
  readPluginEvent,
  readPluginRuntime,
} from "../src/index.js";

const requiredRuntimeEnv = {
  HERDR_PLUGIN_ID: "example.plugin",
  HERDR_PLUGIN_ROOT: "/plugins/example",
  HERDR_PLUGIN_CONFIG_DIR: "/config/example",
  HERDR_PLUGIN_STATE_DIR: "/state/example",
};

function environment(overrides: Record<string, string | undefined> = {}): EnvSource {
  return { ...requiredRuntimeEnv, ...overrides };
}

describe("runtime environment", () => {
  it("recognizes the Herdr marker without requiring unrelated variables", () => {
    expect(isHerdrEnvironment({ HERDR_ENV: "1" })).toBe(true);
    expect(isHerdrEnvironment({ HERDR_ENV: "0" })).toBe(false);
    expect(isHerdrEnvironment({})).toBe(false);
  });

  it("reports each missing required variable", () => {
    for (const variable of Object.keys(requiredRuntimeEnv)) {
      const env = { ...requiredRuntimeEnv };
      delete env[variable as keyof typeof requiredRuntimeEnv];

      expect(() => readPluginRuntime(env)).toThrow(HerdrEnvError);
      try {
        readPluginRuntime(env);
      } catch (error) {
        expect(error).toBeInstanceOf(HerdrEnvError);
        expect((error as HerdrEnvError).variable).toBe(variable);
      }
    }
  });

  it("returns null for absent optional variables", () => {
    const runtime = readPluginRuntime(environment());

    expect(runtime.binPath).toBeNull();
    expect(runtime.socketPath).toBeNull();
    expect(runtime.workspaceId).toBeNull();
    expect(runtime.tabId).toBeNull();
    expect(runtime.paneId).toBeNull();
  });

  it("discriminates startup and event invocations from HERDR_PLUGIN_EVENT", () => {
    expect(readPluginRuntime(environment({ HERDR_PLUGIN_EVENT: "startup" })).invocation).toEqual({
      kind: "startup",
    });
    expect(
      readPluginRuntime(environment({ HERDR_PLUGIN_EVENT: "pane.agent_status_changed" }))
        .invocation,
    ).toEqual({ kind: "event", event: "pane.agent_status_changed" });
  });

  it("discriminates link-handler actions and pane commands", () => {
    expect(
      readPluginRuntime(
        environment({
          HERDR_PLUGIN_ACTION_ID: "open",
          HERDR_PLUGIN_CLICKED_URL: "https://example.test",
          HERDR_PLUGIN_LINK_HANDLER_ID: "docs",
        }),
      ).invocation,
    ).toEqual({
      kind: "action",
      actionId: "open",
      clickedUrl: "https://example.test",
      linkHandlerId: "docs",
    });
    expect(
      readPluginRuntime(environment({ HERDR_PLUGIN_ENTRYPOINT_ID: "inbox" })).invocation,
    ).toEqual({ kind: "pane", entrypointId: "inbox" });
    expect(readPluginRuntime(environment()).invocation).toEqual({ kind: "unknown" });
  });

  it("treats empty action and pane identifiers as absent", () => {
    expect(
      readPluginRuntime(
        environment({ HERDR_PLUGIN_ACTION_ID: "", HERDR_PLUGIN_ENTRYPOINT_ID: "inbox" }),
      ).invocation,
    ).toEqual({ kind: "pane", entrypointId: "inbox" });
    expect(readPluginRuntime(environment({ HERDR_PLUGIN_ENTRYPOINT_ID: "" })).invocation).toEqual({
      kind: "unknown",
    });
  });
});

describe("plugin context", () => {
  it("parses a full context and preserves unknown fields", () => {
    const payload = {
      workspace_id: "w1G",
      workspace_label: "herdr-plugin-sdk",
      workspace_cwd: "/workspace",
      worktree: {
        repo_key: "repo",
        repo_name: "sdk",
        repo_root: "/repos/sdk",
        checkout_path: "/worktrees/sdk",
        is_linked_worktree: true,
      },
      tab_id: "w1G:t1",
      tab_label: "agents",
      focused_pane_id: "w1G:p7",
      focused_pane_cwd: "/workspace",
      focused_pane_agent: "pi",
      focused_pane_status: "working",
      selected_text: "selected",
      invocation_source: "api",
      correlation_id: "pane.agent_status_changed",
      clicked_url: "https://example.test",
      link_handler_id: "docs",
      future_field: { enabled: true },
    };

    const context = readPluginContext({ HERDR_PLUGIN_CONTEXT_JSON: JSON.stringify(payload) });

    expect(context).toEqual(payload);
    expect((context as Record<string, unknown>).future_field).toEqual({ enabled: true });
  });

  it("accepts an empty object", () => {
    expect(readPluginContext({ HERDR_PLUGIN_CONTEXT_JSON: "{}" })).toEqual({});
  });

  it("drops a malformed known field while keeping valid siblings and unknown fields", () => {
    const context = readPluginContext({
      HERDR_PLUGIN_CONTEXT_JSON: JSON.stringify({
        workspace_id: 42,
        workspace_label: "kept",
        future_field: "also kept",
      }),
    });

    expect(context).toEqual({ workspace_label: "kept", future_field: "also kept" });
  });

  it.each([
    ["malformed JSON", '{"selected_text":"secret'],
    ["an array", "[]"],
    ["a string", JSON.stringify("context")],
  ])("rejects %s without exposing payload contents", (_label, value) => {
    expect(() => readPluginContext({ HERDR_PLUGIN_CONTEXT_JSON: value })).toThrow(HerdrEnvError);
  });
});

describe("plugin events", () => {
  const observedEvent = {
    event: "pane_agent_status_changed",
    data: {
      type: "pane_agent_status_changed",
      pane_id: "w1G:p4",
      workspace_id: "w1G",
      agent_status: "done",
      agent: "pi",
      future_data: { revision: 2 },
    },
  };

  it("returns null when no event payload is present", () => {
    expect(readPluginEvent({})).toBeNull();
    expect(readPluginEvent({ HERDR_PLUGIN_EVENT_JSON: "" })).toBeNull();
  });

  it("parses the observed status event and preserves unknown data", () => {
    const event = readPluginEvent({
      HERDR_PLUGIN_EVENT: "pane.agent_status_changed",
      HERDR_PLUGIN_EVENT_JSON: JSON.stringify(observedEvent),
    });

    expect(event).toEqual({
      event: "pane_agent_status_changed",
      name: "pane.agent_status_changed",
      data: observedEvent.data,
    });
    expect(event?.data.future_data).toEqual({ revision: 2 });
    expect(event?.data.agent_status).toBe("done");
    expect(isPaneAgentStatusChanged(event as NonNullable<typeof event>)).toBe(true);
  });

  it("accepts unknown future event types without applying policy", () => {
    const event = readPluginEvent({
      HERDR_PLUGIN_EVENT_JSON: JSON.stringify({
        event: "workspace_future_changed",
        data: { type: "workspace_future_changed", value: "new" },
      }),
    });

    expect(event?.event).toBe("workspace_future_changed");
    expect(event?.data.value).toBe("new");
  });

  it("rejects malformed JSON and malformed envelopes", () => {
    expect(() => readPluginEvent({ HERDR_PLUGIN_EVENT_JSON: "{" })).toThrow(HerdrEnvError);
    expect(() =>
      readPluginEvent({ HERDR_PLUGIN_EVENT_JSON: JSON.stringify({ data: {} }) }),
    ).toThrow(HerdrEnvError);
    expect(() =>
      readPluginEvent({ HERDR_PLUGIN_EVENT_JSON: JSON.stringify({ event: "future", data: [] }) }),
    ).toThrow(HerdrEnvError);
  });

  it("narrows only matching events with all required fields", () => {
    const valid = readPluginEvent({ HERDR_PLUGIN_EVENT_JSON: JSON.stringify(observedEvent) });
    const other = readPluginEvent({
      HERDR_PLUGIN_EVENT_JSON: JSON.stringify({
        event: "pane_created",
        data: { type: "pane_created", pane_id: "p1", workspace_id: "w1" },
      }),
    });
    const missing = readPluginEvent({
      HERDR_PLUGIN_EVENT_JSON: JSON.stringify({
        event: "pane_agent_status_changed",
        data: { type: "pane_agent_status_changed", workspace_id: "w1", agent_status: "done" },
      }),
    });

    expect(isPaneAgentStatusChanged(valid as NonNullable<typeof valid>)).toBe(true);
    expect(isPaneAgentStatusChanged(other as NonNullable<typeof other>)).toBe(false);
    expect(isPaneAgentStatusChanged(missing as NonNullable<typeof missing>)).toBe(false);
  });

  it("keeps malformed JSON details and unrelated secrets out of errors", () => {
    const secret = "unrelated-secret-value";
    const rawPayload = '{"selected_text":"terminal-secret"';
    let error: HerdrEnvError | undefined;

    try {
      readPluginContext({
        UNRELATED_SECRET: secret,
        HERDR_PLUGIN_CONTEXT_JSON: rawPayload,
      });
    } catch (caught) {
      error = caught as HerdrEnvError;
    }

    expect(error).toBeInstanceOf(HerdrEnvError);
    expect(error?.message).not.toContain(secret);
    expect(error?.message).not.toContain(rawPayload);
  });
});
