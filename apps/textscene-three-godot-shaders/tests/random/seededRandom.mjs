/**
 * A random source fixed by a seed: Mulberry32, a 32-bit generator with a period of 2^32 and no
 * state but one integer, so one seed gives the same programs on every platform.
 */
export function seededRandom(seed) {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
  };
  return {
    /** A float in [0, 1). */
    next,
    /** An integer in [0, count). */
    below: (count) => Math.floor(next() * count),
    /** One item of `items`. */
    pick: (items) => items[Math.floor(next() * items.length)],
    /** True with the chance `chance`. */
    chance: (chance) => next() < chance,
  };
}
