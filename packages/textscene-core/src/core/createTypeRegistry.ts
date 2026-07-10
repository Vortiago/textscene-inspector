/**
 * Generic `typeName → value` registry (ADR-0002).
 *
 * The parse, 3D-render, and 2D-render domains each keep a SEPARATE registry —
 * that separation is what keeps the linter bundle React/THREE-free — but they
 * all share this one tested implementation instead of re-rolling the Map
 * boilerplate. Registration silently overwrites (HMR-friendly) but warns
 * (#217) — the same overwrite-with-a-warn contract `NodeRegistry`'s own
 * bespoke Map already carries, so all three ADR-0002 registries (parser,
 * 3D-render, 2D-render) behave identically on a duplicate `typeName`,
 * whether that's a genuine slice-registration collision or an expected HMR
 * re-import.
 */
import { warn } from '../logger.js';

export interface TypeRegistry<T> {
  register(typeName: string, value: T): void;
  get(typeName: string): T | undefined;
  has(typeName: string): boolean;
  getAllTypeNames(): string[];
  clear(): void;
}

/**
 * @param label - Optional registry name surfaced in the duplicate-registration
 *   warning (e.g. "NodeComponentRegistry") so the log line says which
 *   registry collided, not just which typeName.
 */
export function createTypeRegistry<T>(label?: string): TypeRegistry<T> {
  const entries = new Map<string, T>();
  const prefix = label ? `${label}: ` : '';
  return {
    register: (typeName, value) => {
      if (entries.has(typeName)) {
        warn(`${prefix}Type "${typeName}" is already registered. Overwriting.`);
      }
      entries.set(typeName, value);
    },
    get: (typeName) => entries.get(typeName),
    has: (typeName) => entries.has(typeName),
    getAllTypeNames: () => Array.from(entries.keys()),
    clear: () => entries.clear(),
  };
}
