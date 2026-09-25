/**
 * Structural checks for syntaxes/tscn.tmLanguage.json, not full tokenization,
 * which needs vscode-textmate, vscode-oniguruma and a .wasm. The grammar parses,
 * every `#` include resolves (VS Code drops a dangling one without error), and its
 * regexes match the tokens the core parser (`parser/utils.ts`) scans for.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const GRAMMAR_PATH = join(import.meta.dirname, '..', 'syntaxes', 'tscn.tmLanguage.json');

interface GrammarRule {
  include?: string;
  match?: string;
  begin?: string;
  end?: string;
  name?: string;
  patterns?: GrammarRule[];
  captures?: Record<string, { name: string }>;
  beginCaptures?: Record<string, { name: string }>;
  endCaptures?: Record<string, { name: string }>;
}

interface Grammar {
  name: string;
  scopeName: string;
  patterns: GrammarRule[];
  repository: Record<string, GrammarRule>;
}

function loadGrammar(): Grammar {
  return JSON.parse(readFileSync(GRAMMAR_PATH, 'utf-8')) as Grammar;
}

/** Recursively collects every `#name` that an `{"include": "#name"}` references. */
function collectIncludes(node: unknown, found: Set<string>): void {
  if (Array.isArray(node)) {
    for (const item of node) collectIncludes(item, found);
    return;
  }
  if (node && typeof node === 'object') {
    const record = node as Record<string, unknown>;
    if (typeof record.include === 'string' && record.include.startsWith('#')) {
      found.add(record.include.slice(1));
    }
    for (const value of Object.values(record)) {
      collectIncludes(value, found);
    }
  }
}

describe('tscn.tmLanguage.json', () => {
  it('parses as valid JSON', () => {
    expect(() => loadGrammar()).not.toThrow();
  });

  it('declares the source.tscn scope registered in package.json\'s grammars contribution', () => {
    const grammar = loadGrammar();
    expect(grammar.scopeName).toBe('source.tscn');
  });

  it('registers the tscn language\'s grammar scope in package.json', () => {
    const packageJson = JSON.parse(
      readFileSync(join(import.meta.dirname, '..', 'package.json'), 'utf-8')
    ) as {
      contributes: { grammars: Array<{ language: string; scopeName: string; path: string }> };
    };
    const entry = packageJson.contributes.grammars.find((g) => g.language === 'tscn');
    expect(entry).toBeDefined();
    expect(entry!.scopeName).toBe('source.tscn');
    expect(entry!.path).toBe('./syntaxes/tscn.tmLanguage.json');
  });

  it('top-level patterns cover comments, headings, properties, and bare values', () => {
    const grammar = loadGrammar();
    const includes = grammar.patterns.map((p) => p.include);
    expect(includes).toEqual(
      expect.arrayContaining(['#comments', '#heading', '#property', '#value'])
    );
  });

  it('every #-reference resolves to a real repository entry (no dangling includes)', () => {
    const grammar = loadGrammar();
    const repoKeys = new Set(Object.keys(grammar.repository));
    const found = new Set<string>();
    collectIncludes(grammar.patterns, found);
    collectIncludes(grammar.repository, found);

    expect(found.size).toBeGreaterThan(0);
    for (const key of found) {
      expect(repoKeys.has(key)).toBe(true);
    }
  });

  it('recognizes every TSCN section keyword the core parser scans for', () => {
    const grammar = loadGrammar();
    const sectionRule = grammar.repository.heading!.patterns!.find(
      (p) => p.name === 'entity.name.tag.section.tscn'
    );
    expect(sectionRule).toBeDefined();
    const regex = new RegExp(sectionRule!.match!);

    // Mirrors SECTION_HEADING_RE in packages/textscene-core/src/parser/utils.ts.
    const sectionKeywords = [
      'gd_scene',
      'gd_resource',
      'ext_resource',
      'sub_resource',
      'node',
      'resource',
      'connection',
      'editable',
    ];
    for (const keyword of sectionKeywords) {
      expect(regex.test(keyword)).toBe(true);
    }
  });

  it('numeric pattern recognizes ints, decimals, negatives, and scientific notation', () => {
    const grammar = loadGrammar();
    const regex = new RegExp(grammar.repository.numeric!.match!);
    for (const value of ['3', '-3', '1.5', '-0.25', '1e-05', '1.0E+10']) {
      expect(regex.test(value)).toBe(true);
    }
  });

  it('resourceCall begin pattern matches Godot\'s typed-literal constructors', () => {
    const grammar = loadGrammar();
    const regex = new RegExp(grammar.repository.resourceCall!.begin!);
    for (const literal of [
      'SubResource(',
      'ExtResource(',
      'NodePath(',
      'Color(',
      'Vector3(',
      'PackedFloat32Array(',
      'Transform3D(',
    ]) {
      expect(regex.test(literal)).toBe(true);
    }
  });

  it('dictKey pattern only matches a quoted string immediately followed by a colon', () => {
    const grammar = loadGrammar();
    const regex = new RegExp(grammar.repository.dictKey!.match!);
    expect(regex.test('"times":')).toBe(true);
    expect(regex.test('"times" :')).toBe(true);
    expect(regex.test('"plain string value"')).toBe(false);
  });
});
