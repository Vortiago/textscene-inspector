import { describe, expect, it } from 'vitest';
import { decodeSky, decodeSkyProcessing, skyUpdateMode, withAutomaticBake } from './decode';
import { skyMaterialText } from './skyMaterialText';
import { readShaderSky } from './shaderSky';
import { warningsOf } from '../../r3f/testing/logWarnings';
import type { Sky, SkyBake } from './types';
import type { SkyUsage } from '../../shaders/sky/skyUsage';

describe('decodeSkyProcessing — how a Sky bakes its radiance', () => {
  it('applies Godot’s defaults, Automatic at 256, for a bare Sky', () => {
    expect(decodeSkyProcessing({})).toEqual({ processMode: 'automatic', radianceSize: 256 });
  });

  it('reads an authored process mode and radiance size', () => {
    expect(decodeSkyProcessing({ process_mode: '3', radiance_size: '1' })).toEqual({
      processMode: 'real-time',
      radianceSize: 64,
    });
  });

  it('keeps the default size for an index the setter refuses (edge case)', () => {
    expect(decodeSkyProcessing({ radiance_size: '7' })).toMatchObject({ radianceSize: 256 });
  });

  it('reads an invalid value as the default and warns nothing, as the validators report it (error path)', () => {
    const read = () => decodeSkyProcessing({ process_mode: 'x', radiance_size: '-1' });

    expect(warningsOf(read)).toEqual([]);
    expect(read()).toEqual({ processMode: 'automatic', radianceSize: 256 });
  });
});

describe('decodeSky — the filter that bakes a Sky’s layers', () => {
  const material = skyMaterialText('ProceduralSkyMaterial', {}, {})!;

  it('carries the material it draws', () => {
    expect(decodeSky({}, material).material).toBe(material);
  });

  it('bakes a Real-Time sky with the fast filter', () => {
    expect(decodeSky({ process_mode: '3' }, material).radianceFilter).toBe('fast');
  });

  it.each(['0', '1', '2'])('importance-samples a built-in material under process mode %s', (mode) => {
    expect(decodeSky({ process_mode: mode }, material).radianceFilter).toBe('importance-sample');
  });

  it('importance-samples a process mode past Real-Time, which falls back to Automatic', () => {
    expect(decodeSky({ process_mode: '9' }, material).radianceFilter).toBe('importance-sample');
  });
});

describe('decodeSky — the size a Sky’s radiance bakes at', () => {
  const material = skyMaterialText('ProceduralSkyMaterial', {}, {})!;

  it('bakes at 256 by default', () => {
    expect(decodeSky({}, material).radianceSize).toBe(256);
  });

  it('bakes at the size radiance_size names', () => {
    expect(decodeSky({ radiance_size: '0' }, material).radianceSize).toBe(32);
  });

  it('bakes a Real-Time sky at 256 whatever its radiance_size, as Godot does (edge case)', () => {
    expect(decodeSky({ process_mode: '3', radiance_size: '1' }, material).radianceSize).toBe(256);
  });

  it('keeps 256 for an index the setter refuses (error case)', () => {
    expect(decodeSky({ radiance_size: '9' }, material).radianceSize).toBe(256);
  });

  it('admits the fast filter only at the real-time size', () => {
    // A type contract, held by `type-check:tests`: no Sky reaches the fast filter at another size.
    // @ts-expect-error: Godot bakes a real-time sky at REAL_TIME_RADIANCE_SIZE alone.
    const fastAt32: SkyBake = { radianceFilter: 'fast', radianceSize: 32 };
    const importanceAt32: SkyBake = { radianceFilter: 'importance-sample', radianceSize: 32 };
    expect(fastAt32.radianceSize).toBe(importanceAt32.radianceSize);
  });
});

describe('skyUpdateMode — the mode Godot picks for an Automatic sky', () => {
  const NO_USAGE: SkyUsage = {
    light: false,
    time: false,
    position: false,
    hasBufferUniforms: false,
    passColors: [],
    samplers: {},
  };
  const shaderSky = (usage: Partial<SkyUsage>, data: Record<string, string> = {}): Sky =>
    decodeSky(data, {
      code: '',
      file: 'res://sky.gdshader',
      parameters: {},
      textures: {},
      usage: { ...NO_USAGE, ...usage },
    });

  it.each(['time', 'position'] as const)(
    'runs a shader that reads %s at radiance size 256 in real time',
    (read) => {
      expect(skyUpdateMode(shaderSky({ [read]: true, light: true }), false)).toBe('real-time');
    }
  );

  it('runs a shader that reads TIME at another radiance size incrementally when it has a uniform (edge case)', () => {
    const sky = shaderSky({ time: true, hasBufferUniforms: true }, { radiance_size: '1' });
    expect(skyUpdateMode(sky, false)).toBe('incremental');
  });

  it('runs a shader that reads a light incrementally', () => {
    expect(skyUpdateMode(shaderSky({ light: true }), false)).toBe('incremental');
  });

  it('runs a shader with a uniform and no light incrementally', () => {
    expect(skyUpdateMode(shaderSky({ hasBufferUniforms: true }), false)).toBe('incremental');
  });

  it('runs a shader that reads nothing incrementally under fog that scatters the sun', () => {
    expect(skyUpdateMode(shaderSky({}), true)).toBe('incremental');
  });

  it('runs a shader that reads nothing at full quality', () => {
    expect(skyUpdateMode(shaderSky({}), false)).toBe('quality');
  });

  it('runs every built-in material incrementally, since each holds uniforms', () => {
    const panorama = decodeSky(
      {},
      readShaderSky(skyMaterialText('PanoramaSkyMaterial', {}, {})!, { decoders: {} })
    );
    expect(skyUpdateMode(panorama, false)).toBe('incremental');
  });

  it('keeps the mode a Sky names', () => {
    expect(skyUpdateMode(shaderSky({ time: true }, { process_mode: '1' }), false)).toBe('quality');
  });
});

describe('withAutomaticBake — the filter of an Automatic shader sky', () => {
  const shaderSky = (time: boolean, data: Record<string, string> = {}): Sky =>
    decodeSky(data, {
      code: '',
      file: 'res://sky.gdshader',
      parameters: {},
      textures: {},
      usage: { light: false, time, position: false, hasBufferUniforms: false, passColors: [], samplers: {} },
    });

  it('bakes a sky that Automatic runs in real time with the fast filter', () => {
    expect(withAutomaticBake(shaderSky(true)).radianceFilter).toBe('fast');
  });

  it('importance-samples a sky that reads TIME at another radiance size (edge case)', () => {
    expect(withAutomaticBake(shaderSky(true, { radiance_size: '1' }))).toMatchObject({
      radianceFilter: 'importance-sample',
      radianceSize: 64,
    });
  });

  it('importance-samples a sky that reads neither TIME nor POSITION', () => {
    expect(withAutomaticBake(shaderSky(false)).radianceFilter).toBe('importance-sample');
  });
});
