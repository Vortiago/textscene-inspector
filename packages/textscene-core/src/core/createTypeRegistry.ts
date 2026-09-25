/**
 * Generic `typeName → value` registry (ADR-0002). The parse, 3D-render and 2D-render domains
 * each keep a separate one, which keeps the linter bundle free of React and THREE. A duplicate
 * `typeName` overwrites, for HMR, and warns, whether it is a slice collision or a re-import.
 */
import { warn } from '../logger.js';

export interface TypeRegistry<T> {
  register(typeName: string, value: T): void;
  /** Remove one registration (test teardown for probe types); true if it existed. */
  unregister(typeName: string): boolean;
  get(typeName: string): T | undefined;
  has(typeName: string): boolean;
  getAllTypeNames(): string[];
  clear(): void;
}

/**
 * @param label - Optional registry name in the duplicate-registration warning, such as
 *   "NodeComponentRegistry", so the log line names the registry as well as the typeName.
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
    unregister: (typeName) => entries.delete(typeName),
    get: (typeName) => entries.get(typeName),
    has: (typeName) => entries.has(typeName),
    getAllTypeNames: () => Array.from(entries.keys()),
    clear: () => entries.clear(),
  };
}
