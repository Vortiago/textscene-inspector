import { act } from 'react';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as logger from '../../logger';
import { memoisedImport, type LazyImport } from '../../resources/memoisedImport';
import type { ShaderText } from '../../resources/materials/shadermaterial/types';
import type { ProjectShaderOptions } from '../../shaders/rendererShaderOptions';
import { useShaderRefusalWarning, useShaderTranslator, type ShaderTranslator } from './useShaderTranslator';

const stubs = vi.hoisted(() => ({ nodesHandler: 'ready' as string, options: {} as object | null }));

vi.mock('../canvasRenderer/canvasNodesHandler', () => ({ useNodesHandler: () => stubs.nodesHandler }));
vi.mock('../projectShaderOptions', () => ({ useProjectShaderOptions: () => stubs.options }));

const LOAD_FAILURE = 'the translator did not load';
const OPTIONS = { stub: true } as unknown as ProjectShaderOptions;

function shaderOf(): ShaderText {
  return { code: 'shader_type canvas_item;\n', file: 'res://a.gdshader', parameters: {}, textures: {} };
}

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function renderTranslator(load: () => Promise<unknown>) {
  return renderTranslators(memoisedImport(load), [LOAD_FAILURE]);
}

/** One probe for each of `loadFailures`, all over one `lazy` import. */
async function renderTranslators(lazy: LazyImport<unknown>, loadFailures: readonly string[]) {
  const shader = shaderOf();
  const seen: (ShaderTranslator<unknown> | null)[] = [];
  function Probe({ loadFailure }: { loadFailure: string }) {
    seen.push(useShaderTranslator(lazy, shader.code, loadFailure));
    return null;
  }
  await ReactThreeTestRenderer.create(
    <>
      {loadFailures.map((loadFailure, index) => (
        <Probe key={index} loadFailure={loadFailure} />
      ))}
    </>
  );
  await settle();
  return seen;
}

async function renderRefusal(shader: ShaderText, refusal: string | null) {
  function Probe() {
    useShaderRefusalWarning(shader, refusal);
    return null;
  }
  await ReactThreeTestRenderer.create(<Probe />);
}

afterEach(() => {
  vi.restoreAllMocks();
  stubs.nodesHandler = 'ready';
});

describe('useShaderTranslator', () => {
  beforeEach(() => {
    stubs.options = OPTIONS;
  });

  it('gives null on the first render, while the module loads', async () => {
    let land: (module: object) => void = () => {};
    const seen = await renderTranslator(() => new Promise((resolve) => (land = resolve)));
    const beforeLanding = seen.length;
    await act(async () => land({}));

    expect(seen.slice(0, beforeLanding).every((translator) => translator === null)).toBe(true);
  });

  it('gives the module with the options once everything has loaded', async () => {
    const module = { name: 'translator' };
    const seen = await renderTranslator(() => Promise.resolve(module));

    expect(seen.at(-1)).toMatchObject({ module, options: OPTIONS });
  });

  it('gives null and warns the load failure once when the import fails', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const seen = await renderTranslator(() => Promise.reject(new Error('x')));

    expect(seen.at(-1)).toBeNull();
    expect(warn).toHaveBeenCalledExactlyOnceWith(LOAD_FAILURE);
  });

  it('warns each load failure message once, as callers name different fallbacks', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const lazy = memoisedImport(() => Promise.reject(new Error('x')));

    await renderTranslators(lazy, ['draws the default', 'draws the classic material', 'draws the default']);

    expect(warn.mock.calls).toEqual([['draws the default'], ['draws the classic material']]);
  });

  it('gives null while the project options load', async () => {
    stubs.options = null;
    const seen = await renderTranslator(() => Promise.resolve({}));

    expect(seen.at(-1)).toBeNull();
  });
});

describe('useShaderRefusalWarning', () => {
  it('warns the refusal once', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const shader = shaderOf();

    await renderRefusal(shader, '[material] refused');
    await renderRefusal(shader, '[material] refused');

    expect(warn).toHaveBeenCalledExactlyOnceWith('[material] refused');
  });

  it('does not warn without a refusal', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});

    await renderRefusal(shaderOf(), null);

    expect(warn).not.toHaveBeenCalled();
  });
});
