import { describe, expect, it } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import * as transpiler from '../../resources/sky/shaderSky';
import { useSkyTranspiler } from './skyTranspiler';

describe('useSkyTranspiler', () => {
  it('loads the transpiler for a sky that needs it', async () => {
    const { result } = renderHook(() => useSkyTranspiler(true));
    await waitFor(() => expect(result.current?.readShaderSky).toBe(transpiler.readShaderSky));
  });

  it('gives none to a sky that needs none (edge case)', () => {
    expect(renderHook(() => useSkyTranspiler(false)).result.current).toBeNull();
  });
});
