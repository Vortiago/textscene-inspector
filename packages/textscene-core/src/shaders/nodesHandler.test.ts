/** The install of three's nodes handler on a renderer, at most once for each renderer. */

import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { float } from 'three/tsl';
import type { Node } from 'three/webgpu';
import { TranslatorFault } from './fault/translatorFault';
import { installNodesHandler } from './nodesHandler';
import { BoundNodeMaterial } from './uniforms/boundMaterial';

/** A renderer that records each handler it is given: the install needs no GL context. */
function recordingRenderer(onShaderError: unknown = null) {
  const setNodesHandler = vi.fn();
  const programs = new Map<object, { currentProgram: { program: object } }>();
  const renderer = {
    setNodesHandler,
    debug: { onShaderError },
    properties: {
      has: (material: object) => programs.has(material),
      get: (material: object) => programs.get(material),
    },
    info: { programs: [] as { program: object; name: string; type: string }[] },
  };
  return { renderer: renderer as unknown as THREE.WebGLRenderer, setNodesHandler, programs };
}

/** A context whose program gives a link log and whose shaders compile with no log. */
const LINKING_CONTEXT = {
  VALIDATE_STATUS: 0x8b83,
  COMPILE_STATUS: 0x8b81,
  getError: () => 0,
  getProgramParameter: () => false,
  getProgramInfoLog: () => 'Could not pack varying',
  getShaderParameter: () => true,
  getShaderInfoLog: () => '',
} as unknown as WebGL2RenderingContext;

/** `renderer` building a program for `material` that the GPU refuses, as three reports it. */
function refuseProgram(
  { renderer, programs }: ReturnType<typeof recordingRenderer>,
  material: THREE.Material
): void {
  const program = {} as WebGLProgram;
  programs.set(material, { currentProgram: { program } });
  renderer.info.programs!.push({ program, name: material.name, type: material.type } as never);
  const { onShaderError } = renderer.debug as unknown as { onShaderError: (...args: unknown[]) => void };
  onShaderError(LINKING_CONTEXT, program, {}, {});
}

/** A transpiled material whose faults land in `faults`. */
function faultRecordingMaterial(faults: TranslatorFault[]): BoundNodeMaterial {
  const material = new BoundNodeMaterial({
    parameters: [],
    source: { text: '', file: 'res://bands.gdshader' },
  });
  material.onTranslatorFault = (fault) => faults.push(fault);
  return material;
}

/** The hook three's types leave out of the handler. */
type OutputHook = { getOutputCallback: (outputNode: Node) => Node };

describe('installNodesHandler', () => {
  it('gives a renderer one handler', () => {
    const { renderer, setNodesHandler } = recordingRenderer();

    installNodesHandler(renderer, 'linear');

    expect(setNodesHandler).toHaveBeenCalledTimes(1);
  });

  it('changes nothing on a second call for the same renderer', () => {
    const { renderer, setNodesHandler } = recordingRenderer();

    installNodesHandler(renderer, 'linear');
    installNodesHandler(renderer);

    expect(setNodesHandler).toHaveBeenCalledTimes(1);
  });

  it('gives each renderer its own handler', () => {
    const first = recordingRenderer();
    const second = recordingRenderer();

    installNodesHandler(first.renderer, 'linear');
    installNodesHandler(second.renderer, 'linear');

    expect(second.setNodesHandler).toHaveBeenCalledTimes(1);
    expect(second.setNodesHandler.mock.calls[0]![0]).not.toBe(first.setNodesHandler.mock.calls[0]![0]);
  });

  it('writes a linear output unchanged', () => {
    const { renderer, setNodesHandler } = recordingRenderer();
    installNodesHandler(renderer, 'linear');
    const handler = setNodesHandler.mock.calls[0]![0] as OutputHook;
    const output = float(0.5);

    expect(handler.getOutputCallback(output)).toBe(output);
  });

  it("keeps the handler's own tone mapping and colour space by default", () => {
    const { renderer, setNodesHandler } = recordingRenderer();
    installNodesHandler(renderer);
    const handler = setNodesHandler.mock.calls[0]![0] as OutputHook & { renderer: unknown };
    // The renderer the handler's own callback reads, which `setRenderer` sets on a live renderer.
    handler.renderer = { toneMapping: THREE.ACESFilmicToneMapping, outputColorSpace: THREE.SRGBColorSpace };
    const output = float(0.5);

    expect(handler.getOutputCallback(output)).not.toBe(output);
  });

  it("hands a refused program of a transpiled material to the material's hook", () => {
    const recording = recordingRenderer();
    installNodesHandler(recording.renderer);
    const faults: TranslatorFault[] = [];

    refuseProgram(recording, faultRecordingMaterial(faults));

    expect(faults.map((fault) => [fault.source.file, fault.log])).toEqual([
      ['res://bands.gdshader', 'program: Could not pack varying'],
    ]);
  });

  it('hands a refused program to the hook the caller set before', () => {
    const previous = vi.fn();
    const recording = recordingRenderer(previous);
    installNodesHandler(recording.renderer);

    refuseProgram(recording, new THREE.MeshBasicMaterial());

    expect(previous).toHaveBeenCalledTimes(1);
  });

  it('still hands a fault to its material when the caller sets a hook after the install', () => {
    const recording = recordingRenderer();
    installNodesHandler(recording.renderer);
    const callerHook = vi.fn();
    recording.renderer.debug.onShaderError = callerHook;
    const faults: TranslatorFault[] = [];

    refuseProgram(recording, faultRecordingMaterial(faults));

    expect([faults.length, callerHook.mock.calls.length]).toEqual([1, 1]);
  });

  it('calls a caller hook that calls the hook it replaced once', () => {
    const recording = recordingRenderer();
    installNodesHandler(recording.renderer);
    const replaced = recording.renderer.debug.onShaderError!;
    const callerHook = vi.fn((...args: Parameters<typeof replaced>) => replaced(...args));
    recording.renderer.debug.onShaderError = callerHook;

    refuseProgram(recording, new THREE.MeshBasicMaterial());

    expect(callerHook).toHaveBeenCalledTimes(1);
  });

  it("gives three's own report for another material when the caller set no hook", () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const recording = recordingRenderer();
    installNodesHandler(recording.renderer);

    refuseProgram(recording, new THREE.MeshBasicMaterial());

    expect(error).toHaveBeenCalledWith(expect.stringContaining('Material Type: MeshBasicMaterial'));
    error.mockRestore();
  });

  it('gives no fault to a disposed material', () => {
    const recording = recordingRenderer();
    installNodesHandler(recording.renderer);
    const faults: TranslatorFault[] = [];
    const material = faultRecordingMaterial(faults);
    material.dispose();
    vi.spyOn(console, 'error').mockImplementation(() => {});

    refuseProgram(recording, material);

    expect(faults).toEqual([]);
    vi.restoreAllMocks();
  });
});
