import { SOURCE_LABEL, isMeasured, sourceOf } from '../domain/sources';
import type { DayLog, SourcedField } from '../domain/types';

/** Etiqueta pequena com a origem do valor: medido (relógio/app Saúde) ou escrito pela pessoa. */
export function SourceTag({ l, f }: { l: DayLog | undefined; f: SourcedField }) {
  const has = f === 'exMin' ? !!l?.src?.exMin : l?.[f] !== undefined;
  if (!has) return null;
  const s = sourceOf(l, f);
  return (
    <span className={`src-tag ${isMeasured(s) ? 'measured' : ''}`} title={isMeasured(s) ? 'Valor medido por um aparelho' : 'Valor escrito por si'}>
      {isMeasured(s) ? '⌚' : '✍️'} {SOURCE_LABEL[s]}
    </span>
  );
}
