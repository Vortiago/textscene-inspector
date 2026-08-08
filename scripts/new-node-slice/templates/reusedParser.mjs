/**
 * The files a slice gets when it REUSES a base parse — `transform-only` and
 * `pending` both do, because property knowledge lives in linterParser.ts and
 * the render half is deferred to whoever implements it.
 *
 * The indentation below is the emitted file's, not this module's: these are
 * whole TypeScript files, and a template literal carries its own leading
 * whitespace into the output.
 */

import { LENIENT_TREE_TEST_CASE } from './parserTests.mjs';

export function reusedParserFiles({ typeName, lower, camel, intent, base, toSrc, toBase, reusedParser }) {
  const files = new Map();
    files.set(
      'index.ts',
      `/**
 * ${typeName} registration — parser.
 *
 * Reuses the ${base.component} parse; property knowledge lives in linterParser.ts${
   intent === 'transform-only'
     ? `.
 * Draws nothing by design (ADR-0008), so index.r3f.ts registers ${base.component}
 * and its children still land in the right transform space.`
     : `.
 * Not rendered yet, so it registers NO component: the dispatcher falls back to
 * GenericNodeFallback and the tree keeps reporting it as not implemented.`
 }
 */

import { nodeRegistry, type NodeTypeRegistration } from '${toSrc}core/NodeRegistry';
import { ${reusedParser.fn} } from '${reusedParser.importPath}';

const ${camel}Registration: NodeTypeRegistration = {
  typeName: '${typeName}',
  parser: ${reusedParser.fn},
};

nodeRegistry.register(${camel}Registration);

export { ${camel}Registration };
`
    );
    if (intent === 'transform-only') {
      files.set(
        'index.r3f.ts',
        `/**
 * ${typeName} draws nothing of its own (ADR-0008) — reuse the ${base.component}
 * component so its children still land in the right transform space.
 */

import { nodeComponentRegistry } from '${toSrc}r3f/NodeComponentRegistry';
import { ${base.component} } from '${toBase}/Component';

nodeComponentRegistry.register({
  typeName: '${typeName}',
  Component: ${base.component},
${base.workspaceFlag ? `  ${base.workspaceFlag}\n` : ''}  renderIntent: 'transform-only',
});
`
      );
    }
    files.set(
      `${lower}.test.ts`,
      intent === 'transform-only'
        ? `/**
 * ${typeName} registration — it is parsed, and it draws nothing on purpose
 * (ADR-0008) rather than for want of an implementation.
 */

import { describe, expect, it, vi } from 'vitest';
import { nodeRegistry } from '${toSrc}core/NodeRegistry';
import { nodeComponentRegistry } from '${toSrc}r3f/NodeComponentRegistry';
import { TscnParser } from '${toSrc}parser/TscnParser';
import * as logger from '${toSrc}logger';
import { ${reusedParser.fn} } from '${reusedParser.importPath}';
import { ${base.component} } from '${toBase}/Component';
import './index';
import './index.r3f';

describe('${typeName} registration', () => {
  it('registers the ${reusedParser.fn} parse it reuses', () => {
    const registration = nodeRegistry.getRegistration('${typeName}');
    expect(registration).not.toBeNull();
    expect(registration!.parser).toBe(${reusedParser.fn});
  });

  it('reuses the ${base.component} component so children keep their transform space', () => {
    expect(nodeComponentRegistry.get('${typeName}')).toBe(${base.component});
  });

  it('declares drawing nothing, so the sheet may claim linter-only', () => {
    expect(nodeComponentRegistry.isTransformOnly('${typeName}')).toBe(true);
  });

${LENIENT_TREE_TEST_CASE(typeName, base.component)}
});
`
        : `/**
 * ${typeName} registration — parsed and validated, not yet rendered.
 *
 * Registering NO component is the point: the dispatcher falls back to
 * GenericNodeFallback, and \`rendersOwnVisual\` reports 'not-implemented' so the
 * tree and inspector keep saying so until someone draws it.
 */

import { describe, expect, it, vi } from 'vitest';
import { nodeRegistry } from '${toSrc}core/NodeRegistry';
import { nodeComponentRegistry } from '${toSrc}r3f/NodeComponentRegistry';
import { TscnParser } from '${toSrc}parser/TscnParser';
import * as logger from '${toSrc}logger';
import { ${reusedParser.fn} } from '${reusedParser.importPath}';
import './index';

describe('${typeName} registration', () => {
  it('registers the ${reusedParser.fn} parse it reuses', () => {
    const registration = nodeRegistry.getRegistration('${typeName}');
    expect(registration).not.toBeNull();
    expect(registration!.parser).toBe(${reusedParser.fn});
  });

  it('registers no render component, so it still reads as not implemented', () => {
    expect(nodeComponentRegistry.get('${typeName}')).toBeUndefined();
  });

${LENIENT_TREE_TEST_CASE(typeName, base.component)}
});
`
    );
  return files;
}
