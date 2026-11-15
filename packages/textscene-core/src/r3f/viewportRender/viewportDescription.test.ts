import { describe, expect, it } from 'vitest';
import { parseProjectSettings } from '../../parser/projectSettingsParser';
import { rootViewportDescription } from './viewportDescription';

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
    });
  });
});
