/** What every canvas's renderer gets before its first frame. */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { CanvasRendererScope } from './CanvasRendererScope';
import { r3fStateProbe } from '../testing/R3FStateProbe';

/** The mark `installShadowPass` leaves on a wrapped shadow map. */
const SHADOW_PASS = Symbol.for('textscene.shadowPass');

describe('CanvasRendererScope', () => {
  it('installs the shadow pass on its renderer', async () => {
    const { Probe, state } = r3fStateProbe();

    await ReactThreeTestRenderer.create(
      <CanvasRendererScope>
        <Probe />
      </CanvasRendererScope>
    );

    expect(SHADOW_PASS in state().gl.shadowMap).toBe(true);
  });

  it('wraps the shadow pass once when it mounts again', async () => {
    const { Probe, state } = r3fStateProbe();
    const rendered = await ReactThreeTestRenderer.create(
      <CanvasRendererScope key="a">
        <Probe />
      </CanvasRendererScope>
    );
    const wrapped = state().gl.shadowMap.render;

    await rendered.update(
      <CanvasRendererScope key="b">
        <Probe />
      </CanvasRendererScope>
    );

    expect(state().gl.shadowMap.render).toBe(wrapped);
  });

  it('mounts its children', async () => {
    const rendered = await ReactThreeTestRenderer.create(
      <CanvasRendererScope>
        <mesh name="drawn" />
      </CanvasRendererScope>
    );

    expect(rendered.scene.findAllByProps({ name: 'drawn' })).toHaveLength(1);
  });
});
