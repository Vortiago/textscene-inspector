# TextScene Inspector

[![CI](https://github.com/Vortiago/textscene-inspector/actions/workflows/ci.yml/badge.svg?branch=main&event=push)](https://github.com/Vortiago/textscene-inspector/actions/workflows/ci.yml?query=branch%3Amain+event%3Apush)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

Renders Godot `.tscn` scenes in 3D and 2D, without Godot.

It reads the `.tscn` text and draws it with react-three-fiber over three.js. There is no Godot install, editor cache or import step.

**Try it:** [vortiago.github.io/textscene-inspector](https://vortiago.github.io/textscene-inspector/)

![The web previewer rendering a CSG hallway](./docs/showcase/web/hallway.png)

## Get it

| Tool | Get it | Guide |
| --- | --- | --- |
| VS Code extension (desktop and vscode.dev) | [Marketplace](https://marketplace.visualstudio.com/items?itemName=vortiago.textscene-inspector) | [Extension README](./apps/textscene-vscode/README.md) |
| Web previewer | [Open in the browser](https://vortiago.github.io/textscene-inspector/) | [Web guide](./docs/user-guide-web.md) |
| CLI linter for `.tscn` and `.tres` | `npm install --global @textscene/linter` | [Linter README](./apps/textscene-linter/README.md) |

The dev edition of the web previewer adds the built-in test scenes: [textscene-inspector.pages.dev](https://textscene-inspector.pages.dev/).

## What it renders

All 240 of Godot 4.6.3's instantiable node types are parsed and linted. Most of them also render: meshes, CSG, lights, materials, 2D, Control UI, viewports and animation.

The [parity gallery](https://textscene-inspector.pages.dev/parity/index.html) compares each node type with real Godot. It is the one list of what renders and where the output differs.

## Build from source

Requires Node.js 24 or later and pnpm 9 or later. On Windows, `winget configure scripts/winget-dev-setup.yaml` installs both.

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
| `pnpm build:site` | Build the dev edition of the web previewer |
| `pnpm build:pages` | Build the public edition, and check it holds no dev content |
| `pnpm build:linter` | Build the CLI linter |
| `pnpm lint:tscn <paths>` | Lint `.tscn` and `.tres` files or directories |
| `pnpm test` | Unit tests |
| `pnpm test:visual` | Golden images, exact pixel match |
| `pnpm test:visual:update` | Rewrite the golden images. Check them before you commit. |
| `pnpm test:vscode:csp` | Text renders in the real VS Code webview, offline, under its CSP |
| `pnpm --filter textscene-inspector test:integration` | VS Code integration tests |
| `pnpm lint` | ESLint |
| `pnpm type-check` | Type check |
| `pnpm clean` | Remove build output |

[CONTRIBUTING.md](./CONTRIBUTING.md) says how to check a change before a pull request.

## Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md): design and project structure
- [CONTRIBUTING.md](./CONTRIBUTING.md): issues, checks and pull requests
- [RELEASING.md](./RELEASING.md): how to release
- [REFERENCES.md](./REFERENCES.md): Godot and three.js links
- [docs/user-flows.md](./docs/user-flows.md): manual verification flows
- [GitHub issues](https://github.com/Vortiago/textscene-inspector/issues): open work

## License

MIT
