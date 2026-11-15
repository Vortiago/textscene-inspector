import { useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import type { PositionalShadowAtlasSettings } from '../../godot/rendering/lights/positionalShadowAtlas';
import { sameData } from '../../utils/sameData';
import { useByValue } from '../hooks/useByValue';
import { useDisposeOnRelease } from '../useDisposeOnRelease';
import { atlasWithinGpu, ViewportShadowAtlas } from './viewportShadowAtlas';

/** The viewport's own atlas, so a light it shares with the main view keeps a cube for each. */
export function useViewportShadowAtlas(settings: PositionalShadowAtlasSettings): ViewportShadowAtlas {
  const stableSettings = useByValue(settings, sameData);
  const maxTextureSize = useThree((state) => state.gl.capabilities.maxTextureSize);
  const atlas = useMemo(
    () => new ViewportShadowAtlas(atlasWithinGpu(stableSettings, maxTextureSize)),
    [stableSettings, maxTextureSize]
  );
  useDisposeOnRelease(atlas);
  return atlas;
}
