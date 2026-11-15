import { describe, expect, it } from 'vitest';
import { PreprocessedOutput } from './preprocessedOutput.js';

describe('PreprocessedOutput', () => {
  it('joins the expanded text and the open text', () => {
    const output = new PreprocessedOutput();
    output.append('a');
    output.expandOpenText((text) => text.toUpperCase());
    output.append('b');
    expect(output.text()).toBe('Ab');
  });

  it('expands only the text since the last expansion', () => {
    const output = new PreprocessedOutput();
    const seen: string[] = [];
    output.append('a');
    output.expandOpenText((text) => (seen.push(text), text));
    output.append('b');
    output.expandOpenText((text) => (seen.push(text), text));
    expect(seen).toEqual(['a', 'b']);
  });

  it('is empty before anything is written', () => {
    expect(new PreprocessedOutput().text()).toBe('');
  });
});
