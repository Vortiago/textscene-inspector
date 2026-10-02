#!/usr/bin/env node
/**
 * PostToolUse hook for Edit, Write and MultiEdit: runs the STE checks of `sheets.test.mjs` on a
 * comparison sheet the tool just changed. It exits 2 with the violations on stderr, which Claude
 * Code shows to Claude, and 0 for a passing sheet and for every other file.
 */

import { readFileSync } from 'node:fs';
import { relative } from 'node:path';

import { findProseViolations, formatViolation, isSheetPath } from '../../scripts/compare-docs/sheetProse.mjs';

/** Exit status that makes Claude Code show stderr to Claude. The edit has already happened. */
const REPORT = 2;

/** The edited file in the hook input, or an empty string when the input holds none. */
function readFilePath() {
  try {
    return JSON.parse(readFileSync(0, 'utf8')).tool_input?.file_path ?? '';
  } catch {
    // Unreadable input names no sheet to check, and a crash here must not interrupt the edit.
    return '';
  }
}

/** The sheet's text, or null when the file is gone. */
function readSheet(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    // A sheet the edit removed or never wrote has no prose to check.
    return null;
  }
}

const path = readFilePath();
const text = isSheetPath(path) ? readSheet(path) : null;
const violations = text === null ? [] : findProseViolations(text);
if (violations.length > 0) {
  const inProject = relative(process.env.CLAUDE_PROJECT_DIR ?? process.cwd(), path);
  const label = inProject.startsWith('..') ? path : inProject;
  console.error(
    `${label} breaks the Simplified Technical English checks of the sheet standard ` +
      '(scripts/compare-docs/SHEET-STANDARD.md). Fix each line now:\n' +
      violations.map((v) => formatViolation(label, v)).join('\n')
  );
  process.exit(REPORT);
}
