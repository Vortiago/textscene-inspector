/** Each Window class parses through the Window parse, which reads that class's own defaults. */
import { nodeRegistry } from '../../../core/NodeRegistry';
import { parseWindow } from './parser';
import type { EmbeddedWindowType } from '../../viewport/subviewport/viewportBoundary';

export function registerWindowParser(typeName: EmbeddedWindowType): void {
  nodeRegistry.register({ typeName, parser: parseWindow });
}
