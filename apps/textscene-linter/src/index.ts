/**
 * The public entry of `@textscene/linter`: the lint run, its formatters and the `res://` roots a
 * caller builds itself. The CLI stays the `tscn-lint` bin: importing this entry starts no CLI, so
 * a bundler can guess this package's entry point.
 */

export { createDiskResRoots } from '@textscene/core/resources/diskProject';

export {
  collectFileDiagnostics,
  expandTscnPaths,
  lintFile,
  lintFileDiagnostics,
  printFileResult,
  runLint,
} from './lint';
export type { CollectDiagnosticsResult, FileDiagnostics, FileLintResult, LintRunResult } from './lint';

export {
  escapeControlCharacters,
  formatDiagnostics,
  formatDim,
  formatError,
  formatFilePath,
  formatGithubAnnotation,
  formatGithubAnnotations,
  formatJson,
  formatSeverity,
  formatSuccess,
  getSeverityIcon,
  toJsonFindings,
} from './format';
export type { JsonFinding } from './format';
