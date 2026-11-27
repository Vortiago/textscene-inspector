# Godot load oracle

The oracle loads each `.tscn` and `.tres` file of a folder in Godot 4.6.3 and prints one line per file. The line holds the first parse error Godot prints, or `loads` and the node tree. Where Godot prints an error and loads the file all the same, the line holds both, split by `|`. Each file loads in its own headless process, so no resource cache carries over from one file to the next.

```sh
node scripts/godot-load-oracle/loadOracle.mjs <folder>
```

Godot must be on the path. The oracle measures the rows of `packages/textscene-core/src/resources/loadFailure/godotLoadRows.test.ts`.

`headingFamilySweep.mjs <folder>` writes the cases of the heading and line-count sweep into a new or empty folder. The cases cover line endings, string escapes, a key split from its value, and a heading refused at each token. Load the folder with the oracle to measure them.

`headingControlCodeSweep.mjs <folder>` writes 80 cases into a new or empty folder: a NUL, a tab, the code 1 and a CR at each of ten places in a child heading. Each case comes twice, once to read the tree and once with a refused heading after it to read the line. `headingControlCodes.test.ts` holds Godot's result for each case.

`headingValueKindSweep.mjs <folder>` and `headingRefusalSweep.mjs <folder>` write their cases into a new or empty folder, with the `real.tres` file the scenes name. `headingSweepScene.mjs` holds the scene they share, which has a heading of each kind. The first sweep puts each kind of value in a field of each kind of heading. The second puts a refusal at each token kind, on the heading's own line and on a later line. It also leaves each kind of heading never closed, with no `]` or with an open string, before a heading, a body line or the end of the file. `headingValueKinds.test.ts` and `headingRefusals.test.ts` hold Godot's result for each case.

`headerLeadSweep.mjs <folder>` writes 22 cases into a new or empty folder: a scene and a resource, each with one kind of text before its header, such as a BOM, a body line or a comment. `headerLeads.test.ts` holds Godot's result for each case.

`blankLineSweep.mjs <folder>` writes 24 cases into a new or empty folder: a tab or the code 1, 8 or 31 after a heading's `]`, alone on a body line, between a key and its value, before a key, around its `=` or after its value. Godot skips each one, and `blankLines.test.ts` holds that result.
