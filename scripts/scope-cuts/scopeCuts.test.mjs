/**
 * The scope cuts `unownedScopeCuts` finds in a Markdown text. The texts are the lines that hid the
 * missing half of the shader port in November 2026, before and after each got its owner.
 */

import { describe, expect, it } from 'vitest';
import { isScopeCutDocument, unownedScopeCuts } from './scopeCuts.mjs';

const lines = (...text) => text.join('\n');

describe('unownedScopeCuts', () => {
  it('finds each item of an "Out of scope" list that names no issue', () => {
    const brief = lines(
      '**Out of scope:**',
      '- The drop rule of #1227 and #968. VoxelGI (#1464) and SDFGI.',
      '- A node form of the SSAO, SSR and prepass passes themselves: they are whole programs and stay.',
      '- Fog (#1458).'
    );

    expect(unownedScopeCuts(brief)).toEqual([
      {
        line: 3,
        text: '- A node form of the SSAO, SSR and prepass passes themselves: they are whole programs and stay.',
      },
    ]);
  });

  it('finds no cut once each item names its owner', () => {
    const brief = lines(
      '**Out of scope, each with its owner:**',
      '- The froxel passes (#1783) and the FogVolume shaders (#1624, #734).',
      '- A TSL port of the three sky shaders (#1779).'
    );

    expect(unownedScopeCuts(brief)).toEqual([]);
  });

  it('reads the list below an "Out of scope" heading, past a blank line', () => {
    const issue = lines(
      '## Out of scope',
      '',
      '- Global shader uniforms (#1183).',
      '- A move to `WebGPURenderer`.'
    );

    expect(unownedScopeCuts(issue)).toEqual([{ line: 4, text: '- A move to `WebGPURenderer`.' }]);
  });

  it('ends an "Out of scope" list at the next label', () => {
    const brief = lines(
      '**Out of scope:**',
      '- Fog (#1458).',
      '',
      '**Acceptance criteria:**',
      '- [ ] Both sub-issues are closed.'
    );

    expect(unownedScopeCuts(brief)).toEqual([]);
  });

  it('takes the owner of an item from a line the item continues on', () => {
    const adr = lines(
      '## Out of scope',
      '',
      '- A TSL port of the 2D canvas lighting and',
      '  the sky shaders (#1779).'
    );

    expect(unownedScopeCuts(adr)).toEqual([]);
  });

  it('finds an "Out of scope" sentence that lists its items on the same line', () => {
    const brief =
      '**Out of scope:** capture through MCP, a registration of the server from the extension, and a tool for `.tres` files.';

    expect(unownedScopeCuts(brief)).toEqual([{ line: 1, text: brief }]);
  });

  it.each([
    'After the last slice, two issues that are not filed yet: one publishes 0.1.0.',
    '**After this slice (not filed yet):** one issue publishes the package.',
    'They are the passes a later issue can move into the package.',
    '| The first target | The handler. `WebGPURenderer` is a later project |',
    'A hint in the tree is a possible follow-up, not part of this decision.',
    'The shadow passes and the sky bake are host inputs.',
    'The `bezier`, `method`, `audio` and `animation` track types are deferred.',
  ])('finds the line that puts work off with no owner: %s', (text) => {
    expect(unownedScopeCuts(text)).toEqual([{ line: 1, text }]);
  });

  it.each([
    '**After this slice:** #1787 publishes 0.1.0, which is not filed under the port.',
    '`WebGPURenderer` is a later project (https://github.com/Vortiago/textscene-inspector/issues/1788).',
    'An HTTP transport is out of scope. No issue: nobody has asked for one.',
  ])('accepts an issue number, an issue link or "no issue" with its reason: %s', (text) => {
    expect(unownedScopeCuts(text)).toEqual([]);
  });

  it('takes the owner of a wrapped sentence from any line of its paragraph', () => {
    const adr = lines(
      'The first target is the handler, with `WebGPURenderer` as a later',
      'and separate project (#1788).'
    );

    expect(unownedScopeCuts(adr)).toEqual([]);
  });

  it('names the first line of a wrapped sentence that has no owner', () => {
    const adr = lines(
      'The decision stands.',
      '',
      'It stays out of scope, so that an order fix',
      'is not mixed with it.'
    );

    expect(unownedScopeCuts(adr)).toEqual([{ line: 3, text: 'It stays out of scope, so that an order fix' }]);
  });

  it('reads no cut from code: a code span and a fenced block hold names, not plans', () => {
    const doc = lines(
      'Call `set_deferred` from the callback.',
      '',
      '```',
      'deferred = true // out of scope',
      '```'
    );

    expect(unownedScopeCuts(doc)).toEqual([]);
  });

  it('reads no cut from a quote: a rule that names the words of a cut puts no work off', () => {
    const rule = lines(
      '- A line that cuts scope names the open issue that owns it: "out of scope", "later", "follow-up",',
      '  "not filed" or "host input".'
    );

    expect(unownedScopeCuts(rule)).toEqual([]);
  });

  it('reads a cut beside a quote: the words outside the quote still put work off', () => {
    const doc = 'The "sky bake" pass is deferred.';

    expect(unownedScopeCuts(doc)).toEqual([{ line: 1, text: doc }]);
  });

  it('reads a `~~~` line inside a block of three backticks as code (edge case)', () => {
    const doc = lines('```', '~~~', 'The sky bake is deferred.', '```', '', 'The fog is deferred.');

    expect(unownedScopeCuts(doc)).toEqual([{ line: 6, text: 'The fog is deferred.' }]);
  });

  it('reads no cut from an HTML comment, and keeps the line numbers after it', () => {
    const template = lines('<!-- Say what is out of scope,', 'and why. -->', '', 'The fog is deferred.');

    expect(unownedScopeCuts(template)).toEqual([{ line: 4, text: 'The fog is deferred.' }]);
  });

  it('reads `<!--` in a code span as text, so the lines up to the next comment stay prose (edge case)', () => {
    const doc = lines('A comment starts with `<!--`.', '', 'The fog is deferred.', '', '<!-- A note. -->');

    expect(unownedScopeCuts(doc)).toEqual([{ line: 3, text: 'The fog is deferred.' }]);
  });

  it('finds no cut in a text that puts nothing off', () => {
    expect(
      unownedScopeCuts('The pass draws later frames first.\n\n- The mount stays in the renderer.')
    ).toEqual([]);
  });
});

describe('isScopeCutDocument', () => {
  it.each(['README.md', 'docs/adr/0072-shaders.md', 'docs/webgpu-tsl-spike.md'])('reads %s', (path) => {
    expect(isScopeCutDocument(path)).toBe(true);
  });

  it.each([
    'packages/textscene-core/src/nodes/2d/ui/label/comparison.md',
    'docs/comparison/sheets/complex-2d-gui.md',
    'GLOSSARY.md',
    'apps/textscene-web/README.md',
    'docs/adr/template.txt',
  ])('leaves a sheet, the glossary, a document of a package and another file type out: %s', (path) => {
    expect(isScopeCutDocument(path)).toBe(false);
  });
});
