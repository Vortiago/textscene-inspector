import { BillboardMode } from '../../../../../godot/rendering/materials/billboardMode';

export function billboardName(mode: number): string {
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
