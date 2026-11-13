/**
 * A declaration an object makes on its own `userData` under one key, for a reader elsewhere in the
 * scene. One key, so an object carries one declaration of each kind.
 */

import type * as THREE from 'three';

export interface UserDataDeclaration<Declaration> {
  /**
   * The `userData` entry that declares `declaration`. R3F assigns a `userData` prop whole, so an
   * object that declares more merges every entry into the one prop.
   */
  userData(declaration: Declaration): Record<string, unknown>;
  /** The object's declaration, or null for an object that made none or made a malformed one. */
  read(object: THREE.Object3D): Declaration | null;
}

/** `hasShape` checks the fields of a candidate that is already a non-null object. */
export function userDataDeclaration<Declaration>(
  key: string,
  hasShape: (candidate: Record<string, unknown>) => boolean
): UserDataDeclaration<Declaration> {
  return {
    userData: (declaration) => ({ [key]: declaration }),
    read: (object) => {
      const value = (object.userData as Record<string, unknown>)[key];
      if (typeof value !== 'object' || value === null) return null;
      return hasShape(value as Record<string, unknown>) ? (value as Declaration) : null;
    },
  };
}
