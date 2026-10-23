/** A test child that records the sampler its position in the tree resolves to. */
import { useResolvedTextureSampler, type CanvasItemTextureSampler } from '../canvasItemTextureSampler';

export function samplerProbe(): { Probe: () => null; resolved: () => CanvasItemTextureSampler } {
  let sampler: CanvasItemTextureSampler | undefined;
  return {
    Probe: () => {
      sampler = useResolvedTextureSampler();
      return null;
    },
    resolved: () => sampler!,
  };
}
