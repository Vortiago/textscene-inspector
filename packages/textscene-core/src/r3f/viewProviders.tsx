import type { ReactNode } from 'react';
import { HierarchyProvider, type HierarchyContextValue } from './contexts/HierarchyContext.js';
import { ResourceLoaderProvider } from '../resources/ResourceLoaderContext.js';
import type { ResourceLoader } from '../resources/ResourceLoader.js';
import { SelectionProvider } from './contexts/SelectionContext.js';
import { MissingResourcesProvider } from './contexts/MissingResourcesContext.js';
import { LiveFilesHost } from './LiveFilesHost.js';
import { AnimatedBonePosesProvider } from './contexts/AnimatedBonePosesContext.js';
import { AnimatedValueProvider } from './contexts/AnimatedValueContext.js';
import { AnimationDriverProvider } from './contexts/AnimationDriverContext.js';
import { ViewportTextureProvider } from './contexts/ViewportTextureContext.js';
import { ViewportPassProvider } from './contexts/ViewportPassRegistryContext.js';
import { ViewportRectProvider } from './contexts/ViewportRectContext.js';
import { ProjectSettingsProvider } from './contexts/ProjectSettingsContext.js';
import { AnimationTransportProvider } from './contexts/AnimationTransportContext.js';
import { PreviewVisibilityProvider } from './contexts/PreviewVisibilityContext.js';
import { composeProviders } from './composeProviders.js';

interface ViewProviderOptions {
  hierarchyValue: HierarchyContextValue;
  /** The loader of the view's scene, which the view and every part of the host read files through. */
  loader: ResourceLoader;
  /** Whether the host shows the view. Both canvases stop rendering while it is `false`. */
  isVisible?: boolean;
}

/** The view's providers, in order, as a function so the caller's tree gains no wrapper (ADR-0002). */
export function viewProviders({
  hierarchyValue,
  loader,
  isVisible,
}: ViewProviderOptions): (children: ReactNode) => ReactNode {
  return composeProviders(
    (children) => <ResourceLoaderProvider loader={loader}>{children}</ResourceLoaderProvider>,
    (children) => <HierarchyProvider value={hierarchyValue}>{children}</HierarchyProvider>,
    (children) => <SelectionProvider>{children}</SelectionProvider>,
    (children) => <PreviewVisibilityProvider isVisible={isVisible}>{children}</PreviewVisibilityProvider>,
    (children) => (
      <MissingResourcesProvider>
        <LiveFilesHost />
        {children}
      </MissingResourcesProvider>
    ),
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
    (children) => <ProjectSettingsProvider>{children}</ProjectSettingsProvider>
  );
}
