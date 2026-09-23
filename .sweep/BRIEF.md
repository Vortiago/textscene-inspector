# Editor brief: the prose sweep

You bring one batch of files to the repo's prose rules. You edit only the files
in your batch. The session that started you runs the gates and commits.

## Before you edit

1. Read both rule files in full:
   - `/var/lib/longhorn/atle/repos/Verktoykasse/main/clean-code/clean-code-rules.md`
   - `/var/lib/longhorn/atle/repos/Verktoykasse/main/simplified-technical-english/ste-rules.md`
2. Read `AGENTS.md` for the repo conventions.
3. Read your batch's file list in `.sweep/batches.json` (your batch id is in
   your prompt).

## Hard limits

- Edit only the files in your batch. Create no file.
- Do not run `git commit`, `git stash`, `git checkout`, `git reset` or
  `git restore`. Other agents edit this worktree at the same time.
- Do not run `pnpm install`, `pnpm test:unit` or a build. The session runs the
  full gates.
- Never add, move or change an engine cite (`something.cpp:123`,
  `something.h:40-52`, `…xml`). You cannot see the engine source, so a cite
  you write is a guess. A cite stays beside the fact it grounds.

## Keep exactly as it is

- Every engine cite, in a comment, a `cite:` string or a document.
- Text a tool reads: `@param @returns @type @typedef @template @see`,
  `eslint-*`, `@ts-*`, `prettier-ignore`, a shebang, frontmatter, a licence
  header, `GENERATED`, `keep in sync with …`.
- All code outside comments: string literals, error and log messages, CLI help
  text, `describe` and `it` titles (`testTitleTier.guard.test.ts` pins the tier
  words in them). The one exception is dead code, below.
- Every fact: a constraint, a contract, a number with its reason, a "not X,
  because" choice. A cut removes the story around a fact, never the fact.
- Text a test asserts. Before you edit a markdown file, search for tests that
  read it: `grep -rln "<file name>" --include='*.test.*' packages apps scripts`.
  Keep every word such a test matches.

## Cut hard

- War stories: review rounds, audits, "a sweep found", "this once broke",
  "previously", "used to", "no longer", dates, PR and issue narration.
- Counts that rot ("~2,000 files", "237 validators", "3,649 files today"),
  unless code in the same file asserts that number.
- A comment that repeats the name, the type or the next line of code.
- A section rule made of dashes or `=`: it becomes a blank line. Keep a
  section marker that names a contract.
- A second statement of a fact the same file already states.
- Emphasis in capitals (`NEVER`, `ONLY`, `EXACTLY`): write the word in lower
  case. Keep capitals in a name, a constant or an acronym.

## Code comments (`.ts .tsx .js .mjs .css`)

- A comment answers one question from the Clean Code list: the choice and what
  the other choice costs, the failure it prevents, the platform fact with its
  number, the rule every branch keeps, or the contract. Anything else goes.
- At most four prose lines per comment. Adjacent `//` lines count as one
  comment. Tag lines (`@param` and after) do not count.
- A module opens with one or two sentences on the job it does.
- When a comment holds more facts than four lines can carry, split it: put
  each fact beside the line it governs. When the facts still do not fit, keep
  them all and list the file under "unplaced" in your report. Never drop a fact
  to meet the limit.
- Dead code: delete commented-out code. Delete an unused local, import,
  parameter or private function only when a repo-wide search finds no use
  outside its definition. A symbol that only a test uses stays, and you list it
  under "candidates". Do not delete an export of a package entry point.
- A comment that is wrong: fix it to state what the code does. When you cannot
  tell, list it under "unplaced".

## `.tscn` fixture comments (`;` lines)

A golden fixture header names the one variable it moves and says why a
regression in it is invisible in every other scene (AGENTS.md). Keep that, in at
most four lines. Cut everything else.

## Markdown

- **Prose documents**: rewrite to current fact in STE. Start with the point.
  Keep every heading anchor that another file links to
  (`grep -rn "<file name>#" .`), every command, fenced block, link, table row
  and cite. Delete history sections and changelog-style narration.
- **`CHANGELOG.md`**: each entry is a record of a release. Keep every entry and
  fix only the STE surface rules.
- **ADRs** (`docs/adr/`): keep the number, the filename, the title, the status
  and the parts that decide: context, decision, consequences, and each
  rejected option with what it costs. Cut the story of how the decision was
  reached. Link text to another ADR stays valid.
- **Parity sheets** (`comparison.md`, `docs/comparison/sheets/`): the structure
  is data that `scripts/compare-docs/*.test.mjs` parses. Keep the frontmatter,
  every heading, every table column and row, every status value and every
  property name exactly. Tighten only the free prose in cells and paragraphs.
  Never edit between `<!-- lint:begin … -->` and `<!-- lint:end -->`:
  `pnpm docs:lint-sections` writes that block from the validators.
  Read `scripts/compare-docs/SHEET-STANDARD.md` first.
- `AGENTS.md`, `CLAUDE.md` and `.claude/**` are briefs that agents follow:
  keep every rule, command and gate. Cut the narration around them.

## Check your files before you report

Run these on your own files only, and fix what they list:

1. `node .sweep/check.mjs <your files>`: the mechanical prose rules. It must
   print `0 finding(s)`, except for files you list under "unplaced".
2. `node .sweep/keepList.mjs <your files>`: it must print
   `0 kept token(s) lost`.
3. `node .sweep/commentOnly.mjs <your files>`: every line it prints must be a
   dead-code removal in your report.
4. For code files, `npx eslint <your changed code files>`: an import left
   unused by a dead-code removal fails CI.

## Report

End with this, and nothing after it:

```
BATCH <id>
changed: <number> files
dead code: <file>: <symbol>: <proof, for example "grep finds no use">   (one per line, or none)
candidates: <file>: <symbol>: <its only user>                           (or none)
unplaced: <file>:<line>: <the fact, and why it did not fit>              (or none)
check: <finding count> | keepList: <lost count> | commentOnly: <files>
```
