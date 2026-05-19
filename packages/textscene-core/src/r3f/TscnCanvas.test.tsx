import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { TscnSceneContents } from './TscnCanvas';

describe('<TscnSceneContents> (default lighting)', () => {
  it('mounts ambient and directional lights', async () => {
    const renderer = await ReactThreeTestRenderer.create(<TscnSceneContents />);

    const ambient = renderer.scene.findAllByType('AmbientLight');
    const directional = renderer.scene.findAllByType('DirectionalLight');

    expect(ambient).toHaveLength(1);
    expect(directional).toHaveLength(1);
  });

  it('positions the directional light at [5, 5, 5]', async () => {
    const renderer = await ReactThreeTestRenderer.create(<TscnSceneContents />);

    const directional = renderer.scene.findByType('DirectionalLight');
    const pos = directional.instance.position;

    expect(pos.x).toBe(5);
    expect(pos.y).toBe(5);
    expect(pos.z).toBe(5);
  });
});
