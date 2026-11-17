import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NodePathProvider } from '../contexts/NodePathContext';
import { ShaderErrorsProvider, useShaderErrors } from '../contexts/ShaderErrorsContext';
import type { SkyProperties } from '../../resources/sky/types';
import type { ShaderDecoders } from '../../shaders/preprocessor/decoders';
import { useShaderSkyErrorReport } from './shaderSkyError';

function shaderSky(code: string): SkyProperties {
  return {
    kind: 'shader',
    code,
    parameters: {},
    textures: {},
    usage: { light: false, time: false, position: false, colorSamplers: [] },
  };
}

const UNCOMPILED = shaderSky('shader_type sky;\nvoid sky() { COLOR = 1.0; }\n');

function Sky({ material, decoders }: { material: SkyProperties; decoders: ShaderDecoders | null }) {
  useShaderSkyErrorReport(material, decoders);
  return null;
}

function Errors() {
  return <span data-testid="errors">{useShaderErrors('World/Environment').join('|')}</span>;
}

function renderSky(material: SkyProperties, decoders: ShaderDecoders | null = {}) {
  render(
    <ShaderErrorsProvider>
      <NodePathProvider path="World/Environment">
        <Sky material={material} decoders={decoders} />
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
    expect(renderSky(UNCOMPILED, null)).toBe('');
  });
});
