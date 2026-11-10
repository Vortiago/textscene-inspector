import { describe, expect, it } from 'vitest';
import { resourceSliceRegistry } from '../../sliceRegistration';
import { isBinaryResourceType } from '../../resourceProviderUtils';
import { parseTheoraVideo } from './parse';
import './index';

describe('theoravideo slice registration', () => {
  it('claims .ogv for the generic resource bus slot', () => {
    expect(resourceSliceRegistry.busTypeOfPath('res://video/intro.ogv')).toBe('resource');
  });

  it('fetches an .ogv as bytes', () => {
    expect(isBinaryResourceType('VideoStream', 'res://video/intro.ogv')).toBe(true);
  });

  it('reads an .ogv through its own bytes parser, not the RSRC reader', () => {
    expect(resourceSliceRegistry.byExtension('.ogv')?.parseBytes).toBe(parseTheoraVideo);
  });
});
