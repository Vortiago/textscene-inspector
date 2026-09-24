/**
 * Shared audio boolean formatter: renders a boolean audio property as
 * 'true' or 'false' in the details panel for the AudioStreamPlayer, 2D and 3D
 * property formatters.
 */

export function yesNo(value: boolean): string {
  return value ? 'true' : 'false';
}
