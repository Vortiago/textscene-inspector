import { describe, expect, it } from 'vitest';
import { loadOutcome, type LoadFacts } from './loadOutcome';

/** Facts over text files, each with the paths whose failure fails it, and the other files that exist. */
function factsOver(
  textFiles: Readonly<Record<string, readonly string[]>>,
  otherFiles: readonly string[] = []
): LoadFacts {
  return {
    failingReads: async (path) => textFiles[path] ?? 'unread',
    exists: async (path) => path in textFiles || otherFiles.includes(path),
    isImportFailed: async () => false,
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
      failingReads: async (path) => (path === 'res://main.tscn' ? ['res://broken.tres'] : 'unparsed'),
      exists: async () => true,
      isImportFailed: async () => false,
    };

    expect(await loadOutcome('res://main.tscn', facts)).toEqual({
      isFailed: true,
      chain: ['res://main.tscn', 'res://broken.tres'],
      cause: 'unparsed',
    });
  });

  it('fails a text file that reads an image whose import failed', async () => {
    const facts: LoadFacts = {
      ...factsOver({ 'res://main.tscn': ['res://corrupt.png'] }, ['res://corrupt.png']),
      isImportFailed: async (path) => path === 'res://corrupt.png',
    };

    expect(await loadOutcome('res://main.tscn', facts)).toEqual({
      isFailed: true,
      chain: ['res://main.tscn', 'res://corrupt.png'],
      cause: 'unimported',
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

  it('claims no failure where a file that exists could not be read', async () => {
    const facts = factsOver({ 'res://main.tscn': ['res://slow.tres'] }, ['res://slow.tres']);

    await expect(loadOutcome('res://main.tscn', facts)).rejects.toThrow('res://slow.tres');
  });

  it('reads a file that several files read once', async () => {
    const reads: string[] = [];
    const shared = factsOver(
      {
        'res://main.tscn': ['res://a.tres', 'res://b.tres'],
        'res://a.tres': ['res://shared.tres'],
        'res://b.tres': ['res://shared.tres'],
        'res://shared.tres': [],
      },
      []
    );
    const facts: LoadFacts = {
      ...shared,
      failingReads: (path) => (reads.push(path), shared.failingReads(path)),
    };

    await loadOutcome('res://main.tscn', facts);

    expect(reads.filter((path) => path === 'res://shared.tres')).toHaveLength(1);
  });
});
