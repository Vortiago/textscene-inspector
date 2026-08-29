/**
 * The files a slice gets when it REUSES a base parse — `transform-only` and
 * `pending` both do, because property knowledge lives in linterParser.ts and
 * the render half is deferred to whoever implements it.
 *
 * The indentation below is the emitted file's, not this module's: these are
 * whole TypeScript files, and a template literal carries its own leading
 * whitespace into the output.
 */


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
     : base.invisibleBase
       ? `.
 * Not rendered yet: index.r3f.ts registers ${base.component} under
 * \`renderIntent: 'pending'\`, so the tree still reports it as not implemented
 * while \`visible\` and the workspace split keep working.`
       : `.
 * Not rendered yet, so it registers NO component: the dispatcher falls back to
 * GenericControlFallback and the tree keeps reporting it as not implemented.`
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
    // A `pending` slice mounts the base too, and says so with its own intent:
    // `GenericNodeFallback` carries no `visible`, and an unregistered type reads
    // as belonging to BOTH canvases. Only `control` opts out — see `invisibleBase`.
    if (intent === 'transform-only' || (intent === 'pending' && base.invisibleBase)) {
      const pending = intent === 'pending';
      files.set(
        'index.r3f.ts',
        `/**
 * ${typeName} ${
   pending
     ? `draws nothing here YET — the badge reads "not implemented". The
 * ${base.component} base still mounts, for \`visible\` and the workspace split.`
     : `draws nothing of its own (ADR-0008) — reuse the ${base.component}
 * component so its children still land in the right transform space.`
 }
 */

import { nodeComponentRegistry } from '${toSrc}r3f/NodeComponentRegistry';
import { ${base.component} } from '${toBase}/Component';

nodeComponentRegistry.register({
  typeName: '${typeName}',
  Component: ${base.component},
${base.workspaceFlag ? `  ${base.workspaceFlag}\n` : ''}  renderIntent: '${intent}',
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

import { describe, expect, it } from 'vitest';
import { nodeRegistry } from '${toSrc}core/NodeRegistry';
import { nodeComponentRegistry } from '${toSrc}r3f/NodeComponentRegistry';
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
});
`
        : `/**
 * ${typeName} registration — parsed and validated, not yet rendered.
 *
 * Registering NO component is the point: the dispatcher falls back to
 * GenericNodeFallback, and \`rendersOwnVisual\` reports 'not-implemented' so the
 * tree and inspector keep saying so until someone draws it.
 */

import { describe, expect, it } from 'vitest';
import { nodeRegistry } from '${toSrc}core/NodeRegistry';
import { nodeComponentRegistry } from '${toSrc}r3f/NodeComponentRegistry';
import { ${reusedParser.fn} } from '${reusedParser.importPath}';
import './index';${base.invisibleBase ? `
import './index.r3f';` : ''}

describe('${typeName} registration', () => {
  it('registers the ${reusedParser.fn} parse it reuses', () => {
    const registration = nodeRegistry.getRegistration('${typeName}');
    expect(registration).not.toBeNull();
    expect(registration!.parser).toBe(${reusedParser.fn});
  });

${
  base.invisibleBase
    ? `  // The badge reads the declared INTENT, never the absence of a registration:
  // a pending slice registers the invisible base so the type keeps \`visible\`
  // and stays out of both workspaces. Importing \`./index.r3f\` above is what
  // lets this assertion see the registration the slice actually makes.
  it('registers the base under the pending render intent', () => {
    expect(nodeComponentRegistry.renderIntentOf('${typeName}')).toBe('pending');
  });`
    : `  // A control base opts out of mounting an invisible base, so this slice
  // registers no component at all and the dispatcher falls back.
  it('registers no render component, so it still reads as not implemented', () => {
    expect(nodeComponentRegistry.get('${typeName}')).toBeUndefined();
  });`
}
});
`
    );
  return files;
}
