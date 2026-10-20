import { describe, expect, it } from 'vitest';
import { createRawNode } from './rawNode.js';

const nodeOf = (attributes: Record<string, string>) => createRawNode({ type: 'node', attributes }, {});

describe('createRawNode', () => {
  it('takes the name, type and parent the heading states', () => {
    expect(nodeOf({ name: 'Box', type: 'Node3D', parent: '.' })).toMatchObject({
      name: 'Box',
      type: 'Node3D',
      parent: '.',
    });
  });

  it('types a placeholder heading as an InstancePlaceholder', () => {
    expect(nodeOf({ name: 'Door', instance_placeholder: 'res://door.tscn' }).type).toBe(
      'InstancePlaceholder'
    );
  });

  it('marks a heading with no type, instance or placeholder as an override', () => {
    expect(nodeOf({ name: 'Inner', parent: 'Door' }).overridesExistingNode).toBe(true);
  });

  it('leaves the parent unset for an empty parent=', () => {
    expect(nodeOf({ name: 'Box', type: 'Node3D', parent: '' }).parent).toBeUndefined();
  });
});
