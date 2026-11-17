import { describe, expect, it } from 'vitest';
import { MESH_SCENES } from '../e2e/meshScenes.mjs';
import { DRAWN, NOT_A_MATERIAL_BRANCH, OPEN, sceneBranchStates } from './sceneBranches.mjs';

const sources = MESH_SCENES.flatMap((scene) => [
  scene.source,
  ...(scene.others ?? []).flatMap((other) => other.source ?? []),
]);
const states = sceneBranchStates(sources);

describe('the branches of the unshaded colour pass', () => {
  it('holds the state of each branch of both stages in sceneBranches.json', async () => {
    await expect(`${JSON.stringify(states, null, 2)}\n`).toMatchFileSnapshot('./sceneBranches.json');
  });

  it('gives each branch one of the three states', () => {
    const all = Object.values(states).flatMap((stage) => Object.values(stage));
    const kinds = new Set(all.map((state) => (state.startsWith(`${OPEN}: `) ? OPEN : state)));
    expect(kinds).toEqual(new Set([DRAWN, OPEN, NOT_A_MATERIAL_BRANCH]));
  });

  it('names an open issue for each row of an open branch', () => {
    const open = Object.values(states)
      .flatMap((stage) => Object.values(stage))
      .filter((state) => state.startsWith(OPEN));
    expect(
      open.filter((state) => !/^open: .*\(#\d+\)$/.test(state) || state.includes('(transpiled)'))
    ).toEqual([]);
  });

  it('marks a branch of no scene open, and the same branch drawn once a scene takes it', () => {
    const plain = sceneBranchStates(['shader_type spatial;\nrender_mode unshaded;\n']).vertex;
    const withUv = sceneBranchStates([
      'shader_type spatial;\nrender_mode unshaded;\nvoid fragment() { ALBEDO = vec3(UV, 0.0); }\n',
    ]).vertex;
    const moved = Object.keys(withUv).filter((key) => plain[key].startsWith(OPEN) && withUv[key] === DRAWN);
    expect(moved.length).toBeGreaterThan(0);
  });
});
