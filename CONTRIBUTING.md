# Contributing

A change starts as an issue and lands as one pull request that passes the gates: the
checks each kind of change must pass.

## Set up

Follow [Quick start](README.md#quick-start) in the README. `pnpm install` also points git at
the hooks in `githooks/`. [githooks/README.md](githooks/README.md) explains them.

## Pick the work

1. Find or open an issue for the change.
2. For a large change, wait until the maintainer agrees to the issue. A design the
   maintainer rejects wastes your work.

## Make the change

Read [AGENTS.md](AGENTS.md) first. It lists the gates for each kind of change and the
project conventions. [ARCHITECTURE.md](ARCHITECTURE.md) explains the structure.

- Put each test next to the file it tests.
- Write code comments and docs to the rules in [.claude/rules/](.claude/rules/): Clean Code
  and Simplified Technical English.

## Check it

Run the gates that AGENTS.md lists for your change. Before a push, run:

```bash
pnpm validate
```

The pre-push hook and CI run the same gates.

## Open the pull request

- Use a [Conventional Commits](https://www.conventionalcommits.org/) title, for example
  `fix(parser): read a negative index`. The `commit-msg` hook checks each commit message.
- End the description with `Closes #<issue>`.
- Keep one change in one pull request.

## Report a vulnerability

Do not open a public issue. Follow [SECURITY.md](SECURITY.md).
