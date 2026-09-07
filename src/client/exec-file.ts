import { execFile } from "node:child_process";
import type { HerdrCommandExecutor, HerdrCommandResult } from "./executor.js";

interface ChildProcessFailure {
  readonly code?: number | string;
  readonly signal?: string | null;
  readonly killed?: boolean;
  readonly syscall?: string;
}

const NON_SPAWN_ERROR_CODES = new Set(["ERR_CHILD_PROCESS_STDIO_MAXBUFFER", "ETIMEDOUT"]);

/** Creates the default executor without invoking a shell. */
export function createExecFileExecutor(): HerdrCommandExecutor {
  return (request) =>
    new Promise<HerdrCommandResult>((resolve) => {
      try {
        execFile(
          request.binPath,
          [...request.argv],
          {
            encoding: "utf8",
            env: request.env,
            maxBuffer: request.maxBuffer,
            shell: false,
            timeout: request.timeoutMs,
          },
          (error, stdout, stderr) => {
            resolve(toCommandResult(error, stdout, stderr, request.timeoutMs));
          },
        );
      } catch (error) {
        resolve({
          stdout: "",
          stderr: "",
          exitCode: null,
          signal: null,
          timedOut: false,
          spawnError: error,
        });
      }
    });
}

function toCommandResult(
  error: unknown,
  stdout: unknown,
  stderr: unknown,
  timeoutMs: number,
): HerdrCommandResult {
  const output = {
    stdout: toText(stdout),
    stderr: toText(stderr),
  };

  if (error === null || error === undefined) {
    return {
      ...output,
      exitCode: 0,
      signal: null,
      timedOut: false,
    };
  }

  const failure = readFailure(error);
  if (failure === null) {
    return {
      ...output,
      exitCode: null,
      signal: null,
      timedOut: false,
      spawnError: error,
    };
  }

  const timedOut =
    failure.code === "ETIMEDOUT" ||
    (failure.killed === true &&
      timeoutMs > 0 &&
      failure.code !== "ERR_CHILD_PROCESS_STDIO_MAXBUFFER");
  const spawnError = isSpawnFailure(failure) ? { spawnError: error } : {};

  return {
    ...output,
    exitCode: typeof failure.code === "number" ? failure.code : null,
    signal: typeof failure.signal === "string" ? failure.signal : null,
    timedOut,
    ...spawnError,
  };
}

function readFailure(value: unknown): ChildProcessFailure | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  return value as ChildProcessFailure;
}

function isSpawnFailure(failure: ChildProcessFailure): boolean {
  if (typeof failure.signal === "string") {
    return false;
  }

  if (typeof failure.syscall === "string") {
    return failure.syscall.startsWith("spawn");
  }

  if (typeof failure.code === "number") {
    return false;
  }

  return (
    failure.code === undefined ||
    (typeof failure.code === "string" && !NON_SPAWN_ERROR_CODES.has(failure.code))
  );
}

function toText(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (Buffer.isBuffer(value)) {
    return value.toString("utf8");
  }

  return "";
}
