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

  it('offers parent= the path from the root of each node declared above', async () => {
    const document = new LanguageDocument(
      [
        '[node name="Root" type="Node3D"]',
        '[node name="Body" type="Node3D" parent="."]',
        '[node name="Arm" type="Node3D" parent="Body"]',
        '[node name="Hand" type="Node3D" parent=""]',
        '[node name="Later" type="Node3D" parent="."]',
      ].join('\n')
    );
    const labels = await labelsAt(document, 4, '[node name="Hand" type="Node3D" parent="'.length);
    expect(labels).toEqual(['.', 'Body', 'Body/Arm']);
  });

  it('offers parent= only the root for the first child', async () => {
    const document = new LanguageDocument(
      ['[node name="Root" type="Node3D"]', '[node name="Body" type="Node3D" parent=""]'].join('\n')
    );
    expect(await labelsAt(document, 2, '[node name="Body" type="Node3D" parent="'.length)).toEqual(['.']);
  });

  it('offers res:// paths in an ext_resource heading path=', async () => {
    const heading = '[ext_resource type="Texture2D" path="res://art/" id="1"]';
    const document = new LanguageDocument(heading);
    const labels = await labelsAt(document, 1, heading.indexOf('art/') + 'art/'.length, [
      'res://art/a.png',
      'res://main.tscn',
    ]);
    expect(labels).toEqual(['res://art/a.png']);
  });

  it('offers the external resource ids in a node heading instance=', async () => {
    const heading = '[node name="Door" parent="." instance=ExtResource("")]';
    const document = new LanguageDocument(
      [
        '[ext_resource type="PackedScene" path="res://door.tscn" id="1_door"]',
        '[node name="Root" type="Node3D"]',
        heading,
      ].join('\n')
    );
    expect(await labelsAt(document, 3, heading.indexOf('("') + 2)).toEqual(['1_door']);
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

  it('offers nothing on a blank line between the properties of a node with a class', async () => {
    const document = new LanguageDocument(
      ['[node name="Lamp" type="OmniLight3D"]', 'omni_range = 4.0', '', 'light_energy = 2.0'].join('\n')
    );
    expect(await labelsAt(document, 3, 0)).toEqual([]);
  });

  it('offers no key on a comment line between the properties of a node', async () => {
    const document = new LanguageDocument(
      ['[node name="Lamp" type="OmniLight3D"]', 'omni_range = 4.0', '; omni', 'light_energy = 2.0'].join('\n')
    );
    expect(await labelsAt(document, 3, '; omni'.length)).toEqual([]);
  });

  it('offers no key for a typed word under an ext_resource heading', async () => {
    const document = new LanguageDocument(
      ['[ext_resource type="Texture2D" path="res://a.png" id="1"]', 'load'].join('\n')
    );
    expect(await labelsAt(document, 2, 'load'.length)).toEqual([]);
  });

  it('offers no key for a typed word under a gd_resource header', async () => {
    const document = new LanguageDocument(
      ['[gd_resource type="StandardMaterial3D" format=3]', 'albedo', '', '[resource]'].join('\n')
    );
    expect(await labelsAt(document, 2, 'albedo'.length)).toEqual([]);
  });

  it("offers the header class's keys for a word typed in a [resource] body", async () => {
    const document = new LanguageDocument(
      ['[gd_resource type="StandardMaterial3D" format=3]', '', '[resource]', 'albedo_'].join('\n')
    );
    expect(await labelsAt(document, 4, 'albedo_'.length)).toContain('albedo_color');
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

  describe('the typed text each item replaces', () => {
    function rangeAt(line: number, start: number, end: number) {
      return { start: { line, character: start }, end: { line, character: end } };
    }

    it('replaces the res:// text typed so far, which a word boundary would split at / and :', async () => {
      const line = 'metadata/path = "res://art/"';
      const document = new LanguageDocument(['[node name="R" type="Node"]', line].join('\n'));
      const cursor = line.indexOf('art/') + 'art/'.length;
      const [item] = await completionsAt(
        document,
        { line: 1, character: cursor },
        { listPaths: async () => ['res://art/a.png'] }
      );
      expect(item?.replaces).toEqual(rangeAt(1, line.indexOf('res://'), cursor));
    });

    it('replaces the parent path typed so far', async () => {
      const heading = '[node name="Hand" type="Node3D" parent="Body/A"]';
      const document = new LanguageDocument(
        ['[node name="Root" type="Node3D"]', '[node name="Body" type="Node3D" parent="."]', heading].join(
          '\n'
        )
      );
      const cursor = heading.indexOf('Body/A') + 'Body/A'.length;
      const items = await completionsAt(document, { line: 2, character: cursor });
      expect(items.map((item) => item.replaces)).toEqual(
        items.map(() => rangeAt(2, heading.indexOf('Body/A'), cursor))
      );
    });

    it('replaces the resource id typed so far', async () => {
      const line = 'mesh = SubResource("Bo")';
      const document = new LanguageDocument(
        ['[sub_resource type="BoxMesh" id="Box_1"]', '[node name="R" type="MeshInstance3D"]', line].join('\n')
      );
      const cursor = line.indexOf('Bo') + 2;
      const [item] = await completionsAt(document, { line: 2, character: cursor });
      expect(item?.replaces).toEqual(rangeAt(2, line.indexOf('Bo'), cursor));
    });

    it('replaces the key typed so far, a slash in it included', async () => {
      const line = 'surface_material_override/';
      const document = new LanguageDocument(
        ['[node name="R" type="MeshInstance3D"]', 'mesh = null', line].join('\n')
      );
      const [item] = await completionsAt(document, { line: 2, character: line.length });
      expect(item?.replaces).toEqual(rangeAt(2, 0, line.length));
    });

    it('replaces the start of a key on a line that already has its =', async () => {
      const document = new LanguageDocument(
        ['[node name="R" type="MeshInstance3D"]', 'mesh = null'].join('\n')
      );
      const [item] = await completionsAt(document, { line: 1, character: 2 });
      expect(item?.replaces).toEqual(rangeAt(1, 0, 2));
    });

    it('keeps the indent before a key being typed', async () => {
      const line = '  surface_';
      const document = new LanguageDocument(
        ['[node name="R" type="MeshInstance3D"]', 'mesh = null', line].join('\n')
      );
      const [item] = await completionsAt(document, { line: 2, character: line.length });
      expect(item?.replaces).toEqual(rangeAt(2, 2, line.length));
    });

    it('leaves an enum value without a range, since its insert text is not its label', async () => {
      const document = new LanguageDocument(SCENE);
      const text = document.lines[LINE.rootProperty - 1]!;
      const items = await completionsAt(document, {
        line: LINE.rootProperty - 1,
        character: text.indexOf('=') + 2,
      });
      expect(items.length).toBeGreaterThan(0);
      expect(items.every((item) => item.replaces === undefined)).toBe(true);
    });
  });
});
