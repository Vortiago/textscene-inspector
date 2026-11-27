import { describe, expect, it, vi } from 'vitest';
import { TemplateDrawClaims } from './templateDrawClaims.js';

function registration() {
  const release = vi.fn();
  const register = vi.fn(() => release);
  return { register, release };
}

describe('TemplateDrawClaims', () => {
  it('registers at once while no draw claims the pixels', () => {
    const { register } = registration();
    new TemplateDrawClaims().whileUnclaimed(register);
    expect(register).toHaveBeenCalledTimes(1);
  });

  it('registers nothing while a draw claimed the pixels first', () => {
    const claims = new TemplateDrawClaims();
    claims.claim();
    const { register } = registration();
    claims.whileUnclaimed(register);
    expect(register).not.toHaveBeenCalled();
  });

  it('releases the registration when a draw claims the pixels', () => {
    const claims = new TemplateDrawClaims();
    const { register, release } = registration();
    claims.whileUnclaimed(register);
    claims.claim();
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('registers again only when the last claim ends', () => {
    const claims = new TemplateDrawClaims();
    const { register } = registration();
    claims.whileUnclaimed(register);
    const first = claims.claim();
    const second = claims.claim();
    first();
    expect(register).toHaveBeenCalledTimes(1);
    second();
    expect(register).toHaveBeenCalledTimes(2);
  });

  it('counts a claim released twice once', () => {
    const claims = new TemplateDrawClaims();
    const { register } = registration();
    claims.whileUnclaimed(register);
    const first = claims.claim();
    claims.claim();
    first();
    first();
    expect(register).toHaveBeenCalledTimes(1);
  });

  it('follows no claim after its own release', () => {
    const claims = new TemplateDrawClaims();
    const { register, release } = registration();
    const stop = claims.whileUnclaimed(register);
    stop();
    claims.claim()();
    expect(register).toHaveBeenCalledTimes(1);
    expect(release).toHaveBeenCalledTimes(1);
  });
});
