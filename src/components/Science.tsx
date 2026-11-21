import { useEffect } from 'react';
import { LEVELS, STUDIES, pubmedUrl, studyById, type EvidenceLevel, type Study } from '../domain/science';
import type { WhyStep } from '../domain/types';

export function LevelTag({ level }: { level: EvidenceLevel }) {
  return <span className={`lvl lvl-${level}`}>{LEVELS[level].label}</span>;
}

const KINDS: Record<WhyStep['kind'], [string, string]> = {
  evidencia: ['Estudo', 'ev'],
  criterio: ['Critério NEFESH', 'cr'],
  rotulo: ['Rótulo do produto', 'ro'],
  profissional: ['Profissional de saúde', 'pr'],
};

export function KindTag({ kind }: { kind: WhyStep['kind'] }) {
  return <span className={`kind ${KINDS[kind][1]}`}>{KINDS[kind][0]}</span>;
}

export function StudyCard({ s }: { s: Study }) {
  return (
    <article className="study">
      <div className="row" style={{ gap: 8 }}>
        <h3 style={{ margin: 0 }}>{s.cite}</h3>
        <LevelTag level={s.level} />
      </div>
      <p className="small mute" style={{ margin: '4px 0 10px' }}>{s.journal}</p>
      {s.level !== 'seguranca' && (
        <dl className="facts">
          <div><dt>Desenho</dt><dd>{s.design}</dd></div>
          <div><dt>Quem</dt><dd>{s.population}</dd></div>
          {s.dose !== 'a confirmar' && <div><dt>Dose</dt><dd>{s.dose}</dd></div>}
          {s.duration !== 'a confirmar' && <div><dt>Duração</dt><dd>{s.duration}</dd></div>}
        </dl>
      )}
      <p className="small" style={{ margin: '10px 0 8px' }}><b>Resultado:</b> {s.result}</p>
      <div className="row" style={{ gap: 8 }}>
        <a className="link small" href={pubmedUrl(s)} target="_blank" rel="noopener">Ver no PubMed ↗</a>
      </div>
    </article>
  );
}

export function DoseSteps({ steps, total, gPerKg }: { steps: WhyStep[]; total: string; gPerKg: string }) {
  return (
    <>
      <ol className="steps">
        {steps.map((st) => (
          <li key={st.label}>
            <div className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
              <span style={{ flex: '1 1 160px', fontWeight: 600 }}>{st.label}</span>
              <b className="neon" style={{ whiteSpace: 'nowrap' }}>{st.value}</b>
            </div>
            <KindTag kind={st.kind} />
            <p className="small mute" style={{ margin: '6px 0 0' }}>
              {st.note}
              {st.studies?.length ? ` (${st.studies.map((id) => studyById(id).cite).join('; ')})` : ''}
            </p>
          </li>
        ))}
      </ol>
      <div className="row tot-row">
        <span>A sua dose diária</span>
        <b className="neon">{total}</b>
      </div>
      <p className="small mute" style={{ margin: '8px 0 0' }}>Equivale a {gPerKg} g por kg de peso corporal.</p>
    </>
  );
}

export function ScienceSheet({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  const order: EvidenceLevel[] = ['moderada', 'preliminar', 'seguranca'];
  return (
    <div className="modal show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Biblioteca científica">
        <div className="row">
          <h2 style={{ margin: 0 }}>Biblioteca científica</h2>
          <button className="btn ghost sm" onClick={onClose}>Fechar</button>
        </div>
        <p className="small mute">Todos os estudos em que a NEFESH Life se baseia, organizados pela força da evidência.</p>
        {order.map((lv) => (
          <section key={lv} style={{ marginTop: 18 }}>
            <LevelTag level={lv} />
            <p className="small mute" style={{ margin: '6px 0 10px' }}>{LEVELS[lv].text}</p>
            {STUDIES.filter((s) => s.level === lv).map((s) => <StudyCard key={s.id} s={s} />)}
          </section>
        ))}
        <p className="small mute" style={{ marginTop: 16 }}>
          A Spirulina é um suplemento alimentar. Na União Europeia não há alegações de saúde autorizadas para a Spirulina: os estudos descrevem o que foi investigado e não são promessas de resultado.
        </p>
      </div>
    </div>
  );
}
