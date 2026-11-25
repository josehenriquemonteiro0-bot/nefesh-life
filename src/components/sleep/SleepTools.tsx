import { useState } from 'react';
import { TECHNIQUES, techniqueOf, type Technique } from '../../domain/mind';
import { meditationById } from '../../domain/meditations';
import { NIGHT_MEDITATIONS } from '../../domain/sleep';
import { canAccess } from '../../domain/features';
import { useStore } from '../../state/store';
import { usePractice } from './usePractice';

/** Técnicas para adormecer (respirações da noite e sessões guiadas) e o que fazer acordado a meio da noite. */
export function SleepTools({ id }: { id?: string }) {
  const { S, toast } = useStore();
  const night = TECHNIQUES.filter((t) => t.night);
  const [tech, setTech] = useState<Technique['id']>('expira');
  const [min, setMin] = useState(5);
  const { start, node } = usePractice((m) => m >= 1 && toast(`Feito: ${m >= 2 ? Math.round(m) : m} min. Boa noite. 🌙`));
  const full = canAccess(S, 'meditacao');
  const sessions = NIGHT_MEDITATIONS.filter((x) => x !== '478' && x !== 'acordado').map((x) => meditationById(x)!).filter(Boolean);
  return (
    <section className="card" id={id}>
      {node}
      <h2 style={{ marginTop: 0 }}>😮‍💨 Técnicas para adormecer</h2>
      <p className="small" style={{ margin: '0 0 6px' }}><b>Respiração</b></p>
      <div className="chips" role="group" aria-label="Técnica de respiração">
        {night.map((x) => (
          <button key={x.id} className={`chip sm ${tech === x.id ? 'on' : ''}`} aria-pressed={tech === x.id} onClick={() => setTech(x.id)}>{x.name}</button>
        ))}
      </div>
      <p className="small mute" style={{ margin: '8px 0' }}>{techniqueOf(tech).text}</p>
      <div className="row" style={{ gap: 8, justifyContent: 'flex-start' }}>
        {[3, 5, 10].map((m) => (
          <button key={m} className={`chip sm ${min === m ? 'on' : ''}`} aria-pressed={min === m} onClick={() => setMin(m)}>{m} min</button>
        ))}
        <button className="btn sm" onClick={() => start({ kind: 'respiracao', id: tech, minutes: min })}>Começar</button>
      </div>

      <p className="small" style={{ margin: '14px 0 6px' }}><b>Relaxamento guiado</b></p>
      <div className="med-list">
        {sessions.map((m) => (
          <button key={m.id} className="med-row" onClick={() => start({ kind: 'meditacao', id: m.id })}>
            <span className="med-play" aria-hidden="true">▶</span>
            <span style={{ flex: 1, display: 'grid', textAlign: 'left' }}>
              <b className="small">{m.title}{!m.free && !full ? ' 🔒' : ''}</b>
              <span className="small mute">{m.desc}</span>
            </span>
            <span className="small mute">{m.minutes} min</span>
          </button>
        ))}
      </div>

      <div className="tip" style={{ marginTop: 14, paddingLeft: 10 }}>
        <p className="small" style={{ margin: 0 }}><b>Acordou a meio da noite?</b> Não olhe para as horas. Respire devagar, com a expiração mais longa. Se passarem uns 20 minutos sem sono, levante-se, faça algo calmo com pouca luz e volte quando os olhos pesarem.</p>
        <button className="btn ghost sm" style={{ marginTop: 8 }} onClick={() => start({ kind: 'meditacao', id: 'acordado' })}>▶ Guiar-me agora (6 min)</button>
      </div>
    </section>
  );
}
