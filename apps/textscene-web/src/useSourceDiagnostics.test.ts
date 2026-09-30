/**
 * The Source pane's linter surface between an edit and the debounced lint that follows it:
 * the badge counts only findings the pane shows, a gutter row or the file-level section.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ResourceProvider } from '@textscene/core/linter';
import { useSourceDiagnostics } from './useSourceDiagnostics';
import { DEBOUNCE_MS } from './useSceneSource';

/** A scene whose last line, line 4, holds a value `visible` cannot read. */
const WITH_BAD_LAST_LINE = [
  '[gd_scene format=3]',
  '',
  '[node name="Root" type="Node3D"]',
  'visible = maybe',
].join('\n');

/** The same scene with that line deleted. */
const LAST_LINE_DELETED = WITH_BAD_LAST_LINE.split('\n').slice(0, 3).join('\n');

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

/** A project that holds no file, for a buffer that reads none. */
const EMPTY_PROJECT: ResourceProvider = { loadResource: async () => null };

function lintedPane(buffer: string) {
  const hook = renderHook(({ text }) => useSourceDiagnostics(text, EMPTY_PROJECT), {
    initialProps: { text: buffer },
  });
  act(() => {
    vi.advanceTimersByTime(DEBOUNCE_MS);
  });
  return hook;
}

describe('useSourceDiagnostics', () => {
  it('puts a finding on its gutter row once the lint has run', () => {
    const { result } = lintedPane(WITH_BAD_LAST_LINE);

    expect(result.current.diagnosticsByLine.has(4)).toBe(true);
    expect(result.current.fileDiagnostics).toBeNull();
    expect(result.current.problemBadge).not.toBeNull();
  });

  it('shows a finding on a line deleted since the lint in the file-level section', () => {
    const { result, rerender } = lintedPane(WITH_BAD_LAST_LINE);
    const finding = result.current.diagnosticsByLine.get(4)!.messages;

    rerender({ text: LAST_LINE_DELETED });

    expect(result.current.lineCount).toBe(3);
    expect(result.current.diagnosticsByLine.has(4)).toBe(false);
    expect(result.current.fileDiagnostics?.messages).toEqual(finding);
    expect(result.current.problemBadge).not.toBeNull();
  });

  it('drops the finding when the lint of the edited text runs', () => {
    const { result, rerender } = lintedPane(WITH_BAD_LAST_LINE);

    rerender({ text: LAST_LINE_DELETED });
    act(() => {
      vi.advanceTimersByTime(DEBOUNCE_MS);
    });

    expect(result.current.fileDiagnostics).toBeNull();
    expect(result.current.problemBadge).toBeNull();
  });
});

/** The committed GLB that requires EXT_mesh_gpu_instancing, which Godot's glTF importer refuses. */
const INSTANCED_TREE = new Uint8Array(
  readFileSync(
    join(import.meta.dirname, '../../../scenes/fixtures/gltf-unsupported-required-extension/instanced-tree.glb')
  )
).buffer;

/** A scene whose `Tree` node instances `res://tree.glb`, declared on line 3. */
const USES_TREE_GLB = [
  '[gd_scene format=3]',
  '',
  '[ext_resource type="PackedScene" path="res://tree.glb" id="1_tree"]',
  '',
  '[node name="Root" type="Node3D"]',
  '',
  '[node name="Tree" parent="." instance=ExtResource("1_tree")]',
].join('\n');

/** A provider whose every read of the GLB waits until the test releases it. It holds no other file. */
function heldProvider() {
  const pending: Array<() => void> = [];
  const provider: ResourceProvider = {
    loadResource: (path) =>
      path === 'res://tree.glb'
        ? new Promise((resolve) => pending.push(() => resolve(INSTANCED_TREE)))
        : Promise.resolve(null),
  };
  return { provider, pending };
}

/** Releases every held read, then lets the lint's promises settle. */
async function releaseAll(pending: Array<() => void>): Promise<void> {
  await act(async () => {
    for (const release of pending.splice(0)) release();
    await vi.runAllTimersAsync();
  });
}

function debounce(): void {
  act(() => {
    vi.advanceTimersByTime(DEBOUNCE_MS);
  });
}

describe('useSourceDiagnostics with a resource provider', () => {
  it("adds a refused glTF on its ext_resource heading once the scene's dependencies are read", async () => {
    const { provider, pending } = heldProvider();
    const { result } = renderHook(() => useSourceDiagnostics(USES_TREE_GLB, provider));
    act(() => {
      vi.advanceTimersByTime(DEBOUNCE_MS);
    });

    expect(result.current.diagnosticsByLine.has(3)).toBe(false);
    await act(async () => {
      for (const release of pending.splice(0)) release();
      await vi.runAllTimersAsync();
    });

    expect(result.current.diagnosticsByLine.get(3)?.severity).toBe('error');
  });

  it('drops the result of a lint whose buffer has changed since', async () => {
    const { provider, pending } = heldProvider();
    const { result, rerender } = renderHook(({ text }) => useSourceDiagnostics(text, provider), {
      initialProps: { text: USES_TREE_GLB },
    });
    act(() => {
      vi.advanceTimersByTime(DEBOUNCE_MS);
    });
    const releaseStale = pending.shift()!;

    rerender({ text: WITH_BAD_LAST_LINE });
    await act(async () => {
      releaseStale();
      await vi.runAllTimersAsync();
    });

    expect(result.current.diagnosticsByLine.has(3)).toBe(false);
    expect(result.current.diagnosticsByLine.has(4)).toBe(true);
  });

  it("keeps the refused glTF on its heading while an edit's read is pending", async () => {
    const { provider, pending } = heldProvider();
    const { result, rerender } = renderHook(({ text }) => useSourceDiagnostics(text, provider), {
      initialProps: { text: USES_TREE_GLB },
    });
    debounce();
    await releaseAll(pending);
    expect(result.current.diagnosticsByLine.get(3)?.severity).toBe('error');

    rerender({ text: `${USES_TREE_GLB}\n` });
    debounce();

    expect(pending).toHaveLength(1);
    expect(result.current.diagnosticsByLine.get(3)?.severity).toBe('error');
    await releaseAll(pending);
    expect(result.current.diagnosticsByLine.get(3)?.messages).toHaveLength(1);
  });

  it('drops the refused glTF once an edit leaves the buffer with no glTF to read', async () => {
    const { provider, pending } = heldProvider();
    const { result, rerender } = renderHook(({ text }) => useSourceDiagnostics(text, provider), {
      initialProps: { text: USES_TREE_GLB },
    });
    debounce();
    await releaseAll(pending);

    rerender({ text: LAST_LINE_DELETED });
    debounce();

    expect(result.current.diagnosticsByLine.has(3)).toBe(false);
    expect(result.current.problemBadge).toBeNull();
  });

  it("re-lints the unchanged buffer when the project's files change", async () => {
    let tree: ArrayBuffer | null = null;
    const loadResource = vi.fn(async (path: string) => (path === 'res://tree.glb' ? tree : null));
    const provider: ResourceProvider = { loadResource };
    const { result, rerender } = renderHook(
      ({ revision }) => useSourceDiagnostics(USES_TREE_GLB, provider, revision),
      { initialProps: { revision: 0 } }
    );
    debounce();
    await releaseAll([]);
    expect(result.current.diagnosticsByLine.has(3)).toBe(false);

    tree = INSTANCED_TREE;
    rerender({ revision: 1 });
    debounce();
    await releaseAll([]);

    expect(result.current.diagnosticsByLine.get(3)?.severity).toBe('error');
  });
});
