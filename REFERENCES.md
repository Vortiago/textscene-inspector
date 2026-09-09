# Documentation References

Quick reference for looking up documentation.

## Context7 Library IDs

Use these with the Context7 MCP tool for up-to-date documentation:

- **three.js**: `/mrdoob/three.js`
- **React**: `/reactjs/react.dev`
- **react-three-fiber**: `/pmndrs/react-three-fiber`
- **@react-three/drei**: `/pmndrs/drei`
- **@testing-library/react**: `/testing-library/react-testing-library`
- **VS Code Extension API**: `/websites/code_visualstudio_api`
- **Godot Engine**: `/websites/godotengine_en_stable`
- **TypeScript**: `/microsoft/typescript`
- **ViTest**: `/websites/vitest_dev`
- **PNPM**: `/pnpm/pnpm`

## Godot engine source — a local reading aid, never a dependency

Property bounds (`PROPERTY_HINT_RANGE`), enum constants and the own-versus-inherited
member split are stated only in the engine source. Linter validators are therefore
measured from it rather than guessed. Clone it anywhere. Nothing in this repo reads it:

```bash
git clone --filter=blob:none --sparse --depth 1 --branch 4.6.3-stable \
    https://github.com/godotengine/godot.git godot-4.6.3
cd godot-4.6.3 && git sparse-checkout set scene doc/classes modules servers \
    core editor drivers
```

All seven directories are needed. `scene` and `doc/classes` cover the common case.
`servers` holds the rendering-server entry points a few parity notes cite. `modules`
holds the OpenXR classes and their own `doc_classes/` pages. `core` holds
`variant_parser.cpp`, which decides what a malformed literal does. `editor` holds the
`TOOLS_ENABLED` node types the catalog still lists. `drivers` holds the GLES3
rasteriser the 2D-lighting notes cite. A directory left out does not produce an error.
It produces an invented citation: an agent asked to ground a claim in a file it cannot
open returns plausible, wrong line numbers. Check that the path resolves before
trusting any `file:line`.

Match the tag to the `godot` binary `pnpm ref:godot` uses (4.6.3). Read
`doc/classes/<Type>.xml` for members, defaults, enum constants and the `inherits=`
parent. Read the class `.cpp` for `ADD_PROPERTY` bounds. A member tagged
`overrides="…"` is a default-value override, not a new property. A property flagged
`PROPERTY_USAGE_NONE` is never serialised into a `.tscn`.

Values learned this way are baked into the code as literals, with the governing source
line reproduced as a comment. No source file, test, fixture, script or CI step may
resolve a path into the checkout. `scripts/godot-source-decoupling.test.mjs` enforces
that, and deleting the clone must leave `pnpm validate` unchanged.

Every `file.cpp:line` in the code is 4.6.3-relative. Count the distinct pairs with:

```bash
grep -rhoE '[a-z0-9_]+\.(cpp|h|glsl):[0-9]+' packages/textscene-core/src | sort -u | wc -l
```

Moving the pin therefore re-anchors every citation and is a sweep, not a config change.
The published class reference is already a minor version ahead (4.7). That is why
`AreaLight3D` has a slice and a hand-stated `Light3D` hop but no citable `ADD_PROPERTY`
hint.

## Core Documentation

### TSCN Format
- https://docs.godotengine.org/en/stable/contributing/development/file_formats/tscn.html

### three.js
- https://threejs.org/docs/

### React
- https://react.dev/reference/react

### react-three-fiber
- https://r3f.docs.pmnd.rs/

### @react-three/drei
- https://drei.docs.pmnd.rs/

### Testing Library (React)
- https://testing-library.com/docs/react-testing-library/intro/

### TypeScript
- https://www.typescriptlang.org/docs/

### VS Code Extension API
- https://code.visualstudio.com/api

### pnpm Workspaces
- https://pnpm.io/workspaces

### Vitest
- https://vitest.dev/guide/
- https://vitest.dev/guide/projects (monorepo setup)
