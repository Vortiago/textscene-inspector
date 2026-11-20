import { describe, expect, it } from 'vitest';
import { findImportedFiles } from './webviewBudget.mjs';

describe('findImportedFiles', () => {
  it('names a file the script imports statically', () => {
    const script = 'import{a as b}from"./chunks/chunk-A.js";import"./chunks/chunk-B.js";';
    expect(findImportedFiles(script)).toEqual(['./chunks/chunk-A.js', './chunks/chunk-B.js']);
  });

  it('names a file the script re-exports', () => {
    expect(findImportedFiles('export*from"./chunks/chunk-C.js";')).toEqual(['./chunks/chunk-C.js']);
  });

  it('names a file the script loads through import()', () => {
    expect(findImportedFiles('const p=()=>import("./chunks/panel-D.js");')).toEqual(['./chunks/panel-D.js']);
  });

  it('passes a script that imports only a URL it builds at run time', () => {
    expect(findImportedFiles('import(scriptUri);const w=new Worker(URL.createObjectURL(blob));')).toEqual([]);
  });
});
