/**
 * The sky bakes the lights the scene draws after they settle, and bakes again when they change.
 * The build itself needs a real GL context, so it is replaced by a spy on the lights it receives.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { SkyEnvironmentInput } from '../../resources/sky/build';
import type { PanoramaSkyProperties } from '../../resources/sky/types';
import { SkyLayer } from './SkyLayer';

const bakes = vi.hoisted((): SkyEnvironmentInput[] => []);

vi.mock('../../resources/sky/build', () => ({
  buildSkyEnvironment: (_gl: unknown, input: SkyEnvironmentInput) => {
    bakes.push(input);
    return null;
  },
}));

const SKY: PanoramaSkyProperties = { kind: 'panorama', panorama: undefined, energy_multiplier: 1 };

function Scene({ lights }: { lights: number }) {
  return (
    <>
      <SkyLayer sky={SKY} />
      {Array.from({ length: lights }, (_, i) => (
        <directionalLight key={i} position={[i + 1, 2, 3]} />
      ))}
    </>
  );
}

const lastBake = () => bakes[bakes.length - 1];

type Renderer = Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>;

/** In `act`, so the key a frame sets reaches the bake effect before the assertion. */
const advance = (renderer: Renderer, frames: number) =>
  ReactThreeTestRenderer.act(() => renderer.advanceFrames(frames, 0));

afterEach(() => {
  bakes.length = 0;
});

describe('SkyLayer', () => {
  it('waits for a frame to read the lights before it bakes', async () => {
    const renderer = await ReactThreeTestRenderer.create(<Scene lights={1} />);
    expect(bakes).toHaveLength(0);

    await advance(renderer, 1);

    expect(bakes).toHaveLength(1);
    expect(lastBake()?.lights).toHaveLength(1);
  });

  it('bakes again when a light unmounts after the bake', async () => {
    // The editor preview sun does this when the scene's own sun arrives. A stale bake keeps its
    // disc, and every glossy surface reflects it.
    const renderer = await ReactThreeTestRenderer.create(<Scene lights={2} />);
    await advance(renderer, 1);
    expect(lastBake()?.lights).toHaveLength(2);

    await renderer.update(<Scene lights={1} />);
    await advance(renderer, 1);

    expect(lastBake()?.lights).toHaveLength(1);
  });

  it('does not bake again while the lights stay the same', async () => {
    const renderer = await ReactThreeTestRenderer.create(<Scene lights={1} />);
    await advance(renderer, 3);

    expect(bakes).toHaveLength(1);
  });
});
