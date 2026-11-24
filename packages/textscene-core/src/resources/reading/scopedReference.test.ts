import { describe, expect, it } from 'vitest';
import { referenceAddress } from './scopedReference';
import { referenceIn } from './scopedReference.testkit';

const SHADER_FILE = { type: 'Shader', path: 'res://skies/tint.gdshader', id: '1_sky' } as never;

describe('referenceAddress', () => {
  it("gives an ExtResource's path", () => {
    expect(referenceAddress(referenceIn('ExtResource("1_sky")', [SHADER_FILE], []))).toBe(
      'res://skies/tint.gdshader'
    );
  });

  it('gives a sub resource of another file as path::id', () => {
    const reference = { ...referenceIn('SubResource("code")', [], []), origin: 'res://holder.tres' };
    expect(referenceAddress(reference)).toBe('res://holder.tres::code');
  });

  it("gives a sub resource of the scene as its reference, as the scene's path is not known here", () => {
    expect(referenceAddress(referenceIn('SubResource("code")', [], []))).toBe('SubResource("code")');
  });
});
