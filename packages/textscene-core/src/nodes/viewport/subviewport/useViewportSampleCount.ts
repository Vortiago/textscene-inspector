/** The samples a sub-viewport's pass draws on this device, for the buffer `kind` names. */

import { useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { deviceSampleCount } from '../../../r3f/deviceSampleCount';
import { viewportMsaaSamples } from './offscreenViewport';
import type { SubViewportProperties } from './types';

export function useViewportSampleCount(
  modes: Pick<SubViewportProperties, 'msaa_2d' | 'msaa_3d'>,
  kind: '2d' | '3d'
): number {
  const gl = useThree((state) => state.gl);
  const requested = viewportMsaaSamples(modes, kind);
  return useMemo(() => deviceSampleCount(gl, requested), [gl, requested]);
}
