/** `rgba(r, g, b, a)` with 0 to 255 whole channels and a two-place alpha, from a Color's four numbers. */
export function rgbaText([r = 0, g = 0, b = 0, a = 1]: readonly number[]): string {
  return `rgba(${(r * 255).toFixed(0)}, ${(g * 255).toFixed(0)}, ${(b * 255).toFixed(0)}, ${a.toFixed(2)})`;
}

/** A rotation in radians as degrees to two places. */
export function degreesText(radians: number): string {
  return (radians * (180 / Math.PI)).toFixed(2);
}

/** A vector's numbers in brackets, as JavaScript writes each: `(1, 0.5)`. */
export function tupleText(numbers: readonly number[]): string {
  return `(${numbers.join(', ')})`;
}

export function yesNo(isOn: boolean): string {
  return isOn ? 'Yes' : 'No';
}

/** A resource path, or `(none)` for an empty slot. */
export function resourceText(path: string | null): string {
  return path ?? '(none)';
}
