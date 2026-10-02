# Documentation References

## Context7 Library IDs

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

## Godot engine source: a local reading aid, never a dependency

Clone it for property bounds, enum constants and the own-versus-inherited member split:

```bash
git clone --filter=blob:none --sparse --depth 1 --branch 4.6.3-stable \
    https://github.com/godotengine/godot.git godot-4.6.3
cd godot-4.6.3 && git sparse-checkout set scene doc/classes modules servers \
    core editor drivers
```

- Keep all seven directories. A missing one makes an agent invent line numbers, so check that a path resolves before you trust a `file:line`.
- `doc/classes/<Type>.xml` has members, defaults, enum constants and the `inherits=` parent.
- The class `.cpp` has the `ADD_PROPERTY` bounds.
- A member tagged `overrides="…"` is a default override, not a new property.
- A property flagged `PROPERTY_USAGE_NONE` never reaches a `.tscn`.
- Write each value as a literal with its source line as a comment. Nothing may read the checkout (`scripts/godot-source-decoupling.test.mjs`).
- `pnpm ref:godot` runs the `godot` on PATH. Check that `godot --version` matches the clone.
- A `file.cpp:line` is 4.6.3-relative unless its comment names another release. Moving the pin means a sweep of every citation.
- The published class reference is 4.7, so `AreaLight3D` has no citable `ADD_PROPERTY` hint.

Count the distinct citations:

```bash
grep -rhoE '[a-z0-9_]+\.(cpp|h|glsl):[0-9]+' packages/textscene-core/src | sort -u | wc -l
```

A bound that differs between releases follows the newer one (ADR-0032), cited from 4.7.2:

```bash
git clone --filter=blob:none --sparse --depth 1 --branch 4.7.2-stable \
    https://github.com/godotengine/godot.git godot-4.7.2
cd godot-4.7.2 && git sparse-checkout set scene modules servers core
```

`HINT_PREDATES_CAPTURE` in `hintImplementationParity` lists these values against the 4.6.3 ClassDB capture.

## Core Documentation

- TSCN format: https://docs.godotengine.org/en/stable/contributing/development/file_formats/tscn.html
- three.js: https://threejs.org/docs/
- React: https://react.dev/reference/react
- react-three-fiber: https://r3f.docs.pmnd.rs/
- @react-three/drei: https://drei.docs.pmnd.rs/
- Testing Library (React): https://testing-library.com/docs/react-testing-library/intro/
- TypeScript: https://www.typescriptlang.org/docs/
- VS Code Extension API: https://code.visualstudio.com/api
- pnpm workspaces: https://pnpm.io/workspaces
- Vitest: https://vitest.dev/guide/
- Vitest monorepo setup: https://vitest.dev/guide/projects
