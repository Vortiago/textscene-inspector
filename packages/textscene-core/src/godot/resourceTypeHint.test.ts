import { describe, expect, it } from 'vitest';
import { excludingHint, resourceTypeHint } from './resourceTypeHint.js';

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

describe('excludingHint', () => {
  const textureHint =
    'Texture2D,-AnimatedTexture,-AtlasTexture,-CameraTexture,-CanvasTexture,-MeshTexture,-Texture2DRD,-ViewportTexture';

  it('reaches the class that declares the slot through the base chain', () => {
    expect(excludingHint('OmniLight3D', 'light_projector')).toEqual({
      declaredBy: 'Light3D',
      hintString: textureHint,
      excluded: [
        'AnimatedTexture',
        'AtlasTexture',
        'CameraTexture',
        'CanvasTexture',
        'MeshTexture',
        'Texture2DRD',
        'ViewportTexture',
      ],
    });
  });

  it('reads a class the pinned ClassDB lacks from its hand rows', () => {
    expect(excludingHint('AreaLight3D', 'area_texture')?.declaredBy).toBe('AreaLight3D');
  });

  it('answers nothing for a slot whose hint excludes no class', () => {
    expect(excludingHint('MeshInstance3D', 'mesh')).toBeUndefined();
  });

  it('answers nothing for a hand row with no exclusion', () => {
    expect(excludingHint('AreaLight3D', 'area_size')).toBeUndefined();
  });

  it('answers nothing for a class no table knows', () => {
    expect(excludingHint('constructor', 'light_projector')).toBeUndefined();
  });
});
