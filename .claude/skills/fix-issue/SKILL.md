---
name: fix-issue
description: Pick an open GitHub issue, agree its scope with the user, and implement it with red-green TDD under the Clean Code and STE rules, through to a pull request. Use when the user asks to pick, fix or implement an issue from the tracker, or invokes /fix-issue with or without an issue number.
---

# Fix an issue

This skill takes one GitHub issue from open to a pull request. It is test-first, and
it ends with a pull request that leaves the tracker shorter, not longer.

Use `gh` where it exists. In a cloud session, use the `mcp__github__*` tools instead.

## 1. Pick the issue

1. If the user named an issue, use it.
2. If not, list the open issues. Skip each issue with the `in-progress` label.
3. Propose two or three candidates, each with its complexity (simple, moderate or
   complex), and recommend one.
4. Wait for the user to choose. Never start an issue the user did not choose.

## 2. Claim it

1. Add the `in-progress` label to the issue.
2. Rename the session to `#<n>: <what the issue fixes>`, so that the session list
   tells one issue from another. In a cloud session, use `set_session_title` from
   the `claude-code-remote` tools. In a terminal session, ask the user to run
   `/rename`.
3. Read the issue body and every comment. The implementation notes and the testing
   strategy are there.
4. Read the ADRs and the `comparison.md` sheets in the area the issue touches.

## 3. Agree the scope

Ask the user questions until the two of you share one understanding. Ask one question
at a time, and give your recommended answer with each. If the code can answer a
question, read the code instead of asking.

Resolve these before any code:

- the behaviour that is wrong now, and the behaviour that is right, with its engine
  source (`file:line`) or a `pnpm ref:godot` measurement;
- the test that proves it, and where it lives;
- the gates in AGENTS.md that the change triggers.

## 4. Make the task list

Create one task for each item below, and keep the list current:

1. One task for each red-green cycle (one behaviour each).
2. Clean Code pass.
3. STE pass.
4. Gates.
5. Commit, push and pull request.

## 5. Red, green, refactor

Do each cycle in this order:

1. **Red.** Write one test for one behaviour. Run it. Confirm that it fails, and that
   it fails for the reason you expect. Show the failure output.
2. **Green.** Write the least code that makes the test pass. Run it again.
3. **Refactor.** Clean the code you touched while the test stays green.

Do not write production code before a failing test asks for it.

## 6. Clean Code pass

Do not skip this step. It exists because the rules are the part a long session forgets.

1. Read `.claude/rules/clean-code-rules.md` again now, in full.
2. Read `git diff origin/main` hunk by hunk against each heading of that file.
3. Fix each violation in the diff, and in the code around it.

Check these first, because they are the ones that escape:

- a comment with no question from "A comment that earns its place";
- a comment longer than four lines, or one that states history;
- a function with more than one job, or a name that needs `and`;
- a magic number without a name and a reason, or one that belongs in
  `packages/textscene-core/src/godot/`;
- an unused import, parameter or variable;
- a test that checks more than one concept;
- an issue or work-item reference in code.

## 7. STE pass

1. Read `.claude/rules/ste-rules.md` again now.
2. Apply it to every comment, markdown file, commit message and the pull request body.
3. If the diff adds more than a few lines of prose, run the `ste-review` agent on it.

## 8. Fix what you find, do not file it

The Clean Code rules say: fix a problem you find now, in this change. So:

- Fix a bug, a wrong comment or dead code that you find on the way, in this pull request.
- Never open a follow-up issue on your own.
- If a problem is truly outside the issue's scope, ask the user. Open an issue only when
  the user agrees.

## 9. Gates

Run every gate in AGENTS.md that the change triggers. Always run the pre-push hook:

1. Commit the change.
2. Run `git push --dry-run origin HEAD`.
3. If a check fails, fix the cause and run the hook again.

The hook type-checks each changed package and its dependents, and runs the tests beside each
changed file. AGENTS.md says when the change needs the full gate.

## 10. Ship

1. Commit with a conventional message. See the `conventional-commits` skill.
2. Push the branch.
3. Open a pull request with `Closes #<n>` in the body.
4. Report the result to the user. Do not start the next issue.

Keep the `in-progress` label while the pull request is open, so that no other session
picks the issue. The merge closes the issue. If you stop without a pull request, remove
the label.
