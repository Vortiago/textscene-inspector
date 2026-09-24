/**
 * The preview panel's provider stack, in the order it mounts. It is a plain
 * function, not a component, so the shell's element tree gains no wrapper.
 */

import type { ReactNode } from 'react';
import { HierarchyProvider, type HierarchyContextValue } from '../../contexts/HierarchyContext.js';
import { SelectionProvider } from '../../contexts/SelectionContext.js';
import { CameraControlProvider } from '../../contexts/CameraControlContext.js';
import { MissingResourcesProvider } from '../../contexts/MissingResourcesContext.js';
import { ViewportModeProvider, type ViewportMode } from '../../contexts/ViewportModeContext.js';
import { AnimatedValueProvider } from '../../contexts/AnimatedValueContext.js';
import { AnimationDriverProvider } from '../../contexts/AnimationDriverContext.js';
import { ViewportTextureProvider } from '../../contexts/ViewportTextureContext.js';
import { ViewportPassProvider } from '../../contexts/ViewportPassRegistryContext.js';
import { ViewportRectProvider } from '../../contexts/ViewportRectContext.js';
import { ProjectSettingsProvider } from '../../contexts/ProjectSettingsContext.js';
import { AnimationTransportProvider } from '../../contexts/AnimationTransportContext.js';
import { composeProviders } from '../../composeProviders.js';

export interface PreviewShellProviderOptions {
  hierarchyValue: HierarchyContextValue;
  initialActiveCameraPath: string | null | undefined;
  onMissingPathsChange: ((paths: ReadonlySet<string>) => void) | undefined;
  /** The host's forced viewport mode, if it named one. */
  initialViewportMode: ViewportMode | undefined;
  /** The mode, grid and frame persisted last session. */
  initialViewport: { mode: ViewportMode; showGrid: boolean; frameOnOpen: boolean };
  panelId: string;
  rootScenePath: string;
}

/**
 * Each entry mounts its own provider, in order. ADR-0002 keeps these contexts
 * separate on purpose, so `composeProviders` only removes the JSX nesting.
 */
export function previewShellProviders({
  hierarchyValue,
  initialActiveCameraPath,
  onMissingPathsChange,
  initialViewportMode,
  initialViewport,
  panelId,
  rootScenePath,
}: PreviewShellProviderOptions): (children: ReactNode) => ReactNode {
  return composeProviders(
    (children) => <HierarchyProvider value={hierarchyValue}>{children}</HierarchyProvider>,
    (children) => <SelectionProvider>{children}</SelectionProvider>,
    (children) => (
      <CameraControlProvider initialActiveCameraPath={initialActiveCameraPath}>
        {children}
      </CameraControlProvider>
    ),
    (children) => (
      <MissingResourcesProvider onMissingPathsChange={onMissingPathsChange}>
        {children}
      </MissingResourcesProvider>
    ),
    (children) => (
      // A host-forced `initialViewportMode` wins over the persisted mode.
      <ViewportModeProvider
        initialMode={initialViewportMode ?? initialViewport.mode}
        initialShowGrid={initialViewport.showGrid}
        initialFrameOnOpen={initialViewport.frameOnOpen}
      >
        {children}
      </ViewportModeProvider>
    ),
    (children) => <AnimationTransportProvider>{children}</AnimationTransportProvider>,
    (children) => <AnimationDriverProvider>{children}</AnimationDriverProvider>,
    // A `<SubViewport>` publishes its target here and a `ViewportTexture` resolves
    // it by NodePath. It wraps both canvases and the DOM overlay, since consumers
    // live on both sides (ADR-0030).
    (children) => <ViewportTextureProvider>{children}</ViewportTextureProvider>,
    // Inside the texture registry: a pass registers its ordering edge and
    // publishes the target it rendered, so the two are read together.
    (children) => <ViewportPassProvider>{children}</ViewportPassProvider>,
    // A stretching SubViewportContainer measures its DOM box and the publisher
    // sizes the target from it, since Godot's `recalc_force_viewport_sizes`
    // makes the container's rect the viewport's size. It wraps both sides too.
    (children) => <ViewportRectProvider>{children}</ViewportRectProvider>,
    (children) => <AnimatedValueProvider>{children}</AnimatedValueProvider>,
    // Outermost of the Control-facing providers, since both theme-scale consumers,
    // `<Canvas2DStage>` and `<ControlRasterHosts>`, sit under it.
    // The key carries `panelId`: `rootScenePath` is relative to the **Corpus root**,
    // so two projects can each hold a `res://main.tscn` and the path alone stays.
    (children) => (
      <ProjectSettingsProvider sceneKey={`${panelId} ${rootScenePath}`}>
        {children}
      </ProjectSettingsProvider>
    )
  );
}
