/** The Billboard row of the Sprite3D and Label3D details panels, which share SpriteBase3D's `billboard`. */

import { BillboardMode } from '../../../../godot/rendering/materials/billboardMode';
import type { EnumValue } from '../../../../godot/classdb/enumNames.js';

export function billboardName(mode: EnumValue<typeof BillboardMode>): string {
  switch (mode) {
    case BillboardMode.BILLBOARD_DISABLED:
      return 'Disabled';
    case BillboardMode.BILLBOARD_ENABLED:
      return 'Enabled';
    case BillboardMode.BILLBOARD_FIXED_Y:
      return 'Y-Axis Only';
    default:
      return 'Unknown';
  }
}
