/**
 * Godot's tonemap pass as a compositor pass: Godot tonemaps the finished colour buffer after the alpha
 * pass (`render_forward_clustered.cpp:2514`, `:2389`), never per fragment. One effect, not bloom then
 * tonemap: `tonemap.glsl` is one shader, and the glow blend sits either side of the curve per mode.
 */

import type { Effect } from 'postprocessing';
import { EffectComposer } from '@react-three/postprocessing';
import type { EnvironmentAdjustments, EnvironmentSettings } from '../../resources/environment/types';
import type { SceneResources } from '../SceneResourcesContext';
import { projectTransparentBackground } from '../../parser/projectSettingsParser';
import { useProjectSettings } from '../contexts/ProjectSettingsContext';
import { SCENE_BUFFER_TYPE, type CompositorPass } from './useCompositorPass';
import { SubscriberStep } from '../frameProfile/FrameProfiler';
import { useGodotToneMapEffect } from './useGodotToneMapEffect';

/** The composer's `useFrame` priority. A positive one takes the canvas's render over from R3F. */
const COMPOSER_PRIORITY = 1;

interface CompositorProps {
  /** The glow, the auto exposure and the scene buffer's samples. The samples resolve before the curve as Godot resolves them. */
  pass: CompositorPass;
  /** Null when `adjustment_enabled` is false. */
  adjustments: EnvironmentAdjustments | null;
  toneMapping: EnvironmentSettings['toneMapping'];
  /** The pools `glow_map` resolves in: those of the Environment that names it. */
  resources: SceneResources;
}

export function Compositor({ pass, adjustments, toneMapping, resources }: CompositorProps) {
  const { glow, samples, autoExposure, usesDebanding } = pass;
  // The composer draws the canvas, which is the root window's surface.
  const transparentBackground = projectTransparentBackground(useProjectSettings().settings);
  // Typed as the base `Effect`: with the library's `declaration: true`, a class
  // extending postprocessing's `Effect` does not carry its inherited members
  // across a module boundary (the base's event-map type is not nameable in the
  // emitted `.d.ts`). The instance is still a `GodotToneMapEffect`.
  const effect: Effect = useGodotToneMapEffect({
    glow,
    adjustments,
    toneMapping,
    autoExposure,
    transparentBackground,
    usesDebanding,
    resources,
  });

  return (
    <>
      <SubscriberStep step="Compositor" priority={COMPOSER_PRIORITY} />
      <EffectComposer
        multisampling={samples}
        frameBufferType={SCENE_BUFFER_TYPE}
        renderPriority={COMPOSER_PRIORITY}
      >
        <primitive object={effect} dispose={null} />
      </EffectComposer>
    </>
  );
}
