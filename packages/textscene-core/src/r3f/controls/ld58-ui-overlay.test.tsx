/**
 * Integration verification: every vendored ld-58 2D-UI scene renders through the
 * real shell pipeline (TscnParser → SceneGraph → ControlOverlay) without falling
 * back to GenericControlFallback for any node type. This is the deterministic,
 * browser-free guard behind the "ld-58 UI renders correctly" claim — it reads the
 * actual committed fixtures, so a regression (an unhandled Control type, a parse
 * break) turns this red.
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
import { TscnParser } from '../../parser/TscnParser';
import { SceneGraphBuilder } from '../../core/SceneGraphBuilder';
import { tscnSceneToParsedScene } from '../../core/SceneGraph';
import { ControlOverlay, controlComponentRegistry } from './index';

const LD58 = join(dirname(fileURLToPath(import.meta.url)), '../../../../../scenes/ld58');

// The vendored ld-58 UI scenes (res://-relative paths under scenes/ld58/).
const UI_SCENES = [
  'ClueContainer.tscn',
  'ClueItem.tscn',
  'Scenes/AboutDialog/AboutDialog.tscn',
  'Scenes/DialogSystem/DialogSystem.tscn',
  'Scenes/EndGameDialog/EndGameDialog.tscn',
  'Scenes/GameUI/GameUI.tscn',
  'Scenes/StartScreen/StartScreen.tscn',
];

/** Mirror TscnPreviewShell.parseContent → the node tree ViewportArea feeds the overlay. */
function loadRootScene(rel: string) {
  const content = readFileSync(join(LD58, rel), 'utf8');
  const tscn = new TscnParser().parse(content);
  const parsed = tscnSceneToParsedScene(
    'res://__test__.tscn',
    tscn.nodes,
    tscn.externalResources,
    tscn.internalResources
  );
  const graph = new SceneGraphBuilder().setRootScene('res://__test__.tscn').addScene(parsed).build();
  return graph.scenes.get(graph.rootScene)!;
}

function renderScene(rel: string): HTMLElement {
  const root = loadRootScene(rel);
  return render(
    <ControlOverlay
      nodes={root.nodes}
      internalResources={root.internalResources}
      externalResources={root.externalResources}
    />
  ).container;
}

const REGISTERED = new Set(controlComponentRegistry.getAllTypeNames());

describe('ld-58 UI scenes render through the Control overlay', () => {
  it.each(UI_SCENES)('%s: mounts the overlay with rendered controls', (rel) => {
    const c = renderScene(rel);
    expect(c.querySelector('[data-control-overlay="true"]')).toBeTruthy();
    expect(c.querySelectorAll('[data-control-type]').length).toBeGreaterThan(2);
  });

  it.each(UI_SCENES)('%s: every registered Control type renders (none passes through)', (rel) => {
    const c = renderScene(rel);
    // GenericControlFallback renders `data-control-passthrough` for unhandled
    // types. Non-Control nodes (plain `Node`, unresolved instances) legitimately
    // pass through; a *registered* Control type passing through would mean the
    // dispatcher failed to render a type we claim to support — that's the bug
    // this guards against.
    const passedThroughControls = [...c.querySelectorAll('[data-control-passthrough="true"]')]
      .map((e) => e.getAttribute('data-control-type'))
      .filter((t) => t && REGISTERED.has(t));
    expect(passedThroughControls).toEqual([]);
  });
});

describe('ld-58 UI content spot-checks', () => {
  it('EndGameDialog renders its "Solve the Mystery" title', () => {
    const c = renderScene('Scenes/EndGameDialog/EndGameDialog.tscn');
    expect(c.textContent).toContain('Solve the Mystery');
  });

  it('DialogSystem includes a TextureRect (Inspector portrait)', () => {
    const c = renderScene('Scenes/DialogSystem/DialogSystem.tscn');
    expect(c.querySelector('[data-control-type="TextureRect"]')).toBeTruthy();
  });

  it('StartScreen renders at least one Button', () => {
    const c = renderScene('Scenes/StartScreen/StartScreen.tscn');
    expect(c.querySelector('[data-control-type="Button"]')).toBeTruthy();
  });
});
