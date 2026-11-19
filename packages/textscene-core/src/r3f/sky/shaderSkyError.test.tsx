import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NodePathProvider } from '../contexts/NodePathContext';
import { ShaderErrorsProvider, useShaderErrors } from '../contexts/ShaderErrorsContext';
import * as transpiler from '../../resources/sky/shaderSky';
import type { ShaderSkyProperties } from '../../resources/sky/types';
import type { SkyTranspiler } from './skyTranspiler';
import type { ProjectShaderOptions } from '../../shaders/rendererShaderOptions';
import { useShaderSkyErrorReport } from './shaderSkyError';

function shaderSky(code: string): ShaderSkyProperties {
  return {
    code,
    file: 'res://sky.gdshader',
    parameters: {},
    textures: {},
    usage: {
      light: false,
      time: false,
      position: false,
      hasBufferUniforms: false,
      passColors: [],
      samplers: {},
    },
  };
}

const UNCOMPILED = shaderSky('shader_type sky;\nvoid sky() { COLOR = 1.0; }\n');

interface SkyProps {
  material: ShaderSkyProperties;
  transpiler: SkyTranspiler | null;
  options: ProjectShaderOptions | null;
}

function Sky({ material, transpiler, options }: SkyProps) {
  useShaderSkyErrorReport(material, transpiler, options);
  return null;
}

function Errors() {
  return <span data-testid="errors">{useShaderErrors('World/Environment').join('|')}</span>;
}

function renderSky(
  material: ShaderSkyProperties,
  {
    loaded = transpiler,
    options = { decoders: {} },
  }: { loaded?: SkyTranspiler | null; options?: ProjectShaderOptions | null } = {}
) {
  render(
    <ShaderErrorsProvider>
      <NodePathProvider path="World/Environment">
        <Sky material={material} transpiler={loaded} options={options} />
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

  it('reports nothing while the options load', () => {
    expect(renderSky(UNCOMPILED, { options: null })).toBe('');
  });

  it('reports nothing while the transpiler loads', () => {
    expect(renderSky(UNCOMPILED, { loaded: null })).toBe('');
  });
});
