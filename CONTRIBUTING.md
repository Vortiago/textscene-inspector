# Contributing

## Set up

Follow [Build from source](README.md#build-from-source). `pnpm install` also enables the hooks in `githooks/` ([githooks/README.md](githooks/README.md)).

## Pick the work

1. Find or open an issue.
2. For a large change, wait for the maintainer to agree.

## Make the change

- Follow the gates and conventions in [AGENTS.md](AGENTS.md). [ARCHITECTURE.md](ARCHITECTURE.md) has the structure.
- Put each test next to the file it tests.
- Write code and docs to the rules in [.claude/rules/](.claude/rules/).

## Check it

Run the AGENTS.md gates for your change. `pnpm check` runs the checks that the pre-push hook runs.
`pnpm validate` runs the full gate, as CI does.

## Open the pull request

- Use a [Conventional Commits](https://www.conventionalcommits.org/) title, for example `fix(parser): read a negative index`.
- End the description with `Closes #<issue>`.
- Keep one change per pull request.

## Report a vulnerability

Follow [SECURITY.md](SECURITY.md), not a public issue.
