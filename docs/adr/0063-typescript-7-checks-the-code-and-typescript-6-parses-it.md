# TypeScript 7 checks the code, and TypeScript 6 parses it for the tools

- Status: Accepted

## Context

TypeScript 7 is the native compiler. Its `typescript` package ships the `tsc` command and no
JavaScript compiler API. Some tools in the repo import that API to parse TypeScript source: the
ESLint parser (`@typescript-eslint/parser`), dts-bundle-generator, and our own syntax scripts and
conformance tests (`declaredExports.ts` and `testOnlyExports.mjs`, for example). typescript-eslint
supports TypeScript up to 6.0 (typescript-eslint issue #10940).

## Decision

Every package runs `tsc` from `@typescript/native`, an alias for `typescript@7`. The name
`typescript` is an alias for `@typescript/typescript6`, the package that Microsoft publishes for
tools that need the TypeScript 6 API. Its command is `tsc6`, so the two commands do not collide.
An override in the root `package.json` gives dts-bundle-generator the same TypeScript 6 API.

The type check, the build and the type check of each packed package and the renderer consumer use
TypeScript 7. The tools that only parse use TypeScript 6. When typescript-eslint and
dts-bundle-generator support TypeScript 7, `typescript` can name TypeScript 7 again.

## Considered options

- Keep TypeScript 6 for everything: the type check stays on the compiler that consumers move away
  from.
- Port our syntax scripts to the `typescript/unstable/*` API of TypeScript 7: the ESLint parser
  still needs TypeScript 6, so the repo keeps both, and the scripts depend on an API that can
  change in any release.
