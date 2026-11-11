/** Who embeds a window, by the viewport's own properties and by what the root window embeds. */
import { describe, expect, it } from 'vitest';
import type { ProjectSettings } from '../../../parser/projectSettingsParser';
import type { TscnNode } from '../../../parser/types';
import { liveTreeOf } from '../../../r3f/liveSceneTree';
import { ROOT_EMBEDS_NO_WINDOWS, sourcesOver } from '../../../r3f/liveSceneTree.testkit';
import { embedsAWindow, embedsSubwindows } from './windowEmbedder';
import '../../../r3f/nodes/index';

const node = (type: string, properties: Record<string, unknown> = {}, children: TscnNode[] = []) =>
  ({ name: type, type, properties, children, rawProperties: {} }) as unknown as TscnNode;

/** The live tree of a viewport's children under `settings`, which default to an embedding root. */
function treeBelow(viewport: TscnNode, settings: ProjectSettings | null = null) {
  const sources = sourcesOver(undefined, settings);
  return liveTreeOf(viewport.children, { externalResources: [], internalResources: [], ...sources });
}

const drawsAWindow = (viewport: TscnNode, settings: ProjectSettings | null = null) =>
  embedsAWindow(treeBelow(viewport, settings), viewport);

const embeds = (viewport: TscnNode | null, settings: ProjectSettings | null = null) =>
  embedsSubwindows(treeBelow(node('Node'), settings), viewport);

describe('embedsAWindow: whether a viewport draws a window over its canvas', () => {
  it('finds a window below a viewport that embeds windows', () => {
    const viewport = node('SubViewport', { gui_embed_subwindows: true }, [
      node('Node', {}, [node('Window')]),
    ]);
    expect(drawsAWindow(viewport)).toBe(true);
  });

  it('finds none in a viewport that embeds no windows', () => {
    expect(drawsAWindow(node('SubViewport', { gui_embed_subwindows: false }, [node('Window')]))).toBe(false);
  });

  it('leaves out a window a nested viewport embeds', () => {
    const embedding = node('SubViewport', { gui_embed_subwindows: true }, [node('Window')]);
    expect(drawsAWindow(node('SubViewport', { gui_embed_subwindows: true }, [embedding]))).toBe(false);
  });

  it('reaches a window past a viewport that embeds none', () => {
    const passing = node('SubViewport', { gui_embed_subwindows: false }, [node('Popup')]);
    expect(drawsAWindow(node('SubViewport', { gui_embed_subwindows: true }, [passing]))).toBe(true);
  });

  it('leaves out a hidden window, which the embedder never registers (`window.cpp:1546-1563`)', () => {
    const viewport = node('SubViewport', { gui_embed_subwindows: true }, [node('Popup', { visible: false })]);
    expect(drawsAWindow(viewport)).toBe(false);
  });

  it('reaches a visible window below a hidden one', () => {
    const hidden = node('Window', { visible: false }, [node('Popup', { visible: true })]);
    expect(drawsAWindow(node('SubViewport', { gui_embed_subwindows: true }, [hidden]))).toBe(true);
  });

  it('leaves out a native window', () => {
    const viewport = node('SubViewport', { gui_embed_subwindows: true }, [
      node('Window', { force_native: true }),
    ]);
    expect(drawsAWindow(viewport)).toBe(false);
  });

  it('stops at a hidden window that embeds the popup below it, under a root that embeds none', () => {
    const hidden = node('Window', { visible: false, gui_embed_subwindows: true }, [
      node('Popup', { visible: true }),
    ]);
    const viewport = node('SubViewport', { gui_embed_subwindows: true }, [hidden]);
    expect(drawsAWindow(viewport, ROOT_EMBEDS_NO_WINDOWS)).toBe(false);
  });
});

describe('embedsSubwindows: whether a viewport is the embedder of the windows below it', () => {
  it('reads gui_embed_subwindows of a SubViewport', () => {
    expect(embeds(node('SubViewport', { gui_embed_subwindows: true }))).toBe(true);
    expect(embeds(node('SubViewport', { gui_embed_subwindows: false }))).toBe(false);
  });

  it('ignores the authored gui_embed_subwindows of a window, which entering the tree resets (`window.cpp:1534-1537`)', () => {
    expect(embeds(node('Window', { gui_embed_subwindows: true, force_native: false }))).toBe(false);
  });

  it('lets a native window embed the windows below it, as entering the tree sets it to force_native', () => {
    expect(embeds(node('Window', { gui_embed_subwindows: false, force_native: true }))).toBe(true);
  });

  it('keeps the authored gui_embed_subwindows of a window under a root that embeds none (`window.cpp:1535`)', () => {
    const authored = node('Window', { gui_embed_subwindows: true, force_native: false });
    const native = node('Window', { gui_embed_subwindows: false, force_native: true });
    expect(embeds(authored, ROOT_EMBEDS_NO_WINDOWS)).toBe(true);
    expect(embeds(native, ROOT_EMBEDS_NO_WINDOWS)).toBe(false);
  });

  it('answers for the root window where no viewport is named', () => {
    expect(embeds(null)).toBe(true);
    expect(embeds(null, ROOT_EMBEDS_NO_WINDOWS)).toBe(false);
  });
});
