#!/usr/bin/env node
/**
 * The TextScene Linter CLI lints Godot's text formats: `.tscn` scenes and
 * `.tres` resources. It walks a directory argument for both.
 */

import { readFileSync } from 'fs';
import { Command } from 'commander';
import { formatGithubAnnotations, formatJson } from './format';
import { collectFileDiagnostics, expandTscnPaths, printFileResult, runLint } from './lint';

/**
 * Reads `--version` from this package's package.json. Both src/cli.ts and the
 * bundled dist/cli.js sit one level below the package root, so
 * '../package.json' resolves from either.
 */
function getVersion(): string {
  try {
    const pkg = JSON.parse(
      readFileSync(new URL('../package.json', import.meta.url), 'utf-8')
    ) as { version?: string };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

type OutputFormat = 'text' | 'json' | 'github';
const OUTPUT_FORMATS: OutputFormat[] = ['text', 'json', 'github'];

function isOutputFormat(value: string): value is OutputFormat {
  return (OUTPUT_FORMATS as string[]).includes(value);
}

/**
 * Resolves the effective output format. An explicit `--format` always wins;
 * otherwise auto-detect `github` when running inside a GitHub Actions job
 * ($GITHUB_ACTIONS=true), falling back to the default human-readable text.
 * Throws when `--format` names something other than text/json/github.
 */
function resolveFormat(requested: string | undefined): OutputFormat {
  if (requested !== undefined) {
    if (!isOutputFormat(requested)) {
      throw new Error(`Invalid --format '${requested}'. Expected one of: ${OUTPUT_FORMATS.join(', ')}.`);
    }
    return requested;
  }

  return process.env.GITHUB_ACTIONS === 'true' ? 'github' : 'text';
}

const program = new Command();

program
  .name('tscn-lint')
  .description('Lint and validate Godot text scenes (.tscn) and resources (.tres)')
  .version(getVersion())
  .argument('<files...>', '.tscn/.tres files or directories to lint (directories are searched recursively)')
  .option('--no-color', 'Disable colored output (text format only)')
  .option(
    '--format <format>',
    `Output format: ${OUTPUT_FORMATS.join(', ')} (auto-detects "github" when $GITHUB_ACTIONS is set)`
  )
  .action((files: string[], options: { color?: boolean; format?: string }) => {
    let format: OutputFormat;
    try {
      format = resolveFormat(options.format);
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(2);
      return;
    }

    const expandedFiles = expandTscnPaths(files);

    if (format === 'text') {
      const hasColor = options.color !== false;
      const { exitCode } = runLint(expandedFiles, hasColor, printFileResult);
      process.exit(exitCode);
      return;
    }

    const { exitCode, files: fileResults } = collectFileDiagnostics(expandedFiles);

    if (format === 'json') {
      console.log(formatJson(fileResults));
    } else {
      for (const line of formatGithubAnnotations(fileResults)) {
        console.log(line);
      }
    }

    process.exit(exitCode);
  });

program.parse();
