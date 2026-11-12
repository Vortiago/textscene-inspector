/**
 * Guards ADR-0071: a reader outside `resources/reading/` reads a resource through
 * `useNodeResource` or `ResourceSnapshot.read`, never by looking a reference up in a table. The
 * list of files not moved yet only shrinks, names the issue that removes each entry, and ends.
 */

import { describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import { findRepoRoot } from './repoRoot.mjs';
import { readSourceTree } from './sourceTree.mjs';
import { lookupFailures } from './resourceLookups.mjs';

const CORE_SRC = resolve(findRepoRoot(), 'packages/textscene-core/src');

/**
 * The layer below the module: the files that define the banned functions, the reference grammar
 * and section lookup the module and the loader's processors share, and the files that rewrite
 * tables for a merged node or resolve the scene of an instance.
 */
const LAYER = new Set([
  'resources/SubResourceResolver.ts',
  'resources/useSubOrExtResource.ts',
  'resources/resolveReference.ts',
  'resources/useLoadedFiles.ts',
  'resources/resourceSection.ts',
  'resources/subResourcePath.ts',
  'resources/rehomeOverride.ts',
  'resources/authoredSpelling.ts',
  'r3f/hooks/useInstancedScene.ts',
]);

/**
 * The files not moved onto the module yet, each with its calls and the open issue that removes it.
 * Where several issues lower the count of one file, the entry names the last of them.
 */
const UNMOVED = new Map([
  ['nodes/2d/ui/textedit/Component.tsx', { calls: 1, issue: 1697 }],
  ['nodes/3d/csg/csgmesh3d/csgGeometry.ts', { calls: 5, issue: 1685 }],
  ['nodes/3d/csg/csgmesh3d/meshSurfaces.ts', { calls: 2, issue: 1685 }],
  ['nodes/3d/fogvolume/Component.tsx', { calls: 2, issue: 1694 }],
  ['nodes/3d/gridmap/Component.tsx', { calls: 1, issue: 1681 }],
  ['nodes/3d/lightmapgi/Component.tsx', { calls: 1, issue: 1697 }],
  ['nodes/3d/meshinstance3d/Component.tsx', { calls: 1, issue: 1685 }],
  ['nodes/3d/meshinstance3d/meshAabb.ts', { calls: 1, issue: 1685 }],
  ['nodes/3d/meshinstance3d/useMeshSkin.ts', { calls: 1, issue: 1685 }],
  ['nodes/3d/multimeshinstance3d/ownAabb.ts', { calls: 1, issue: 1685 }],
  ['nodes/3d/navigationregion3d/Component.tsx', { calls: 1, issue: 1694 }],
  ['nodes/3d/occluderinstance3d/Component.tsx', { calls: 1, issue: 1694 }],
  ['nodes/3d/particles/cpuparticles3d/ParticleMesh.tsx', { calls: 1, issue: 1685 }],
  ['nodes/3d/particles/gpuparticles3d/useProcessMaterialEmission.ts', { calls: 1, issue: 1695 }],
  ['nodes/3d/worldenvironment/useResolvedEnvironment.ts', { calls: 3, issue: 1517 }],
  ['nodes/animation/animationplayer/animationResolver.ts', { calls: 5, issue: 1682 }],
  ['nodes/animation/animationtree/treeResources.ts', { calls: 1, issue: 1682 }],
  ['nodes/physics/3d/collisionshape3d/Component.tsx', { calls: 1, issue: 1694 }],
  ['nodes/physics/3d/shapecast3d/Component.tsx', { calls: 1, issue: 1694 }],
  ['nodes/shared/cpuparticles/sceneResources.ts', { calls: 2, issue: 1695 }],
  ['nodes/shared/cpuparticles/useParticleResources.ts', { calls: 1, issue: 1695 }],
  ['r3f/components/canvasItemMaterialContext.tsx', { calls: 2, issue: 1688 }],
  ['r3f/controls/native/buildSolveTree.ts', { calls: 6, issue: 1696 }],
  ['r3f/controls/native/parseStyleBox.ts', { calls: 2, issue: 1679 }],
  ['r3f/controls/native/styleBoxLine.ts', { calls: 2, issue: 1679 }],
  ['r3f/controls/native/styleBoxTexture.ts', { calls: 2, issue: 1679 }],
  ['r3f/environment/useResolvedCameraAttributes.ts', { calls: 1, issue: 1517 }],
  ['r3f/materials/materialSource.ts', { calls: 3, issue: 1517 }],
  ['r3f/useTileSetModel.ts', { calls: 3, issue: 1680 }],
  ['resources/curves/shared/bezierCurve.ts', { calls: 2, issue: 1687 }],
  ['resources/fonts/font/decode.ts', { calls: 3, issue: 1686 }],
  ['resources/lightmapgidata/decode.ts', { calls: 1, issue: 1697 }],
  ['resources/meshes/primitivemesh/surface.ts', { calls: 3, issue: 1685 }],
  ['resources/styles/labelsettings/decode.ts', { calls: 1, issue: 1696 }],
  ['resources/texture2DSize.ts', { calls: 2, issue: 1688 }],
  ['resources/textures/atlastexture/resolveAtlasTexture.ts', { calls: 2, issue: 1518 }],
  ['resources/textures/gradienttexture2d/decode.ts', { calls: 1, issue: 1518 }],
  ['resources/textures/gradienttexture2d/resolveGradientTexture.ts', { calls: 2, issue: 1518 }],
  ['resources/textures/image/decode.ts', { calls: 1, issue: 1518 }],
  ['resources/textures/noiseSources.ts', { calls: 1, issue: 1518 }],
  ['resources/textures/resolveProceduralSubResource.ts', { calls: 2, issue: 1518 }],
  ['resources/textures/spriteframes/useSpriteFrames.ts', { calls: 1, issue: 1697 }],
  ['resources/textures/textureSourceFiles.ts', { calls: 3, issue: 1518 }],
  ['resources/textures/viewporttexture/useViewportTextureSlot.ts', { calls: 2, issue: 1518 }],
  ['resources/tileset/decode.ts', { calls: 7, issue: 1680 }],
  ['resources/useLoadedFilesAndFonts.ts', { calls: 2, issue: 1696 }],
  ['resources/useProjectFonts.ts', { calls: 2, issue: 1696 }],
  ['resources/useTexture2D.ts', { calls: 4, issue: 1518 }],
  ['resources/useTexture3D.ts', { calls: 1, issue: 1518 }],
  ['resources/useTextureSources.ts', { calls: 1, issue: 1518 }],
]);

const CALLS_LOOKUP = 'const sub = findSubResource(pools, id);\n';
const NO_LAYER = new Set();
const NONE_UNMOVED = new Map();

describe('a call of a lookup outside the reading module', () => {
  it('fails in a file that is not listed', () => {
    const files = new Map([['nodes/2d/sprite2d/Component.tsx', CALLS_LOOKUP]]);

    expect(lookupFailures(files, NO_LAYER, NONE_UNMOVED)).toEqual([
      expect.stringMatching(
        /nodes\/2d\/sprite2d\/Component\.tsx calls findSubResource\(.*useNodeResource.*ResourceSnapshot\.read/
      ),
    ]);
  });

  it('passes inside resources/reading/ and in a file of the layer', () => {
    const files = new Map([
      ['resources/reading/snapshot.ts', CALLS_LOOKUP],
      ['resources/rehomeOverride.ts', CALLS_LOOKUP],
    ]);

    expect(lookupFailures(files, new Set(['resources/rehomeOverride.ts']), NONE_UNMOVED)).toEqual([]);
  });

  it.each([
    ['a test file', 'nodes/2d/sprite2d/Component.test.tsx'],
    ['a linter file', 'nodes/2d/sprite2d/linter.ts'],
    ['a file of a linter folder', 'nodes/2d/sprite2d/linter/rules.ts'],
    ['a file outside nodes/, r3f/ and resources/', 'parser/TscnParser.ts'],
  ])('passes in %s, which the scan does not read', (_label, path) => {
    expect(lookupFailures(new Map([[path, CALLS_LOOKUP]]), NO_LAYER, NONE_UNMOVED)).toEqual([]);
  });
});

describe('how the scan reads a file', () => {
  const failuresOf = (text) => lookupFailures(new Map([['r3f/Reader.tsx', text]]), NO_LAYER, NONE_UNMOVED);

  it('counts a call', () => {
    expect(failuresOf('useResourceResolution(ref, pools);\n')).toHaveLength(1);
  });

  it('passes an import with no call', () => {
    expect(failuresOf("import { findSubResource } from '../resources/SubResourceResolver';\n")).toEqual([]);
  });

  it('passes a name in a comment', () => {
    expect(failuresOf('// Not findSubResource(pools, id): the module resolves it.\n')).toEqual([]);
  });

  it('passes a name in a string', () => {
    expect(failuresOf("const message = 'call findSubResource(pools, id)';\n")).toEqual([]);
  });

  it('counts a call after an apostrophe in a template literal on the same line', () => {
    expect(failuresOf("warn(`can't ${x}`); findSubResource(t, 'id');\n")).toHaveLength(1);
  });

  it('counts a call inside a template literal interpolation', () => {
    expect(failuresOf('const label = `${findSubResource(t, id)?.type}`;\n')).toHaveLength(1);
  });

  it('counts a call whose name and bracket are on two lines', () => {
    expect(failuresOf('const sub = findSubResource\n  (t, id);\n')).toHaveLength(1);
  });

  it('passes a method of another object with a banned name', () => {
    expect(failuresOf('table.findSubResource(id);\n')).toEqual([]);
  });

  it('passes a longer name that starts with a banned one', () => {
    expect(failuresOf('findSubResourceTable(pools);\n')).toEqual([]);
  });
});

describe('the list of files not moved yet', () => {
  const READER = 'r3f/Reader.tsx';
  const twoCalls = new Map([[READER, `${CALLS_LOOKUP}${CALLS_LOOKUP}`]]);

  it('only shrinks: a listed file with more calls than its entry fails', () => {
    const unmoved = new Map([[READER, { calls: 1, issue: 1 }]]);

    expect(lookupFailures(twoCalls, NO_LAYER, unmoved)).toEqual([expect.stringContaining('2 calls')]);
  });

  it('names an issue for each entry', () => {
    const unmoved = new Map([[READER, { calls: 2 }]]);

    expect(lookupFailures(twoCalls, NO_LAYER, unmoved)).toEqual([expect.stringContaining('names no issue')]);
  });

  it('ends: a listed file with no call fails as stale', () => {
    const unmoved = new Map([[READER, { calls: 2, issue: 1 }]]);

    expect(lookupFailures(new Map([[READER, 'export const reader = 1;\n']]), NO_LAYER, unmoved)).toEqual([
      expect.stringContaining('stale'),
    ]);
  });

  it('ends: a listed file with fewer calls fails until its entry is lowered', () => {
    const unmoved = new Map([[READER, { calls: 3, issue: 1 }]]);

    expect(lookupFailures(twoCalls, NO_LAYER, unmoved)).toEqual([
      expect.stringContaining('lower its entry to 2'),
    ]);
  });
});

describe('the readers of @textscene/core', () => {
  it('read every resource through the module, but the files listed as not moved yet', () => {
    expect(lookupFailures(readSourceTree(CORE_SRC), LAYER, UNMOVED)).toEqual([]);
  });
});
