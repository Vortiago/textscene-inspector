/**
 * The `location` a heading or a property gives, read from the line table `StrictTscnParser`
 * returns, and `undefined`, never a guessed line, for an owner or a key the table lacks.
 */

import { describe, expect, it } from 'vitest';
import { StrictTscnParser } from './StrictTscnParser.js';
import { headingLocation, propertyLocation } from './sourceLocation.js';
import type { TscnInternalResource, TscnNode } from '../parser/types.js';

const SCENE = `[gd_scene format=3]

[sub_resource type="BoxMesh" id="Box_1"]
size = Vector3(1, 2, 3)

[node name="Root" type="Node3D"]
visible = false
`;

function parse() {
  const { scene, lines } = new StrictTscnParser().parse(SCENE);
  return { lines, root: scene!.nodes[0]!, box: scene!.internalResources[0]! };
}

/** A node no scan built, so no table holds it. */
const STRAY: TscnNode = { name: 'Stray', type: 'Node3D', children: [], properties: {} };
const STRAY_RESOURCE: TscnInternalResource = { id: 'Stray_1', type: 'BoxMesh', data: {} };

describe('headingLocation', () => {
  it("gives a node's heading line, at column 1", () => {
    const { lines, root } = parse();
    expect(headingLocation(lines, root)).toEqual({ line: 6, column: 1 });
  });

  it("gives a sub-resource's heading line", () => {
    const { lines, box } = parse();
    expect(headingLocation(lines, box)).toEqual({ line: 3, column: 1 });
  });

  it('gives undefined for an owner the table does not hold', () => {
    const { lines } = parse();
    expect(headingLocation(lines, STRAY)).toBeUndefined();
    expect(headingLocation(lines, STRAY_RESOURCE)).toBeUndefined();
  });
});

describe('propertyLocation', () => {
  it("gives the line a node's property sits on, at column 1", () => {
    const { lines, root } = parse();
    expect(propertyLocation(lines, root, 'visible')).toEqual({ line: 7, column: 1 });
  });

  it("gives the line a sub-resource's property sits on", () => {
    const { lines, box } = parse();
    expect(propertyLocation(lines, box, 'size')).toEqual({ line: 4, column: 1 });
  });

  it('gives undefined for a key the owner does not write', () => {
    const { lines, root } = parse();
    expect(propertyLocation(lines, root, 'position')).toBeUndefined();
  });

  it('gives undefined for an owner the table does not hold', () => {
    const { lines } = parse();
    expect(propertyLocation(lines, STRAY, 'visible')).toBeUndefined();
  });
});
