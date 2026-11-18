/**
 * With no scene loaded, the canvas shows a grid and a prompt, since a black
 * rectangle looks like a renderer crash.
 */
import { describe, expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import { TRIANGLE_OUTLINES } from './controls/native/testing/triangleOutlines';
import { TscnSceneContents } from './TscnCanvas';

// One triangle for each glyph of the bundled font, so no test decodes the font.
vi.mock('./controls/native/text/sceneFontOutlines', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  peekOutlines: () => TRIANGLE_OUTLINES,
}));

// The first lazy import transforms the glyph engine, which outlasts the default 1 s under a loaded run.
const PROMPT_LOAD_TIMEOUT = { timeout: 10_000 };
// Longer than the wait, so the wait's own failure message reports a slow load.
const PROMPT_TEST_TIMEOUT = { timeout: 15_000 };

describe('<TscnSceneContents> empty-scene indicator (WI-UX-4 / Gap 8)', () => {
  it('mounts a gridHelper as a visual baseline when sceneGraph is null', async () => {
    const renderer = await ReactThreeTestRenderer.create(<TscnSceneContents />);
    const grids = renderer.scene.findAllByType('GridHelper');
    expect(grids).toHaveLength(1);
  });

  it('tags the empty-scene group on userData so callers can identify it', async () => {
    const renderer = await ReactThreeTestRenderer.create(<TscnSceneContents />);
    // Walk the THREE.Scene under the renderer to find the tagged group.
    const sceneInstance = renderer.scene.instance;
    let tagged: { userData?: Record<string, unknown> } | null = null;
    sceneInstance.traverse((object: { userData?: Record<string, unknown> }) => {
      if (object.userData?.tscnEmptyState === true) {
        tagged = object;
      }
    });
    expect(tagged).not.toBeNull();
  });

  it('draws the prompt as glyphs of the bundled font', PROMPT_TEST_TIMEOUT, async () => {
    const renderer = await ReactThreeTestRenderer.create(<TscnSceneContents />);
    await vi.waitFor(async () => {
      await ReactThreeTestRenderer.act(async () => {});
      const glyphMeshes = renderer.scene.findAll((node) => node.instance instanceof THREE.Mesh);
      expect(glyphMeshes.length).toBeGreaterThan(0);
    }, PROMPT_LOAD_TIMEOUT);
  });
});
