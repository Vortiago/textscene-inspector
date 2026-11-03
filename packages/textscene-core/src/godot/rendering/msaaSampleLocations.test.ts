import { describe, expect, it } from 'vitest';
import { sampleJitter, standardSampleLocations } from './msaaSampleLocations';

describe('standardSampleLocations', () => {
  it("lists Vulkan's two standard locations in sample order", () => {
    expect(standardSampleLocations(2)).toEqual([
      { x: 0.75, y: 0.75 },
      { x: 0.25, y: 0.25 },
    ]);
  });

  it('lists four and eight locations, each inside the pixel', () => {
    for (const count of [4, 8]) {
      const locations = standardSampleLocations(count);
      expect(locations).toHaveLength(count);
      for (const { x, y } of locations) {
        expect(x).toBeGreaterThan(0);
        expect(y).toBeLessThan(1);
      }
    }
    expect(standardSampleLocations(4)[0]).toEqual({ x: 0.375, y: 0.125 });
    expect(standardSampleLocations(8)[7]).toEqual({ x: 0.9375, y: 0.0625 });
  });

  it('gives one location at the centre for a single sample', () => {
    expect(standardSampleLocations(0)).toEqual([{ x: 0.5, y: 0.5 }]);
  });
});

describe('sampleJitter', () => {
  it('moves the frame so its pixel centre lands on the location, with rows running down', () => {
    // A location right of and below the centre moves the scene left and up in NDC.
    expect(sampleJitter({ x: 0.75, y: 0.75 }, 100, 50)).toEqual({ x: -0.005, y: 0.01 });
  });

  it('leaves the centre in place', () => {
    expect(sampleJitter({ x: 0.5, y: 0.5 }, 100, 50)).toEqual({ x: 0, y: 0 });
  });
});
