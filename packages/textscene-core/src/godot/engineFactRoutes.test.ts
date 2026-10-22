/**
 * Each engine fact has one declaration under `src/godot/` and one import route, the file that
 * declares it. A copy of an enum, or a re-export beside the declaration, gives a second route that
 * drifts from the first: two cites for one fact, and two places to fix one error.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const srcDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Every non-test `.ts` and `.tsx` file under `dir`, relative to `srcDir`, with `/` separators. */
function sourceFiles(dir: string = srcDir, prefix = ''): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const name = `${prefix}${entry.name}`;
    if (entry.isDirectory()) return sourceFiles(resolve(dir, entry.name), `${name}/`);
    const isSource = /\.tsx?$/.test(entry.name) && !entry.name.endsWith('.d.ts');
    return isSource && !/\.test\.tsx?$/.test(entry.name) ? [name] : [];
  });
}

function parse(source: string): ts.SourceFile {
  return ts.createSourceFile('file.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

/** The path a specifier names, relative to `srcDir` and without `.js`, or undefined for a package. */
function resolvedTarget(fromFile: string, specifier: string): string | undefined {
  if (!specifier.startsWith('.')) return undefined;
  return posix.join(posix.dirname(fromFile), specifier).replace(/\.js$/, '');
}

/** The specifier each imported name came from. */
function importedNames(file: ts.SourceFile): Map<string, string> {
  const specifierByName = new Map<string, string>();
  for (const statement of file.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const bindings = statement.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;
    for (const element of bindings.elements)
      specifierByName.set(element.name.text, statement.moduleSpecifier.text);
  }
  return specifierByName;
}

/**
 * The module each re-export reaches: `export { a } from './x'`, and `export { a }` of an imported
 * name. A constant that names an imported fact for its own use (`export const A = B`) is not one.
 */
function reExportedModules(source: string): string[] {
  const file = parse(source);
  const imported = importedNames(file);
  const reached: string[] = [];
  for (const statement of file.statements) {
    if (
      ts.isExportDeclaration(statement) &&
      statement.moduleSpecifier &&
      ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      reached.push(statement.moduleSpecifier.text);
    } else if (
      ts.isExportDeclaration(statement) &&
      statement.exportClause &&
      ts.isNamedExports(statement.exportClause)
    ) {
      for (const element of statement.exportClause.elements) {
        const specifier = imported.get((element.propertyName ?? element.name).text);
        if (specifier) reached.push(specifier);
      }
    }
  }
  return reached;
}

interface EnumMembers {
  name: string;
  members: ReadonlyMap<string, number>;
}

function integerOf(node: ts.Expression): number | undefined {
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (ts.isParenthesizedExpression(node)) return integerOf(node.expression);
  if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken) {
    const operand = integerOf(node.operand);
    return operand === undefined ? undefined : -operand;
  }
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.LessThanLessThanToken) {
    const [left, right] = [integerOf(node.left), integerOf(node.right)];
    return left === undefined || right === undefined ? undefined : left << right;
  }
  return undefined;
}

function enumMembers(declaration: ts.EnumDeclaration): ReadonlyMap<string, number> | undefined {
  const members = new Map<string, number>();
  let next = 0;
  for (const member of declaration.members) {
    const value = member.initializer ? integerOf(member.initializer) : next;
    if (value === undefined) return undefined;
    members.set(member.name.getText(), value);
    next = value + 1;
  }
  return members;
}

/**
 * An object literal whose every member is an integer, which is how `as const` enums are written.
 * Members that are all one letter make it a vector or a colour (`{ x: 1, y: 0 }`), not an enum.
 */
function objectLiteralMembers(literal: ts.ObjectLiteralExpression): ReadonlyMap<string, number> | undefined {
  const members = new Map<string, number>();
  for (const property of literal.properties) {
    const value = ts.isPropertyAssignment(property) ? integerOf(property.initializer) : undefined;
    const name = property.name?.getText().replace(/^['"]|['"]$/g, '');
    if (value === undefined || !name) return undefined;
    members.set(name, value);
  }
  const isCoordinates = [...members.keys()].every((name) => name.length === 1);
  return members.size > 0 && !isCoordinates ? members : undefined;
}

function enumsIn(source: string): { tsEnums: EnumMembers[]; objects: EnumMembers[] } {
  const tsEnums: EnumMembers[] = [];
  const objects: EnumMembers[] = [];
  for (const statement of parse(source).statements) {
    if (ts.isEnumDeclaration(statement)) {
      const members = enumMembers(statement);
      if (members) tsEnums.push({ name: statement.name.text, members });
    } else if (ts.isVariableStatement(statement)) {
      for (const { name, initializer } of statement.declarationList.declarations) {
        let value = initializer;
        while (value && (ts.isAsExpression(value) || ts.isSatisfiesExpression(value)))
          value = value.expression;
        const members =
          value && ts.isObjectLiteralExpression(value) ? objectLiteralMembers(value) : undefined;
        if (members && ts.isIdentifier(name)) objects.push({ name: name.text, members });
      }
    }
  }
  return { tsEnums, objects };
}

const spelling = (name: string): string => name.toLowerCase().replace(/_/g, '');

/** True when every member of `candidate` is a member of `engine`, by spelling and value. */
function copiesMembersOf(candidate: EnumMembers, engine: EnumMembers): boolean {
  const engineBySpelling = new Map([...engine.members].map(([name, value]) => [spelling(name), value]));
  return [...candidate.members].every(([name, value]) => engineBySpelling.get(spelling(name)) === value);
}

const isInGodot = (file: string): boolean => file.startsWith('godot/');
const isInGodotGroup = (file: string): boolean => /^godot\/[^/]+\//.test(file);
const read = (file: string): string => readFileSync(resolve(srcDir, file), 'utf8');

describe('detecting a re-export', () => {
  it('sees a re-export from a specifier', () => {
    expect(reExportedModules("export { a } from './x.js';")).toEqual(['./x.js']);
    expect(reExportedModules("export type { A } from './x.js';")).toEqual(['./x.js']);
  });

  it('sees a re-export of an imported name', () => {
    expect(reExportedModules("import { a } from './x.js';\nexport { a };")).toEqual(['./x.js']);
    expect(reExportedModules("import { a as b } from './x.js';\nexport { b };")).toEqual(['./x.js']);
  });

  it('passes a name the file declares itself', () => {
    expect(reExportedModules("import { a } from './x.js';\nconst b = a;\nexport { b };")).toEqual([]);
    expect(reExportedModules("import { a } from './x.js';\nexport const b = a;")).toEqual([]);
  });
});

describe('detecting an engine enum', () => {
  it('reads a TypeScript enum with its implicit and written values', () => {
    const { tsEnums } = enumsIn('export enum E { A, B = 5, C }');
    expect(tsEnums[0]?.members).toEqual(
      new Map([
        ['A', 0],
        ['B', 5],
        ['C', 6],
      ])
    );
  });

  it('reads an as-const object of integers and skips one with other values', () => {
    const { objects } = enumsIn(
      "const E = { FIRST: 0, SECOND: 1 << 2 } as const;\nconst F = { FIRST: 'x' };"
    );
    expect(objects.map(({ name }) => name)).toEqual(['E']);
    expect(objects[0]?.members).toEqual(
      new Map([
        ['FIRST', 0],
        ['SECOND', 4],
      ])
    );
  });

  it('counts a spelling that differs by case and underscores as the same member', () => {
    const engine = { name: 'E', members: new Map([['ONE_SHOT', 1]]) };
    expect(copiesMembersOf({ name: 'C', members: new Map([['OneShot', 1]]) }, engine)).toBe(true);
    expect(copiesMembersOf({ name: 'C', members: new Map([['OneShot', 2]]) }, engine)).toBe(false);
  });
});

describe('src/godot is the one route to an engine fact', () => {
  const files = sourceFiles();

  it('finds the source files, so the sweeps cannot pass vacuously', () => {
    expect(files).toContain('godot/math/math.ts');
    expect(files).toContain('linter/validators/commonValidators.ts');
  });

  it('is not re-exported by any module outside it', () => {
    const violations = files
      .filter((file) => !isInGodot(file))
      .flatMap((file) =>
        reExportedModules(read(file))
          .filter((specifier) => resolvedTarget(file, specifier)?.startsWith('godot/'))
          .map((specifier) => `${file} re-exports from '${specifier}'`)
      );
    expect(violations, 'import the fact from the file under godot/ that declares it').toEqual([]);
  });

  it('has no barrel inside a group', () => {
    const violations = files.filter(isInGodotGroup).flatMap((file) =>
      reExportedModules(read(file))
        .filter((specifier) => resolvedTarget(file, specifier)?.startsWith('godot/'))
        .map((specifier) => `${file} re-exports from '${specifier}'`)
    );
    expect(violations, 'a group has no barrel (ARCHITECTURE.md)').toEqual([]);
  });

  it('declares no engine enum outside it as a TypeScript enum', () => {
    const violations = files
      .filter((file) => !isInGodot(file))
      .flatMap((file) => enumsIn(read(file)).tsEnums.map(({ name }) => `${file} declares enum ${name}`));
    expect(violations, 'declare the enum under godot/, with its Godot cite').toEqual([]);
  });

  it('copies no godot/ enum as an object outside it', () => {
    const engineEnums = files.filter(isInGodot).flatMap((file) => {
      const { tsEnums, objects } = enumsIn(read(file));
      return [...tsEnums, ...objects]
        .filter(({ members }) => members.size >= 2)
        .map((found) => ({ ...found, file }));
    });
    const violations = files
      .filter((file) => !isInGodot(file))
      .flatMap((file) =>
        enumsIn(read(file)).objects.flatMap((candidate) => {
          const copied =
            candidate.members.size >= 2 && engineEnums.find((engine) => copiesMembersOf(candidate, engine));
          return copied ? [`${file}: ${candidate.name} copies ${copied.file} ${copied.name}`] : [];
        })
      );
    expect(violations, 'import the enum from godot/ instead').toEqual([]);
  });
});
