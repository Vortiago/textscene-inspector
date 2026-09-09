/**
 * `resolveResourceSlot` and the `checkResourceExists` derived from it, where the
 * input is not a clean hit: text that is not a reference at all, and an id that
 * exists in one table but not the other.
 *
 * The happy paths are the sibling `resourceChecker.test.ts`.
 */

import { describe, it, expect } from 'vitest';
import { checkResourceExists, resolveResourceSlot } from './resourceChecker.js';
import type { TscnScene, TscnExternalResource } from '../parser/types.js';

/** An empty scene: every reference against it dangles or is no reference at all. */
const emptyScene: TscnScene = { nodes: [], externalResources: [], internalResources: [] };

describe('resolveResourceSlot', () => {
  it('reads every spelling of nothing as one empty slot', () => {
    for (const spelling of [undefined, '', '   ', 'null', 'nil']) {
      expect(resolveResourceSlot(emptyScene, spelling)).toEqual({ kind: 'empty' });
    }
  });

  it('separates a value that is no reference from one that names nothing', () => {
    // `variant_parser.cpp:1089` takes only the `Resource` / `SubResource` /
    // `ExtResource` identifiers into the resource arm, so none of these asks
    // for a resource. Collapsing them into the dangling arm is what reported a
    // missing resource that nobody had named.
    for (const value of ['mesh_1', 'SubResource(mesh_1)', 'InvalidResource("mesh_1")', 'SubResource("")']) {
      expect(resolveResourceSlot(emptyScene, value)).toEqual({ kind: 'not-a-reference' });
    }
    // Well-formed, and the id is declared nowhere: `resource_format_text.cpp:113`
    // fails the load on the sub-resource half, `:138` on the ext-resource one.
    expect(resolveResourceSlot(emptyScene, 'SubResource("mesh_1")')).toEqual({ kind: 'dangling' });
    expect(resolveResourceSlot(emptyScene, 'ExtResource("mesh_1")')).toEqual({ kind: 'dangling' });
  });

  it('carries the declared type of a reference that resolves', () => {
    const scene: TscnScene = {
      nodes: [],
      externalResources: [
        { id: 'tex_1', type: 'Texture2D', path: 'res://texture.png' },
      ] as TscnExternalResource[],
      internalResources: [{ id: '1', type: 'ConcavePolygonShape3D', data: { id: 'shape_1' } }],
    };

    expect(resolveResourceSlot(scene, 'SubResource("shape_1")')).toEqual({
      kind: 'resolved',
      type: 'ConcavePolygonShape3D',
    });
    expect(resolveResourceSlot(scene, 'ExtResource("tex_1")')).toEqual({
      kind: 'resolved',
      type: 'Texture2D',
    });
  });

  it('is the one scan `checkResourceExists` answers from', () => {
    // The boolean is derived, so the two cannot drift into disagreeing about
    // which state owes a "resource not found".
    for (const value of ['', 'null', 'mesh_1', 'SubResource(mesh_1)', 'SubResource("mesh_1")']) {
      const dangling = resolveResourceSlot(emptyScene, value).kind === 'dangling';
      expect(checkResourceExists(emptyScene, value)).toBe(!dangling);
    }
  });
});

describe('checkResourceExists', () => {
  // A value that is not a reference at all is TRUE: only a well-formed
  // reference can dangle, and its format is the strict parser's diagnostic.
  // Answering false put a second, factually wrong "resource not found" beside
  // it, naming a resource nothing had asked for.
  describe('values that are not references at all', () => {
    it('is not dangling when the id is unquoted', () => {
      const scene: TscnScene = {
        nodes: [],
        externalResources: [],
        internalResources: [],
      };

      expect(checkResourceExists(scene, 'SubResource(mesh_1)')).toBe(true);
    });

    it('is not dangling when the parentheses are missing', () => {
      const scene: TscnScene = {
        nodes: [],
        externalResources: [],
        internalResources: [],
      };

      expect(checkResourceExists(scene, 'SubResource"mesh_1"')).toBe(true);
    });

    it('is not dangling when the constructor name is not a reference kind', () => {
      const scene: TscnScene = {
        nodes: [],
        externalResources: [],
        internalResources: [],
      };

      expect(checkResourceExists(scene, 'InvalidResource("mesh_1")')).toBe(true);
    });

    it('is not dangling for a plain string', () => {
      const scene: TscnScene = {
        nodes: [],
        externalResources: [],
        internalResources: [],
      };

      expect(checkResourceExists(scene, 'mesh_1')).toBe(true);
    });

    it('is not dangling for an empty string', () => {
      const scene: TscnScene = {
        nodes: [],
        externalResources: [],
        internalResources: [],
      };

      expect(checkResourceExists(scene, '')).toBe(true);
    });

    it('should return true for a cleared slot, which names nothing on purpose', () => {
      // `variant_parser.cpp:699` reads a bare `null` as `Variant()` and every
      // `Ref<T>` setter takes it, so nothing is missing. Shared by every rule
      // that asks this question, so the arm is pinned here once.
      const scene: TscnScene = {
        nodes: [],
        externalResources: [],
        internalResources: [],
      };

      expect(checkResourceExists(scene, 'null')).toBe(true);
    });

    it('is not dangling for a malformed reference', () => {
      const scene: TscnScene = {
        nodes: [],
        externalResources: [],
        internalResources: [],
      };

      expect(checkResourceExists(scene, 'SubResource(')).toBe(true);
      expect(checkResourceExists(scene, 'SubResource()')).toBe(true);
      // An empty id is not a well-formed reference either — `resourceRef`'s id
      // class needs at least one character.
      expect(checkResourceExists(scene, 'SubResource("")')).toBe(true);
    });
  });

  describe('mixed SubResource and ExtResource', () => {
    it('should differentiate between SubResource and ExtResource with same ID', () => {
      const scene: TscnScene = {
        nodes: [],
        externalResources: [
          {
            id: 'resource_1',
            type: 'Texture2D',
            path: 'res://texture.png',
          },
        ] as TscnExternalResource[],
        internalResources: [
          {
            id: '1',
            type: 'ArrayMesh',
            data: { id: 'resource_1' },
          },
        ],
      };

      expect(checkResourceExists(scene, 'SubResource("resource_1")')).toBe(true);
      expect(checkResourceExists(scene, 'ExtResource("resource_1")')).toBe(true);
    });

    it('should not find SubResource when only ExtResource exists', () => {
      const scene: TscnScene = {
        nodes: [],
        externalResources: [
          {
            id: 'resource_1',
            type: 'Texture2D',
            path: 'res://texture.png',
          },
        ] as TscnExternalResource[],
        internalResources: [],
      };

      expect(checkResourceExists(scene, 'SubResource("resource_1")')).toBe(false);
      expect(checkResourceExists(scene, 'ExtResource("resource_1")')).toBe(true);
    });

    it('should not find ExtResource when only SubResource exists', () => {
      const scene: TscnScene = {
        nodes: [],
        externalResources: [],
        internalResources: [
          {
            id: '1',
            type: 'ArrayMesh',
            data: { id: 'resource_1' },
          },
        ],
      };

      expect(checkResourceExists(scene, 'ExtResource("resource_1")')).toBe(false);
      expect(checkResourceExists(scene, 'SubResource("resource_1")')).toBe(true);
    });
  });
});
