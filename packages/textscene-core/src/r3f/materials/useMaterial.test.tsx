/**
 * The one load step every material slot reads: a material body and the tables its
 * references resolve in, the same shape whether the material is written in the scene,
 * is a whole `.tres`, or is a `[sub_resource]` inside one.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import * as logger from '../../logger';
import { parseTresFile } from '../../parser/parsedResource';
import type { TscnExternalResource, TscnInternalResource } from '../../parser/types';
import { ResourceLoaderProvider } from '../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../resources/testing/createFakeResourceLoader';
import { MissingResourcesProvider, useMissingResources } from '../contexts/MissingResourcesContext';
import type { MaterialSource } from './materialSource';
import { readyMaterial, useMaterial } from './useMaterial';

const TRES_PATH = 'res://materials/paint.tres';

const PAINT_TRES = `[gd_resource type="StandardMaterial3D" load_steps=3 format=3]

[ext_resource type="Texture2D" path="res://grain.png" id="1_grain"]

[sub_resource type="StandardMaterial3D" id="Inner_mat"]
albedo_color = Color(0, 0, 1, 1)

[resource]
albedo_color = Color(1, 0, 0, 1)
albedo_texture = ExtResource("1_grain")
`;

const SCENE_INTERNAL: TscnInternalResource[] = [
  { id: 'Mat_body', type: 'StandardMaterial3D', data: { albedo_color: 'Color(0, 1, 0, 1)' } },
  { id: 'Shader_fx', type: 'ShaderMaterial', data: {} },
];
const SCENE_EXTERNAL: TscnExternalResource[] = [];

function inline(id: string): MaterialSource {
  const resource = SCENE_INTERNAL.find((entry) => entry.id === id)!;
  return {
    kind: 'inline',
    material: { resource, internalResources: SCENE_INTERNAL, externalResources: SCENE_EXTERNAL },
  };
}

function renderMaterial(source: MaterialSource | undefined, seeded: Record<string, string> = {}) {
  const fake = createFakeResourceLoader();
  for (const [path, text] of Object.entries(seeded)) fake.resources.seed(path, parseTresFile(text));
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ResourceLoaderProvider loader={fake.loader}>{children}</ResourceLoaderProvider>
  );
  return { fake, ...renderHook(() => useMaterial(source), { wrapper }) };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useMaterial', () => {
  it('hands back a scene material with the scene tables it came with', () => {
    const source = inline('Mat_body');
    const { result } = renderMaterial(source);

    expect(result.current).toEqual({
      status: 'ready',
      material: source.kind === 'inline' ? source.material : null,
    });
  });

  it('keeps one material across renders that rebuild an equal source', () => {
    const fake = createFakeResourceLoader();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ResourceLoaderProvider loader={fake.loader}>{children}</ResourceLoaderProvider>
    );
    const { result, rerender } = renderHook(() => useMaterial(inline('Mat_body')), { wrapper });
    const first = result.current;
    rerender();

    expect(result.current).toBe(first);
    expect(first.status).toBe('ready');
  });

  it("reads a whole .tres as its [resource] body and the file's own tables", () => {
    const { result, fake } = renderMaterial({ kind: 'file', path: TRES_PATH }, { [TRES_PATH]: PAINT_TRES });
    const parsed = fake.resources.getCached(TRES_PATH)!;
    const loaded = readyMaterial(result.current);

    expect(loaded?.resource).toEqual({
      id: TRES_PATH,
      type: 'StandardMaterial3D',
      data: { albedo_color: 'Color(1, 0, 0, 1)', albedo_texture: 'ExtResource("1_grain")' },
    });
    expect(loaded?.internalResources).toBe(parsed.subResources);
    expect(loaded?.externalResources).toBe(parsed.extResources);
  });

  it("reads a sub-resource address as that [sub_resource], with its file's tables", () => {
    const { result, fake } = renderMaterial(
      { kind: 'file', path: `${TRES_PATH}::Inner_mat` },
      { [TRES_PATH]: PAINT_TRES }
    );
    const parsed = fake.resources.getCached(TRES_PATH)!;

    expect(readyMaterial(result.current)?.resource).toBe(parsed.subResources[0]);
    expect(readyMaterial(result.current)?.internalResources).toBe(parsed.subResources);
  });

  it('answers absent while the file loads, then the material', () => {
    const { result, fake } = renderMaterial({ kind: 'file', path: TRES_PATH });
    expect(result.current).toEqual({ status: 'absent' });

    act(() => fake.resources._resolve(TRES_PATH, parseTresFile(PAINT_TRES)));
    expect(readyMaterial(result.current)?.resource.type).toBe('StandardMaterial3D');
  });

  it('answers absent for a file that fails to load, so nothing replaces what the surface had', () => {
    const { result, fake } = renderMaterial({ kind: 'file', path: TRES_PATH });
    act(() => fake.resources._fail(TRES_PATH, 'not found'));

    expect(result.current).toEqual({ status: 'absent' });
  });

  it('reports each sub-resource address of a failed file as its own missing row', () => {
    const fake = createFakeResourceLoader();
    fake.resources.seed(TRES_PATH, null);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <MissingResourcesProvider>
        <ResourceLoaderProvider loader={fake.loader}>{children}</ResourceLoaderProvider>
      </MissingResourcesProvider>
    );
    const { result } = renderHook(
      () => {
        useMaterial({ kind: 'file', path: `${TRES_PATH}::Inner_a` });
        useMaterial({ kind: 'file', path: `${TRES_PATH}::Inner_b` });
        return useMissingResources().missingPaths;
      },
      { wrapper }
    );

    expect([...result.current].sort()).toEqual([`${TRES_PATH}::Inner_a`, `${TRES_PATH}::Inner_b`]);
  });

  it('answers absent for a sub-resource the file does not declare', () => {
    const { result } = renderMaterial(
      { kind: 'file', path: `${TRES_PATH}::Missing` },
      { [TRES_PATH]: PAINT_TRES }
    );

    expect(result.current).toEqual({ status: 'absent' });
  });

  it("declines a material type it does not build: Godot's default surface", () => {
    const orm = PAINT_TRES.replace('type="StandardMaterial3D" load_steps', 'type="ORMMaterial3D" load_steps');
    const { result } = renderMaterial({ kind: 'file', path: TRES_PATH }, { [TRES_PATH]: orm });

    expect(result.current).toEqual({ status: 'declined', type: 'ORMMaterial3D' });
  });

  it('declines a ShaderMaterial with one warning, from either arrival', () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const fromScene = renderMaterial(inline('Shader_fx'));
    const shaderTres = PAINT_TRES.replace(
      'type="StandardMaterial3D" load_steps',
      'type="ShaderMaterial" load_steps'
    );
    const fromFile = renderMaterial({ kind: 'file', path: TRES_PATH }, { [TRES_PATH]: shaderTres });

    expect(fromScene.result.current).toEqual({ status: 'declined', type: 'ShaderMaterial' });
    expect(fromFile.result.current).toEqual({ status: 'declined', type: 'ShaderMaterial' });
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn.mock.calls.every(([message]) => String(message).includes('ShaderMaterial'))).toBe(true);
  });

  it('answers absent for no source at all', () => {
    const { result } = renderMaterial(undefined);

    expect(result.current).toEqual({ status: 'absent' });
  });
});
