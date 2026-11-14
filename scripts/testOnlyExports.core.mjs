/**
 * The test-only export scan over the real `@textscene/core` tree, with the exports it keeps. The
 * unit test and `pnpm pr:state` share it, so a thread sees a new test-only export in seconds.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { REPO_ROOT } from './repoRoot.mjs';
import { readImporters, readSourceTree } from './sourceTree.mjs';
import { entryPointsOf, testOnlyExports } from './testOnlyExports.mjs';

const CORE = resolve(REPO_ROOT, 'packages/textscene-core');

/** Every place outside core that imports it: the apps, the dev kit and the scripts. */
const OUTSIDE_CORE = ['apps', 'packages/textscene-dev-kit', 'scripts'].map((dir) => resolve(REPO_ROOT, dir));

/** The value exports kept although only tests import them, each with the reason a test needs it. */
export const KEPT_TEST_ONLY_EXPORTS = [
  // `@react-three/test-renderer` cannot wrap a real `<Canvas>`, so a scene test mounts its contents.
  'r3f/TscnCanvas.tsx#TscnSceneContents',
  // No runtime code lists the vendored icons, and the icon test checks each one against its raster.
  'r3f/controls/native/themeIcons.ts#vendoredIconSvgUrls',
  // The switch of the TSL port ships before its one reader, the pick of a lit surface's material,
  // which the next slice of the port adds.
  'r3f/litSurface/litSurfaceForm.ts#litSurfaceForm',
  // The builds and the cache are module state, so each test starts from the one reset that aborts
  // the builds in flight and clears the cache.
  'resources/textures/proceduralBuilds.ts#resetProceduralTextures',
  // The round trip test prints each parsed tree back to text, which no transpilation needs.
  'shaders/language/printer.ts#printShader',
  // The tree check proves each parsed tree has Godot's node types and positions, in tests only.
  'shaders/language/treeCheck.ts#treeFault',
];

/** The `file#name` of every value export of core that only tests import, the kept ones included. */
export function coreTestOnlyExports() {
  const packageJson = JSON.parse(readFileSync(resolve(CORE, 'package.json'), 'utf8'));
  return testOnlyExports(readSourceTree(resolve(CORE, 'src')), {
    tree: 'packages/textscene-core/src',
    dist: 'packages/textscene-core/dist',
    importers: readImporters(REPO_ROOT, OUTSIDE_CORE),
    entries: entryPointsOf(packageJson, './src'),
  });
}
