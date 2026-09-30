# Issue tracker: GitHub

Issues and specs for this repo live as GitHub issues. Use the `gh` CLI for every
operation. `gh` infers the repo from `git remote -v` when it runs inside a clone.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`. Use a heredoc for a
  body of more than one line.
- **Read an issue**: `gh issue view <number> --comments`. Filter the comments with `jq`,
  and fetch the labels too.
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'`.
  Add `--label` and `--state` filters as the task needs.
- **Comment on an issue**: `gh issue comment <number> --body "..."`
- **Add or remove a label**: `gh issue edit <number> --add-label "..."` or
  `--remove-label "..."`
- **Close an issue**: `gh issue close <number> --comment "..."`

## Pull requests as a triage surface

**PRs as a request surface: no.** _(Set this to `yes` if this repo treats an external PR
as a feature request. `/triage` reads this flag.)_

When the flag is `yes`, PRs go through the same labels and states as issues, with the
`gh pr` equivalents:

- **Read a PR**: `gh pr view <number> --comments`, and `gh pr diff <number>` for the diff.
- **List external PRs for triage**: `gh pr list --state open --json number,title,body,labels,author,authorAssociation,comments`.
  Keep only an `authorAssociation` of `CONTRIBUTOR`, `FIRST_TIME_CONTRIBUTOR` or `NONE`.
- **Comment, label or close**: `gh pr comment`, `gh pr edit --add-label` or
  `--remove-label`, `gh pr close`.

Issues and PRs share one number space on GitHub, so a bare `#42` can be either. Try
`gh pr view 42` first, then `gh issue view 42`.

## When a skill says "publish to the issue tracker"

Create a GitHub issue.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> --comments`.

## Wayfinding operations

`/wayfinder` uses these. The **map** is one issue, and its **child** issues are the
tickets.

- **Map**: one issue with the label `wayfinder:map`. Its body holds the Notes,
  Decisions-so-far and Fog sections. Create it with `gh issue create --label wayfinder:map`.
- **Child ticket**: an issue linked to the map as a GitHub sub-issue, through `gh api` on
  the sub-issues endpoint. Without sub-issues, add the child to a task list in the map
  body and put `Part of #<map>` at the top of the child body. Its label is
  `wayfinder:<type>`, where the type is `research`, `prototype`, `grilling` or `task`. A
  claimed ticket is assigned to the developer who drives it.
- **Blocking**: GitHub's native issue dependencies, which the UI shows. Add an edge with
  `gh api --method POST repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`.
  `<blocker-db-id>` is the blocker's numeric database id
  (`gh api repos/<owner>/<repo>/issues/<n> --jq .id`), not its `#number` or `node_id`.
  `issue_dependencies_summary.blocked_by` counts the open blockers only, so it is the
  live gate. Without dependencies, put a `Blocked by: #<n>, #<n>` line at the top of the
  child body. A ticket is unblocked when every blocker is closed.
- **Frontier query**: list the map's open children (`gh issue list --state open`, scoped
  to the map's sub-issues or task list). Drop each child that has an open blocker or an
  assignee. The first child left, in map order, wins.
- **Claim**: `gh issue edit <n> --add-assignee @me`, as the session's first write.
- **Resolve**: `gh issue comment <n> --body "<answer>"`, then `gh issue close <n>`. Then
  add a context pointer (the gist and a link) to the map's Decisions-so-far.
