/**
 * `BaseMaterial3D::get_material_for_2d` (`scene/resources/material.cpp:3021`) in three's terms.
 * Sprite3D and Label3D both build their material there, so the decisions it makes are one module
 * here: the blend and opaque prepass of each pass, the shadow membership, the side and the sampler.
 */

import * as THREE from 'three';
import type { AlphaCutMode } from '../godot/rendering/materials/alphaCut';
import type { TextureFilter } from '../godot/rendering/materials/textureFilter';
import { AlphaAntiAliasing } from '../godot/rendering/materials/alphaAntialiasing';
import { alphaCutSurface, joinsShadowPass, NO_TRANSPARENT_FLAG } from './godotAlphaCut';
import { cutBlends, cutOpaquePrepasses, type FadeVariants } from './materials/fadeVariants';
import { godotTextureFilterState, type TextureFilterState } from '../resources/textures/godotTextureFilter';
import type { PassBlend } from './materials/surfaceBlend';
import type { EnumValue } from '../godot/classdb/enumNames.js';

/** The flags `get_material_for_2d` reads, as the node stores them. */
interface MaterialFor2dInput {
  /** `SpriteBase3D::AlphaCutMode` or `Label3D::AlphaCutMode`: two C++ enums, same members. */
  alphaCut: EnumValue<typeof AlphaCutMode>;
  alphaScissorThreshold: number;
  /** A Sprite3D's `FLAG_TRANSPARENT`, or `NO_TRANSPARENT_FLAG` for a Label3D, whose DrawFlags have none. */
  transparentFlag: boolean | typeof NO_TRANSPARENT_FLAG;
  alphaHashScale: number;
  alphaAntialiasingMode: EnumValue<typeof AlphaAntiAliasing>;
  alphaAntialiasingEdge: number;
  /** Omitted means Godot's default, both faces. */
  doubleSided: boolean | undefined;
  noDepthTest: boolean;
  /** `BaseMaterial3D::TextureFilter` ordinal. */
  textureFilter: EnumValue<typeof TextureFilter>;
  /** The viewport's anisotropic filtering level, which sets the anisotropic sampler rows. */
  anisotropicFilteringLevel: number;
}

interface MaterialFor2d {
  /**
   * Each pass a geometry instance's fade can draw the surface in. It carries no opacity: a
   * Sprite3D takes it from its modulate, a Label3D run from its tint.
   */
  blends: FadeVariants<PassBlend>;
  joinsShadowPass: boolean;
  side: THREE.Side;
  depthTest: boolean;
  textureFilter: TextureFilterState;
}

export function materialFor2d(input: MaterialFor2dInput): MaterialFor2d {
  const cut = alphaCutSurface({
    mode: input.alphaCut,
    scissorThreshold: input.alphaScissorThreshold,
    transparentFlag: input.transparentFlag,
    antialiasing: { mode: input.alphaAntialiasingMode, edge: input.alphaAntialiasingEdge },
  });
  const depthTest = !input.noDepthTest;
  const blends = cutBlends(cut);
  const prepasses = cutOpaquePrepasses(cut, depthTest);
  const { antialiasing } = cut;
  const { alphaHashScale } = input;
  return {
    blends: {
      unfaded: { ...blends.unfaded, alphaHashScale, antialiasing, opaquePrepass: prepasses.unfaded },
      alphaPass: { ...blends.alphaPass, alphaHashScale, antialiasing, opaquePrepass: prepasses.alphaPass },
    },
    joinsShadowPass: joinsShadowPass(cut, depthTest),
    side: input.doubleSided === false ? THREE.FrontSide : THREE.DoubleSide,
    depthTest,
    textureFilter: godotTextureFilterState(input.textureFilter, input.anisotropicFilteringLevel),
  };
}
