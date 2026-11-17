import { describe, expect, it } from 'vitest';
import { DEFAULT_ANISOTROPIC_FILTERING_LEVEL } from '../../godot/scene/viewport';
import { parseProjectSettings } from '../../parser/projectSettingsParser';
import {
  gameViewportDescription,
  probeCaptureDescription,
  rootViewportDescription,
  subViewportDescription,
} from './viewportDescription';

describe('rootViewportDescription', () => {
  it("gives Godot's root defaults and the editor's rules with no project", () => {
    expect(rootViewportDescription(null)).toEqual({
      msaa2D: 0,
      msaa3D: 0,
      usesDebanding: false,
      transparentBackground: false,
      mipmapBias: 0,
      positionalShadowAtlas: { size: 4096, quadrantShadows: [4, 4, 16, 64] },
      anisotropicLevel: 2,
      camera: 'editor',
      drawsEditorChrome: true,
      previewsEnvironment: true,
      fallbackEnvironment: null,
    });
  });

  it('takes each project key into its field', () => {
    const settings = parseProjectSettings(
      [
        '[rendering]',
        'anti_aliasing/quality/msaa_2d=1',
        'anti_aliasing/quality/msaa_3d=2',
        'anti_aliasing/quality/use_debanding=true',
        'viewport/transparent_background=true',
        'textures/default_filters/texture_mipmap_bias=-0.5',
        'lights_and_shadows/positional_shadow/atlas_size=512',
        'lights_and_shadows/positional_shadow/atlas_quadrant_2_subdiv=1',
        'textures/default_filters/anisotropic_filtering_level=4',
        'environment/defaults/default_environment="res://default_env.tres"',
      ].join('\n')
    );

    expect(rootViewportDescription(settings)).toMatchObject({
      msaa2D: 1,
      msaa3D: 2,
      usesDebanding: true,
      transparentBackground: true,
      mipmapBias: -0.5,
      positionalShadowAtlas: { size: 512, quadrantShadows: [4, 4, 1, 64] },
      anisotropicLevel: 4,
      fallbackEnvironment: 'res://default_env.tres',
    });
  });

  it('keeps the root default for a project value Godot refuses (error case)', () => {
    const settings = parseProjectSettings(
      ['[rendering]', 'lights_and_shadows/positional_shadow/atlas_size=-1'].join('\n')
    );

    expect(rootViewportDescription(settings).positionalShadowAtlas.size).toBe(4096);
  });
});

describe('gameViewportDescription', () => {
  const settings = parseProjectSettings(
    [
      '[rendering]',
      'anti_aliasing/quality/msaa_3d=2',
      'environment/defaults/default_environment="res://env.tres"',
    ].join('\n')
  );

  it("keeps the root's facts from the project", () => {
    expect(gameViewportDescription(settings)).toMatchObject({
      msaa3D: 2,
      fallbackEnvironment: 'res://env.tres',
    });
  });

  it("draws by the game's rules: the current camera, no editor element and no preview", () => {
    expect(gameViewportDescription(settings)).toMatchObject({
      camera: 'elected',
      drawsEditorChrome: false,
      previewsEnvironment: false,
    });
  });
});

describe('subViewportDescription', () => {
  const root = { ...rootViewportDescription(null), mipmapBias: -0.75, anisotropicLevel: 3 };
  const node = {
    msaa_2d: 1,
    msaa_3d: 3,
    use_debanding: true,
    use_hdr_2d: false,
    transparent_bg: true,
    texture_mipmap_bias: 0.25,
    anisotropic_filtering_level: 4,
    positional_shadow_atlas_size: 1024,
    positional_shadow_atlas_quad_0: 4,
    positional_shadow_atlas_quad_1: 3,
    positional_shadow_atlas_quad_2: 2,
    positional_shadow_atlas_quad_3: 1,
  };

  it("takes each node property into its field and the game's rules", () => {
    expect(subViewportDescription(node, root)).toEqual({
      msaa2D: 1,
      msaa3D: 3,
      usesDebanding: true,
      transparentBackground: true,
      mipmapBias: 0.25,
      positionalShadowAtlas: { size: 1024, quadrantShadows: [64, 16, 4, 1] },
      anisotropicLevel: 4,
      camera: 'elected',
      drawsEditorChrome: false,
      previewsEnvironment: false,
      fallbackEnvironment: null,
    });
  });

  it("takes the root's bias and anisotropic level where the node sets none", () => {
    const unset = { ...node, texture_mipmap_bias: undefined, anisotropic_filtering_level: undefined };
    expect(subViewportDescription(unset, root)).toMatchObject({ mipmapBias: -0.75, anisotropicLevel: 3 });
  });

  it('gives the default SubViewport atlas where the node sets none (edge case)', () => {
    const unset = {
      ...node,
      positional_shadow_atlas_size: undefined,
      positional_shadow_atlas_quad_0: undefined,
      positional_shadow_atlas_quad_1: undefined,
      positional_shadow_atlas_quad_2: undefined,
      positional_shadow_atlas_quad_3: undefined,
    };
    expect(subViewportDescription(unset, root).positionalShadowAtlas).toEqual({
      size: 2048,
      quadrantShadows: [4, 4, 16, 64],
    });
  });

  it('drops debanding on an HDR target (edge case)', () => {
    expect(subViewportDescription({ ...node, use_hdr_2d: true }, root).usesDebanding).toBe(false);
  });
});

describe('probeCaptureDescription', () => {
  const root = { ...rootViewportDescription(null), mipmapBias: -0.75 };

  it("samples at Godot's default samplers, with no bias", () => {
    expect(probeCaptureDescription(root).mipmapBias).toBe(0);
  });

  it("samples at Godot's default anisotropic level, whatever the viewport's", () => {
    expect(probeCaptureDescription({ ...root, anisotropicLevel: 4 }).anisotropicLevel).toBe(
      DEFAULT_ANISOTROPIC_FILTERING_LEVEL
    );
  });

  it("keeps the root's other facts", () => {
    expect(probeCaptureDescription({ ...root, msaa3D: 2 })).toMatchObject({ msaa3D: 2, camera: 'editor' });
  });

  it('leaves the root it reads unchanged (edge case)', () => {
    probeCaptureDescription(root);

    expect(root.mipmapBias).toBe(-0.75);
  });
});
