import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NodePathProvider } from '../contexts/NodePathContext';
import { ShaderErrorsProvider, useShaderErrors } from '../contexts/ShaderErrorsContext';
import * as transpiler from '../../resources/sky/shaderSky';
import type { SkyProperties } from '../../resources/sky/types';
import type { SkyTranspiler } from './skyTranspiler';
import type { ShaderDecoders } from '../../shaders/preprocessor/decoders';
import { useShaderSkyErrorReport } from './shaderSkyError';

function shaderSky(code: string): SkyProperties {
  return {
    kind: 'shader',
    code,
    file: 'res://sky.gdshader',
    parameters: {},
    textures: {},
    usage: { light: false, timeOrPosition: false, hasBufferUniforms: false, samplers: {} },
  };
}

const UNCOMPILED = shaderSky('shader_type sky;\nvoid sky() { COLOR = 1.0; }\n');

interface SkyProps {
  material: SkyProperties;
  transpiler: SkyTranspiler | null;
  decoders: ShaderDecoders | null;
}

function Sky({ material, transpiler, decoders }: SkyProps) {
  useShaderSkyErrorReport(material, transpiler, decoders);
  return null;
}

function Errors() {
  return <span data-testid="errors">{useShaderErrors('World/Environment').join('|')}</span>;
}

function renderSky(
  material: SkyProperties,
  {
    loaded = transpiler,
    decoders = {},
  }: { loaded?: SkyTranspiler | null; decoders?: ShaderDecoders | null } = {}
) {
  render(
    <ShaderErrorsProvider>
      <NodePathProvider path="World/Environment">
        <Sky material={material} transpiler={loaded} decoders={decoders} />
      </NodePathProvider>
      <Errors />
    </ShaderErrorsProvider>
  );
  return screen.getByTestId('errors').textContent;
}

describe('useShaderSkyErrorReport', () => {
  it("reports Godot's error for a sky shader that does not compile", () => {
    expect(renderSky(UNCOMPILED)).toMatch(/^Godot does not compile the sky shader.* 2:\d+: /);
  });

  it('reports nothing for a sky shader that compiles', () => {
    expect(renderSky(shaderSky('shader_type sky;\nvoid sky() { COLOR = vec3(1.0); }\n'))).toBe('');
  });

  it('reports nothing while the decoders load', () => {
    expect(renderSky(UNCOMPILED, { decoders: null })).toBe('');
  });

  it('reports nothing while the transpiler loads', () => {
    expect(renderSky(UNCOMPILED, { loaded: null })).toBe('');
  });
});
