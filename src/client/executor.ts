/** Input passed to the client's command executor seam. */
export interface HerdrCommandRequest {
  readonly binPath: string;
  readonly argv: readonly string[];
  /** SDK process timeout in milliseconds; 0 disables the SDK-managed timeout. */
  readonly timeoutMs: number;
  readonly maxBuffer: number;
  readonly env: NodeJS.ProcessEnv;
}

/** Result reported by a Herdr command executor, including ordinary failures. */
export interface HerdrCommandResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number | null;
  readonly signal: string | null;
  readonly timedOut: boolean;
  /** Underlying spawn or execution error, when one was reported. */
  readonly spawnError?: unknown;
}

/** Narrow executor seam used by the typed Herdr client. */
export type HerdrCommandExecutor = (request: HerdrCommandRequest) => Promise<HerdrCommandResult>;
