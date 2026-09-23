/**
 * One error for every registered resource slot whose id the file never declares: the generic pass behind
 * `dangling-resource-reference`. `resource_format_text.cpp:113` (`ERR_FAIL_COND_V(!int_resources.has(id), ERR_INVALID_PARAMETER);`)
 * and its ext twin at `:138` (`if (!ext_resources.has(id)) { … return ERR_PARSE_ERROR; }`) run while the value is
 * tokenised, before any setter, so the slot's class is irrelevant: the whole load fails.
 */

import { describe, expect, it } from 'vitest';
import { lint, node, scene, subResource } from './testing/testkit.js';
import { FILE_DIAGNOSTICS } from './fileDiagnostics.js';
import './index.js';

const RULE = FILE_DIAGNOSTICS.danglingResourceReference.ruleName;
const texture = '[ext_resource type="Texture2D" path="res://t.png" id="1_tex"]';

/** Every diagnostic the generic pass reported, and nothing another arm did. */
function dangling(content: string) {
  return lint(content).filter((d) => d.ruleName === RULE);
}

describe('dangling-resource-reference', () => {
  it('reports one error naming the key and the id for a SubResource nobody declares', () => {
    const diagnostics = lint(scene(node('CSGBox3D', { material: 'SubResource("nope")' })));
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({
      severity: 'error',
      ruleName: RULE,
      nodeName: 'CSGBox3D',
      nodeType: 'CSGBox3D',
    });
    expect(diagnostics[0]!.message).toContain("'material'");
    expect(diagnostics[0]!.message).toContain('SubResource("nope")');
  });

  it('reports the ExtResource twin the same way', () => {
    const diagnostics = lint(scene(node('CSGBox3D', { material: 'ExtResource("nope")' })));
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({ severity: 'error', ruleName: RULE });
    expect(diagnostics[0]!.message).toContain('ExtResource("nope")');
  });

  it('reports nothing for a declared id, in either table', () => {
    expect(
      lint(
        scene(
          texture,
          subResource('StandardMaterial3D', {}, 'mat_1'),
          node('CSGBox3D', { material: 'SubResource("mat_1")' }),
          node('Sprite2D', { texture: 'ExtResource("1_tex")' }, { parent: '.' })
        )
      )
    ).toEqual([]);
  });

  it('reports nothing for a cleared slot', () => {
    expect(lint(scene(node('CSGBox3D', { material: 'null' })))).toEqual([]);
  });

  it('keeps the two id spaces apart', () => {
    // `int_resources` and `ext_resources` are separate maps in the loader.
    expect(
      dangling(scene(texture, node('CSGBox3D', { material: 'SubResource("1_tex")' })))
    ).toHaveLength(1);
  });

  it('says nothing about a key that is not a registered resource slot', () => {
    // An unregistered key gets no validator; a registered non-resource slot
    // is phase 1's refusal alone, so neither is this arm's.
    expect(dangling(scene(node('CSGBox3D', { unknown_key: 'SubResource("nope")' })))).toEqual([]);
    const diagnostics = lint(scene(node('CSGBox3D', { size: 'SubResource("nope")' })));
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]!.ruleName).toBe('strict-parser');
  });

  it('leaves a malformed reference to phase 1', () => {
    // Only a well-formed reference names an id; the format error is the
    // strict parser's and must not be doubled.
    const diagnostics = lint(scene(node('CSGBox3D', { material: 'SubResource(nope)' })));
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]!.ruleName).toBe('strict-parser');
  });

  it('reads the old-style integer index as a reference, and reports it dangling once', () => {
    // `_parse_sub_resource` takes TK_NUMBER too (`resource_format_text.cpp:107`)
    // and looks the stringified int up in the same table (`:113`).
    const diagnostics = lint(
      scene(node('StaticBody2D'), node('CollisionShape2D', { shape: 'SubResource(3)' }, { parent: '.' }))
    );
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({ severity: 'error', ruleName: RULE });
    expect(diagnostics[0]!.message).toContain('SubResource(3)');
  });

  it('reaches a slot the type inherits from a base', () => {
    expect(
      dangling(scene(node('OmniLight3D', { light_projector: 'SubResource("nope")' })))
    ).toHaveLength(1);
  });

  it('reaches a slot behind a path wildcard, however the tail is spelled', () => {
    for (const key of ['surface_material_override/0', 'surface_material_override/0/extra']) {
      expect(dangling(scene(node('MeshInstance3D', { [key]: 'SubResource("nope")' })))).toHaveLength(1);
    }
  });

  it('reaches a leaf behind an indexed-family dispatcher, and only a resource leaf', () => {
    const item = (leaf: string) => node('ItemList', { item_count: 1, [`item_0/${leaf}`]: 'SubResource("nope")' });
    expect(lint(scene(item('icon')))).toMatchObject([{ ruleName: RULE }]);
    const diagnostics = lint(scene(item('text')));
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]!.ruleName).toBe('strict-parser');
  });

  it('reports a sub-resource body that names an id nothing declares, by its id', () => {
    const diagnostics = dangling(
      scene(
        subResource('StandardMaterial3D', { albedo_texture: 'SubResource("nope")' }, 'mat_1'),
        node('Node3D')
      )
    );
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({ nodeName: 'mat_1', nodeType: 'StandardMaterial3D' });
  });

  it('reads a sub-resource forward reference as dangling, and a backward one as declared', () => {
    // `int_resources[id] = res` lands at `:629`, as each `[sub_resource]`
    // heading is read, so a body sees only the ids above it and its own.
    const forward = scene(
      subResource('StandardMaterial3D', { albedo_texture: 'SubResource("tex_1")' }, 'mat_1'),
      subResource('GradientTexture2D', {}, 'tex_1'),
      node('Node3D')
    );
    const found = dangling(forward);
    expect(found).toHaveLength(1);
    expect(found[0]!.message).toContain('later');
    const backward = scene(
      subResource('GradientTexture2D', {}, 'tex_1'),
      subResource('StandardMaterial3D', { albedo_texture: 'SubResource("tex_1")' }, 'mat_1'),
      node('Node3D')
    );
    expect(dangling(backward)).toEqual([]);
  });

  it('reports every dangling slot on one node, once each', () => {
    const diagnostics = dangling(
      scene(
        node('MeshInstance3D', {
          mesh: 'SubResource("a")',
          material_override: 'SubResource("b")',
          skin: 'SubResource("c")',
        })
      )
    );
    expect(diagnostics.map((d) => d.message.match(/'(\w+)'/)?.[1]).sort()).toEqual([
      'material_override',
      'mesh',
      'skin',
    ]);
  });
});
