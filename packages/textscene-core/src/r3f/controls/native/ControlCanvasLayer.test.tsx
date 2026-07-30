/**
 * `<ControlCanvasLayer>` (#368, packet P2): the native (WebGL) mount point
 * for Control nodes. This packet ships only the mount seam — the layer is a
 * placeholder that draws nothing. A later packet replaces the body with the
 * real Control canvas-item tree; this test pins the placeholder contract so
 * that swap has a known-good baseline to diff against.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { ControlCanvasLayer } from './ControlCanvasLayer';

describe('<ControlCanvasLayer> (P2 placeholder)', () => {
  it('renders nothing', async () => {
    const renderer = await ReactThreeTestRenderer.create(<ControlCanvasLayer />);
    expect(renderer.scene.children).toHaveLength(0);
  });
});
