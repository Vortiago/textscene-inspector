import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type * as THREE from 'three';
import * as transpiler from '../../resources/sky/shaderSky';
import * as nodesHandler from '../canvasRenderer/canvasNodesHandler';
import { useSkyTranslator } from './skyTranspiler';

const gl = { setNodesHandler: vi.fn(), debug: {} } as unknown as THREE.WebGLRenderer;

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useSkyTranslator', () => {
  it('loads the transpiler and the nodes handler', async () => {
    const { result } = renderHook(() => useSkyTranslator(gl));
    await waitFor(() => expect(result.current.isReady).toBe(true));
    await waitFor(() => expect(result.current.transpiler?.readShaderSky).toBe(transpiler.readShaderSky));
  });

  it('names the failure when a part does not load, as the sky then draws nothing (error case)', () => {
    vi.spyOn(nodesHandler, 'useNodesHandler').mockReturnValue('failed');
    const { result } = renderHook(() => useSkyTranslator(gl));
    expect(result.current.loadFailure).toMatch(/^The previewer could not load its sky shader translator/);
  });
});
