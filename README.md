# TextScene Inspector

[![CI](https://github.com/Vortiago/textscene-inspector/actions/workflows/ci.yml/badge.svg?branch=main&event=push)](https://github.com/Vortiago/textscene-inspector/actions/workflows/ci.yml?query=branch%3Amain+event%3Apush)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

TextScene Inspector renders Godot `.tscn` scenes in 3D and 2D from the text alone, without Godot.

**Try it:** [vortiago.github.io/textscene-inspector](https://vortiago.github.io/textscene-inspector/)

![The web previewer rendering a CSG hallway](./docs/showcase/web/hallway.png)

## Get it

| Tool | Get it | Guide |
| --- | --- | --- |
| VS Code extension (desktop and vscode.dev) | [Marketplace](https://marketplace.visualstudio.com/items?itemName=vortiago.textscene-inspector) | [Extension README](./apps/textscene-vscode/README.md) |
| Web previewer | [Open in the browser](https://vortiago.github.io/textscene-inspector/) | [Web guide](./docs/user-guide-web.md) |
| CLI linter for `.tscn` and `.tres` | `npm install --global @textscene/linter` | [Linter README](./apps/textscene-linter/README.md) |
| Language server for any editor | `npm install --global @textscene/lsp` | [Language server README](./apps/textscene-lsp/README.md) |

Dev edition, with the test scenes: [textscene-inspector.pages.dev](https://textscene-inspector.pages.dev/).

## What it renders

All 240 of Godot 4.6.3's instantiable node types are parsed and linted, and most render. The [parity gallery](https://textscene-inspector.pages.dev/parity/index.html) lists what renders and where it differs from Godot.

## Build from source

Requires Node.js 24+ and pnpm 9+ (on Windows: `winget configure scripts/winget-dev-setup.yaml`).

```bash
pnpm install
pnpm build
pnpm dev:web                                # web previewer on localhost
pnpm --filter textscene-inspector package   # VS Code .vsix
pnpm build:linter                           # CLI linter, then: pnpm lint:tscn <files>
```

Install a `.vsix` with **Extensions: Install from VSIX…**.

## Scripts

| Command | Does |
|---|---|
| `pnpm build` | Build all packages |
| `pnpm build:site` | Build the dev edition |
| `pnpm build:pages` | Build the public edition, without dev content |
| `pnpm build:linter` | Build the CLI linter |
| `pnpm build:lsp` | Build the `tscn-lsp` language server |
| `pnpm lint:tscn <paths>` | Lint `.tscn` and `.tres` paths |
| `pnpm test` | Unit tests |
| `pnpm test:visual` | Golden images, exact pixel match |
| `pnpm test:visual:update` | Rewrite the golden images |
| `pnpm test:visual:measure <logs>` | Refresh the scene seconds that balance the CI shards, from `gh run view --log` output |
| `pnpm test:vscode:csp` | The preview draws in the real VS Code webview, under its CSP |
| `pnpm --filter textscene-inspector test:integration` | VS Code integration tests |
| `TEXTSCENE_VSCODE_VERSION=min pnpm --filter textscene-inspector test:integration` | The same tests on the oldest VS Code that `engines.vscode` accepts |
| `pnpm vsc:package && pnpm --filter textscene-inspector test:installed` | The packaged `.vsix` in a clean VS Code: activation, commands, lint and preview |
| `pnpm --filter textscene-inspector test:web` | The browser build in VS Code for the Web, as vscode.dev runs it: activation, commands, lint, Outline and the preview tab |
| `pnpm test:vscode:web-preview` | In VS Code for the Web, a local folder's scene previews from the editor title button: the tree lists the root and the viewport paints. Run it after `test:web`, which builds the web bundle |
| `pnpm check` | The pre-push checks, for every change since `origin/main`, uncommitted files included |
| `pnpm lint` | ESLint |
| `pnpm format` | Prettier |
| `pnpm format:check` | Prettier check, as in CI |
| `pnpm type-check` | Type check |
| `pnpm clean` | Remove build output |

## Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md): design
- [CONTRIBUTING.md](./CONTRIBUTING.md): how to contribute
- [RELEASING.md](./RELEASING.md): how to release
- [REFERENCES.md](./REFERENCES.md): external docs
- [docs/user-flows.md](./docs/user-flows.md): manual checks
- [GitHub issues](https://github.com/Vortiago/textscene-inspector/issues): open work

## License

MIT
