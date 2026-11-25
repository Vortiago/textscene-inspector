/** `rgba(r, g, b, a)` with 0 to 255 whole channels and a two-place alpha, from a Color's four numbers. */
export function rgbaText([r = 0, g = 0, b = 0, a = 1]: readonly number[]): string {
  return `rgba(${channelOf(r)}, ${channelOf(g)}, ${channelOf(b)}, ${a.toFixed(2)})`;
}

// The product rounds in single precision, as color.cpp:113 does: 0.7f reads 179, not 178.
function channelOf(component: number): number {
  return Math.round(Math.fround(component * 255));
}

/** A rotation in radians as degrees to two places. */
export function degreesText(radians: number): string {
  return (radians * (180 / Math.PI)).toFixed(2);
}

/** A vector's numbers in brackets, each as `realText` writes it: `(1, 0.4)`. */
export function tupleText(numbers: readonly number[]): string {
  return `(${numbers.map(realText).join(', ')})`;
}

/** The shortest decimal that reads back as the same single-precision number: 0.4, not 0.4000000059604645. */
export function realText(real: number): string {
  for (let digits = 1; digits <= 9; digits++) {
    const shortest = Number(real.toPrecision(digits));
    if (Math.fround(shortest) === real) return String(shortest);
  }
  return String(real);
}

export function yesNo(isOn: boolean): string {
  return isOn ? 'Yes' : 'No';
}

/** A resource path, or `(none)` for an empty slot. */
export function resourceText(path: string | null): string {
  return path ?? '(none)';
}
