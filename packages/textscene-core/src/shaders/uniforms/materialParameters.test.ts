import { describe, expect, it, vi } from 'vitest';
import { NIL, real } from '../../godot/variant/value/variant.js';
import { parameterVariants, setParameterValues } from './materialParameters.js';

const uniformsNamed = (...names: string[]) => new Map(names.map((name) => [name, { set: vi.fn() }]));

describe('setParameterValues', () => {
  it('writes each value to the uniform of its name', () => {
    const uniforms = uniformsNamed('roughness');

    setParameterValues(uniforms, { roughness: real(0.25) });

    expect(uniforms.get('roughness')!.set).toHaveBeenCalledWith(real(0.25));
  });

  it('ignores a value no uniform declares, as Godot does', () => {
    const uniforms = uniformsNamed('roughness');

    expect(() => setParameterValues(uniforms, { metallic: real(1) })).not.toThrow();
    expect(uniforms.get('roughness')!.set).not.toHaveBeenCalled();
  });
});

describe('parameterVariants', () => {
  it('reads each value from its Variant text', () => {
    expect(parameterVariants({ tint: '0.5' })).toEqual({ tint: real(0.5) });
  });

  it('reads an unreadable text as NIL, which erases the value', () => {
    expect(parameterVariants({ tint: '' })).toEqual({ tint: NIL });
  });

  it('gives nothing for a material that sets no parameter', () => {
    expect(parameterVariants({})).toEqual({});
  });
});
