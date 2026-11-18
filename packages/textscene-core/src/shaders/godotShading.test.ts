import { describe, expect, it, vi } from 'vitest';
import type * as THREE from 'three';
import { installGodotShading } from './godotShading';
import { disposeSky } from './sky/transpileSky';

/** WebGL 2's `MAX_VERTEX_OUTPUT_COMPONENTS` and `MAX_FRAGMENT_INPUT_COMPONENTS`. */
const VERTEX_OUTPUTS = 0x9122;
const FRAGMENT_INPUTS = 0x9125;

/** A renderer whose GL context has `varyingSlots` slots: its vertex outputs set the limit. */
function rendererWithSlots(varyingSlots: number) {
  const components: Record<number, number> = { [VERTEX_OUTPUTS]: varyingSlots * 4, [FRAGMENT_INPUTS]: 256 };
  const getParameter = vi.fn((name: number) => components[name]);
  const context = {
    MAX_VERTEX_OUTPUT_COMPONENTS: VERTEX_OUTPUTS,
    MAX_FRAGMENT_INPUT_COMPONENTS: FRAGMENT_INPUTS,
    getParameter,
  };
  const setNodesHandler = vi.fn();
  const renderer = { setNodesHandler, debug: {}, getContext: () => context };
  return { renderer: renderer as unknown as THREE.WebGLRenderer, getParameter, setNodesHandler };
}

/** Seventeen slots, the most Forward+ gives past the 15 its template takes. It is unshaded. */
const SEVENTEEN_VARYINGS =
  'shader_type spatial;\nrender_mode unshaded;\nvarying vec4 v[17];\nvoid fragment() {}\n';

describe('installGodotShading', () => {
  it('gives the renderer a nodes handler', () => {
    const { renderer, setNodesHandler } = rendererWithSlots(16);
    installGodotShading(renderer);
    expect(setNodesHandler).toHaveBeenCalledOnce();
  });

  it("refuses varyings past the GL context's slots on a compatibility project", () => {
    const shading = installGodotShading(rendererWithSlots(16).renderer, {
      renderingMethod: 'gl_compatibility',
    });
    expect(() => shading.spatial(SEVENTEEN_VARYINGS)).toThrow(
      'Too many varyings used in shader (17 used, maximum supported is 16).'
    );
  });

  it("draws varyings within the GL context's slots on a compatibility project", () => {
    const shading = installGodotShading(rendererWithSlots(18).renderer, {
      renderingMethod: 'gl_compatibility',
    });
    expect(() => shading.spatial(SEVENTEEN_VARYINGS).material.dispose()).not.toThrow();
  });

  it('reads no GL limit for a Forward+ project, which takes the Vulkan limit', () => {
    const { renderer, getParameter } = rendererWithSlots(16);
    installGodotShading(renderer).spatial(SEVENTEEN_VARYINGS).material.dispose();
    expect(getParameter).not.toHaveBeenCalled();
  });

  it('reads no GL limit for a method that names no renderer, which Godot draws with Forward+', () => {
    const { renderer, getParameter } = rendererWithSlots(16);
    installGodotShading(renderer, { renderingMethod: 'GL_Compatibility' })
      .spatial(SEVENTEEN_VARYINGS)
      .material.dispose();
    expect(getParameter).not.toHaveBeenCalled();
  });

  it("parses a sky with the project's rendering method", () => {
    const shading = installGodotShading(rendererWithSlots(16).renderer, { renderingMethod: 'mobile' });
    expect(() =>
      shading.sky('shader_type sky;\nuniform sampler2D t : hint_normal_roughness_texture;\nvoid sky() {}\n')
    ).toThrow("'hint_normal_roughness_texture' is only available when using the Forward+ renderer.");
  });

  it('draws a sky with no rendering method as Forward+', () => {
    const shading = installGodotShading(rendererWithSlots(16).renderer);
    expect(() => disposeSky(shading.sky('shader_type sky;\nvoid sky() {}\n'))).not.toThrow();
  });
});
