/** The root world's tonemap pass on its canvas, which draws every 3D frame (ADR-0061). */

import { Compositor } from './Compositor';
import { useDraws3D } from './draws3D';

export function ToneMapLayer() {
  return useDraws3D() ? <Compositor /> : null;
}
