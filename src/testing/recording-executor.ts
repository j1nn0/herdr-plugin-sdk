/** One Herdr command captured by a recording executor. */
export interface RecordedHerdrCommand {
  readonly binPath: string;
  readonly argv: readonly string[];
  readonly timeoutMs: number;
}

/** Recording executor seam with snapshot-safe call history. */
export interface RecordingExecutor {
  readonly executor: import('../client/executor.js').HerdrCommandExecutor;
  readonly calls: readonly RecordedHerdrCommand[];
  reset(): void;
}

type RecordingResponder = (
  command: RecordedHerdrCommand,
  index: number,
) =>
  | import('../client/executor.js').HerdrCommandResult
  | Promise<import('../client/executor.js').HerdrCommandResult>;

/** Creates a recording command executor that succeeds silently by default. */
export function createRecordingExecutor(respond?: RecordingResponder): RecordingExecutor {
  const recordedCommands: RecordedHerdrCommand[] = [];
  const executor: import('../client/executor.js').HerdrCommandExecutor = async (request) => {
    const command = {
      binPath: request.binPath,
      argv: [...request.argv],
      timeoutMs: request.timeoutMs,
    };
    const index = recordedCommands.length;
    recordedCommands.push(command);
    if (respond === undefined) {
      return { stdout: '', stderr: '', exitCode: 0, signal: null, timedOut: false };
    }
    return await respond(copyCommand(command), index);
  };

  return {
    executor,
    get calls() {
      return recordedCommands.map((command) => copyCommand(command));
    },
    reset() {
      recordedCommands.length = 0;
    },
  };
}

function copyCommand(command: RecordedHerdrCommand): RecordedHerdrCommand {
  return {
    binPath: command.binPath,
    argv: [...command.argv],
    timeoutMs: command.timeoutMs,
  };
}
