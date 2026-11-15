import { describe, expect, it } from 'vitest';
import { loadOutcome, type LoadFacts } from './loadOutcome';

/** Facts over text files, each with the paths whose failure fails it, and the other files that exist. */
function factsOver(
  textFiles: Readonly<Record<string, readonly string[] | null>>,
  otherFiles: readonly string[] = []
): LoadFacts {
  return {
    failingReads: async (path) => textFiles[path] ?? null,
    exists: async (path) => path in textFiles || otherFiles.includes(path),
  };
}

describe('loadOutcome', () => {
  it('loads a text file whose reads all exist', async () => {
    const facts = factsOver({ 'res://main.tscn': ['res://icon.png'] }, ['res://icon.png']);

    expect(await loadOutcome('res://main.tscn', facts)).toEqual({ isFailed: false });
  });

  it('fails a text file that reads a missing file, with the chain to it', async () => {
    const facts = factsOver({ 'res://main.tscn': ['res://gone.png'] });

    expect(await loadOutcome('res://main.tscn', facts)).toEqual({
      isFailed: true,
      chain: ['res://main.tscn', 'res://gone.png'],
      cause: 'missing',
    });
  });

  it('fails through two levels of text files', async () => {
    const facts = factsOver({
      'res://main.tscn': ['res://outer.tres'],
      'res://outer.tres': ['res://inner.tres'],
      'res://inner.tres': ['res://gone.png'],
    });

    expect(await loadOutcome('res://main.tscn', facts)).toMatchObject({
      chain: ['res://main.tscn', 'res://outer.tres', 'res://inner.tres', 'res://gone.png'],
    });
  });

  it('fails a text file that reads one that exists but does not parse', async () => {
    const facts: LoadFacts = {
      failingReads: async (path) => (path === 'res://main.tscn' ? ['res://broken.tres'] : null),
      exists: async () => true,
    };

    expect(await loadOutcome('res://main.tscn', facts)).toEqual({
      isFailed: true,
      chain: ['res://main.tscn', 'res://broken.tres'],
      cause: 'unparsed',
    });
  });

  it('fails a missing file on its own', async () => {
    expect(await loadOutcome('res://gone.tres', factsOver({}))).toMatchObject({
      chain: ['res://gone.tres'],
      cause: 'missing',
    });
  });

  it('loads a cycle of text files', async () => {
    const facts = factsOver({ 'res://a.tres': ['res://b.tres'], 'res://b.tres': ['res://a.tres'] });

    expect(await loadOutcome('res://a.tres', facts)).toEqual({ isFailed: false });
  });
});
