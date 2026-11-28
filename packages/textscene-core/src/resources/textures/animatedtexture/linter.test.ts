import { describe, expect, it } from 'vitest';
import '../../../linter/index.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { lint, node, scene, subResource } from '../../../linter/testing/testkit.js';

function resource(properties: string): string {
  return `[gd_resource type="AnimatedTexture" format=3]\n\n[resource]\n${properties}\n`;
}

describe('AnimatedTexture setters', () => {
  it.each([
    ['frames', '0', 'animated_texture.cpp:90'],
    ['frames', '257', 'animated_texture.cpp:90'],
    ['frames', '300', 'animated_texture.cpp:90'],
    ['speed_scale', '-1000.00006103515625', 'animated_texture.cpp:166'],
    ['speed_scale', '999.99999', 'animated_texture.cpp:166'],
    ['speed_scale', '1000', 'animated_texture.cpp:166'],
    ['speed_scale', 'inf', 'animated_texture.cpp:166'],
    ['speed_scale', '-inf', 'animated_texture.cpp:166'],
    ['speed_scale', 'inf_neg', 'animated_texture.cpp:166'],
    ['speed_scale', '10.00e+', 'animated_texture.cpp:166'],
  ])('reports an error for %s = %s', (key, value, cite) => {
    const diagnostics = lint(resource(`${key} = ${value}`));
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toBeAtTier('error');
    expect(validatorRegistry.declarationFor('AnimatedTexture', key)?.grounding?.cite).toContain(cite);
  });

  it.each([
    ['frames', '1'],
    ['frames', '256'],
    ['speed_scale', '-1000'],
    ['speed_scale', '-1000.00001'],
    ['speed_scale', '999.99993896484375'],
    ['speed_scale', 'nan'],
    ['speed_scale', '2e4294967296'],
    ['speed_scale', '92233720368547758082'],
  ])('accepts %s = %s', (key, value) => {
    expect(lint(resource(`${key} = ${value}`))).toEqual([]);
  });

  it.each(['256', '4294967296', '99999999999999999999999', '00', '01', '+1', '-0', '-1', '', 'x'])(
    'reports an unknown-key error for frame_%s/duration',
    (index) => {
      const key = `frame_${index}/duration`;
      const diagnostics = lint(resource(`${key} = null`));
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]).toBeAtTier('error');
      expect(diagnostics[0]?.message).toContain(key);
    }
  );

  it('accepts the decimal midpoint that Godot rounds below the speed limit', () => {
    expect(lint(resource('speed_scale = 999.999969482421820'))).toEqual([]);
  });

  it('reports the cited index limit for an unsafe integer', () => {
    const [error] = lint(resource('frame_9007199254740992/duration = 2'));
    expect(error).toBeAtTier('error');
    expect(error?.message).toContain('animated_texture.h:43');
  });

  it('reports an unknown frame error for a multiline texture value', () => {
    const image = subResource('ImageTexture', {}, 'x');
    const file = `[gd_resource type="AnimatedTexture" format=3]\n${image}\n[resource]\nframe_256/texture = SubResource(\n "x"\n)`;
    const diagnostics = lint(file);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toBeAtTier('error');
    expect(diagnostics[0]?.message).toContain('frame_256/texture');
  });

  it('distinguishes an integer ID from a quoted ID with leading zeros', () => {
    const image = subResource('ImageTexture', {}, '1');
    const animation = subResource('AnimatedTexture', { 'frame_0/texture': 'SubResource(01)' }, '01');
    expect(lint(scene(image, animation, node('Sprite2D', { texture: 'SubResource("01")' })))).toEqual([]);
  });

  it.each(['01', '1.0', '-1', '""', String.raw`"\u0061"`])(
    'reports a multiline self-reference for ID %s',
    (id) => {
      const file = `[gd_resource type="Resource" format=3]\n[sub_resource type="AnimatedTexture" id=${id}]\nframe_0/texture = SubResource(\n ${id}\n)\n[resource]\n`;
      const diagnostics = lint(file);
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]).toBeAtTier('error');
      expect(diagnostics[0]?.message).toContain('own AnimatedTexture');
    }
  );

  it.each([
    ['true', '"true"'],
    ['@"a"', '"a"'],
    ['1e21', '"1000000000000000000000.0"'],
    [String.raw`"\é"`, '"é"'],
    ['"é"', String.raw`"\é"`],
    ['Vector2(1, 2)', '"(1.0, 2.0)"'],
    ['[9223372036854775807]', '"[9223372036854775807]"'],
  ])('reports an error for heading ID %s referred to as %s', (heading, ref) => {
    const file = `[gd_resource type="Resource" format=3]\n[sub_resource type="AnimatedTexture" id=${heading}]\nframe_0/texture = SubResource(${ref})\n[resource]\n`;
    const diagnostics = lint(file);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toBeAtTier('error');
    expect(diagnostics[0]?.message).toContain('own AnimatedTexture');
  });

  it('reports the original line for a refused frame write followed by null', () => {
    const file =
      '[gd_resource type="Resource" format=3]\n[sub_resource type="AnimatedTexture" id="a"]\nframe_0/texture = SubResource("a")\nframe_0/texture = null\n[resource]\n';
    const diagnostics = lint(file);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toBeAtTier('error');
    expect(diagnostics[0]?.location?.line).toBe(3);
  });

  it('reports an error for a self reference written with a Unicode escape', () => {
    const animation = subResource(
      'AnimatedTexture',
      { 'frame_0/texture': String.raw`SubResource("\u0061")` },
      'a'
    );
    const diagnostics = lint(scene(animation, node('Sprite2D', { texture: 'SubResource("a")' })));
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toBeAtTier('error');
    expect(diagnostics[0]?.message).toContain('own AnimatedTexture');
  });

  it('accepts a frame beyond the assigned count', () => {
    expect(lint(resource('frames = 1\nframe_255/duration = 17\nframe_255/texture = null'))).toEqual([]);
  });

  it('warns about a negative duration on the last frame', () => {
    const diagnostics = lint(resource('frame_255/duration = -3'));
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toBeAtTier('warning');
    expect(diagnostics[0]?.message).toContain('frame_255/duration');
  });

  it('uses the concrete capture for each bound leaf', () => {
    const type = 'AnimatedTexture';
    const last = 'frame_255/duration';
    expect(validatorRegistry.isDerived(type, last)).toBe(true);
    expect(validatorRegistry.derivedOwnKeys(type)).toContain(last);
    expect(validatorRegistry.declarationFor(type, last)?.grounding?.cite).toBe(
      `ClassDB 4.6.3: ${type}.${last}`
    );
  });

  it('accepts the main resource referring to another texture', () => {
    const image = subResource('ImageTexture', {}, '<unknown>');
    expect(
      lint(`[gd_resource type="AnimatedTexture" format=3]
${image}
[resource]
frame_0/texture = SubResource("<unknown>")`)
    ).toEqual([]);
  });

  it('reports one error for an unbound frame containing a self-reference', () => {
    const animation = subResource('AnimatedTexture', { 'frame_256/texture': 'SubResource("a")' }, 'a');
    const diagnostics = lint(scene(animation, node('Sprite2D', { texture: 'SubResource("a")' })));
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toBeAtTier('error');
    expect(diagnostics[0]?.message).toContain('Unknown');
  });

  it('reports an error for a frame that uses its own AnimatedTexture', () => {
    const animation = subResource('AnimatedTexture', { 'frame_255/texture': 'SubResource("a")' }, 'a');
    const diagnostics = lint(scene(animation, node('Sprite2D', { texture: 'SubResource("a")' })));
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toBeAtTier('error');
    expect(diagnostics[0]?.message).toContain('frame_255/texture');
  });
});
