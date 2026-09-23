export {
  walkImportClosure,
  bareSpecifiers,
  tsxFiles,
  FRAMEWORK_BARE_RE,
  NODE_BUILTIN_RE,
} from './importClosure';
export type { ImportClosure, WalkImportClosureOptions } from './importClosure';
export { commentSpans, stripComments } from './commentSpans';
export {
  commentBlocks,
  commentViolations,
  isGeneratedSource,
  markdownViolations,
  surfaceViolations,
  tscnCommentBlocks,
} from './proseRules';
export type { CommentBlock, ProseViolation } from './proseRules';
