export {
  walkImportClosure,
  bareSpecifiers,
  tsxFiles,
  FRAMEWORK_BARE_RE,
  NODE_BUILTIN_RE,
} from './importClosure';
export type { ImportClosure, WalkImportClosureOptions } from './importClosure';
export { commentSpans, stripComments } from './commentSpans';
export { escapeRegExp } from './regExp';
export { answersFixtureDir, cursorIn, loadAnswers, rangeTuple, sortedRanges } from './languageFeatureAnswers';
export type { CursorSpec, LanguageFeatureAnswers, RangeTuple } from './languageFeatureAnswers';
