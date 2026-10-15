import { describe, expect, it, vi } from 'vitest';
import { perRenderer } from './perRenderer';
import { testRenderer } from '../testing/recordingWebGL';

describe('perRenderer', () => {
  it('gives a renderer the same value on every ask', async () => {
    const { renderer } = await testRenderer();
    const valueFor = perRenderer(() => ({}));

    expect(valueFor(renderer)).toBe(valueFor(renderer));
  });

  it('gives each renderer a value of its own (edge case)', async () => {
    const { renderer: first } = await testRenderer();
    const { renderer: second } = await testRenderer();
    const valueFor = perRenderer(() => ({}));

    expect(valueFor(first)).not.toBe(valueFor(second));
  });

  it('makes the value again on the next ask when `create` throws (error case)', async () => {
    const { renderer } = await testRenderer();
    const create = vi.fn<() => object>().mockImplementationOnce(() => {
      throw new Error('lost context');
    });
    create.mockImplementation(() => ({}));
    const valueFor = perRenderer(create);

    expect(() => valueFor(renderer)).toThrow('lost context');
    expect(valueFor(renderer)).toEqual({});
  });
});
