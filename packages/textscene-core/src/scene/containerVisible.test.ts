import { describe, expect, it } from 'vitest';
import '../r3f/sceneLiveTree.js';
import '../nodes/2d/ui/tabcontainer/index';
import '../nodes/2d/ui/foldablecontainer/index';
import { openScene, type Scene } from './openScene';

const TABS = `[gd_scene format=3]

[node name="Tabs" type="TabContainer"]

[node name="First" type="Control" parent="."]

[node name="Second" type="Control" parent="."]

[node name="Third" type="Control" parent="."]
`;

const FOLD = `[gd_scene format=3]

[node name="Fold" type="FoldableContainer"]
folded = %FOLDED%

[node name="Inner" type="Control" parent="."]
visible = false
`;

const open = (source: string): Scene => openScene({ source, provider: { loadResource: async () => null } });
const visibleOf = (scene: Scene, path: string) => scene.getNode(path).get('visible');

describe("a TabContainer page's visible", () => {
  it('is false on a page that is not current (tab_container.cpp:377-399)', async () => {
    const scene = open(TABS);

    expect(await visibleOf(scene, '/root/Tabs/First')).toBe(true);
    expect(await visibleOf(scene, '/root/Tabs/Second')).toBe(false);
  });

  it('makes a shown page current (tab_container.cpp:619-620)', async () => {
    const scene = open(TABS);

    await scene.getNode('/root/Tabs/Second').set('visible', true);

    expect(await scene.getNode('/root/Tabs').get('current_tab')).toBe(1);
    expect(await visibleOf(scene, '/root/Tabs/Second')).toBe(true);
    expect(await visibleOf(scene, '/root/Tabs/First')).toBe(false);
  });

  it('moves a hidden current page on to the next one (tab_container.cpp:600-617)', async () => {
    const scene = open(TABS);

    await scene.getNode('/root/Tabs/First').set('visible', false);

    expect(await scene.getNode('/root/Tabs').get('current_tab')).toBe(1);
  });

  it('keeps the only page shown (tab_container.cpp:605-607)', async () => {
    const scene = open(`[gd_scene format=3]

[node name="Tabs" type="TabContainer"]

[node name="Only" type="Control" parent="."]
`);

    await scene.getNode('/root/Tabs/Only').set('visible', false);

    expect(await visibleOf(scene, '/root/Tabs/Only')).toBe(true);
  });
});

describe("a TabContainer's current_tab", () => {
  const currentTabOf = (scene: Scene) => scene.getNode('/root/Tabs').get('current_tab');

  it('is the first page with none authored (tab_bar.cpp:763-767)', async () => {
    expect(await currentTabOf(open(TABS))).toBe(0);
  });

  it('is -1 with no page (tab_bar.cpp:763-767)', async () => {
    expect(await currentTabOf(open('[gd_scene format=3]\n\n[node name="Tabs" type="TabContainer"]\n'))).toBe(
      -1
    );
  });

  it('moves past the page a write hides (tab_container.cpp:600-617)', async () => {
    const scene = open(TABS);
    await scene.getNode('/root/Tabs/Second').set('visible', true);

    await scene.getNode('/root/Tabs/Second').set('visible', false);

    expect(await currentTabOf(scene)).toBe(2);
  });
});

describe("a FoldableContainer child's visible", () => {
  it('is false under a folded container (foldable_container.cpp:375-380)', async () => {
    expect(await visibleOf(open(FOLD.replace('%FOLDED%', 'true')), '/root/Fold/Inner')).toBe(false);
  });

  it('is true under an unfolded container, whatever the file says', async () => {
    expect(await visibleOf(open(FOLD.replace('%FOLDED%', 'false')), '/root/Fold/Inner')).toBe(true);
  });

  it("goes back to the container's value after a write (container.cpp:33-36)", async () => {
    const scene = open(FOLD.replace('%FOLDED%', 'false'));

    await scene.getNode('/root/Fold/Inner').set('visible', false);

    expect(await visibleOf(scene, '/root/Fold/Inner')).toBe(true);
  });
});
