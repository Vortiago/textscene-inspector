/**
 * Shared audio boolean formatter — renders a boolean audio property as
 * 'true' / 'false' in the details panel. Shared by the AudioStreamPlayer /
 * 2D / 3D property formatters.
 */

export function yesNo(value: boolean): string {
  return value ? 'true' : 'false';
}
