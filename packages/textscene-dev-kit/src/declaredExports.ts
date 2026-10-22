/**
 * The names a built declaration file exports, so a package test pins its public API from the file
 * a consumer's compiler reads.
 */
import { readFileSync } from 'node:fs';
import ts from 'typescript';

function isExported(statement: ts.Statement): boolean {
  return (
    ts.canHaveModifiers(statement) &&
    (ts.getModifiers(statement) ?? []).some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
  );
}

/** The names a declaration statement introduces: one for a type or function, many for a `const` list. */
function declaredNames(statement: ts.Statement, source: ts.SourceFile): string[] {
  if (ts.isVariableStatement(statement)) {
    return statement.declarationList.declarations.map((declaration) => declaration.name.getText(source));
  }
  return 'name' in statement ? [(statement.name as ts.Identifier).text] : [];
}

/** The sorted names a declaration file exports, whether it declares them or re-exports them. */
export function declaredExports(declarationPath: string): string[] {
  const source = ts.createSourceFile(
    declarationPath,
    readFileSync(declarationPath, 'utf8'),
    ts.ScriptTarget.ES2022
  );
  const names: string[] = [];
  for (const statement of source.statements) {
    if (
      ts.isExportDeclaration(statement) &&
      statement.exportClause &&
      ts.isNamedExports(statement.exportClause)
    ) {
      names.push(...statement.exportClause.elements.map((element) => element.name.text));
    } else if (isExported(statement)) {
      names.push(...declaredNames(statement, source));
    }
  }
  return names.sort();
}
