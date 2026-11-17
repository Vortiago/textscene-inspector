import { useMemo } from 'react';
import { useEnvironmentOf } from '../../nodes/3d/worldenvironment/useResolvedEnvironment';
import { decodeEnvironment } from '../../resources/environment/decode';
import { createEnvironmentSettings } from '../../resources/environment/build';
import { projectSettingReference } from '../../resources/reading';
import type { Rgba } from '../../godot/math/math';
import { useProjectClearColorSrgb } from '../useProjectClearColor';
import { useViewportDescription } from '../viewportRender/viewportDescriptionContext';
import { NO_RESOLUTION } from './worldGroup';
import type { EnvironmentResolution } from './WorldEnvironmentScope';

/** The viewport's fallback Environment, else the clear colour's, else none for a black clear colour. */
export function useFallbackEnvironment(): EnvironmentResolution {
  const description = useViewportDescription();
  const path = description.fallbackEnvironment;
  const reference = useMemo(() => (path ? projectSettingReference(path) : null), [path]);
  const fallback = useEnvironmentOf(reference);
  const clearColor = useProjectClearColorSrgb();
  // Godot lights by the clear request's colour: black for a transparent target or one that never asks.
  const isClearBlack = description.transparentBackground || !description.requestsClear;
  const noEnvironment = useMemo(
    () => (isClearBlack ? NO_RESOLUTION : clearColorEnvironment(clearColor)),
    [isClearBlack, clearColor]
  );
  return fallback.status === 'none' ? noEnvironment : fallback;
}

/** No Environment lights by the clear colour (`render_scene_data_rd.cpp:225-235`), as a default one does. */
function clearColorEnvironment(clearColor: Rgba): EnvironmentResolution {
  const settings = createEnvironmentSettings(decodeEnvironment({}), clearColor);
  return { status: 'resolved', environment: { settings, sky: null, panorama: null, glowMap: null } };
}
