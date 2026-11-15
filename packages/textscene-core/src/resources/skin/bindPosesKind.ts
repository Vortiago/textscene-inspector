/** The bind poses of a Skin, read through the resource module (ADR-0071): what a `draw_skin` gives a trail. No THREE and no React. */

import type { Transform3D } from '../../godot/math/transform3d';
import type { ResourceKind } from '../reading';
import { decodeSkin } from './decode';

export const SKIN_BIND_POSES: ResourceKind<Transform3D[]> = {
  name: 'Skin',
  accepts: (type) => type === 'Skin',
  decode: ({ properties }) => decodeSkin(properties).map((bind) => bind.pose),
};
