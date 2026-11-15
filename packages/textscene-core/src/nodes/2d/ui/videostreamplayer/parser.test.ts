import { describe, expect, it } from 'vitest';
import type { ParsedHeading } from '../../../../parser/utils';
import { parseVideoStreamPlayer } from './parser';

function parse(properties: Record<string, string>) {
  const heading: ParsedHeading = { type: 'node', attributes: { name: 'V', type: 'VideoStreamPlayer' } };
  return parseVideoStreamPlayer(heading, properties);
}

describe('parseVideoStreamPlayer', () => {
  it('keeps the stream ref raw and reads expand', () => {
    const props = parse({ stream: 'ExtResource("1_video")', expand: 'true' });
    expect(props.stream).toBe('ExtResource("1_video")');
    expect(props.expand).toBe(true);
  });

  it('leaves the stream unset and expand off when neither is authored', () => {
    const props = parse({ anchors_preset: '15' });
    expect(props.stream).toBeUndefined();
    expect(props.expand).toBe(false);
    expect(props.anchorsPreset).toBe(15);
  });

  it('falls back to expand off on a malformed value', () => {
    expect(parse({ expand: 'maybe' }).expand).toBe(false);
  });
});
