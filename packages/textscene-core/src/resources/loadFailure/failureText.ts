import type { LoadFailureCause } from './loadOutcome';

const CAUSE_TEXT: Record<LoadFailureCause, string> = {
  missing: 'missing',
  unparsed: 'does not parse',
  unimported: 'does not import',
};

export function failureChainText(chain: readonly string[], cause: LoadFailureCause): string {
  return `${chain.join(' → ')} (${CAUSE_TEXT[cause]})`;
}
