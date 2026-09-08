# Contributor and agent guidance

## Communication

- Use Japanese only for user-facing communication.
- Use English for all non-user-facing communication and generated artifacts unless the repository, task, or existing content requires another language.
- Use English for agent-to-agent communication, delegation prompts, plans, findings, summaries, intermediate reports, tool-related annotations, code comments, documentation, and commit messages.
- Keep non-user-facing communication concise and information-dense. Do not restate context already available to the receiving agent.
- Preserve the language of existing content when editing it unless the task explicitly requires changing it.

## Repository rules

- The canonical verification command is `pnpm check`.
- Zero runtime dependencies is a hard constraint; adding one requires explicit justification.
- Types mirroring a Herdr JSON payload keep Herdr wire field names (snake_case). SDK-synthesized types (options bags, errors, `PluginRuntime`) use camelCase.
- Forward compatibility matters: parsers validate required fields only and must preserve unknown fields.
- Read output must never be trimmed, normalized, or JSON-parsed.
- Subprocess execution uses a binary plus argv and must never use a shell.
- Errors must never carry environment contents or command output beyond the truncated `stderr` on `HerdrProcessError`.
- Tests must never require a Herdr installation, a running server, a socket, or a subprocess; use the executor seam or `@j1nn0/herdr-plugin-sdk/testing`.
- Tests should import from the public entrypoints rather than deep internal paths.
- Coupled changes: adding a client operation means updating `src/client/types.ts`, `src/client/parse.ts`, `src/client/client.ts`, `src/client/index.ts`, the mock in `src/testing/mock-client.ts`, and the README.
- Use Conventional Commits.
- Only document behavior that exists.
