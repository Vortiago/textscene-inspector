import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const shadersDir = dirname(fileURLToPath(import.meta.url));

/** three's ways to hand it shader text, by the name a file imports or calls. */
const TEXT_ESCAPES = new Set([
  'glslFn',
  'wgslFn',
  'glsl',
  'wgsl',
  'js',
  'code',
  'CodeNode',
  'FunctionNode',
  'ShaderMaterial',
  'RawShaderMaterial',
  'onBeforeCompile',
  'addLineFlowCode',
  'addFlowCode',
  'getMethod',
]);

/**
 * The Node subclasses that may define `generate`, each with why it writes no text. A subclass
 * that writes text into the builder's code would go around three's TSL nodes.
 */
const NODE_SUBCLASSES_ALLOWED: Readonly<Record<string, string>> = {
  WholeArray: 'generate() returns the build of the TSL node it wraps and changes only its type',
};

/**
 * Text of GLSL or WGSL source: a call built around an interpolation, or a form only shader source
 * has. A `gl_` name is left out: the template stages read `gl_FragCoord` and the rest as input names.
 */
const SHADER_SOURCE =
  /\w\s*\(\s*\$\{|bitcast<|\b[biu]?vec[234]<|\bmat[234]x[234]<|#version|\bvoid\s+main\b|\bfn\s+\w+\s*\(|\blayout\s*\(|\breturn\s+[^;]*;/;

/** A breach of the rule: the file, the line and what it does. */
type Breach = string;

const isThreeImport = (node: ts.Node): node is ts.ImportDeclaration =>
  ts.isImportDeclaration(node) &&
  ts.isStringLiteral(node.moduleSpecifier) &&
  /^three(\/|$)/.test(node.moduleSpecifier.text);

/** The text of a string or template literal, with each interpolation as `${}`. */
function literalText(node: ts.Node): string | undefined {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isTemplateExpression(node))
    return node.head.text + node.templateSpans.map((span) => `\${}${span.literal.text}`).join('');
  return undefined;
}

/** The breaches of the rule in the source `text` of the file `name`, or none off the emit path. */
export function shaderTextBreaches(name: string, text: string): Breach[] {
  const file = ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true);
  if (!file.statements.some(isThreeImport)) return [];
  const breaches: Breach[] = [];
  const at = (node: ts.Node, what: string) =>
    breaches.push(`${name}:${file.getLineAndCharacterOfPosition(node.getStart()).line + 1} ${what}`);
  const visit = (node: ts.Node) => {
    if (
      ts.isImportSpecifier(node) &&
      isThreeImport(node.parent.parent.parent) &&
      TEXT_ESCAPES.has(node.name.text)
    )
      at(node, `imports three's text escape ${node.name.text}`);
    if (ts.isPropertyAccessExpression(node) && TEXT_ESCAPES.has(node.name.text))
      at(node, `calls three's text escape ${node.name.text}`);
    if (ts.isClassDeclaration(node) && node.heritageClauses && node.name) {
      const writes = node.members.some(
        (member) => ts.isMethodDeclaration(member) && member.name.getText(file) === 'generate'
      );
      if (writes && !(node.name.text in NODE_SUBCLASSES_ALLOWED))
        at(node, `defines generate() in the Node subclass ${node.name.text}`);
    }
    const literal = literalText(node);
    if (literal !== undefined && SHADER_SOURCE.test(literal))
      at(node, `holds shader source ${JSON.stringify(literal.slice(0, 60))}`);
    if (!ts.isTemplateExpression(node)) ts.forEachChild(node, visit);
    else node.templateSpans.forEach((span) => visit(span.expression));
  };
  visit(file);
  return breaches;
}

/** Each source file of the module but a test and a test kit. */
const moduleFiles = readdirSync(shadersDir, { recursive: true, encoding: 'utf8' })
  .filter((name) => /\.ts$/.test(name) && !/\.(test|testkit)\.ts$/.test(name))
  .map((name) => join(shadersDir, name));

describe('shader text rule (ADR-0074)', () => {
  it('finds no shader text in the emit path', () => {
    const breaches = moduleFiles.flatMap((file) =>
      shaderTextBreaches(relative(shadersDir, file), readFileSync(file, 'utf8'))
    );

    expect(breaches).toEqual([]);
  });

  it('reads the emit path as the files that import three', () => {
    const emitPath = moduleFiles.filter((file) =>
      ts
        .createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest)
        .statements.some(isThreeImport)
    );

    expect(emitPath.map((file) => relative(shadersDir, file))).toContain('language/emitBuiltIn.ts');
  });

  it('finds each breach in a node that writes its call as text', () => {
    const fixture = readFileSync(join(shadersDir, 'shaderTextRule.fixtures/textWritingNode.txt'), 'utf8');

    const breaches = shaderTextBreaches('textWritingNode.ts', fixture).map((breach) =>
      breach.replace(/^\S+ /, '')
    );

    expect(breaches).toEqual([
      "imports three's text escape glslFn",
      'defines generate() in the Node subclass BuiltInCallNode',
      "calls three's text escape addLineFlowCode",
      'holds shader source "${} = modf( ${} ).whole"',
      'holds shader source "round( ${} )"',
      'holds shader source "vec2<f32>( bitcast<f32>( 0x7f800000u ) )"',
      'holds shader source "float f(float x) { return x; }"',
    ]);
  });

  it('finds nothing in a file that imports no three', () => {
    expect(shaderTextBreaches('parse.ts', "const message = 'return sin(a);';")).toEqual([]);
  });
});
