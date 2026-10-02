# Issue tracker: GitHub

Use the `gh` CLI inside the clone.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`, with a heredoc for a multi-line body.
- **Read an issue**: `gh issue view <number> --comments`, with the labels.
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'`, filtered with `--label` and `--state` as needed.
- **Comment on an issue**: `gh issue comment <number> --body "..."`
- **Add or remove a label**: `gh issue edit <number> --add-label "..."` or `--remove-label "..."`
- **Close an issue**: `gh issue close <number> --comment "..."`

## Pull requests as a triage surface

**PRs as a request surface: no.** _(Read by `/triage`. `yes` treats an external PR as a feature request.)_

With `yes`, triage PRs like issues:

- **Read a PR**: `gh pr view <number> --comments`, and `gh pr diff <number>`.
- **List external PRs for triage**: `gh pr list --state open --json number,title,body,labels,author,authorAssociation,comments`. Keep only an `authorAssociation` of `CONTRIBUTOR`, `FIRST_TIME_CONTRIBUTOR` or `NONE`.
- **Comment, label or close**: `gh pr comment`, `gh pr edit --add-label` or `--remove-label`, `gh pr close`.

For a bare `#42`, try `gh pr view 42`, then `gh issue view 42`.

## When a skill says "publish to the issue tracker"

Create a GitHub issue.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> --comments`.

## Wayfinding operations

`/wayfinder` uses one **map** issue whose **child** issues are the tickets.

- **Map**: `gh issue create --label wayfinder:map`, with Notes, Decisions-so-far and Fog sections.
- **Child ticket**: a sub-issue of the map (`gh api`, sub-issues endpoint), labelled `wayfinder:<type>`: `research`, `prototype`, `grilling` or `task`.
- **Without sub-issues**: list the child in a map task list, and start its body with `Part of #<map>`.
- **Blocking**: `gh api --method POST repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`. `<blocker-db-id>` comes from `gh api repos/<owner>/<repo>/issues/<n> --jq .id`, not the `#number` or `node_id`. `issue_dependencies_summary.blocked_by` counts open blockers.
- **Without dependencies**: start the child body with `Blocked by: #<n>, #<n>`.
- **Frontier query**: the first open child in map order (`gh issue list --state open`) with no open blocker and no assignee.
- **Claim**: `gh issue edit <n> --add-assignee @me`, as the first write.
- **Resolve**:
  1. Run `gh issue comment <n> --body "<answer>"`.
  2. Run `gh issue close <n>`.
  3. Add the gist and a link to the map's Decisions-so-far.
