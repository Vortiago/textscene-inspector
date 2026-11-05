/** A cache bounded to the keys read most recently. */

/**
 * A reader that builds the value of a key on its first read and keeps the values of the `max` keys
 * read most recently. A read moves its key to the newest place, so the key dropped at the cap is
 * the one read least recently. An animation through many keys then cannot drop a key still in use.
 *
 * @canonical A cache bounded to its most recently read keys
 *   For a key that an animation can step through without end, such as a font size or axis value.
 */
export function recentlyRead<K, V>(max: number): (key: K, build: (key: K) => V) => V {
  const kept = new Map<K, V>();
  return (key, build) => {
    const isKept = kept.has(key);
    const value = isKept ? kept.get(key)! : build(key);
    if (isKept) kept.delete(key);
    else if (kept.size >= max) kept.delete(kept.keys().next().value!);
    kept.set(key, value);
    return value;
  };
}
