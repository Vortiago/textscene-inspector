/** A read that the canvas fills once R3F mounts its children, after it measures the stage. */
export interface LateReader<K, T> {
  fill(read: (key: K) => T): void;
  /** Waits for the first fill, so an ask made while the canvas mounts lands on its answer. */
  read(key: K): Promise<T>;
}

export function createLateReader<K, T>(): LateReader<K, T> {
  let filled: ((key: K) => T) | null = null;
  let onFill: (() => void)[] = [];
  return {
    fill(read) {
      filled = read;
      const woken = onFill;
      onFill = [];
      woken.forEach((wake) => wake());
    },
    async read(key) {
      if (!filled) await new Promise<void>((resolve) => onFill.push(resolve));
      return filled!(key);
    },
  };
}
