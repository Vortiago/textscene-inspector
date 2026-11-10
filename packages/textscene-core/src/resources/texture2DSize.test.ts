import { describe, expect, it } from 'vitest';
import type { ParsedResource } from '../parser/parsedResource';
import { extResourceTexture2DSize } from './texture2DSize';

function theoraStream(properties: Record<string, string>): ParsedResource {
  return { resourceType: 'VideoStreamTheora', properties, extResources: [], subResources: [] };
}

describe('extResourceTexture2DSize', () => {
  it('reports a Theora stream at its picture size', () => {
    const stream = theoraStream({ picture_width: '70', picture_height: '30' });
    expect(extResourceTexture2DSize(stream)).toEqual({ x: 70, y: 30 });
  });

  it('reports nothing for a Theora stream with no picture', () => {
    expect(extResourceTexture2DSize(theoraStream({}))).toBeNull();
  });
});
