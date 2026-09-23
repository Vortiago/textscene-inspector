# Unified single-slice layout with a React-free linter sub-path

Each Node type lives in one folder (`nodes/<category>/<type>/`) that holds its parser, linter, formatter, render component and tests. Three thin entry points expose it. `index.ts` registers the parser and formatter in NodeRegistry and never re-exports the component. `index.linter.ts` registers validators and lint rules and imports only `.ts` files. `index.r3f.ts` registers the render component and is the only file that may import `./Component`.

The linter bundle stays React-free and THREE-free *by construction*: `linter/index.ts` imports only `index.linter.ts`, which imports only `.ts`. A module-graph guard test, over both `linter/index.ts` and `parser/TscnParser.ts`, enforces that invariant. An ESLint `no-restricted-imports` rule bans `*.tsx` and `./Component` from `index.ts` and `index.linter.ts`.

Rejected: the split-slice layout, with parser and linter in `nodes/` and the component in a parallel `r3f/nodes/`. Locality matters more than the apparent safety of physical separation. A change to what a Camera3D is touches one directory, not two trees four levels apart.

The decision is hard to reverse, because it touches every Node folder and all three barrels. React beside linter code looks as if it breaks the bundle split. The entry-point discipline is what keeps the split.
