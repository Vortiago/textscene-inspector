/**
 * Generic `typeName → value` registry (ADR-0002).
 *
 * The parse, 3D-render, and 2D-render domains each keep a SEPARATE registry —
 * that separation is what keeps the linter bundle React/THREE-free — but they
 * all share this one tested implementation instead of re-rolling the Map
 * boilerplate. Registration silently overwrites (HMR-friendly).
 */

export interface TypeRegistry<T> {
  register(typeName: string, value: T): void;
  get(typeName: string): T | undefined;
  has(typeName: string): boolean;
  getAllTypeNames(): string[];
  clear(): void;
}

export function createTypeRegistry<T>(): TypeRegistry<T> {
  const entries = new Map<string, T>();
  return {
    register: (typeName, value) => {
      entries.set(typeName, value);
    },
    get: (typeName) => entries.get(typeName),
    has: (typeName) => entries.has(typeName),
    getAllTypeNames: () => Array.from(entries.keys()),
    clear: () => entries.clear(),
  };
}
