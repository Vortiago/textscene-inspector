/**
 * Integration verification: the shipped 2D-UI example + container unit fixtures
 * render through the real shell pipeline (TscnParser → SceneGraph →
 * ControlOverlay) without falling back to GenericControlFallback for any
 * registered Control type. This is the deterministic, browser-free guard behind
 * the "2D UI renders correctly" claim — it reads the actual committed fixtures,
 * so a regression (an unhandled Control type, a parse break) turns this red.
 *
 * Note: TextureRect legitimately renders its own dashed placeholder here because
 * there is no ResourceLoaderProvider in the test env — that placeholder carries
 * data-control-type="TextureRect" (a REGISTERED type), so it is NOT an
 * unregistered-type fallback. The assertion below distinguishes the two.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { parseTscnContent } from '../hooks/useParsedScene';
import { ControlOverlay, controlComponentRegistry } from './index';

const SCENES = join(dirname(fileURLToPath(import.meta.url)), '../../../../../scenes');
const EXAMPLE_DIALOG = join(SCENES, 'examples/example-ui-dialog.tscn');
const CONTAINER_UNIT = join(SCENES, 'fixtures/unit-control-containers.tscn');

// Both fixtures are self-contained (zero ext_resource) so this guard survives
// with no on-disk asset closure.
const UI_FIXTURES: readonly [string, string][] = [
  ['example-ui-dialog', EXAMPLE_DIALOG],
  ['unit-control-containers', CONTAINER_UNIT],
];

/** The real shell parse path (same one ViewportArea feeds the overlay from). */
function loadRootScene(absPath: string) {
  const content = readFileSync(absPath, 'utf8');
  const { sceneGraph, error } = parseTscnContent(content, 'res://__test__.tscn');
  if (error || !sceneGraph) throw new Error(error ?? `no scene parsed from ${absPath}`);
  return sceneGraph.scenes.get(sceneGraph.rootScene)!;
}

function renderScene(absPath: string): HTMLElement {
  const root = loadRootScene(absPath);
  return render(
    <ControlOverlay
      nodes={root.nodes}
      internalResources={root.internalResources}
      externalResources={root.externalResources}
    />
  ).container;
}

const REGISTERED = new Set(controlComponentRegistry.getAllTypeNames());

describe('2D-UI fixtures render through the Control overlay', () => {
  it.each(UI_FIXTURES)('%s: mounts the overlay with rendered controls', (_name, path) => {
    const c = renderScene(path);
    expect(c.querySelector('[data-control-overlay="true"]')).toBeTruthy();
    expect(c.querySelectorAll('[data-control-type]').length).toBeGreaterThan(2);
  });

  it.each(UI_FIXTURES)(
    '%s: every registered Control type renders (none passes through)',
    (_name, path) => {
      const c = renderScene(path);
      // GenericControlFallback renders `data-control-passthrough` for unhandled
      // types. Non-Control nodes (plain `Node`, unresolved instances) legitimately
      // pass through; a *registered* Control type passing through would mean the
      // dispatcher failed to render a type we claim to support — that's the bug
      // this guards against.
      const passedThroughControls = [...c.querySelectorAll('[data-control-passthrough="true"]')]
        .map((e) => e.getAttribute('data-control-type'))
        .filter((t) => t && REGISTERED.has(t));
      expect(passedThroughControls).toEqual([]);
    }
  );
});

describe('2D-UI content spot-checks', () => {
  it('example-ui-dialog renders its "Field Journal" title', () => {
    const c = renderScene(EXAMPLE_DIALOG);
    expect(c.textContent).toContain('Field Journal');
  });

  it('example-ui-dialog renders both dialog Buttons', () => {
    const c = renderScene(EXAMPLE_DIALOG);
    const buttons = [...c.querySelectorAll('[data-control-type="Button"]')].map((b) => b.textContent);
    expect(buttons.some((t) => t?.includes('Save Entry'))).toBe(true);
    expect(buttons.some((t) => t?.includes('Close'))).toBe(true);
  });

  it('example-ui-dialog includes a TextureRect (dashed placeholder, no bound texture)', () => {
    const c = renderScene(EXAMPLE_DIALOG);
    expect(c.querySelector('[data-control-type="TextureRect"]')).toBeTruthy();
  });

  it('example-ui-dialog renders its RichTextLabel journal entry inside a CanvasLayer', () => {
    const c = renderScene(EXAMPLE_DIALOG);
    expect(c.querySelector('[data-control-type="CanvasLayer"]')).toBeTruthy();
    const rich = c.querySelector('[data-control-type="RichTextLabel"]');
    expect(rich?.textContent).toContain('bird sightings');
  });

  it('example-ui-dialog passes its plain non-Control Node child through (not a registered-type fallback)', () => {
    const c = renderScene(EXAMPLE_DIALOG);
    const passthroughTypes = [...c.querySelectorAll('[data-control-passthrough="true"]')].map((e) =>
      e.getAttribute('data-control-type')
    );
    // The `JournalController` plain Node reaches the fallback (passthrough) —
    // legitimately, because `Node` is not a registered Control type.
    expect(passthroughTypes).toContain('Node');
    expect(REGISTERED.has('Node')).toBe(false);
  });

  it('unit-control-containers renders grid cell text', () => {
    const c = renderScene(CONTAINER_UNIT);
    expect(c.textContent).toContain('Ada Byron');
    expect(c.textContent).toContain('Amber');
  });

  it('unit-control-containers exercises the scroll/grid/panel container types', () => {
    const c = renderScene(CONTAINER_UNIT);
    expect(c.querySelector('[data-control-type="ScrollContainer"]')).toBeTruthy();
    expect(c.querySelector('[data-control-type="GridContainer"]')).toBeTruthy();
    expect(c.querySelector('[data-control-type="PanelContainer"]')).toBeTruthy();
    expect(c.querySelector('[data-control-type="CenterContainer"]')).toBeTruthy();
  });
});
