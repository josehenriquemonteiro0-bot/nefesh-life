import { FEATURES, PREMIUM_ENFORCED, type Feature } from '../domain/features';

/** Etiqueta discreta nas funcionalidades que serão Premium. */
export function PremiumTag({ f }: { f: Feature }) {
  if (!FEATURES[f].premium) return null;
  return <span className="premium-tag" title={PREMIUM_ENFORCED ? 'Premium' : 'Premium · aberto durante a fase de testes'}>Premium{PREMIUM_ENFORCED ? '' : ' · grátis nos testes'}</span>;
}
