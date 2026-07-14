/**
 * stepPlayback — exhaustive transition-table tests for the pure per-frame
 * playback-step reducer.
 *
 * The reducer decides which transport edge fired this frame and what the
 * driver adapter must do, without touching any THREE object or React hook.
 * Tests exercise every documented transition and the deliberate no-flush-on-
 * stop subtlety.
 */
import { describe, expect, it } from 'vitest';
import { stepPlayback, type StepPlaybackInput } from './stepPlayback';
import type { PlayState } from '../contexts/AnimationTransportContext';

/** Build a minimal input, override only what varies per test. */
function input(overrides: Partial<StepPlaybackInput> = {}): StepPlaybackInput {
  return {
    prevState: 'stopped',
    state: 'stopped',
    prevTime: 0,
    transportTime: 0,
    liveTime: null,
    clipChanged: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// stopped → stopped  (the default idle case)
// ---------------------------------------------------------------------------
describe('stepPlayback — stopped → stopped', () => {
  it('emits none when nothing changes in stopped state', () => {
    const result = stepPlayback(input());
    expect(result.command).toBe('none');
    expect(result.resume).toBe(false);
    expect(result.flushTime).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// stopped → playing  (fresh play entry)
// ---------------------------------------------------------------------------
describe('stepPlayback — stopped → playing', () => {
  it('emits ensure-playing with resume=true (fresh entry into playback)', () => {
    const result = stepPlayback(input({ prevState: 'stopped', state: 'playing' }));
    expect(result.command).toBe('ensure-playing');
    expect(result.resume).toBe(true);
    expect(result.flushTime).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// paused → playing  (resume from pause)
// ---------------------------------------------------------------------------
describe('stepPlayback — paused → playing', () => {
  it('emits ensure-playing with resume=true (re-entry into playback)', () => {
    const result = stepPlayback(input({ prevState: 'paused', state: 'playing' }));
    expect(result.command).toBe('ensure-playing');
    expect(result.resume).toBe(true);
    expect(result.flushTime).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// playing → playing  (continuing)
// ---------------------------------------------------------------------------
describe('stepPlayback — playing → playing', () => {
  it('emits ensure-playing with resume=false when already running', () => {
    const result = stepPlayback(input({ prevState: 'playing', state: 'playing' }));
    expect(result.command).toBe('ensure-playing');
    expect(result.resume).toBe(false);
    expect(result.flushTime).toBe(false);
  });

  it('emits ensure-playing with resume=true on clip switch mid-playback', () => {
    const result = stepPlayback(
      input({ prevState: 'playing', state: 'playing', clipChanged: true })
    );
    expect(result.command).toBe('ensure-playing');
    expect(result.resume).toBe(true);
    expect(result.flushTime).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// playing → paused  (pause edge — must flush time)
// ---------------------------------------------------------------------------
describe('stepPlayback — playing → paused', () => {
  it('emits hold-paused + flushTime=true so the paused readout is never stale', () => {
    const result = stepPlayback(
      input({ prevState: 'playing', state: 'paused', liveTime: 0.42 })
    );
    expect(result.command).toBe('hold-paused');
    expect(result.resume).toBe(false);
    // The pause-edge flush fires regardless of whether liveTime is provided —
    // the adapter owns the null-guard (the driver may have no live playhead).
    expect(result.flushTime).toBe(true);
  });

  it('still emits flushTime=true when liveTime is null (adapter guards the null)', () => {
    const result = stepPlayback(
      input({ prevState: 'playing', state: 'paused', liveTime: null })
    );
    expect(result.command).toBe('hold-paused');
    expect(result.flushTime).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// stopped → paused  (start paused / seek-while-paused first frame)
// ---------------------------------------------------------------------------
describe('stepPlayback — stopped → paused', () => {
  it('emits hold-paused with no flush (was not playing before)', () => {
    const result = stepPlayback(input({ prevState: 'stopped', state: 'paused' }));
    expect(result.command).toBe('hold-paused');
    expect(result.resume).toBe(false);
    expect(result.flushTime).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// paused → paused (holding; optionally seek)
// ---------------------------------------------------------------------------
describe('stepPlayback — paused → paused', () => {
  it('emits hold-paused when the scrub position has not moved', () => {
    const result = stepPlayback(input({ prevState: 'paused', state: 'paused', prevTime: 0.3, transportTime: 0.3 }));
    expect(result.command).toBe('hold-paused');
    expect(result.resume).toBe(false);
    expect(result.flushTime).toBe(false);
  });

  it('emits seek when the transport time changed (user scrubbed while paused)', () => {
    const result = stepPlayback(
      input({ prevState: 'paused', state: 'paused', prevTime: 0.3, transportTime: 0.7 })
    );
    expect(result.command).toBe('seek');
    expect(result.resume).toBe(false);
    expect(result.flushTime).toBe(false);
  });

  it('emits hold-paused on a stop → pause jump with an unmoved playhead (prevTime === transportTime === 0)', () => {
    // stopped (prevTime=0) → paused (time=0): no seek because time is unchanged.
    // This tests the "already at 0" path — no wasted re-seek.
    const result = stepPlayback(
      input({ prevState: 'stopped', state: 'paused', prevTime: 0, transportTime: 0 })
    );
    expect(result.command).toBe('hold-paused');
  });

  it('emits seek when the transport scrubs to a new position on first paused entry', () => {
    const result = stepPlayback(
      input({ prevState: 'stopped', state: 'paused', prevTime: 0, transportTime: 0.5 })
    );
    expect(result.command).toBe('seek');
  });
});

// ---------------------------------------------------------------------------
// playing → stopped  (stop edge — must NOT flush time)
// ---------------------------------------------------------------------------
describe('stepPlayback — playing → stopped', () => {
  it('emits stop-and-restore with flushTime=false (transport already reset the playhead)', () => {
    const result = stepPlayback(
      input({ prevState: 'playing', state: 'stopped', liveTime: 0.42 })
    );
    expect(result.command).toBe('stop-and-restore');
    expect(result.resume).toBe(false);
    // DELIBERATE: stop() resets transport.time to 0; flushing the pre-stop
    // playhead here would overwrite that reset (stuck-scrubber bug).
    expect(result.flushTime).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// paused → stopped
// ---------------------------------------------------------------------------
describe('stepPlayback — paused → stopped', () => {
  it('emits stop-and-restore', () => {
    const result = stepPlayback(input({ prevState: 'paused', state: 'stopped' }));
    expect(result.command).toBe('stop-and-restore');
    expect(result.resume).toBe(false);
    expect(result.flushTime).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// already stopped → stopped (no-op, no double-restore)
// ---------------------------------------------------------------------------
describe('stepPlayback — stopped → stopped (no-op)', () => {
  it('emits none, not stop-and-restore, so drivers do not restore twice', () => {
    const result = stepPlayback(input({ prevState: 'stopped', state: 'stopped' }));
    expect(result.command).toBe('none');
    expect(result.resume).toBe(false);
    expect(result.flushTime).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Clip-switch resume: playing and the clip changed
// ---------------------------------------------------------------------------
describe('stepPlayback — clip switch during playback', () => {
  it('sets resume=true so the adapter re-seeds the local clock', () => {
    const result = stepPlayback(
      input({ prevState: 'playing', state: 'playing', clipChanged: true })
    );
    expect(result.resume).toBe(true);
  });

  it('does NOT set resume when the clip is unchanged during playback', () => {
    const result = stepPlayback(
      input({ prevState: 'playing', state: 'playing', clipChanged: false })
    );
    expect(result.resume).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Complete transition table — every (prevState, state) pair
// ---------------------------------------------------------------------------
describe('stepPlayback — full transition table', () => {
  type Row = [PlayState, PlayState, string, boolean, boolean];
  const table: Row[] = [
    // prevState       state         command             resume  flushTime
    ['stopped',  'stopped',  'none',             false,  false],
    ['stopped',  'playing',  'ensure-playing',   true,   false],
    ['stopped',  'paused',   'hold-paused',      false,  false],
    ['playing',  'stopped',  'stop-and-restore', false,  false],
    ['playing',  'playing',  'ensure-playing',   false,  false],
    ['playing',  'paused',   'hold-paused',      false,  true],
    ['paused',   'stopped',  'stop-and-restore', false,  false],
    ['paused',   'playing',  'ensure-playing',   true,   false],
    ['paused',   'paused',   'hold-paused',      false,  false],
  ];

  for (const [prevState, state, command, resume, flushTime] of table) {
    it(`${prevState} → ${state} → command=${command}, resume=${resume}, flushTime=${flushTime}`, () => {
      const result = stepPlayback(input({ prevState, state }));
      expect(result.command).toBe(command);
      expect(result.resume).toBe(resume);
      expect(result.flushTime).toBe(flushTime);
    });
  }
});
