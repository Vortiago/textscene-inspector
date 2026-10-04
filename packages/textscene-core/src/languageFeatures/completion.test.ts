import { describe, expect, it } from 'vitest';
import { completionsAt } from './completion';
import { LanguageDocument } from './document';
import { LINE, SCENE } from './fixtures.testkit';

function labelsAt(
  document: LanguageDocument,
  line: number,
  character: number,
  paths?: readonly string[]
): string[] {
  const items = completionsAt(
    document,
    { line: line - 1, character },
    paths ? { listPaths: () => paths } : undefined
  );
  return items.map((item) => item.label);
}

describe('completionsAt', () => {
  it('offers every node class inside a node heading type=', () => {
    const document = new LanguageDocument(SCENE);
    const text = document.lines[LINE.rootNode - 1]!;
    const items = completionsAt(document, { line: LINE.rootNode - 1, character: text.indexOf('Node3D') + 1 });
    expect(items.every((item) => item.kind === 'nodeType')).toBe(true);
    expect(items.map((item) => item.label)).toContain('MeshInstance3D');
  });

  it('offers a resource class inside a sub_resource heading type=', () => {
    const document = new LanguageDocument(SCENE);
    const items = completionsAt(document, { line: LINE.subMesh - 1, character: 20 });
    expect(items.map((item) => item.label)).toContain('BoxMesh');
  });

  it('offers the class properties a node does not already set', () => {
    const document = new LanguageDocument(SCENE);
    const labels = labelsAt(document, LINE.meshProperty, 0);
    expect(labels).toContain('visible');
    expect(labels).not.toContain('mesh');
    expect(labels).not.toContain('skeleton');
  });

  it('offers an enum property the integers the engine stores', () => {
    const document = new LanguageDocument(SCENE);
    const text = document.lines[LINE.rootProperty - 1]!;
    const items = completionsAt(document, { line: LINE.rootProperty - 1, character: text.indexOf('=') + 2 });
    expect(items.map((item) => item.insertText)).toEqual(['0', '1', '2']);
  });

  it('offers the external resource ids for an ExtResource reference', () => {
    const doc = new LanguageDocument(
      [
        '[ext_resource type="PackedScene" path="res://door.tscn" id="1_door"]',
        '[node name="Extra" type="MeshInstance3D"]',
        'mesh = ExtResource("1_door")',
      ].join('\n')
    );
    // The cursor sits after the `1_` the writer typed, before the rest of the id.
    const items = completionsAt(doc, { line: 2, character: 'mesh = ExtResource("1_'.length });
    expect(items.map((item) => item.label)).toEqual(['1_door']);
    expect(items[0]?.detail).toBe('PackedScene');
  });

  it('offers res:// paths through the host listing', () => {
    const document = new LanguageDocument(
      ['[node name="R" type="Node"]', 'scene_file_path = "res://do'].join('\n')
    );
    const labels = labelsAt(document, 2, document.lines[1]!.length, ['res://door.tscn', 'res://icon.svg']);
    expect(labels).toEqual(['res://door.tscn']);
  });

  it('offers node names for a parent= attribute', () => {
    const document = new LanguageDocument(SCENE);
    const text = document.lines[LINE.meshNode - 1]!;
    const items = completionsAt(document, { line: LINE.meshNode - 1, character: text.indexOf('.') + 0 });
    expect(items.map((item) => item.label)).toContain('Root');
  });

  it('offers nothing on a blank line', () => {
    const document = new LanguageDocument(SCENE);
    expect(completionsAt(document, { line: 1, character: 0 })).toEqual([]);
  });
});
