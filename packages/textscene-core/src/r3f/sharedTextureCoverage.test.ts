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
  'r3f/decal/decalSlots.ts':
    "A slot shows another texture's handle and its version stays 0, so no renderer uploads it.",
  'r3f/sceneRows/sceneRowsSlot.ts':
    "A slot shows another texture's handle and its version stays 0, so no renderer uploads it.",
  'r3f/reflectionProbe/probeSlots.ts':
    "A slot shows another texture's handle and its version stays 0, so no renderer uploads it.",
  'r3f/sky/skyLayerArray.ts':
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

/** A top-level function: a declaration, or a `const` that holds an arrow or a function expression. */
function topLevelFunction(statement: ts.Statement): { name: string; body: ts.Node } | undefined {
  if (ts.isFunctionDeclaration(statement) && statement.name)
    return { name: statement.name.text, body: statement };
  if (!ts.isVariableStatement(statement)) return undefined;
  const [declaration] = statement.declarationList.declarations;
  const { initializer } = declaration ?? {};
  if (!declaration || !ts.isIdentifier(declaration.name) || !initializer) return undefined;
  if (!ts.isArrowFunction(initializer) && !ts.isFunctionExpression(initializer)) return undefined;
  return { name: declaration.name.text, body: initializer };
}

/** The factories another module exports that build a texture for each call. */
const IMPORTED_FACTORIES = new Set(['installedSlot']);

function isReleaseCall(node: ts.Node): boolean {
  return (
    ts.isCallExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === 'releasedOnUnmount'
  );
}

/**
 * A module's view of its own source: its top-level names, its texture classes, the factories that
 * build a texture and the factories that release each texture they build.
 */
class Module {
  readonly bindings = new Set<string>();
  readonly textureClasses = new Set<string>();
  readonly factories = new Set<string>();
  readonly releasingFactories = new Set<string>();

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
    this.findFactories(this.factories, (node) => this.builds(node));
    this.findFactories(
      this.releasingFactories,
      (node) => isReleaseCall(node) || this.calls(node, this.releasingFactories)
    );
  }

  /** Whether `node` builds a texture: a constructor, a loader, or a call of a factory. */
  builds(node: ts.Node): boolean {
    if (ts.isNewExpression(node)) {
      const name = node.expression.getText();
      return /(?:^|\.)\w*Texture$/.test(name) || this.textureClasses.has(name);
    }
    if (!ts.isCallExpression(node)) return false;
    const callee = node.expression;
    if (ts.isIdentifier(callee))
      return IMPORTED_FACTORIES.has(callee.text) || this.calls(node, this.factories);
    return (
      ts.isPropertyAccessExpression(callee) &&
      callee.name.text === 'load' &&
      /TextureLoader\(\)$/.test(callee.expression.getText())
    );
  }

  /** Each texture this module keeps past every component, with whether it is released on unmount. */
  heldTextures(): { line: number; isReleased: boolean }[] {
    const held: { line: number; isReleased: boolean }[] = [];
    this.visit(this.source, (node) => {
      if (!this.builds(node) || !this.isHeld(node)) return;
      const line = this.source.getLineAndCharacterOfPosition(node.getStart()).line + 1;
      held.push({ line, isReleased: this.isReleased(node) });
    });
    return held;
  }

  private calls(node: ts.Node, functions: ReadonlySet<string>): boolean {
    return (
      ts.isCallExpression(node) && ts.isIdentifier(node.expression) && functions.has(node.expression.text)
    );
  }

  /** Adds to `found` each top-level function whose body passes `test`, until no more join. */
  private findFactories(found: Set<string>, test: (node: ts.Node) => boolean): void {
    let isGrowing = true;
    while (isGrowing) {
      isGrowing = false;
      for (const statement of this.source.statements) {
        const fn = topLevelFunction(statement);
        if (!fn || found.has(fn.name) || !this.some(fn.body, test)) continue;
        found.add(fn.name);
        isGrowing = true;
      }
    }
  }

  /**
   * Whether `node` reaches `releasedOnUnmount`: as its argument through any wrapper, as a call of a
   * factory that releases, or in a function that releases what it builds.
   */
  private isReleased(node: ts.Node): boolean {
    if (this.calls(node, this.releasingFactories)) return true;
    for (let at = node.parent; at; at = at.parent) if (isReleaseCall(at)) return true;
    const scope = owner(node);
    return scope !== undefined && ts.isFunctionLike(scope) && this.some(scope, isReleaseCall);
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
  .map((path) => ({ path, textures: moduleOf(path).heldTextures() }))
  .filter(({ textures }) => textures.length > 0);

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

  it.each(holders)('$path releases each texture it holds on unmount', ({ path, textures }) => {
    const unreleasedLines = textures.filter(({ isReleased }) => !isReleased).map(({ line }) => line);
    expect(path in FREED_OTHERWISE ? [] : unreleasedLines).toEqual([]);
  });
});
