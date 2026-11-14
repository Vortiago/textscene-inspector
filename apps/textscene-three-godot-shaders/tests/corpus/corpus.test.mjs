/**
 * The transpiler on a corpus of real shaders, with Godot's verdict on each. Every shader
 * ends in one of three states: transpiled, refused as Godot refuses, or not transpiled yet with
 * the owner of the open row. `states.json` holds each state: a shader that leaves a settled state
 * fails, and a forward move is written with `vitest -u`. The count goes to the CI summary.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { verdictOfText } from '../../../../scripts/godot-probes/shaderVerdicts.mjs';
import { writeJobSummary } from '../consumer.mjs';
import { godotAnswers } from '../godotAnswers.mjs';
import { judge, transpilerVerdict } from '../verdicts/judge.mjs';
import { CORPUS } from './corpus.mjs';
import { KNOWN_MISMATCHES } from './knownMismatches.mjs';

const ANSWERS = godotAnswers();
const RECORD = ANSWERS.corpus;
const STATES_FILE = join(import.meta.dirname, 'states.json');
const COMMITTED_STATES = existsSync(STATES_FILE) ? JSON.parse(readFileSync(STATES_FILE, 'utf8')) : {};

const SHADER_TYPES = ['spatial', 'canvas_item', 'particles', 'sky', 'fog'];

const OUTCOMES = CORPUS.filter((shader) => RECORD.cases[shader.id] !== undefined).map((shader) => {
  const godot = verdictOfText(RECORD.cases[shader.id]);
  return { shader, godot, outcome: judge(godot, transpilerVerdict(shader.text)) };
});

/** A state as `states.json` holds it: the owner beside a shader not transpiled yet. */
const stateText = ({ state, owner }) => (owner ? `${state} (${owner})` : state);

const STATES = Object.fromEntries(OUTCOMES.map(({ shader, outcome }) => [shader.id, stateText(outcome)]));

describe('the corpus of real shaders', () => {
  it('records the source and licence of every shader', () => {
    expect(CORPUS.filter((shader) => !shader.source || !shader.licence).map((shader) => shader.id)).toEqual(
      []
    );
  });

  it.runIf(ANSWERS.live)('holds shaders of all five types that Godot accepts and that Godot rejects', () => {
    const kinds = (accepted) =>
      new Set(
        OUTCOMES.filter(({ godot }) => godot.accepted === accepted).map(({ shader }) => shader.shaderType)
      );
    expect([...kinds(true)].sort()).toEqual([...SHADER_TYPES].sort());
    expect(SHADER_TYPES.filter((type) => !kinds(false).has(type))).toEqual([]);
  });

  it.runIf(ANSWERS.live)("has Godot's verdict on every shader", () => {
    expect(
      CORPUS.filter((shader) => RECORD.cases[shader.id] === undefined).map((shader) => shader.id)
    ).toEqual([]);
  });

  it("has Godot's verdict on no shader the corpus has not", () => {
    const ids = new Set(CORPUS.map((shader) => shader.id));
    expect(Object.keys(RECORD.cases).filter((id) => !ids.has(id))).toEqual([]);
  });

  it('comes from Godot 4.6.3', () => {
    expect(RECORD.godot).toMatch(/^4\.6\.3-stable/);
  });

  it("gives Godot's verdict, message and line included, or names the owner of the open row", () => {
    const mismatches = OUTCOMES.filter(
      ({ shader, outcome }) => outcome.state === 'mismatch' && !(shader.id in KNOWN_MISMATCHES)
    ).map(({ shader, outcome }) => `${shader.id}: ${outcome.detail}`);
    expect(mismatches).toEqual([]);
  });

  it.runIf(ANSWERS.live)(
    'lists as known mismatches only shaders that still disagree, each with an owner',
    () => {
      const stale = Object.entries(KNOWN_MISMATCHES).filter(
        ([id, known]) => STATES[id] !== 'mismatch' || !/^#\d+$/.test(known.owner)
      );
      expect(stale.map(([id]) => `${id}: ${STATES[id] ?? 'not in the corpus'}`)).toEqual([]);
    }
  );

  // So the shaders not transpiled yet only grow fewer.
  it('moves no shader back from transpiled or from refused as Godot refuses', () => {
    const settled = new Set(['transpiled', 'refused as Godot refuses']);
    const back = Object.entries(COMMITTED_STATES).filter(
      ([id, state]) => settled.has(state) && (id in STATES || ANSWERS.live) && STATES[id] !== state
    );
    expect(back.map(([id]) => `${id}: ${STATES[id] ?? 'left the corpus'}`)).toEqual([]);
  });

  it.runIf(ANSWERS.live)('holds the state of every shader in states.json', async () => {
    await expect(`${JSON.stringify(STATES, null, 1)}\n`).toMatchFileSnapshot(STATES_FILE);
  });
});

afterAll(() => {
  if (!ANSWERS.live) return;
  const accepted = OUTCOMES.filter(({ godot }) => godot.accepted);
  const transpiled = accepted.filter(({ outcome }) => outcome.state === 'transpiled').length;
  const refused = OUTCOMES.filter(({ outcome }) => outcome.state === 'refused as Godot refuses').length;
  const line = `${transpiled} of ${accepted.length} real shaders transpile. ${refused} of ${OUTCOMES.length - accepted.length} that Godot rejects are refused as Godot refuses them.`;
  console.log(`[shader-corpus] ${line}`);
  writeJobSummary(`## Shader corpus against Godot\n\n${line}\n`);
});
