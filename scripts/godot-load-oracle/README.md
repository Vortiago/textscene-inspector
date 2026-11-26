# Godot load oracle

The oracle loads each `.tscn` and `.tres` file of a folder in Godot 4.6.3 and prints one line per file: the first parse error Godot prints, or `loads` and the node tree. Each file loads in its own headless process, so no resource cache carries over from one file to the next.

```sh
node scripts/godot-load-oracle/loadOracle.mjs <folder>
```

Godot must be on the path. The rows of `packages/textscene-core/src/resources/loadFailure/godotLoadRows.test.ts` are measured with it.
