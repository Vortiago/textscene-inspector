/**
 * Each Window class parses through the Window parse, which reads that class's own defaults. A class
 * with properties of its own passes a parse that extends it.
 */
import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseWindow } from './parser';
import type { EmbeddedWindowType } from '../../viewport/subviewport/viewportBoundary';

export function registerWindowParser(
  typeName: EmbeddedWindowType,
  parser: NodeTypeRegistration['parser'] = parseWindow
): void {
  nodeRegistry.register({ typeName, parser });
}
