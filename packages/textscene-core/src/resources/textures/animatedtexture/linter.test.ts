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
