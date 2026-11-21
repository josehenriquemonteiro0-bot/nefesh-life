import { useEffect, useState } from 'react';
import { COLLECTIONS, MEDITATIONS, meditationById, suggested, type Collection, type Meditation } from '../domain/meditations';
import { canAccess } from '../domain/features';
import { notePremiumUse } from '../domain/analytics';
import { takeMeditationRequest } from '../domain/mind';
import { useStore } from '../state/store';
import { MeditationPlayer } from './MeditationPlayer';
import { PremiumTag } from './PremiumTag';

/** Biblioteca de meditação (Mente): coleções, sessão sugerida para o momento e o leitor. */
export function MeditationLibrary() {
  const { S, todayLog: l, updateToday, toast } = useStore();
  const [col, setCol] = useState<Collection | 'sugerida'>('sugerida');
  const [open, setOpen] = useState<Meditation | null>(null);
  const full = canAccess(S, 'meditacao');
  const sug = meditationById(suggested(new Date().getHours(), l.stress))!;

  // pedido do assistente ("guia-me numa meditação para dormir")
  useEffect(() => {
    const id = takeMeditationRequest();
    const m = id ? meditationById(id) : null;
    if (m) setOpen(m);
  }, []);

  const play = (m: Meditation) => {
    if (!m.free && !full) return toast('Esta sessão faz parte do Premium.');
    if (!m.free) notePremiumUse('meditacao');
    setOpen(m);
  };
  const end = (minutes: number) => {
    const m = open;
    setOpen(null);
    if (minutes >= 1 && m) {
      updateToday((d) => {
        d.medit = Math.round(((d.medit ?? 0) + minutes) * 10) / 10;
        d.hab = { ...(d.hab ?? {}), resp: true };
      });
      toast(`${m.title}: ${minutes >= 2 ? Math.round(minutes) : minutes} min de atenção plena. 🌿`);
    }
  };

  const list = col === 'sugerida' ? [sug] : MEDITATIONS.filter((m) => m.collection === col);
  return (
    <section className="card" data-tour="meditar">
      {open && <MeditationPlayer m={open} onEnd={end} />}
      <div className="row">
        <h2 style={{ margin: 0 }}>🧘 Meditação</h2>
        {(l.medit ?? 0) > 0 ? <span className="small neon">hoje: {l.medit} min ✓</span> : <PremiumTag f="meditacao" />}
      </div>
      <div className="chips" style={{ marginTop: 10 }} role="group" aria-label="Coleção">
        <button className={`chip sm ${col === 'sugerida' ? 'on' : ''}`} aria-pressed={col === 'sugerida'} onClick={() => setCol('sugerida')}>✨ Para agora</button>
        {COLLECTIONS.map(([k, t, icon]) => (
          <button key={k} className={`chip sm ${col === k ? 'on' : ''}`} aria-pressed={col === k} onClick={() => setCol(k)}>{icon} {t}</button>
        ))}
      </div>
      <div className="med-list">
        {list.map((m) => (
          <button key={m.id} className="med-row" onClick={() => play(m)}>
            <span className="med-play" aria-hidden="true">▶</span>
            <span style={{ flex: 1, display: 'grid', textAlign: 'left' }}>
              <b className="small">{m.title}{!m.free && !full ? ' 🔒' : ''}</b>
              <span className="small mute">{m.desc}</span>
            </span>
            <span className="small mute">{m.minutes} min</span>
          </button>
        ))}
      </div>
      <p className="small mute" style={{ margin: '8px 0 0' }}>Guiadas pela voz do telemóvel, com som de fundo. Use auscultadores para uma experiência melhor.</p>
    </section>
  );
}
