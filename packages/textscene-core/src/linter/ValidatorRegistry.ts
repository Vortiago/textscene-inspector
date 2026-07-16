/**
 * Registry for property validators used by strict TSCN parser
 */

import type { ParseError } from './types.js';
import { NODE_BASE_TYPES } from './nodeBaseTypes.js';

/**
 * Property validator function
 * @param key - Property key
 * @param value - Property value (raw string)
 * @param line - Line number in source file
 * @returns ParseError if validation fails, null if valid
 */
export type PropertyValidator = (
  key: string,
  value: string,
  line: number
) => ParseError | null;

/**
 * Registry for property validators by node type
 */
export class ValidatorRegistry {
  private validators = new Map<string, Record<string, PropertyValidator>>();

  /**
   * @param baseTypes - node-type → base-type map driving the inheritance walk in
   *   `findValidator` (see nodeBaseTypes.ts). Defaults to `{}` (no inheritance,
   *   pure exact/wildcard matching); the shared singleton wires NODE_BASE_TYPES.
   */
  constructor(private baseTypes: Readonly<Record<string, string>> = {}) {}

  /**
   * Register multiple validators for a node type
   * @param nodeType - TSCN node type (e.g., "MeshInstance3D")
   * @param validators - Map of property keys to validator functions
   */
  registerAll(nodeType: string, validators: Record<string, PropertyValidator>): void {
    if (!this.validators.has(nodeType)) {
      this.validators.set(nodeType, {});
    }
    Object.assign(this.validators.get(nodeType)!, validators);
  }

  /**
   * Find a validator for a property, walking the node's base-class chain.
   *
   * The owner type is consulted first (exact match, then `*` wildcards), then
   * each base type in turn (Node3D/Node2D/Control → Node), so a subclass that
   * registers no validator of its own still inherits its base's — the subclass
   * always wins on a key both define. Supports wildcard patterns at every level
   * (e.g. "surface_material_override/*", "theme_override_colors/*").
   *
   * @param nodeType - TSCN node type
   * @param propertyKey - Property key to validate
   * @returns Validator function or null if neither the type nor its bases match
   */
  findValidator(nodeType: string, propertyKey: string): PropertyValidator | null {
    const visited = new Set<string>();
    let type: string | undefined = nodeType;
    while (type && !visited.has(type)) {
      visited.add(type);
      const validator = this.findOwnValidator(type, propertyKey);
      if (validator) {
        return validator;
      }
      type = this.baseTypes[type];
    }
    return null;
  }

  /** Exact-then-wildcard lookup among a single type's own validators. */
  private findOwnValidator(nodeType: string, propertyKey: string): PropertyValidator | null {
    const nodeValidators = this.validators.get(nodeType);
    if (!nodeValidators) {
      return null;
    }

    // Try exact match first
    if (nodeValidators[propertyKey]) {
      return nodeValidators[propertyKey];
    }

    // Try pattern matching (e.g., "surface_material_override/*")
    for (const [pattern, validator] of Object.entries(nodeValidators)) {
      if (pattern.endsWith('/*')) {
        const prefix = pattern.slice(0, -2);
        if (propertyKey.startsWith(prefix + '/')) {
          return validator;
        }
      }
    }

    return null;
  }

  /**
   * Node types that currently have validators registered
   */
  getRegisteredNodeTypes(): string[] {
    return [...this.validators.keys()];
  }

  /**
   * Keys registered directly under `nodeType` (own registration only, no
   * base-walk). Used by the meta-guard test to detect shadow copies.
   */
  getOwnKeys(nodeType: string): string[] {
    const own = this.validators.get(nodeType);
    return own ? Object.keys(own) : [];
  }

  /**
   * Clear all registered validators (useful for testing)
   */
  clear(): void {
    this.validators.clear();
  }
}

/**
 * Singleton instance of ValidatorRegistry, wired with the real node base-type
 * table so every subclass inherits its base validators.
 */
export const validatorRegistry = new ValidatorRegistry(NODE_BASE_TYPES);
