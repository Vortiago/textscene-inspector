/**
 * The preview panel's provider stack, in the order it mounts. It is a plain
 * function, not a component, so the shell's element tree gains no wrapper.
 */

import type { ReactNode } from 'react';
import { HierarchyProvider, type HierarchyContextValue } from '../../contexts/HierarchyContext.js';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext.js';
import type { ResourceLoader } from '../../../resources/ResourceLoader.js';
import { SelectionProvider } from '../../contexts/SelectionContext.js';
import { ViewportActionsProvider } from '../../contexts/ViewportActionsContext.js';
import { MissingResourcesProvider } from '../../contexts/MissingResourcesContext.js';
import { LiveFilesHost } from '../../LiveFilesHost.js';
import { UndrawnMeshesProvider } from '../../contexts/UndrawnMeshesContext.js';
import { EmptyShapesProvider } from '../../contexts/EmptyShapesContext.js';
import {
  DEFAULT_VIEWPORT,
  ViewportModeProvider,
  type PersistedViewport,
  type ViewportMode,
} from '../../contexts/ViewportModeContext.js';
import { AnimatedBonePosesProvider } from '../../contexts/AnimatedBonePosesContext.js';
import { AnimatedValueProvider } from '../../contexts/AnimatedValueContext.js';
import { AnimationDriverProvider } from '../../contexts/AnimationDriverContext.js';
import { ViewportTextureProvider } from '../../contexts/ViewportTextureContext.js';
import { ViewportPassProvider } from '../../contexts/ViewportPassRegistryContext.js';
import { ViewportRectProvider } from '../../contexts/ViewportRectContext.js';
import { ProjectSettingsProvider } from '../../contexts/ProjectSettingsContext.js';
import { AnimationTransportProvider } from '../../contexts/AnimationTransportContext.js';
import { PreviewVisibilityProvider } from '../../contexts/PreviewVisibilityContext.js';
import { composeProviders } from '../../composeProviders.js';
import { SoftwareRenderingProvider } from '../../softwareRendering/SoftwareRenderingContext.js';
import { ViewStatusProvider } from '../../viewStatus/ViewStatusContext.js';

interface PreviewShellProviderOptions {
  hierarchyValue: HierarchyContextValue;
  /** The loader of the shell's scene, which every panel and view reads its files through. */
  loader: ResourceLoader;
  initialPreviewedCameraPath?: string | null;
  onMissingPathsChange?: (paths: ReadonlySet<string>) => void;
  /** The host's forced viewport mode, if it named one. */
  initialViewportMode?: ViewportMode;
  /** The mode, the helpers and the framing persisted last session. */
  initialViewport?: PersistedViewport;
  /** Whether the host shows the preview. Both canvases stop rendering while it is `false`. */
  isVisible?: boolean;
  panelId: string;
  rootScenePath: string;
}

/**
 * Each entry mounts its own provider, in order. ADR-0002 keeps these contexts
 * separate on purpose, so `composeProviders` only removes the JSX nesting.
 */
export function previewShellProviders({
  hierarchyValue,
  loader,
  initialPreviewedCameraPath,
  onMissingPathsChange,
  initialViewportMode,
  initialViewport = DEFAULT_VIEWPORT,
  isVisible,
  panelId,
  rootScenePath,
}: PreviewShellProviderOptions): (children: ReactNode) => ReactNode {
  return composeProviders(
    (children) => <ResourceLoaderProvider loader={loader}>{children}</ResourceLoaderProvider>,
    (children) => <HierarchyProvider value={hierarchyValue}>{children}</HierarchyProvider>,
    (children) => <SelectionProvider>{children}</SelectionProvider>,
    (children) => <PreviewVisibilityProvider isVisible={isVisible}>{children}</PreviewVisibilityProvider>,
    (children) => (
      <ViewportActionsProvider initialPreviewedCameraPath={initialPreviewedCameraPath}>
        {children}
      </ViewportActionsProvider>
    ),
    // The view in any mode reports here, and the shell's load status reads it.
    (children) => <ViewStatusProvider>{children}</ViewStatusProvider>,
    (children) => (
      <MissingResourcesProvider onMissingPathsChange={onMissingPathsChange}>
        <LiveFilesHost />
        {children}
      </MissingResourcesProvider>
    ),
    (children) => <UndrawnMeshesProvider>{children}</UndrawnMeshesProvider>,
    (children) => <EmptyShapesProvider>{children}</EmptyShapesProvider>,
    (children) => (
      // A host-forced `initialViewportMode` wins over the persisted mode.
      <ViewportModeProvider
        initialMode={initialViewportMode ?? initialViewport.mode}
        initialShow={initialViewport.show}
        initialFrameOnOpen={initialViewport.frameOnOpen}
      >
        {children}
      </ViewportModeProvider>
    ),
    // Each canvas's probe publishes here, and the top bar reads it.
    (children) => <SoftwareRenderingProvider>{children}</SoftwareRenderingProvider>,
    (children) => <AnimationTransportProvider>{children}</AnimationTransportProvider>,
    (children) => <AnimationDriverProvider>{children}</AnimationDriverProvider>,
    // A `<SubViewport>` publishes its target here and a `ViewportTexture` resolves
    // it by NodePath. It wraps both canvases and the DOM overlay, since consumers
    // live on both sides (ADR-0033).
    (children) => <ViewportTextureProvider>{children}</ViewportTextureProvider>,
    // Inside the texture registry: a pass registers its ordering edge and
    // publishes the target it rendered, so the two are read together.
    (children) => <ViewportPassProvider>{children}</ViewportPassProvider>,
    // A stretching SubViewportContainer publishes its solved rect and the
    // publisher sizes the target from it, since Godot's `recalc_force_viewport_sizes`
    // makes the container's rect the viewport's size. It wraps both canvases too.
    (children) => <ViewportRectProvider>{children}</ViewportRectProvider>,
    (children) => <AnimatedValueProvider>{children}</AnimatedValueProvider>,
    (children) => <AnimatedBonePosesProvider>{children}</AnimatedBonePosesProvider>,
    // Outermost of the Control-facing providers, since both theme-scale consumers,
    // `<Canvas2DStage>` and `<ControlRasterHosts>`, sit under it.
    // The key carries `panelId`: `rootScenePath` is relative to the **Corpus root**,
    // so two projects can each hold a `res://main.tscn` and the path alone stays.
    (children) => (
      <ProjectSettingsProvider sceneKey={`${panelId} ${rootScenePath}`}>{children}</ProjectSettingsProvider>
    )
  );
}
