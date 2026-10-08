import { describe, expect, it } from 'vitest';
import { sectionOwnerOf } from './sectionOwner.js';
import { parseHeading } from '../../parser/utils.js';

const heading = (line: string) => parseHeading(line)!;

describe('sectionOwnerOf', () => {
  it('names a node section by its name and type', () => {
    expect(sectionOwnerOf(heading('[node name="Body" type="Node3D"]'), 'node')).toEqual({
      nodeName: 'Body',
      nodeType: 'Node3D',
    });
  });

  it('names a sub-resource by its id, which tells it from its siblings', () => {
    expect(sectionOwnerOf(heading('[sub_resource type="CircleShape2D" id="c1"]'), 'sub_resource')).toEqual({
      nodeName: 'c1',
      nodeType: 'CircleShape2D',
    });
  });

  it('marks a missing attribute as unknown', () => {
    expect(sectionOwnerOf(heading('[node parent="."]'), 'node')).toEqual({
      nodeName: '<unknown>',
      nodeType: '<unknown>',
    });
  });

  it('gives no owner to a section that holds no validated properties', () => {
    expect(sectionOwnerOf(heading('[resource]'), 'resource')).toBeNull();
    expect(sectionOwnerOf(heading('[ext_resource type="Texture2D" id="1"]'), 'ext_resource')).toBeNull();
  });
});
