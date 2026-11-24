import { PremiumLock } from './Paywall';
import { canAccess } from '../domain/features';
import { useState } from 'react';
import { PremiumTag } from './PremiumTag';
import { CAT_LABEL, MONTH_NAMES, timeline, type TimelineCat } from '../domain/timeline';
import { useStore } from '../state/store';
import { notePremiumUse } from '../domain/analytics';

/** Personal Health Timeline (Evolução). */
export function Timeline() {
  const { S } = useStore();
  const [cat, setCat] = useState<TimelineCat | 'tudo'>('tudo');
  const [all, setAll] = useState(false);
  const ev = timeline(S).filter((e) => cat === 'tudo' || e.cat === cat);
  const future = ev.filter((e) => e.future).reverse();
  const past = ev.filter((e) => !e.future);
  const shown = all ? past : past.slice(0, 10);
  let month = '';
  return (
    <section className="card" data-tour="timeline">
      <div className="row">
        <h2 style={{ margin: 0 }}>A minha Timeline</h2>
        <PremiumTag f="timeline" />
      </div>
      <p className="small mute" style={{ margin: '4px 0 8px' }}>O seu histórico de saúde num só sítio: avaliações, ritual, análises, consultas, prevenção e corpo.</p>
      {!canAccess(S, 'timeline') ? <PremiumLock text={`No Premium vê aqui os ${ev.length} momentos da sua saúde, por data, com filtros.`} /> : (<>
      <div className="chips" role="group" aria-label="Filtro">
        {CAT_LABEL.map(([k, t]) => (
          <button key={k} className={`chip sm ${cat === k ? 'on' : ''}`} aria-pressed={cat === k} onClick={() => setCat(k)}>{t}</button>
        ))}
      </div>
      {future.length > 0 && (
        <div className="tl-future">
          <p className="small gold" style={{ margin: '10px 0 4px', fontWeight: 700 }}>Próximos</p>
          {future.map((e, i) => (
            <div key={`f${i}`} className="tl-item">
              <span className="tl-icon">{e.icon}</span>
              <span style={{ flex: 1 }}><b className="small">{e.title}</b>{e.detail && <span className="small mute" style={{ display: 'block' }}>{e.detail}</span>}</span>
              <span className="small mute">{e.date.split('-').reverse().slice(0, 2).join('/')}</span>
            </div>
          ))}
        </div>
      )}
      {!past.length && <p className="small mute" style={{ margin: '10px 0 0' }}>A sua Timeline enche-se sozinha à medida que usa a app.</p>}
      <div className="tl">
        {shown.map((e, i) => {
          const m = e.date.slice(0, 7);
          const head = m !== month ? (month = m) : null;
          return (
            <div key={i}>
              {head && <p className="tl-month small">{MONTH_NAMES[Number(m.slice(5)) - 1]} {m.slice(0, 4)}</p>}
              <div className="tl-item">
                <span className="tl-icon">{e.icon}</span>
                <span style={{ flex: 1 }}><b className="small">{e.title}</b>{e.detail && <span className="small mute" style={{ display: 'block' }}>{e.detail}</span>}</span>
                <span className="small mute">{e.date.slice(8, 10)}</span>
              </div>
            </div>
          );
        })}
      </div>
      {past.length > 10 && (
        <button className="link small inline" onClick={() => { setAll(!all); if (!all) notePremiumUse('timeline'); }}>{all ? 'Ver menos' : `Ver tudo (${past.length})`}</button>
      )}
      </>)}
    </section>
  );
}
