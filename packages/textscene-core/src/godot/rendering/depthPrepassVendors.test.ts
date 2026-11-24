import { describe, expect, it } from 'vitest';
import { DEPTH_PREPASS_DISABLED_VENDORS, vendorDisablesDepthPrepass } from './depthPrepassVendors';

describe('vendorDisablesDepthPrepass', () => {
  it('turns the prepass off on a GPU whose name holds a listed vendor, in any case', () => {
    expect(
      vendorDisablesDepthPrepass(
        'ANGLE (Apple, ANGLE Metal Renderer: Apple M2)',
        DEPTH_PREPASS_DISABLED_VENDORS
      )
    ).toBe(true);
    expect(vendorDisablesDepthPrepass('mali-g78', DEPTH_PREPASS_DISABLED_VENDORS)).toBe(true);
  });

  it('keeps the prepass on a GPU no listed vendor names', () => {
    expect(
      vendorDisablesDepthPrepass('ANGLE (NVIDIA, NVIDIA GeForce RTX 3070)', DEPTH_PREPASS_DISABLED_VENDORS)
    ).toBe(false);
  });

  it('skips an empty entry and trims the spaces around each', () => {
    expect(vendorDisablesDepthPrepass('NVIDIA GeForce', ' , NVIDIA ,')).toBe(true);
    expect(vendorDisablesDepthPrepass('NVIDIA GeForce', ',,')).toBe(false);
  });
});
