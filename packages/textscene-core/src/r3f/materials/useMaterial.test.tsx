/**
 * The one load step every material slot reads: a reference read with the `MATERIAL` kind, the same
 * value whether the material is written in the scene, is a whole `.tres`, or is a `[sub_resource]`
 * inside one.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import * as logger from '../../logger';
import { parseTresFile, type ParsedResource } from '../../parser/parsedResource';
import type { TscnExternalResource, TscnInternalResource } from '../../parser/types';
import { nodeReference, type ScopedReference } from '../../resources/reading';
import { ResourceLoaderProvider } from '../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../resources/testing/createFakeResourceLoader';
import { useMissingResources } from '../contexts/MissingResourcesContext';
import { missingResourcesWrapper } from '../../resources/testing/missingResourcesWrapper';
import { fileMaterial } from './materialReference';
import { inlineSource } from './surfaceMaterial.testkit';
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
  {
    id: 'Mat_body',
    type: 'StandardMaterial3D',
    data: { albedo_color: 'Color(0, 1, 0, 1)', next_pass: 'SubResource("Shader_fx")' },
  },
  { id: 'Shader_fx', type: 'ShaderMaterial', data: {} },
];
const SCENE_EXTERNAL: TscnExternalResource[] = [];

function inline(id: string): ScopedReference {
  const resource = SCENE_INTERNAL.find((entry) => entry.id === id)!;
  return inlineSource(resource, SCENE_INTERNAL, SCENE_EXTERNAL);
}

function renderMaterial(source: ScopedReference | undefined, seeded: Record<string, string> = {}) {
  const fake = createFakeResourceLoader();
  for (const [path, text] of Object.entries(seeded)) fake.resources.seed(path, parseTresFile(text));
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ResourceLoaderProvider loader={fake.loader}>{children}</ResourceLoaderProvider>
  );
  return { fake, ...renderHook(() => useMaterial(source), { wrapper }) };
}

function MaterialReader({ path }: { path: string }) {
  useMaterial(fileMaterial(path));
  return null;
}

/** The missing-resources rows while one `useMaterial` reads each of `paths` from `TRES_PATH`. */
function missingRows(seeded: ParsedResource | null, paths: string[]): string[] {
  const fake = createFakeResourceLoader();
  fake.resources.seed(TRES_PATH, seeded);
  const Providers = missingResourcesWrapper(fake.loader);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <Providers>
      {paths.map((path) => (
        <MaterialReader key={path} path={path} />
      ))}
      {children}
    </Providers>
  );
  const { result } = renderHook(() => useMissingResources().missingPaths, { wrapper });
  return [...result.current];
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useMaterial', () => {
  it('hands back a scene material whose references resolve in the scene tables', () => {
    const { result } = renderMaterial(inline('Mat_body'));
    const material = readyMaterial(result.current);

    expect(material?.data.albedo[1]).toBeCloseTo(1);
    expect(material?.nextPass?.resources.internalResources).toBe(SCENE_INTERNAL);
    expect(material?.nextPass?.origin).toBeUndefined();
  });

  it('keeps one material across renders that rebuild an equal source', () => {
    const fake = createFakeResourceLoader();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ResourceLoaderProvider loader={fake.loader}>{children}</ResourceLoaderProvider>
    );
    const scope = { internalResources: SCENE_INTERNAL, externalResources: SCENE_EXTERNAL };
    const { result, rerender } = renderHook(
      () => useMaterial(nodeReference('SubResource("Mat_body")', scope)),
      {
        wrapper,
      }
    );
    const first = result.current;
    rerender();

    expect(result.current).toBe(first);
    expect(first.status).toBe('ready');
  });

  it("reads a whole .tres as its [resource] body, each slot in the file's own tables", () => {
    const { result } = renderMaterial(fileMaterial(TRES_PATH), { [TRES_PATH]: PAINT_TRES });
    const albedo = readyMaterial(result.current)?.textures.albedo_texture;

    expect(readyMaterial(result.current)?.data.albedo[0]).toBeCloseTo(1);
    expect(albedo?.ref).toBe('ExtResource("1_grain")');
    expect(albedo?.resources.externalResources.map((ext) => ext.path)).toEqual(['res://grain.png']);
    expect(albedo?.origin).toBe(TRES_PATH);
  });

  it("reads a sub-resource address as that [sub_resource], in its file's tables", () => {
    const { result } = renderMaterial(fileMaterial(`${TRES_PATH}::Inner_mat`), { [TRES_PATH]: PAINT_TRES });
    const material = readyMaterial(result.current);

    expect(material?.data.albedo[2]).toBeCloseTo(1);
  });

  it('answers absent while the file loads, then the material', () => {
    const { result, fake } = renderMaterial(fileMaterial(TRES_PATH));
    expect(result.current).toEqual({ status: 'absent' });

    act(() => fake.resources._resolve(TRES_PATH, parseTresFile(PAINT_TRES)));
    expect(result.current.status).toBe('ready');
  });

  it('answers absent for a file that fails to load, so nothing replaces what the surface had', () => {
    const { result, fake } = renderMaterial(fileMaterial(TRES_PATH));
    act(() => fake.resources._fail(TRES_PATH, 'not found'));

    expect(result.current).toEqual({ status: 'absent' });
  });

  it('reports the file of a failed sub-resource address once, as its file', () => {
    const rows = missingRows(null, [`${TRES_PATH}::Inner_a`, `${TRES_PATH}::Inner_b`]);

    expect(rows).toEqual([TRES_PATH]);
  });

  it('reports no row for a file that loads', () => {
    expect(missingRows(parseTresFile(PAINT_TRES), [`${TRES_PATH}::Inner_mat`])).toEqual([]);
  });

  it('answers absent for a sub-resource the file does not declare', () => {
    const { result } = renderMaterial(fileMaterial(`${TRES_PATH}::Missing`), { [TRES_PATH]: PAINT_TRES });

    expect(result.current).toEqual({ status: 'absent' });
  });

  it("declines a material type it does not build: Godot's default surface", () => {
    const orm = PAINT_TRES.replace('type="StandardMaterial3D" load_steps', 'type="ORMMaterial3D" load_steps');
    const { result } = renderMaterial(fileMaterial(TRES_PATH), { [TRES_PATH]: orm });

    expect(result.current).toEqual({ status: 'declined', type: 'ORMMaterial3D' });
  });

  it('declines an ORMMaterial3D written in the scene as it declines the same material in a .tres', () => {
    const orm: TscnInternalResource = {
      id: 'Orm_mat',
      type: 'ORMMaterial3D',
      data: { albedo_color: 'Color(0.1, 0.3, 0.9, 1)' },
    };
    const fromScene = renderMaterial(inlineSource(orm));
    const ormTres = PAINT_TRES.replace(
      'type="StandardMaterial3D" load_steps',
      'type="ORMMaterial3D" load_steps'
    );
    const fromFile = renderMaterial(fileMaterial(TRES_PATH), { [TRES_PATH]: ormTres });

    expect(fromScene.result.current).toEqual({ status: 'declined', type: 'ORMMaterial3D' });
    expect(fromFile.result.current).toEqual({ status: 'declined', type: 'ORMMaterial3D' });
  });

  it('declines a ShaderMaterial with one warning, from either arrival', () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const fromScene = renderMaterial(inline('Shader_fx'));
    const shaderTres = PAINT_TRES.replace(
      'type="StandardMaterial3D" load_steps',
      'type="ShaderMaterial" load_steps'
    );
    const fromFile = renderMaterial(fileMaterial(TRES_PATH), { [TRES_PATH]: shaderTres });

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
