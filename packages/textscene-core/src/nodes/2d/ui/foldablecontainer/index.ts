/**
 * FoldableContainer registration: the parser, which reads the five properties
 * that change the drawing. `foldable_group`, `title_text_direction` and
 * `language` change no static render and stay linter-only.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseFoldableContainer } from './parser';

const foldableContainerRegistration: NodeTypeRegistration = {
  typeName: 'FoldableContainer',
  parser: parseFoldableContainer,
};

nodeRegistry.register(foldableContainerRegistration);

export { foldableContainerRegistration };
