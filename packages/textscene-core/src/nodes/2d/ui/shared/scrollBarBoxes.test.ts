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

/** Each class that builds its own bars: `item_list.cpp:2472`, `rich_text_label.cpp:8208`, `scroll_container.cpp:919`, `graph_edit.cpp:3211`, `text_edit.cpp`'s constructor, and PopupMenu's ScrollContainer (`popup_menu.cpp:3490`). */
const HOSTS = ['ItemList', 'RichTextLabel', 'ScrollContainer', 'GraphEdit', 'TextEdit', 'PopupMenu'] as const;

/** A host whose Theme chain is an ancestor's Theme of `styles`, the host itself carrying none. */
function hostUnder(styles: Record<string, Record<string, string>>, type: string = 'ItemList'): SolveNode {
  const theme = {
    ...themeResource({ colors: {} }),
    styles,
    resources: { externalResources: [], internalResources: [WIDE_GRABBER] },
  };
  return { ...solveNode(), path: 'Host', node: controlNode('Host', type), themeChain: [theme] };
}

const itemListUnder = (styles: Record<string, Record<string, string>>) => hostUnder(styles);

describe('internalScrollBarBoxes', () => {
  it("reads the default theme table's boxes when no Theme themes a scroll bar", () => {
    expect(internalScrollBarBoxes(itemListUnder({}))).toEqual(defaultScrollBarBoxes(1));
  });

  it("gives the vertical bar a VScrollBar grabber of the host's Theme, and the horizontal bar none of it", () => {
    const boxes = internalScrollBarBoxes(itemListUnder({ VScrollBar: { grabber: 'SubResource("wide")' } }));
    expect(boxes.vertical.grabber.contentMargin).toMatchObject({ left: 7, top: 5 });
    expect(boxes.horizontal.grabber).toEqual(defaultScrollBarBoxes(1).horizontal.grabber);
  });

  it.each(HOSTS)("gives the bars of a %s an ancestor Theme's VScrollBar grabber", (type) => {
    const boxes = internalScrollBarBoxes(hostUnder({ VScrollBar: { grabber: 'SubResource("wide")' } }, type));
    expect(boxes.vertical.grabber.contentMargin).toMatchObject({ left: 7, top: 5 });
  });

  it("does not read a grabber the Theme gives the host's own class", () => {
    const boxes = internalScrollBarBoxes(
      hostUnder({ ScrollContainer: { grabber: 'SubResource("wide")' } }, 'ScrollContainer')
    );
    expect(boxes).toEqual(defaultScrollBarBoxes(1));
  });
});
