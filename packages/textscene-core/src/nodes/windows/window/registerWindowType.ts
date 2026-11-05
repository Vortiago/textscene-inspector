/** Each Window class parses through the Window parse, which reads that class's own defaults. */
import { nodeRegistry } from '../../../core/NodeRegistry';
import { parseWindow } from './parser';

export function registerWindowParser(typeName: string): void {
  nodeRegistry.register({ typeName, parser: parseWindow });
}
