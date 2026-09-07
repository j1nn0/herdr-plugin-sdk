/** Base error for failures reported by the Herdr plugin SDK. */
export class HerdrError extends Error {
  /** Creates a Herdr error with a safe, caller-provided message. */
  constructor(options: { readonly message: string }) {
    super(options.message);
    this.name = "HerdrError";
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
    this.name = "HerdrEnvError";
    this.variable = variable;
    this.reason = options.reason;
  }
}
