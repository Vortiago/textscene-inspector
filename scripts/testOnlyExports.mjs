/**
 * Lists the value exports of a package's source tree that no production file imports. Such an
 * export widens a module's interface for its tests alone, so a test reaches past the interface it
 * should go through. The scan is syntactic: it follows relative imports and re-exports, so it runs
 * in seconds over thousands of files where a type-checker program takes minutes.
 */

import ts from 'typescript';
import { readFileSync, readdirSync } from 'node:fs';
import { join, posix, relative } from 'node:path';

const SOURCE_RE = /\.tsx?$/;
const TEST_RE = /\.(test|spec|testkit)\.tsx?$|(^|\/)testing\//;
const DYNAMIC_IMPORT_RE = /\bimport\s*\(/;

/** A test, a test kit or a file under `testing/` is a test file. Its imports prove nothing. */
export function isTestFile(path) {
  return TEST_RE.test(path);
}

/** Every `.ts` and `.tsx` file under `dir`, keyed by its path relative to `dir`, POSIX-style. */
export function readSourceTree(dir) {
  const files = new Map();
  const walk = (abs) => {
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      const child = join(abs, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules') walk(child);
      } else if (SOURCE_RE.test(entry.name) && !entry.name.endsWith('.d.ts')) {
        files.set(relative(dir, child).split('\\').join('/'), readFileSync(child, 'utf8'));
      }
    }
  };
  walk(dir);
  return files;
}

/**
 * The resolved file for a relative specifier, or nothing for a bare package or a file outside
 * the tree. Bundler resolution maps `./x.js` to `./x.ts`, and `./dir` to `./dir/index.ts`.
 */
function resolveSpecifier(files, fromPath, specifier) {
  if (!specifier.startsWith('.')) return undefined;
  const base = posix.normalize(posix.join(posix.dirname(fromPath), specifier));
  const stem = base.replace(/\.(m?js|jsx)$/, '');
  const candidates = [base, `${stem}.ts`, `${stem}.tsx`, `${base}/index.ts`, `${base}/index.tsx`];
  return candidates.find((candidate) => files.has(candidate));
}

function isTypeDeclaration(statement) {
  return ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement);
}

function declaredNames(statement) {
  if (ts.isVariableStatement(statement)) {
    return statement.declarationList.declarations.flatMap((d) =>
      ts.isIdentifier(d.name) ? [d.name.text] : []
    );
  }
  return statement.name && ts.isIdentifier(statement.name) ? [statement.name.text] : [];
}

/**
 * One file's module record. `own` holds the names it declares and exports. `aliases` maps an
 * exported name to the `[file, name]` it forwards, and `stars` holds the files `export *` forwards.
 * `uses` holds the `[file, name]` pairs it imports, with `*` for a whole module.
 */
function parseModule(files, path, text) {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, false);
  const record = { own: new Map(), aliases: new Map(), stars: [], uses: [] };
  const imported = new Map();
  const localTypes = new Set(
    source.statements.filter(isTypeDeclaration).flatMap((statement) => declaredNames(statement))
  );

  const visitDynamic = (node) => {
    const thenImport = dynamicImportOfThen(node);
    if (thenImport) {
      const target = resolveDynamic(files, path, thenImport.call);
      if (target) for (const name of thenImport.names) record.uses.push([target, name]);
      for (const arg of node.arguments) ts.forEachChild(arg, visitDynamic);
      return;
    }
    if (isDynamicImport(node)) {
      const target = resolveDynamic(files, path, node);
      if (target) record.uses.push([target, '*']);
    }
    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
      const literal = node.argument.literal;
      const target = ts.isStringLiteral(literal) && resolveSpecifier(files, path, literal.text);
      if (target) record.uses.push([target, node.qualifier ? qualifierHead(node.qualifier) : '*']);
    }
    ts.forEachChild(node, visitDynamic);
  };

  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement)) {
      const target = resolveSpecifier(files, path, statement.moduleSpecifier.text);
      const clause = statement.importClause;
      if (!target || !clause) continue;
      if (clause.name) {
        record.uses.push([target, 'default']);
        imported.set(clause.name.text, [target, 'default']);
      }
      const bindings = clause.namedBindings;
      if (bindings && ts.isNamespaceImport(bindings)) record.uses.push([target, '*']);
      if (bindings && ts.isNamedImports(bindings)) {
        for (const element of bindings.elements) {
          const name = (element.propertyName ?? element.name).text;
          record.uses.push([target, name]);
          imported.set(element.name.text, [target, name]);
        }
      }
    } else if (ts.isExportDeclaration(statement)) {
      const specifier = statement.moduleSpecifier;
      const target = specifier && resolveSpecifier(files, path, specifier.text);
      const clause = statement.exportClause;
      if (specifier && !target) continue;
      if (!clause) record.stars.push(target);
      else if (ts.isNamespaceExport(clause)) record.aliases.set(clause.name.text, [target, '*']);
      else {
        for (const element of clause.elements) {
          const local = (element.propertyName ?? element.name).text;
          const exported = element.name.text;
          if (target) record.aliases.set(exported, [target, local]);
          else if (imported.has(local)) record.aliases.set(exported, imported.get(local));
          else record.own.set(exported, localTypes.has(local));
        }
      }
    } else if (ts.isExportAssignment(statement)) {
      record.own.set('default', false);
    } else if (hasModifier(statement, ts.SyntaxKind.ExportKeyword)) {
      const isType = isTypeDeclaration(statement);
      if (hasModifier(statement, ts.SyntaxKind.DefaultKeyword)) record.own.set('default', isType);
      else for (const name of declaredNames(statement)) record.own.set(name, isType);
    }
  }
  // Only a file that writes `import(` holds a dynamic import or an import type to walk for.
  if (DYNAMIC_IMPORT_RE.test(text)) visitDynamic(source);
  return record;
}

function isDynamicImport(node) {
  return ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword;
}

function resolveDynamic(files, path, call) {
  const [arg] = call.arguments;
  return arg && ts.isStringLiteral(arg) && resolveSpecifier(files, path, arg.text);
}

/**
 * For `import('./x').then((m) => … m.A …)`, the import call and the names the callback reads.
 * A callback that uses `m` in any other way reads the whole module, written `*`.
 */
function dynamicImportOfThen(node) {
  if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return undefined;
  const { expression: call, name } = node.expression;
  if (name.text !== 'then' || !isDynamicImport(call)) return undefined;
  const [callback] = node.arguments;
  const param = callback && ts.isFunctionLike(callback) && callback.parameters[0]?.name;
  if (!param || !ts.isIdentifier(param)) return { call, names: ['*'] };
  const names = new Set();
  let isWhole = false;
  const visit = (child) => {
    if (ts.isPropertyAccessExpression(child) && ts.isIdentifier(child.expression)) {
      if (child.expression.text === param.text) return void names.add(child.name.text);
    }
    if (ts.isIdentifier(child) && child.text === param.text && child !== param) isWhole = true;
    ts.forEachChild(child, visit);
  };
  ts.forEachChild(callback, visit);
  return { call, names: isWhole ? ['*'] : [...names] };
}

function hasModifier(node, kind) {
  return ts.getModifiers(node)?.some((m) => m.kind === kind) ?? false;
}

function qualifierHead(qualifier) {
  return ts.isIdentifier(qualifier) ? qualifier.text : qualifierHead(qualifier.left);
}

/**
 * Every `[file, name]` an exported name of `path` reaches, following aliases and `export *`.
 * A name reached through a namespace alias marks the whole target module, written `*`.
 */
function resolveExport(modules, path, name, seen = new Set()) {
  const key = `${path}#${name}`;
  if (seen.has(key)) return [];
  seen.add(key);
  const record = modules.get(path);
  if (!record) return [];
  if (name === '*') return allExports(modules, path, seen);
  if (record.own.has(name)) return [[path, name]];
  const alias = record.aliases.get(name);
  if (alias) return resolveExport(modules, alias[0], alias[1], seen);
  return record.stars.flatMap((star) => resolveExport(modules, star, name, seen));
}

function allExports(modules, path, seen) {
  const record = modules.get(path);
  return [
    ...[...record.own.keys()].map((name) => [path, name]),
    ...[...record.aliases].flatMap(([alias, [file, name]]) => {
      seen.add(`${path}#${alias}`);
      return resolveExport(modules, file, name, seen);
    }),
    ...record.stars.flatMap((star) => resolveExport(modules, star, '*', seen)),
  ];
}

/**
 * The `file#name` of every value export in `files` that no production file outside its own file
 * imports. A type export is left out: a type that names an export's argument or result is part of
 * that interface, and the declaration emitter needs it exported (TS4023). An entry point's exports
 * are the package interface, so they count as imported, as does everything an entry point
 * forwards. A whole-module use (`import *`, a bare `import()`) imports every export of that module.
 */
export function testOnlyExports(files, entryPoints) {
  // A test file's imports prove nothing, so only production files are parsed. `files` still
  // holds every path, so a specifier resolves to a test file as it does to any other.
  const production = [...files].filter(([path]) => !isTestFile(path));
  const modules = new Map(production.map(([path, text]) => [path, parseModule(files, path, text)]));
  const imported = new Set();
  // Every hop counts, so a barrel's forwarding name is imported when an importer goes through it.
  const markImported = (file, name) => {
    const seen = new Set();
    for (const [owner, own] of resolveExport(modules, file, name, seen)) imported.add(`${owner}#${own}`);
    for (const hop of seen) imported.add(hop);
  };
  // A name that reaches no parsed declaration, such as one forwarded from a test kit, is a value:
  // `every` over nothing would call it a type and hide it.
  const isTypeOnly = (path, name) => {
    const owners = resolveExport(modules, path, name);
    return owners.length > 0 && owners.every(([owner, own]) => modules.get(owner).own.get(own));
  };

  for (const entry of entryPoints) markImported(entry, '*');
  for (const [path, record] of modules) {
    for (const [file, name] of record.uses) {
      if (file !== path) markImported(file, name);
    }
  }

  const unimported = [];
  for (const [path, record] of modules) {
    for (const name of [...record.own.keys(), ...record.aliases.keys()]) {
      const id = `${path}#${name}`;
      const isType = record.own.get(name) ?? isTypeOnly(path, name);
      if (!isType && !imported.has(id)) unimported.push(id);
    }
  }
  return unimported.sort();
}

/** The source files a package's `exports` map names under the `@textscene/source` condition. */
export function entryPointsOf(packageJson, sourceDir) {
  return Object.values(packageJson.exports).map((conditions) =>
    posix.relative(sourceDir, posix.normalize(conditions['@textscene/source']))
  );
}
