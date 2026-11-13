/**
 * A Window class draws as a viewport its embedder shows: the SubViewport component publishes its
 * target, and the embedder draws it with its decoration (`EmbeddedWindows.tsx`, ADR-0033).
 */
import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { SubViewport } from '../../viewport/subviewport/Component';
import type { EmbeddedWindowType } from '../../viewport/subviewport/viewportBoundary';

export function registerWindowComponent(typeName: EmbeddedWindowType): void {
  nodeComponentRegistry.register({ typeName, Component: SubViewport });
}
