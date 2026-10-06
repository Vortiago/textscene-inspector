import { describe, expect, it, vi } from 'vitest';
import { completionsAt } from './completion';
import { LanguageDocument } from './document';
import { LINE, SCENE } from './fixtures.testkit';

async function labelsAt(
  document: LanguageDocument,
  line: number,
  character: number,
  paths?: readonly string[]
): Promise<string[]> {
  const items = await completionsAt(
    document,
    { line: line - 1, character },
    paths ? { listPaths: async () => paths } : undefined
  );
  return items.map((item) => item.label);
}

describe('completionsAt', () => {
  it('offers every node class inside a node heading type=', async () => {
    const document = new LanguageDocument(SCENE);
    const text = document.lines[LINE.rootNode - 1]!;
    const items = await completionsAt(document, {
      line: LINE.rootNode - 1,
      character: text.indexOf('Node3D') + 1,
    });
    expect(items.every((item) => item.kind === 'nodeType')).toBe(true);
    expect(items.map((item) => item.label)).toContain('MeshInstance3D');
  });

  it('offers a resource class inside a sub_resource heading type=', async () => {
    const document = new LanguageDocument(SCENE);
    const items = await completionsAt(document, { line: LINE.subMesh - 1, character: 20 });
    expect(items.map((item) => item.label)).toContain('BoxMesh');
  });

  it('offers the class properties a node does not already set', async () => {
    const document = new LanguageDocument(SCENE);
    const labels = await labelsAt(document, LINE.meshProperty, 0);
    expect(labels).toContain('visible');
    expect(labels).not.toContain('mesh');
    expect(labels).not.toContain('skeleton');
  });

  it('offers an enum property the integers the engine stores', async () => {
    const document = new LanguageDocument(SCENE);
    const text = document.lines[LINE.rootProperty - 1]!;
    const items = await completionsAt(document, {
      line: LINE.rootProperty - 1,
      character: text.indexOf('=') + 2,
    });
    expect(items.map((item) => item.insertText)).toEqual(['0', '1', '2']);
  });

  it('offers the external resource ids for an ExtResource reference', async () => {
    const document = new LanguageDocument(
      [
        '[ext_resource type="PackedScene" path="res://door.tscn" id="1_door"]',
        '[node name="Extra" type="MeshInstance3D"]',
        'mesh = ExtResource("1_door")',
      ].join('\n')
    );
    // The cursor sits after the `1_` the writer typed, before the rest of the id.
    const items = await completionsAt(document, { line: 2, character: 'mesh = ExtResource("1_'.length });
    expect(items.map((item) => item.label)).toEqual(['1_door']);
    expect(items[0]?.detail).toBe('PackedScene');
  });

  it('offers res:// paths through the host listing', async () => {
    const document = new LanguageDocument(
      ['[node name="R" type="Node"]', 'scene_file_path = "res://do'].join('\n')
    );
    const labels = await labelsAt(document, 2, document.lines[1]!.length, [
      'res://door.tscn',
      'res://icon.svg',
    ]);
    expect(labels).toEqual(['res://door.tscn']);
  });

  it('offers node names for a parent= attribute', async () => {
    const document = new LanguageDocument(SCENE);
    const text = document.lines[LINE.meshNode - 1]!;
    const items = await completionsAt(document, {
      line: LINE.meshNode - 1,
      character: text.indexOf('.'),
    });
    expect(items.map((item) => item.label)).toContain('Root');
  });

  it('offers the class properties for a key typed before its =', async () => {
    const document = new LanguageDocument(
      ['[node name="Lamp" type="OmniLight3D"]', 'omni_range = 4.0', 'omni_'].join('\n')
    );
    const labels = await labelsAt(document, 3, 'omni_'.length);
    expect(labels).toContain('omni_attenuation');
    expect(labels).not.toContain('omni_range');
  });

  it('offers no key inside the continuation of a multi-line value', async () => {
    const document = new LanguageDocument(
      ['[node name="Lamp" type="OmniLight3D"]', 'editor_description = "first', 'second'].join('\n')
    );
    expect(await labelsAt(document, 3, 'second'.length)).toEqual([]);
  });

  it('offers no key for a typed word under a heading with no class', async () => {
    const document = new LanguageDocument(['[gd_scene format=3]', 'omni_'].join('\n'));
    expect(await labelsAt(document, 2, 'omni_'.length)).toEqual([]);
  });

  it('offers nothing on a blank line', async () => {
    const document = new LanguageDocument(SCENE);
    expect(await completionsAt(document, { line: 1, character: 0 })).toEqual([]);
  });

  it('asks the host for its listing only inside a res:// value', async () => {
    const document = new LanguageDocument(
      ['[node name="R" type="Node"]', 'visible = true', 'scene_file_path = "res://'].join('\n')
    );
    const listPaths = vi.fn(async () => ['res://door.tscn']);

    await completionsAt(document, { line: 1, character: document.lines[1]!.length }, { listPaths });
    expect(listPaths).not.toHaveBeenCalled();

    await completionsAt(document, { line: 2, character: document.lines[2]!.length }, { listPaths });
    expect(listPaths).toHaveBeenCalledTimes(1);
  });
});
