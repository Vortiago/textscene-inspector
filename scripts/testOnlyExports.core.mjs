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
  // No runtime code lists the hand rows, and a test builds the check of each one.
  'godot/classdb/propertyDescriptor.ts#handRowKeys',
  // The preprocessor refuses any NotPortable, and the refusal tests name the class each case throws.
  'godot/expression/execute.ts#UnportedExpression',
  // The Expression coverage test names the constructor registration each case reaches.
  'godot/variant/construct/construct.ts#constructorFor',
  // The preprocessor refuses any NotPortable, and the refusal tests name the class each case throws.
  'godot/variant/objects/makeObject.ts#UnsupportedObject',
  // The test pins that a name only the object prototype has is no C++ parameter.
  'godot/variant/utility/utilityArguments.ts#isCppParameter',
  // A registered hand row is module state nothing clears, so a test passes its own descriptor.
  'linter/descriptorValidator.ts#descriptorValidator',
  // `@react-three/test-renderer` cannot wrap a real `<Canvas>`, so a scene test mounts its contents.
  'r3f/TscnCanvas.tsx#TscnSceneContents',
  // The preview always mounts the shared live tree, so only the test setup installs the paint of a
  // subtree that a component test mounts bare (`r3f/testing/detachedPaint.ts`).
  'r3f/canvasItemPass/detachedPaintSlot.ts#installDetachedPaint',
  // A node and the painter it renders with no resource loader share one module store of settled
  // fonts, so the test setup empties it before each test.
  'r3f/controls/native/text/useSettledFont.ts#resetLoaderlessFonts',
  // No runtime code lists the vendored icons, and the icon test checks each one against its raster.
  'r3f/controls/native/themeIcons.ts#vendoredIconSvgUrls',
  // The TypeScript twins of a light's blend: the test holds both shader forms to them.
  'r3f/lighting2d/lightBlend.ts#blendLayer',
  'r3f/lighting2d/lightBlend.ts#lightBlendCompute',
  'r3f/lighting2d/lightBlend.ts#shadowedLightTerms',
  // The step tests start a step at the root scene's scope, which the live tree builds once inside.
  'r3f/liveSceneTree.ts#rootScope',
  // A host's scene loads through the loader of its provider. Only a test hands a scene a loader it built.
  'r3f/sceneResourcePipeline.ts#adoptLoader',
  // The octmap passes' push constants, coefficients, dispatch and atlas, checked against Godot without a GPU.
  'resources/sky/octmapPasses.ts#coefficientWords',
  'resources/sky/octmapPasses.ts#filterInvocations',
  'resources/sky/octmapPasses.ts#laidOut',
  'resources/sky/octmapPasses.ts#roughnessValues',
  // The builds and the cache are module state, so each test starts from the one reset that aborts
  // the builds in flight and clears the cache.
  'resources/textures/proceduralBuilds.ts#resetProceduralTextures',
  // The canvas tests name each instance flag and check the item matrix without a draw.
  'shaders/canvas/canvasRect.ts#CANVAS_RECT',
  // The preprocessed-text check reads the text before any parse, also for a text the parser refuses.
  'shaders/language/parseShader.ts#shaderCode',
  // The round trip test prints each parsed tree back to text, which no transpilation needs.
  'shaders/language/printer.ts#printShader',
  // The tree check proves each parsed tree has Godot's node types and positions, in tests only.
  'shaders/language/treeCheck.ts#treeFault',
  // The cache test fills the text cache past its bound.
  'shaders/material/baseMaterialShader.ts#CACHED_TEXTS',
  // The sweep of BaseMaterial3D texts writes each key's text, and the stencil pass's, without a material.
  'shaders/material/baseMaterialShader.ts#shaderTextOf',
  'shaders/material/stencilEffect.ts#stencilPassOf',
  // The template check prints each parsed template stage back to text, which no draw needs.
  'shaders/template/printTemplate.ts#printTemplateStage',
  // The sampler test checks the state of each hint without a texture copy.
  'shaders/uniforms/samplerState.ts#samplerState',
  // Vitest resolves `virtual:texture-worker-source` here (`vitest.shared.ts`), which no import names.
  'workers/textureWorkerSource.stub.ts#default',
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
