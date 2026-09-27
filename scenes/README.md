# Scenes

The `.tscn` corpora the tests and the previewers use.

| Directory | Holds |
| --- | --- |
| `fixtures/` | This project's scenes and their resources. It is a `res://` root. |
| `upload-payloads/` | Files the `test-missing-*` fixtures cannot find, on purpose |
| `isometric/` | A vendored dungeon corpus, with its own root (`scripts/corpusRoots.mjs`) |
| `demos/<top>/<project>/` | Vendored Godot demo projects, each with its own `project.godot` |
| `games/` | Community games, fetched on demand and not committed |

## The `fixtures/` root

`res://` resolves to `scenes/fixtures/` in every host:

| Host | How |
| --- | --- |
| Web previewer | Copies it to `public/fixtures/` |
| VS Code tests | Copy it as the workspace |
| `pnpm ref:godot` | Stages it as the Godot project root |

The file prefix gives the kind of scene:

| Prefix | Kind |
| --- | --- |
| `unit-` | One node type or property |
| `edge-` | An edge case. The ones in `negative-fixtures.json` must produce a linter error. |
| `integration-` | Several nodes together |
| `example-` | A larger, realistic scene |
| `test-` | Missing resources and nested sub-scenes |

[README_EXTERNAL_RESOURCES.md](README_EXTERNAL_RESOURCES.md) lists the scenes that test external resources and sub-scenes.

## Add a fixture

For a node type, run `pnpm new:node`. It creates the `unit-*.tscn` fixture (see AGENTS.md).
For another fixture, add the `.tscn` to `scenes/fixtures/`, then check it:

```bash
pnpm build:linter
pnpm lint:tscn scenes/fixtures/<file>.tscn
```

## The games corpus

`pnpm vendor:games` fetches community games at pinned commits into `scenes/games/`. It also writes `apps/textscene-web/src/fixtures.games.ts`. Both are gitignored. `scripts/vendor-godot-games.mjs` lists the sources and licences.

Only the deployed dev edition includes the games:

| Command | Games |
| --- | --- |
| `pnpm dev`, `pnpm build` | Excluded |
| `pnpm build:deploy` | Included |

`build:deploy` sets `VITE_INCLUDE_GAMES=1`. Two files read it and must agree: `apps/textscene-web/scripts/copy-fixtures.js` and `apps/textscene-web/src/fixturesAll.ts`.

The Cloudflare Pages dashboard holds the dev edition's build command, `pnpm build:deploy`. There is no `wrangler.toml`. The public edition deploys to GitHub Pages through `.github/workflows/pages.yml`.
