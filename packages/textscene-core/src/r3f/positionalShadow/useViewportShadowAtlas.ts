import { useMemo } from 'react';
import type { PositionalShadowAtlasSettings } from '../../godot/rendering/lights/positionalShadowAtlas';
import { sameData } from '../../utils/sameData';
import { useByValue } from '../hooks/useByValue';
import { useDisposeOnRelease } from '../useDisposeOnRelease';
import { ViewportShadowAtlas } from './viewportShadowAtlas';

/** The viewport's own atlas, so a light it shares with the main view keeps a cube for each. */
export function useViewportShadowAtlas(settings: PositionalShadowAtlasSettings): ViewportShadowAtlas {
  const stableSettings = useByValue(settings, sameData);
  const atlas = useMemo(() => new ViewportShadowAtlas(stableSettings), [stableSettings]);
  useDisposeOnRelease(atlas);
  return atlas;
}
