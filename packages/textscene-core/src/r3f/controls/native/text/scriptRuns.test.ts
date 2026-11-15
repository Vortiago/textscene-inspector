/** The script runs of a text, against Godot's `ScriptIterator` (`script_iterator.cpp`). */
import { describe, expect, it } from 'vitest';
import { scriptRunIds } from './scriptRuns';

/** The text of each run of `text`, in logical order. */
function runsOf(text: string): string[] {
  const ids = scriptRunIds(text);
  const runs: string[] = [];
  for (let i = 0; i < text.length; i++) {
    if (i === 0 || ids[i] !== ids[i - 1]) runs.push('');
    runs[runs.length - 1] += text[i];
  }
  return runs;
}

describe('scriptRunIds', () => {
  it('keeps one script with its spaces, digits and punctuation as one run', () => {
    expect(runsOf('A.V A 1')).toEqual(['A.V A 1']);
  });

  it('starts a run where the script changes', () => {
    expect(runsOf('AѴ')).toEqual(['A', 'Ѵ']);
  });

  it('gives a Common character the script before it', () => {
    expect(runsOf('А 1 A')).toEqual(['А 1 ', 'A']);
  });

  it('gives a Common character at the start the first script after it', () => {
    expect(runsOf('1AА')).toEqual(['1A', 'А']);
  });

  it('keeps a text of digits and spaces as one Common run', () => {
    expect(runsOf('12 34')).toEqual(['12 34']);
  });

  it('keeps a combining mark in the run of its base', () => {
    expect(runsOf('А́A')).toEqual(['А́', 'A']);
  });

  it('closes a bracket pair in the script it opened in', () => {
    expect(runsOf('А(Ѵ)')).toEqual(['А(Ѵ)']);
  });

  // Godot never resets the depth below which a run gives its script to open brackets
  // (`script_iterator.cpp:85,158`), so the first run that learns a script keeps the bracket.
  it('gives a closing bracket the script of the run that first gave its opening bracket one', () => {
    expect(runsOf('Ж(AЖ)')).toEqual(['Ж(', 'A', 'Ж', ')']);
  });

  it('treats an unmatched closing bracket as Common', () => {
    expect(runsOf('A)А')).toEqual(['A)', 'А']);
  });

  it('gives an unassigned code point the script Unknown, a run of its own', () => {
    expect(runsOf('A͸B')).toEqual(['A', '͸', 'B']);
  });

  it('makes an emoji between two letters a run of its own', () => {
    expect(runsOf('A\u{1F600}B')).toEqual(['A', '\u{1F600}', 'B']);
  });

  it('keeps a joined emoji sequence in one emoji run', () => {
    expect(runsOf('A\u{1F468}‍\u{1F469}B')).toEqual(['A', '\u{1F468}‍\u{1F469}', 'B']);
  });

  it('splits Hebrew from the Latin inside its brackets', () => {
    expect(runsOf('א(Ave)ב')).toEqual(['א(', 'Ave)', 'ב']);
  });
});
