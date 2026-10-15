import { describe, expect, it } from 'vitest';
import { resourceTypeHint } from './resourceTypeHint.js';

describe('resourceTypeHint', () => {
  it('splits the bases from the classes a `-` prefix excludes', () => {
    expect(resourceTypeHint('Texture2D,-AtlasTexture')).toEqual({
      bases: ['Texture2D'],
      excluded: ['AtlasTexture'],
    });
  });

  it('excludes nothing in a hint with no `-` part', () => {
    expect(resourceTypeHint('NoiseTexture,GradientTexture2D')).toEqual({
      bases: ['NoiseTexture', 'GradientTexture2D'],
      excluded: [],
    });
  });

  it('names no class for an empty hint', () => {
    expect(resourceTypeHint('')).toEqual({ bases: [], excluded: [] });
  });

  it('strips the whitespace around each part, as the editor does', () => {
    expect(resourceTypeHint(' Mesh , -PlaneMesh ,')).toEqual({ bases: ['Mesh'], excluded: ['PlaneMesh'] });
  });
});
