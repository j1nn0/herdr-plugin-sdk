/** Base error for failures reported by the Herdr plugin SDK. */
export class HerdrError extends Error {
  /** Creates a Herdr error with a safe, caller-provided message. */
  constructor(options: { readonly message: string }) {
    super(options.message);
    this.name = 'HerdrError';
  }
}

/** Error raised when a Herdr plugin environment variable is invalid or missing. */
export class HerdrEnvError extends HerdrError {
  /** The offending environment variable name, or `null` when there is no single variable. */
  readonly variable: string | null;

  /** A short description of the environment problem. */
  readonly reason: string;

  /** Creates an environment error without including environment values. */
  constructor(options: { readonly variable?: string | null; readonly reason: string }) {
    const variable = options.variable ?? null;
    const message =
      variable === null
        ? `Invalid Herdr environment: ${options.reason}`
        : `Invalid Herdr environment variable ${variable}: ${options.reason}`;
    super({ message });
    this.name = 'HerdrEnvError';
    this.variable = variable;
    this.reason = options.reason;
  }
}
/** Error raised when Herdr returns a structured CLI error response. */
export class HerdrCliError extends HerdrError {
  /** The stable Herdr protocol error code. */
  readonly code: string;

  /** The operation that produced the CLI error. */
  readonly operation: string;

  /** The command arguments, excluding the binary path. */
  readonly argv: readonly string[];

  /** The process exit code, when one was reported. */
  readonly exitCode: number | null;

  /** Creates a CLI error from a structured Herdr error payload. */
  constructor(options: {
    readonly code: string;
    readonly message: string;
    readonly operation: string;
    readonly argv: readonly string[];
    readonly exitCode: number | null;
  }) {
    super({
      message: `Herdr CLI error during ${options.operation} (${options.code}): ${options.message}`,
    });
    this.name = 'HerdrCliError';
    this.code = options.code;
    this.operation = options.operation;
    this.argv = [...options.argv];
    this.exitCode = options.exitCode;
  }
}

/** Error raised when Herdr returns an unexpected successful response. */
export class HerdrResponseError extends HerdrError {
  /** The operation whose response could not be parsed. */
  readonly operation: string;

  /** The command arguments, excluding the binary path. */
  readonly argv: readonly string[];

  /** A safe description of the response problem. */
  readonly detail: string;

  /** Creates a response-shape error without including command output. */
  constructor(options: {
    readonly operation: string;
    readonly argv: readonly string[];
    readonly detail: string;
  }) {
    super({ message: `Invalid Herdr response for ${options.operation}: ${options.detail}` });
    this.name = 'HerdrResponseError';
    this.operation = options.operation;
    this.argv = [...options.argv];
    this.detail = options.detail;
  }
}

/** Error raised when a Herdr process cannot be completed as a protocol command. */
export class HerdrProcessError extends HerdrError {
  /** The operation whose process failed. */
  readonly operation: string;

  /** The command arguments, excluding the binary path. */
  readonly argv: readonly string[];

  /** The process exit code, when one was reported. */
  readonly exitCode: number | null;

  /** The terminating signal, when one was reported. */
  readonly signal: string | null;

  /** Process diagnostics, truncated to 2000 characters or fewer. */
  readonly stderr: string;

  /** The underlying process error, when one was available. */
  override readonly cause?: unknown;

  /** Creates a process error without copying stdout into the error. */
  constructor(options: {
    readonly operation: string;
    readonly argv: readonly string[];
    readonly exitCode: number | null;
    readonly signal: string | null;
    readonly stderr: string;
    readonly cause?: unknown;
  }) {
    super({ message: `Herdr process failed during ${options.operation}.` });
    this.name = 'HerdrProcessError';
    this.operation = options.operation;
    this.argv = [...options.argv];
    this.exitCode = options.exitCode;
    this.signal = options.signal;
    this.stderr = options.stderr.slice(0, 2000);
    if (options.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}

/** Error raised when a Herdr command exceeds its configured timeout. */
export class HerdrTimeoutError extends HerdrError {
  /** The operation that exceeded its timeout. */
  readonly operation: string;

  /** The command arguments, excluding the binary path. */
  readonly argv: readonly string[];

  /** The configured timeout in milliseconds. */
  readonly timeoutMs: number;

  /** Creates a timeout error without including command output. */
  constructor(options: {
    readonly operation: string;
    readonly argv: readonly string[];
    readonly timeoutMs: number;
  }) {
    super({
      message: `Herdr command timed out during ${options.operation} after ${options.timeoutMs}ms.`,
    });
    this.name = 'HerdrTimeoutError';
    this.operation = options.operation;
    this.argv = [...options.argv];
    this.timeoutMs = options.timeoutMs;
  }
}

/** Narrows an unknown value to a Herdr CLI error, optionally by protocol code. */
export function isHerdrCliError(value: unknown, code?: string): value is HerdrCliError {
  return value instanceof HerdrCliError && (code === undefined || value.code === code);
}
