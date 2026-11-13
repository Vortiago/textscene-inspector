/** A Control's internal scroll bars read HScrollBar's and VScrollBar's boxes through the host's Theme chain. */
import { describe, expect, it } from 'vitest';
import type { TscnInternalResource } from '../../../../parser/types';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { controlNode, solveNode } from '../../../../r3f/controls/native/testing/solveNode';
import { themeResource } from '../../../../r3f/controls/native/testing/themeResource';
import { internalScrollBarBoxes } from './scrollBarBoxes';
import { defaultScrollBarBoxes } from './testing/scrollBarBoxes';

const WIDE_GRABBER: TscnInternalResource = {
  id: 'wide',
  type: 'StyleBoxFlat',
  data: { content_margin_left: '7.0', content_margin_top: '5.0' },
};

function itemListUnder(styles: Record<string, Record<string, string>>): SolveNode {
  const theme = {
    ...themeResource({ colors: {} }),
    styles,
    resources: { externalResources: [], internalResources: [WIDE_GRABBER] },
  };
  return { ...solveNode(), path: 'List', node: controlNode('List', 'ItemList'), themeChain: [theme] };
}

describe('internalScrollBarBoxes', () => {
  it("reads the default theme table's boxes when no Theme themes a scroll bar", () => {
    expect(internalScrollBarBoxes(itemListUnder({}))).toEqual(defaultScrollBarBoxes(1));
  });

  it("gives the vertical bar a VScrollBar grabber of the host's Theme, and the horizontal bar none of it", () => {
    const boxes = internalScrollBarBoxes(itemListUnder({ VScrollBar: { grabber: 'SubResource("wide")' } }));
    expect(boxes.vertical.grabber.contentMargin).toMatchObject({ left: 7, top: 5 });
    expect(boxes.horizontal.grabber).toEqual(defaultScrollBarBoxes(1).horizontal.grabber);
  });
});
