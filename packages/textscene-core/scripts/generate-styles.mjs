#!/usr/bin/env node
/* eslint-disable no-undef */
/**
 * Generates styles.ts from styles.css for better IDE support.
 * Run this script after editing styles.css to sync changes.
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const cssPath = join(__dirname, '../src/ui/styles.css');
const tsPath = join(__dirname, '../src/ui/styles.ts');

try {
  const cssContent = readFileSync(cssPath, 'utf-8');

  const tsContent = `/**
 * Shared CSS styles for TSCN preview UI components.
 * Used by both web app and VS Code extension.
 *
 * AUTO-GENERATED from styles.css - DO NOT EDIT DIRECTLY
 * Edit styles.css and run 'pnpm generate:styles' to update this file
 */

export const sharedStyles = \`${cssContent}\`;
`;

  writeFileSync(tsPath, tsContent, 'utf-8');
  console.log('✅ Generated styles.ts from styles.css');
} catch (error) {
  console.error('❌ Error generating styles.ts:', error.message);
  process.exit(1);
}
