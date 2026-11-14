/**
 * The face loader as a seam: each preview loads its fonts through the loader its `ResourceLoader`
 * holds, and a font that settles wakes only the readers of that preview.
 */
import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { TscnExternalResource, TscnInternalResource, TscnNode } from '../../../../parser/types';
import type { FontFileResource } from '../../../../resources/fonts/font/types';
import { labelFontState } from '../../../../nodes/2d/ui/label/nativeSolver';
import { useLabel3DFont } from '../../../../nodes/3d/label3d/useLabel3DFont';
import { FONT_PATH, trueTypeFontFile } from '../../../../resources/meshes/textmesh/textMeshFont.testkit';
import { useResolvableMesh } from '../../../../resources/meshes/useResolvableMesh';
import { ResourceLoaderProvider } from '../../../../resources/ResourceLoaderContext';
import {
  createFakeResourceLoader,
  type FakeResourceLoader,
} from '../../../../resources/testing/createFakeResourceLoader';
import { MissingResourcesProvider } from '../../../contexts/MissingResourcesContext';
import { useCsgGeometryContext } from '../../../csg/useCsgGeometryContext';
import { NO_RESOURCES, SceneResourcesProvider } from '../../../SceneResourcesContext';
import { useBuildSolveTree } from '../buildSolveTree';
import { TEST_SCENE_FONT_METRICS } from '../testing/sceneFontMetrics';
import { solveNode } from '../testing/solveNode';
import type { RegisteredCanvasFontMetrics } from './runtimeFontMetrics';
import { peekSceneFontMetrics } from './sceneFontLoader';
import { handLoader } from './settledFonts.testkit';
import { useWatchedSettledFonts } from './useSettledFont';
import '../../../../nodes/3d/csg/csgbox3d/index.r3f';
import '../../../../nodes/3d/csg/csgmesh3d/index.r3f';

const FACE = TEST_SCENE_FONT_METRICS as RegisteredCanvasFontMetrics;

const FONT_REFERENCE: TscnExternalResource = { id: 'font', type: 'FontFile', path: FONT_PATH };
const TEXT: TscnInternalResource = {
  id: 'Text',
  type: 'TextMesh',
  data: { text: '"H"', font: 'ExtResource("font")' },
};

function node(type: string, properties: Record<string, unknown> = {}, children: TscnNode[] = []): TscnNode {
  return {
    rawProperties: {},
    name: type,
    type,
    children,
    properties: { name: type, ...properties } as never,
  };
}

/** A CSG box holding a CSGMesh3D whose mesh is the TextMesh. */
const CSG_TEXT = node('CSGBox3D', {}, [node('CSGMesh3D', { mesh: 'SubResource("Text")', flipFaces: false })]);

function previewOf(fake: FakeResourceLoader) {
  return function Preview({ children }: { children: ReactNode }) {
    return (
      <MissingResourcesProvider>
        <ResourceLoaderProvider loader={fake.loader}>
          <SceneResourcesProvider internalResources={[TEXT]} externalResources={[FONT_REFERENCE]}>
            {children}
          </SceneResourcesProvider>
        </ResourceLoaderProvider>
      </MissingResourcesProvider>
    );
  };
}

const useLabel3DDraws = () => useLabel3DFont('ExtResource("font")') !== undefined;

const useTextMeshDraws = () =>
  useResolvableMesh({
    resource: TEXT,
    resources: { ...NO_RESOURCES, externalResources: [FONT_REFERENCE] },
  }).mesh !== null;

const useCsgDraws = () => !useCsgGeometryContext(CSG_TEXT).isLoading;

/** A Label's solve reads its settings font through the fonts its solve tree watches. */
function useLabelDraws(font: FontFileResource): boolean {
  const settledFonts = useWatchedSettledFonts();
  const label = labelFontState({
    ...solveNode(),
    path: 'Label',
    node: node('Label'),
    labelSettingsFont: font,
    settledFonts,
  });
  return !label.isLoading;
}

/**
 * Each reader of the font, mounted alone so that only its own wake re-renders it: a Label3D, a
 * TextMesh, a CSG text shape and a Label's settings font.
 */
const READERS = {
  label3D: useLabel3DDraws,
  textMesh: useTextMeshDraws,
  csg: useCsgDraws,
  label: useLabelDraws,
};

type Reader = keyof typeof READERS;

/** Whether `reader` draws: the hook of one reader, picked once for the whole test. */
function useReaderDraws(reader: Reader, font: FontFileResource): boolean {
  return READERS[reader](font);
}

describe('a face loader that stays pending', () => {
  it.each(Object.keys(READERS) as Reader[])(
    'draws nothing in a %s while the face loads, then draws once it settles',
    async (reader) => {
      const loader = handLoader();
      const fake = createFakeResourceLoader({ loadFace: loader.load });
      const font = trueTypeFontFile();
      const { result } = renderHook(() => useReaderDraws(reader, font), { wrapper: previewOf(fake) });

      act(() => fake.fonts._resolve(FONT_PATH, font));
      await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
      expect(result.current).toBe(false);

      await act(() => loader.settle(font.bytes!, FACE));

      await waitFor(() => expect(result.current).toBe(true));
    }
  );
});

describe('a reader that awaits its font', () => {
  it.each<Reader>(['textMesh', 'csg'])(
    'renders a %s 0 times for the settle of a load it did not read',
    async (reader) => {
      const loader = handLoader();
      const fake = createFakeResourceLoader({ loadFace: loader.load });
      const font = trueTypeFontFile();
      let renders = 0;
      renderHook(
        () => {
          renders += 1;
          return useReaderDraws(reader, font);
        },
        { wrapper: previewOf(fake) }
      );
      act(() => fake.fonts._resolve(FONT_PATH, font));
      await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
      const rendersBefore = renders;

      // A macrotask, not `settleFontWork`: the face load this reader awaits stays pending.
      await act(async () => {
        fake.loader.settledFonts.peekOutlines({}, () => Promise.resolve(null));
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(renders).toBe(rendersBefore);
    }
  );
});

/** A painter of a Label in the solve tree: it reads the font file through its node, once the file is there. */
function usePaintedLabel(fake: FakeResourceLoader): number {
  const forest = useBuildSolveTree(LABEL, [], []);
  const font = fake.fonts.getCached(FONT_PATH);
  if (font) peekSceneFontMetrics(forest.tree[0]!.settledFonts, font, 'Label');
  return forest.generation;
}

const LABEL = [node('Label')];

describe('two previews that read one font', () => {
  it('renders the solve tree of one preview 0 times for the settle of that font in the other', async () => {
    const [firstFaces, secondFaces] = [handLoader(), handLoader()];
    const first = createFakeResourceLoader({ loadFace: firstFaces.load });
    const second = createFakeResourceLoader({ loadFace: secondFaces.load });
    const font = trueTypeFontFile();
    const firstPreview = renderHook(() => usePaintedLabel(first), { wrapper: previewOf(first) });
    let secondRenders = 0;
    renderHook(
      () => {
        secondRenders += 1;
        return usePaintedLabel(second);
      },
      { wrapper: previewOf(second) }
    );
    act(() => {
      first.fonts._resolve(FONT_PATH, font);
      second.fonts._resolve(FONT_PATH, font);
    });
    const [firstGeneration, secondRendersBefore] = [firstPreview.result.current, secondRenders];

    await act(() => firstFaces.settle(font.bytes!, FACE));

    expect(firstPreview.result.current).toBeGreaterThan(firstGeneration);
    expect(secondRenders).toBe(secondRendersBefore);
  });
});
