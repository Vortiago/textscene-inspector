/**
 * Flattens a provider-nesting pyramid into a single call.
 *
 * `<TscnPreviewShell>` mounts 8 independent context providers
 * (Hierarchy/Selection/CameraControl/MissingResources/ViewportMode/
 * AnimationTransport/AnimationDriver/AnimatedValue) around its content. Each
 * one is load-bearing on its own — ADR-0002 keeps parse/3D-render/2D-render
 * (and here, per-domain UI state) SEPARATE rather than merged into one
 * mega-context, so a future reader must not "simplify" this into fewer
 * contexts. `composeProviders` only removes the JSX-NESTING boilerplate
 * (and the indentation drift that comes with 8 levels of hand-nested JSX);
 * it still mounts every provider, in the same order, unchanged.
 *
 * Each entry is a `(children) => <Provider ...>{children}</Provider>`
 * closure rather than a bare component type, so providers that need their
 * OWN props (e.g. `<HierarchyProvider value={hierarchyValue}>`) compose the
 * same way as ones that don't.
 */
import type { ReactElement, ReactNode } from 'react';

export type ProviderWrapper = (children: ReactNode) => ReactElement;

/**
 * @param providers - In OUTER-to-INNER order: the first entry becomes the
 *   outermost wrapper, the last sits closest to `children`.
 * @returns A function that wraps its argument in every provider, in order.
 *   With zero providers, returns `children` unchanged (not wrapped in
 *   anything) — so the composed call stays a no-op passthrough rather than
 *   a special case callers need to guard against.
 */
export function composeProviders(...providers: ProviderWrapper[]): (children: ReactNode) => ReactNode {
  return (children: ReactNode) => providers.reduceRight<ReactNode>((acc, wrap) => wrap(acc), children);
}
