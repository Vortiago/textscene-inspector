import { describe, expect, it } from 'vitest';
import { LanguageDocument } from './document';
import { LINE, SCENE } from './fixtures.testkit';

describe('LanguageDocument', () => {
  it('files every heading under its tag and kind', () => {
    const document = new LanguageDocument(SCENE);
    expect(document.sections.map((section) => [section.tag, section.kind])).toEqual([
      ['gd_scene', 'other'],
      ['ext_resource', 'ext_resource'],
      ['ext_resource', 'ext_resource'],
      ['sub_resource', 'sub_resource'],
      ['node', 'node'],
      ['node', 'node'],
      ['connection', 'other'],
    ]);
  });

  it('reads a property as written and as the engine stores it', () => {
    const document = new LanguageDocument(SCENE);
    const section = document.sectionAt(LINE.meshNode);
    expect(section?.attributes.type).toBe('MeshInstance3D');
    expect(section?.properties.map((property) => property.key)).toEqual(['mesh', 'skeleton']);
    expect(section?.properties[0]?.value).toBe('SubResource("BoxMesh_1")');
  });

  it('maps a property line back to its slot and section', () => {
    const document = new LanguageDocument(SCENE);
    const location = document.propertyAt(LINE.meshProperty);
    expect(location?.section.attributes.name).toBe('Mesh');
    expect(location?.property.storedKey).toBe('mesh');
  });

  it('leaves a blank line between sections in no section', () => {
    const document = new LanguageDocument(SCENE);
    expect(document.sectionAt(2)).toBeUndefined();
    expect(document.propertyAt(2)).toBeUndefined();
  });

  it('spans a multiline value to its closing line', () => {
    const text = [
      '[node name="Root" type="Node2D"]',
      'polygon = PackedVector2Array(',
      '\t0, 0,',
      '\t10, 0,',
      '\t10, 10',
      ')',
      '',
    ].join('\n');
    const document = new LanguageDocument(text);
    const property = document.propertyAt(2)?.property;
    expect(property?.isMultiline).toBe(true);
    expect(property?.startLine).toBe(2);
    expect(property?.endLine).toBe(6);
  });

  it('ends a fold on the last line with content', () => {
    const document = new LanguageDocument(SCENE);
    // The two nodes are one blank line apart, and the file ends with a newline.
    expect(document.sectionAt(LINE.rootNode)?.endLine).toBe(LINE.rootProperty);
    expect(document.sectionAt(LINE.meshNode)?.endLine).toBe(LINE.skeletonProperty);
  });

  it('names the class each body belongs to', () => {
    const document = new LanguageDocument(SCENE);
    expect(document.sectionAt(LINE.meshNode)?.ownerType).toBe('MeshInstance3D');
    expect(document.sectionAt(LINE.subMesh)?.ownerType).toBe('BoxMesh');
  });

  it('carries the header class onto a .tres resource body', () => {
    const text = ['[gd_resource type="Environment" format=3]', '', '[resource]', 'background_mode = 1'].join(
      '\n'
    );
    const document = new LanguageDocument(text);
    expect(document.sectionAt(3)?.tag).toBe('resource');
    expect(document.sectionAt(3)?.ownerType).toBe('Environment');
  });
});
