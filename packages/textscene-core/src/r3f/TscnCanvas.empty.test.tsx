/**
 * With no scene loaded, the canvas shows a grid and a prompt, since a black
 * rectangle looks like a renderer crash.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { TscnSceneContents } from './TscnCanvas';

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
});
