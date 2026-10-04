import { describe, expect, it } from 'vitest';
import * as vscode from 'vscode';
import { TscnFoldingRangeProvider } from './TscnFoldingRangeProvider';
import { createMockDocument } from './TscnDefinitionProvider.testkit';

const TOKEN = {} as vscode.CancellationToken;
const CONTEXT = {} as vscode.FoldingContext;

describe('TscnFoldingRangeProvider', () => {
  it('folds each section that reaches past its heading', () => {
    const text = [
      '[node name="Root" type="Node3D"]',
      'visible = false',
      '',
      '[node name="Child" type="Node3D"]',
    ].join('\n');
    const ranges = new TscnFoldingRangeProvider().provideFoldingRanges(
      createMockDocument(text),
      CONTEXT,
      TOKEN
    );
    expect(ranges).toEqual([new vscode.FoldingRange(0, 1, vscode.FoldingRangeKind.Region)]);
  });

  it('folds nothing in a document of bare headings', () => {
    const ranges = new TscnFoldingRangeProvider().provideFoldingRanges(
      createMockDocument('[node name="A" type="Node"]'),
      CONTEXT,
      TOKEN
    );
    expect(ranges).toEqual([]);
  });
});
