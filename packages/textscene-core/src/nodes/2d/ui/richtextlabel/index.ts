/** RichTextLabel registration — parser. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseRichTextLabel, isRichTextLabel } from './parser';

const richTextLabelRegistration: NodeTypeRegistration = {
  typeName: 'RichTextLabel',
  typeGuard: isRichTextLabel,
  parser: parseRichTextLabel,
};

nodeRegistry.register(richTextLabelRegistration);

export { richTextLabelRegistration };
export * from './parser';
export * from './types';
