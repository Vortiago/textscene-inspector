/**
 * NodeRegistry resolves a heading to its registration by its `type` attribute, scoped to
 * `[node]` headings, so a `[sub_resource]` whose `type=` matches a node name never resolves.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { nodeRegistry, parseNodeWithRegistry } from './NodeRegistry';
import { parseNode } from '../nodes/node/parser';
import type { ParsedHeading } from '../parser/utils';

function nodeHeading(type: string): ParsedHeading {
  return { type: 'node', attributes: { type, name: 'X' } };
}

describe('NodeRegistry.findRegistration', () => {
  beforeEach(() => nodeRegistry.clear());

  it('resolves a registration by its typeName', () => {
    nodeRegistry.register({
      typeName: 'Widget3D',
      parser: (_h, props) => ({ name: props.name ?? 'X' }),
    });

    const reg = nodeRegistry.findRegistration(nodeHeading('Widget3D'));

    expect(reg?.typeName).toBe('Widget3D');
  });

  it('returns null for a node type that is not registered', () => {
    nodeRegistry.register({ typeName: 'Widget3D', parser: () => ({}) });

    expect(nodeRegistry.findRegistration(nodeHeading('Unknown'))).toBeNull();
  });

  it('does NOT match a [sub_resource] heading whose type collides with a node typeName', () => {
    nodeRegistry.register({ typeName: 'BoxMesh', parser: () => ({}) });

    const subResource: ParsedHeading = {
      type: 'sub_resource',
      attributes: { type: 'BoxMesh', id: '1' },
    };

    expect(nodeRegistry.findRegistration(subResource)).toBeNull();
  });

  it('returns null for a node heading with no type attribute', () => {
    nodeRegistry.register({ typeName: 'Widget3D', parser: () => ({}) });

    expect(nodeRegistry.findRegistration({ type: 'node', attributes: {} })).toBeNull();
  });
});

describe('parseNodeWithRegistry — raw override retention', () => {
  beforeEach(() => {
    nodeRegistry.clear();
    nodeRegistry.register({ typeName: 'Node', parser: parseNode });
  });

  it('retains the raw override props on a type-less instance node', () => {
    // An instance node has `instance=` but no `type=`, so the base Node parser reads only
    // name, parent, transform and index. The type-specific override keys stay raw, so
    // mergeInstanceRoot can re-parse them against the instanced root's type.
    const heading: ParsedHeading = {
      type: 'node',
      attributes: { name: 'GridMap', parent: '.', instance: 'ExtResource("1_t0f53")' },
    };
    const raw = {
      data: '{ "cells": PackedInt32Array(1, 2, 3) }',
      transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)',
    };

    const result = parseNodeWithRegistry(heading, raw);

    expect(result).not.toBeNull();
    expect(result!.instance).toBe('ExtResource("1_t0f53")');
    expect(result!.rawProperties).toEqual(raw);
  });

  it('builds an InstancePlaceholder node from an instance_placeholder heading', () => {
    // packed_scene.cpp:255 instantiates an InstancePlaceholder for the flag
    // resource_format_text.cpp:254 sets; it is a node of its own, not an
    // override of one already there.
    const heading: ParsedHeading = {
      type: 'node',
      attributes: { name: 'Rock', parent: '.', instance_placeholder: 'res://rock.tscn' },
    };

    const result = parseNodeWithRegistry(heading, { position: 'Vector2(5, 5)' });

    expect(result!.type).toBe('InstancePlaceholder');
    expect(result!.overridesExistingNode).toBeUndefined();
  });
});

describe('parseNodeWithRegistry — rawPropertiesOrderReliable (ADR-0035)', () => {
  beforeEach(() => {
    nodeRegistry.clear();
    nodeRegistry.register({ typeName: 'Node', parser: parseNode });
    nodeRegistry.register({ typeName: 'Widget3D', parser: (_h, props) => ({ name: props.name ?? 'X' }) });
  });

  it('sets rawPropertiesOrderReliable true on a registered-type node — one TscnParserCore scan built its properties', () => {
    const heading: ParsedHeading = { type: 'node', attributes: { type: 'Widget3D', name: 'X' } };
    const result = parseNodeWithRegistry(heading, { foo: '1', bar: '2' });

    expect(result!.rawPropertiesOrderReliable).toBe(true);
  });

  it('sets rawPropertiesOrderReliable true on the Node fallback path too (unregistered type)', () => {
    const heading: ParsedHeading = { type: 'node', attributes: { type: 'TotallyUnknownType', name: 'X' } };
    const result = parseNodeWithRegistry(heading, { foo: '1' });

    expect(result!.rawPropertiesOrderReliable).toBe(true);
  });

  it('preserves Object.keys(rawProperties) as the real file order', () => {
    const heading: ParsedHeading = { type: 'node', attributes: { type: 'Widget3D', name: 'X' } };
    const raw = { zebra: '1', apple: '2', mango: '3' };
    const result = parseNodeWithRegistry(heading, raw);

    expect(Object.keys(result!.rawProperties!)).toEqual(['zebra', 'apple', 'mango']);
  });
});
