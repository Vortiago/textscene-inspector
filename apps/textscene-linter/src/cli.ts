#!/usr/bin/env node
/**
 * TSCN Linter CLI - Command-line tool for linting .tscn files
 */

import { readFileSync } from 'fs';
import { Command } from 'commander';
import { printFileResult, runLint } from './lint';

/**
 * Reads the version from this package's own package.json so `--version`
 * stays in sync with releases. Both src/cli.ts and the bundled dist/cli.js
 * sit one level below the package root, so '../package.json' resolves
 * correctly from either location.
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

const program = new Command();

program
  .name('tscn-lint')
  .description('Lint and validate Godot TSCN files')
  .version(getVersion())
  .argument('<files...>', 'TSCN files to lint')
  .option('--no-color', 'Disable colored output')
  .action((files: string[], options: { color?: boolean }) => {
    const hasColor = options.color !== false;
    const { exitCode } = runLint(files, hasColor, printFileResult);

    // Exit with error code if any errors found
    process.exit(exitCode);
  });

// Parse and execute
program.parse();
