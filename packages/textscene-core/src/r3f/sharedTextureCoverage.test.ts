/**
 * Every texture a module holds, rather than a component, a pass or an instance, frees itself from
 * each renderer when a canvas unmounts, through `releasedOnUnmount` (`sharedTexture.ts`). three's
 * dispose listener on an uploaded texture closes over the renderer, so a module-held texture that
 * misses the release keeps every unmounted canvas's renderer reachable.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const srcDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** The modules that hold a texture three frees another way, each with that way. */
const FREED_OTHERWISE: Record<string, string> = {
  'r3f/fog/fogUniforms.ts':
    "Each pass draws its texture as its own render target's, and three frees it with the target.",
  'r3f/reflectionProbe/probeSlots.ts':
    "A slot shows another texture's handle and its version stays 0, so no renderer uploads it.",
  'r3f/sky/skyLayerCubes.ts':
    "A slot shows another texture's handle and its version stays 0, so no renderer uploads it.",
};

/** Every non-test `.ts` and `.tsx` file under `dir`, relative to `srcDir`. */
function sourceFiles(dir: string, prefix = ''): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const name = `${prefix}${entry.name}`;
    if (entry.isDirectory()) return sourceFiles(resolve(dir, entry.name), `${name}/`);
    return /\.tsx?$/.test(entry.name) && !/\.(?:test|testkit)\.tsx?$/.test(entry.name) ? [name] : [];
  });
}

/** The scope that owns what `node` builds: a function, an instance's field, or none for the module. */
function owner(node: ts.Node): ts.Node | undefined {
  for (let at = node.parent; at; at = at.parent) {
    if (ts.isFunctionLike(at)) return at;
    if (ts.isPropertyDeclaration(at) && !at.modifiers?.some((m) => m.kind === ts.SyntaxKind.StaticKeyword))
      return at;
  }
  return undefined;
}

/** A module's view of its own source: its top-level names, texture classes and texture factories. */
class Module {
  readonly bindings = new Set<string>();
  readonly textureClasses = new Set<string>();
  readonly factories = new Set<string>();

  constructor(readonly source: ts.SourceFile) {
    for (const statement of source.statements) {
      if (ts.isVariableStatement(statement)) {
        for (const { name } of statement.declarationList.declarations) {
          if (ts.isIdentifier(name)) this.bindings.add(name.text);
        }
      }
      if (
        ts.isClassDeclaration(statement) &&
        statement.name &&
        /sharedTexture\(|Texture\b/.test(heritage(statement))
      )
        this.textureClasses.add(statement.name.text);
    }
    this.findFactories();
  }

  /** Whether `node` builds a texture: a constructor, a loader, or a call of this module's factory. */
  builds(node: ts.Node): boolean {
    if (ts.isNewExpression(node)) {
      const name = node.expression.getText();
      return /(?:^|\.)\w*Texture$/.test(name) || this.textureClasses.has(name);
    }
    if (!ts.isCallExpression(node)) return false;
    const callee = node.expression;
    if (ts.isIdentifier(callee)) return this.factories.has(callee.text);
    return (
      ts.isPropertyAccessExpression(callee) &&
      callee.name.text === 'load' &&
      /TextureLoader\(\)$/.test(callee.expression.getText())
    );
  }

  /** The lines of each texture this module keeps past every component. */
  heldTextureLines(): number[] {
    const lines: number[] = [];
    this.visit(this.source, (node) => {
      if (this.builds(node) && this.isHeld(node))
        lines.push(this.source.getLineAndCharacterOfPosition(node.getStart()).line + 1);
    });
    return lines;
  }

  /** A top-level function that builds a texture hands it on, so a call of it builds one too. */
  private findFactories(): void {
    let found = true;
    while (found) {
      found = false;
      for (const statement of this.source.statements) {
        if (
          !ts.isFunctionDeclaration(statement) ||
          !statement.name ||
          this.factories.has(statement.name.text)
        )
          continue;
        if (this.some(statement, (node) => this.builds(node))) {
          this.factories.add(statement.name.text);
          found = true;
        }
      }
    }
  }

  private isHeld(node: ts.Node): boolean {
    if (isInstalled(node)) return true;
    const scope = owner(node);
    if (!scope) return true;
    if (!ts.isFunctionLike(scope)) return false;
    return runsAtModuleScope(scope) || this.some(scope, (inner) => this.writesBinding(inner));
  }

  /** `binding = …`, `binding ??= …` or `binding.set(…)` for a top-level `binding`. */
  private writesBinding(node: ts.Node): boolean {
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
      node.operatorToken.kind <= ts.SyntaxKind.LastAssignment
    )
      return ts.isIdentifier(node.left) && this.bindings.has(node.left.text);
    return (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'set' &&
      ts.isIdentifier(node.expression.expression) &&
      this.bindings.has(node.expression.expression.text)
    );
  }

  private some(root: ts.Node, test: (node: ts.Node) => boolean): boolean {
    let found = false;
    this.visit(root, (node) => {
      found ||= test(node);
    });
    return found;
  }

  private visit(root: ts.Node, at: (node: ts.Node) => void): void {
    const walk = (node: ts.Node): void => {
      at(node);
      ts.forEachChild(node, walk);
    };
    ts.forEachChild(root, walk);
  }
}

function heritage(declaration: ts.ClassDeclaration): string {
  return (declaration.heritageClauses ?? []).map((clause) => clause.getText()).join(' ');
}

/** Whether `fn` runs as the module loads: invoked at once, or handed to a call that runs then. */
function runsAtModuleScope(fn: ts.SignatureDeclaration): boolean {
  let at: ts.Node = fn.parent;
  while (ts.isParenthesizedExpression(at)) at = at.parent;
  if (!ts.isCallExpression(at)) return false;
  const scope = owner(at);
  return scope === undefined || (ts.isFunctionLike(scope) && runsAtModuleScope(scope));
}

/** Whether `node` reaches an `install…` call, which hands it to every material, through any wrapper. */
function isInstalled(node: ts.Node): boolean {
  const call = node.parent;
  if (!ts.isCallExpression(call) || !call.arguments.includes(node as ts.Expression)) return false;
  return /(?:^|\.)install\w*$/.test(call.expression.getText()) || isInstalled(call);
}

function moduleOf(path: string): Module {
  const text = readFileSync(resolve(srcDir, path), 'utf8');
  return new Module(ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true));
}

const holders = sourceFiles(srcDir)
  .map((path) => ({ path, lines: moduleOf(path).heldTextureLines() }))
  .filter(({ lines }) => lines.length > 0);

describe('module-held textures', () => {
  it('finds the modules known to hold one, so the sweep cannot pass vacuously', () => {
    expect(holders.map(({ path }) => path)).toEqual(
      expect.arrayContaining([
        'r3f/materials/defaultWhiteTexture.ts',
        'r3f/areaLight/ltcTextures.ts',
        'r3f/godotIndirectSpecular.ts',
        'r3f/lighting2d/useCanvasItemLighting.ts',
      ])
    );
  });

  it('keeps no exception for a module that holds no texture (edge case)', () => {
    const paths = holders.map(({ path }) => path);
    expect(Object.keys(FREED_OTHERWISE).filter((path) => !paths.includes(path))).toEqual([]);
  });

  it.each(holders)('$path releases each texture it holds on unmount', ({ path, lines }) => {
    const releases = readFileSync(resolve(srcDir, path), 'utf8').includes('releasedOnUnmount(');
    expect(releases || path in FREED_OTHERWISE, `textures held at lines ${lines.join(', ')}`).toBe(true);
  });
});
