# Follow-ups for the last wave

Items the waves found and left for the session. Each is settled before the PR.

## Dead-code candidates (only a test uses them)

The final dead-code pass decides each one: delete it with its test, or keep it
and state why.

- `apps/textscene-vscode/src/test/integration/helpers/fixtureHelpers.ts`:
  `openFixture`. Nothing calls it.
- `packages/textscene-core/src/core/NodeRegistry.ts`:
  `NodeTypeRegistration.typeGuard`. `findRegistration` ignores it. Only tests
  set it.
- `packages/textscene-core/src/core/NodeRegistry.ts`: `unregister`. Only test
  teardown calls it.
- `packages/textscene-core/src/linter/linterUtils.ts`: `findNodesByName`, and
  the `SceneIndex.byName` map that serves it. Only its test calls it.
- Kept as test infrastructure or public entry exports: `everyValidatorLabel`,
  `UNCATALOGUED_BASE_TYPES`, `canonicalPropertyName`, `isDeprecatedPropertyName`.
- `packages/textscene-core/src/nodes/2d/ui/shared/splitContainerSolver.ts`:
  `computeSplitDraggerPosition`. Only its test calls it.
- `packages/textscene-core/src/nodes/2d/ui/shared/splitContainer.ts`:
  `splitFirstExtent`, with `splitSeparation`, `DEFAULT_SEPARATION` and
  `GRABBER_EXTENT` behind it. Only its test reaches them.
- `packages/textscene-core/src/nodes/2d/ui/shared/boxContainer.ts`:
  `alignmentJustify`. Only its test calls it.
- `packages/textscene-core/src/nodes/2d/ui/progressbar/nativeSolver.ts`: four
  `PROGRESS_BAR_*` constants are exported, but only the file itself uses them.
- `packages/textscene-core/src/r3f/controls/native/StyleBoxQuad.tsx`:
  `tintStyleBox` is exported (and re-exported by `buttonBase.ts`) only for
  `buttonBase.test.ts`. The file uses it internally.
