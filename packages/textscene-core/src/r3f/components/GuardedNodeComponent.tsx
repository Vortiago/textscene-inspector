/**
 * The component registered for a node's type, inside the boundary that keeps a render error to
 * that node: uncaught, it blanks the viewport, since `<Canvas>` is its own reconciler root. A new
 * `node` resets the boundary. An unregistered type renders the fallback, so it stays visible.
 */
import type { ReactNode } from 'react';
import type { TscnNode } from '../../parser/types.js';
import { nodeComponentRegistry } from '../NodeComponentRegistry.js';
import { fallbackTransform } from '../nodeFallbackTransform.js';
import { GenericNodeFallback } from '../internal/generic-node-fallback/index';
import { ErrorBoundary } from './ErrorBoundary.js';
import { MissingResourcePlaceholder } from './MissingResourcePlaceholder.js';

export function GuardedNodeComponent({
  node,
  children,
}: {
  node: TscnNode;
  children?: ReactNode;
}): ReactNode {
  const Component = nodeComponentRegistry.get(node.type) ?? GenericNodeFallback;
  return (
    <ErrorBoundary
      resetKeys={[node]}
      fallback={() => (
        <MissingResourcePlaceholder shape="box" name={node.name} {...fallbackTransform(node)} />
      )}
    >
      <Component node={node}>{children}</Component>
    </ErrorBoundary>
  );
}
