/** RichTextLabel registration — parser. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseRichTextLabel } from './parser';

const richTextLabelRegistration: NodeTypeRegistration = {
  typeName: 'RichTextLabel',
  parser: parseRichTextLabel,
};

nodeRegistry.register(richTextLabelRegistration);

export { richTextLabelRegistration };
export * from './parser';
export * from './types';
