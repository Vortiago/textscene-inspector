/**
 * Registry for property validators used by strict TSCN parser
 */

import type { ParseError } from './types.js';

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
   * Find a validator for a specific property
   * Supports pattern matching with wildcards (e.g., "surface_material_override/*")
   * @param nodeType - TSCN node type
   * @param propertyKey - Property key to validate
   * @returns Validator function or null if not found
   */
  findValidator(nodeType: string, propertyKey: string): PropertyValidator | null {
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
   * Clear all registered validators (useful for testing)
   */
  clear(): void {
    this.validators.clear();
  }
}

/**
 * Singleton instance of ValidatorRegistry
 */
export const validatorRegistry = new ValidatorRegistry();
