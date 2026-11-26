# Godot load oracle

The oracle loads each `.tscn` and `.tres` file of a folder in Godot 4.6.3 and prints one line per file. The line holds the first parse error Godot prints, or `loads` and the node tree. Each file loads in its own headless process, so no resource cache carries over from one file to the next.

```sh
node scripts/godot-load-oracle/loadOracle.mjs <folder>
```

Godot must be on the path. The oracle measures the rows of `packages/textscene-core/src/resources/loadFailure/godotLoadRows.test.ts`.

`headingFamilySweep.mjs <folder>` writes the cases of the heading and line-count sweep into a new or empty folder. The cases cover line endings, string escapes, a key split from its value, and a heading refused at each token. Load the folder with the oracle to measure them.

`headingControlCodeSweep.mjs <folder>` writes 80 cases into a new or empty folder: a NUL, a tab, the code 1 and a CR at each of ten places in a child heading. Each case comes twice, once to read the tree and once with a refused heading after it to read the line. `headingControlCodes.test.ts` holds Godot's result for each case.
