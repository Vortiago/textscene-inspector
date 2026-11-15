import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { PositionalShadowAtlasSettings } from '../../godot/rendering/lights/positionalShadowAtlas';
import { positionalShadowAtlas } from './shadowAtlasTarget';
import { useViewportShadowAtlas } from './useViewportShadowAtlas';
import type { ViewportShadowAtlas } from './viewportShadowAtlas';

const settingsOf = (size: number) => ({ size, quadrantShadows: [4, 4, 4, 8] as const });

function AtlasProbe({
  settings,
  seen,
}: {
  settings: PositionalShadowAtlasSettings;
  seen: ViewportShadowAtlas[];
}) {
  seen.push(useViewportShadowAtlas(settings));
  return null;
}

/** The settled atlas of a render with `first`, and the atlas of the next render with `second`. */
async function atlasesOfTwoRenders(
  first: PositionalShadowAtlasSettings,
  second: PositionalShadowAtlasSettings,
  maxTextureSize = 16384
): Promise<ViewportShadowAtlas[]> {
  const seen: ViewportShadowAtlas[] = [];
  const renderer = await ReactThreeTestRenderer.create(<AtlasProbe settings={first} seen={seen} />, {
    onCreated: ({ gl }) => {
      gl.capabilities.maxTextureSize = maxTextureSize;
    },
  });
  // The GPU limit lands in `onCreated`, after the first render.
  const settled = seen.at(-1)!;
  await renderer.update(<AtlasProbe settings={second} seen={seen} />);
  return [settled, seen.at(-1)!];
}

describe('useViewportShadowAtlas', () => {
  it('keeps the atlas while a render builds the same settings again', async () => {
    const [first, last] = await atlasesOfTwoRenders(settingsOf(1024), settingsOf(1024));

    expect(last).toBe(first);
  });

  it('builds a new atlas when the settings change', async () => {
    const [first, last] = await atlasesOfTwoRenders(settingsOf(1024), settingsOf(2048));

    expect(last).not.toBe(first);
  });

  it('holds no larger side than the GPU allocates', async () => {
    await atlasesOfTwoRenders(settingsOf(16384), settingsOf(16384), 8192);

    expect(positionalShadowAtlas().width).toBe(8192);
  });
});
