import { describe, expect, it } from 'vitest';
import { subResource } from './subResource';

describe('subResource', () => {
  it('carries the type, the id and every given value', () => {
    expect(subResource('BoxMesh', 'Box_1', { size: 'Vector3(1, 1, 1)' })).toEqual({
      id: 'Box_1',
      type: 'BoxMesh',
      data: { size: 'Vector3(1, 1, 1)' },
    });
  });

  it('leaves out a key whose value is undefined', () => {
    const { data } = subResource('Environment', 'Env', { background_mode: '1', fog_enabled: undefined });
    expect(Object.keys(data)).toEqual(['background_mode']);
  });

  it('keeps an empty string, which is a value and not an omission', () => {
    expect(subResource('Curve', 'C', { _data: '' }).data).toEqual({ _data: '' });
  });

  it('holds no properties when given no data', () => {
    expect(subResource('Gradient', 'G').data).toEqual({});
  });
});
