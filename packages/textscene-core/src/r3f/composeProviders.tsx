/**
 * Flattens nested providers into one call. ADR-0002 keeps the contexts
 * separate, so this removes only the JSX nesting. Each entry is a closure, not
 * a component type, so a provider with its own props composes the same way.
 */
import type { ReactElement, ReactNode } from 'react';

export type ProviderWrapper = (children: ReactNode) => ReactElement;

/**
 * @param providers - In outer-to-inner order: the first entry is the outermost
 *   wrapper.
 * @returns A function that wraps its argument in every provider, in order.
 *   With zero providers it returns `children` unwrapped.
 */
export function composeProviders(...providers: ProviderWrapper[]): (children: ReactNode) => ReactNode {
  return (children: ReactNode) => providers.reduceRight<ReactNode>((acc, wrap) => wrap(acc), children);
}
