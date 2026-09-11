/**
 * FoldableContainer registration — parser.
 *
 * `parseFoldableContainer` reads the five own properties that change what
 * draws (`folded`, `title`, `title_alignment`, `title_position`,
 * `title_text_overrun_behavior`); `foldable_group`/`title_text_direction`/
 * `language` are behaviour-only for a static render and stay linter-only.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseFoldableContainer } from './parser';

const foldableContainerRegistration: NodeTypeRegistration = {
  typeName: 'FoldableContainer',
  parser: parseFoldableContainer,
};

nodeRegistry.register(foldableContainerRegistration);

export { foldableContainerRegistration };
