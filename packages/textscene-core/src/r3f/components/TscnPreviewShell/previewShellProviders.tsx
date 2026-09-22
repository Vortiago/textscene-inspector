/**
 * The preview panel's provider stack, in the order it mounts.
 *
 * A plain function rather than a component, so the shell's element tree gains
 * no wrapper: it returns the same `withProviders(children)` callable the shell
 * used when the pyramid was written out by hand.
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
  /** What was persisted last session — the mode/grid/frame defaults. */
  initialViewport: { mode: ViewportMode; showGrid: boolean; frameOnOpen: boolean };
  panelId: string;
  rootScenePath: string;
}

/**
 * Flattens what was an 8-level hand-nested provider pyramid into one
 * call. Each entry still mounts its own INDEPENDENT provider, in the SAME
 * order as before — composeProviders only removes the JSX-nesting
 * boilerplate; ADR-0002 (and its per-domain-UI-state analogues here) keeps
 * these contexts separate on purpose, so this is not a merge.
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
      // A host-forced `initialViewportMode` (e.g. the VS Code extension's
      // `textscene.defaultViewportMode` setting) wins over whatever was
      // persisted from a prior session.
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
    // Same reason as the driver registry directly above: a `<SubViewport>`
    // publishes its offscreen target here and a `ViewportTexture` consumer
    // resolves it by NodePath. It wraps BOTH canvases and the DOM overlay
    // because consumers live on both sides of that split (ADR-0030).
    (children) => <ViewportTextureProvider>{children}</ViewportTextureProvider>,
    // Inside the texture registry: a pass registers its ordering edge and
    // publishes the target it rendered, so the two are read together.
    (children) => <ViewportPassProvider>{children}</ViewportPassProvider>,
    // The return leg of the same seam: a stretching SubViewportContainer
    // measures its own DOM box and the publisher sizes the target from it,
    // because Godot's `recalc_force_viewport_sizes` makes the CONTAINER's rect
    // the viewport's size. Wraps both canvases and the overlay for the same
    // reason the texture registry does — the two ends live on either side.
    (children) => <ViewportRectProvider>{children}</ViewportRectProvider>,
    (children) => <AnimatedValueProvider>{children}</AnimatedValueProvider>,
    // The scene's `project.godot`. Outermost of the Control-facing providers
    // because BOTH consumers of the theme scale sit under it — the on-screen
    // overlay in `<Canvas2DStage>` and the off-screen `<ControlRasterHosts>`,
    // which `<ViewportArea>` mounts side by side.
    //
    // The key carries `panelId` as well as the scene's res:// identity because
    // `rootScenePath` is relative to the **Corpus root**: two vendored projects
    // can each hold a `res://main.tscn`, and on that swap the path alone would
    // not change, so the settings would stay the outgoing project's while the
    // byte layer had already been cleared for the incoming one.
    (children) => (
      <ProjectSettingsProvider sceneKey={`${panelId} ${rootScenePath}`}>
        {children}
      </ProjectSettingsProvider>
    )
  );
}
