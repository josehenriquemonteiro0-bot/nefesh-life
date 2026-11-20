import { FEATURES, TEST_MODE, isPremiumFeature, type Feature } from '../domain/features';

/** Selo nas funcionalidades Premium (na fase de teste, mostra que estão abertas). */
export function PremiumTag({ f }: { f: Feature }) {
  if (!isPremiumFeature(f)) return null;
  const free = (FEATURES[f] as { freeNote?: string }).freeNote;
  return (
    <span className="premium-tag" title={TEST_MODE ? 'Premium · aberto durante a fase de testes' : free ? `Premium · no plano grátis: ${free}` : 'Premium'}>
      Premium{TEST_MODE ? ' · grátis nos testes' : ''}
    </span>
  );
}
