import { useEffect, useRef, useState } from 'react';
import { proApi } from '../domain/pro';
import type { ParsedWorkoutPlan } from '../domain/planRead';
import { deviceId, PHOTO_API } from '../domain/photo';
import { isIOS } from '../domain/push';
import { listen, primeAudio, record, shouldRecord, speechSupported, transcribe, voiceLang, type Listening } from '../domain/voice';
import { useStore } from '../state/store';

export interface ReviewNote { workout: string; exercise: number; name: string; note: string }

/** Põe as notas sugeridas nos exercícios que ainda não têm nota (pelo nome do treino e do exercício). */
export function applyReviewNotes(plan: ParsedWorkoutPlan, notes: ReviewNote[]): ParsedWorkoutPlan {
  return {
    ...plan,
    workouts: plan.workouts.map((w) => ({
      ...w,
      exercises: w.exercises.map((e) => {
        const n = notes.find((x) => x.workout === w.name && x.name === e.name);
        return n && !e.notes.trim() ? { ...e, notes: n.note } : e;
      }),
    })),
  };
}

const EXAMPLES = [
  '“Treino A: agachamento búlgaro 4 de 10, cadeira extensora 3 de 12 com 2 segundos parado em cima, leg press 4 de 10 com 80 quilos.”',
  '“No treino B quero puxada à frente 4 de 10, remada baixa e rosca martelo. Na remada, avisa para não balançar o tronco.”',
  '“Divisão ABC, três vezes por semana. Aquecer 10 minutos na esteira antes.”',
];

/** Ditar o treino por voz (ou escrever): a IA monta e o profissional confere em baixo. */
export function DictationCard({ plan, current, onPlan }: { plan: ParsedWorkoutPlan; current: number; onPlan: (p: ParsedWorkoutPlan) => void }) {
  const { S } = useStore();
  const [text, setText] = useState('');
  const [partial, setPartial] = useState('');
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState<'' | 'ouvir' | 'montar'>('');
  const [msg, setMsg] = useState<{ ok?: string; doubt?: string; err?: string }>({});
  const rec = useRef<Listening | null>(null);
  useEffect(() => () => rec.current?.abort(), []);
  const add = (t: string) => setText((x) => `${x}${x && !/\s$/.test(x) ? ' ' : ''}${t.trim()}`);
  const stop = () => rec.current?.stop();
  const start = () => {
    setMsg({});
    primeAudio();
    if (shouldRecord(isIOS())) {
      setOn(true);
      rec.current = record({
        onDone: async (audio, spoke) => {
          setOn(false);
          rec.current = null;
          if (!spoke) return setMsg({ err: 'Não ouvi nada. Toque no microfone e fale perto do telemóvel.' });
          setBusy('ouvir');
          try {
            const t = await transcribe(audio, PHOTO_API, deviceId());
            if (t) add(t);
            else setMsg({ err: 'Não percebi. Tente outra vez, mais perto do telemóvel.' });
          } catch (e) {
            setMsg({ err: (e as Error).message });
          } finally {
            setBusy('');
          }
        },
        onError: (m) => { setOn(false); rec.current = null; setMsg({ err: m }); },
      }, { silenceMs: 4000, maxMs: 90000 });
      return;
    }
    if (!speechSupported()) return setMsg({ err: 'Aqui o microfone da app não está disponível: toque no campo de texto e use o 🎤 do teclado para ditar.' });
    const r = listen(voiceLang(S), {
      onText: (t) => setPartial(t),
      onDone: (t) => { setOn(false); setPartial(''); rec.current = null; if (t) add(t); },
      onError: (m) => { setOn(false); setPartial(''); rec.current = null; setMsg({ err: m }); },
    }, { continuous: true });
    if (!r) return setMsg({ err: 'Não foi possível usar o microfone. Use o 🎤 do teclado no campo de texto.' });
    rec.current = r;
    setOn(true);
  };
  const build = async () => {
    setBusy('montar');
    setMsg({});
    try {
      const r = await proApi<{ plan: ParsedWorkoutPlan; summary: string; doubts: string }>('ia/ditado', { text, plan, current });
      onPlan({ ...plan, ...r.plan, is_workout: true, professional: plan.professional });
      setText('');
      setMsg({ ok: r.summary || 'Treino atualizado. Confira em baixo.', doubt: r.doubts || undefined });
    } catch (e) {
      setMsg({ err: (e as Error).message });
    } finally {
      setBusy('');
    }
  };
  const wname = plan.workouts[current]?.name;
  return (
    <section className="card pro-voice">
      <h3 style={{ marginTop: 0 }}>🎙️ Ditar o treino{wname ? <span className="small mute" style={{ fontWeight: 400 }}> · agora no {wname}</span> : null}</h3>
      <p className="small mute" style={{ marginTop: 0 }}>Fale como falaria com o aluno: o treino, os exercícios, séries e repetições, carga, descanso e as observações. A IA monta e você confere em baixo.</p>
      <div className="row" style={{ gap: 10, justifyContent: 'flex-start', flexWrap: 'nowrap' }}>
        <button className={`pro-mic ${on ? 'on' : ''}`} onClick={on ? stop : start} disabled={!!busy} aria-label={on ? 'Parar de ouvir' : 'Começar a ditar'}>{on ? '■' : '🎙️'}</button>
        <span className="small">{on ? 'A ouvir… toque para parar (pode fazer pausas).' : busy === 'ouvir' ? 'A passar a texto…' : 'Toque e fale. Pode ditar várias vezes antes de montar.'}</span>
      </div>
      <textarea className="field" rows={4} style={{ marginTop: 10 }} maxLength={4000} value={on && partial ? `${text}${text ? ' ' : ''}${partial}` : text} onChange={(e) => setText(e.target.value)}
        placeholder="O que ditar aparece aqui; também pode escrever ou corrigir." aria-label="Texto do ditado" />
      <div className="row" style={{ gap: 8, justifyContent: 'flex-start', marginTop: 8 }}>
        <button className="btn sm" disabled={!text.trim() || !!busy || on} onClick={build}>{busy === 'montar' ? 'A montar…' : '✨ Montar com IA'}</button>
        {text && !busy && <button className="link small inline" onClick={() => setText('')}>Limpar</button>}
      </div>
      {msg.ok && <p className="small neon" style={{ marginBottom: 0 }}>✓ {msg.ok}</p>}
      {msg.doubt && <p className="small gold" style={{ marginBottom: 0 }}>Confira: {msg.doubt}</p>}
      {msg.err && <p className="small warn-t" style={{ marginBottom: 0 }}>{msg.err}</p>}
      {!text && !msg.ok && (
        <details className="small" style={{ marginTop: 8 }}>
          <summary className="mute">Exemplos do que pode dizer</summary>
          {EXAMPLES.map((x) => <p key={x} className="mute" style={{ margin: '6px 0' }}>{x}</p>)}
        </details>
      )}
    </section>
  );
}

/** Revisão técnica com IA no fim: observações para o profissional e notas sugeridas para o aluno. */
export function ReviewCard({ plan, onPlan }: { plan: ParsedWorkoutPlan; onPlan: (p: ParsedWorkoutPlan) => void }) {
  const [about, setAbout] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [res, setRes] = useState<{ general: string[]; notes: ReviewNote[] } | null>(null);
  const [pick, setPick] = useState<Set<number>>(new Set());
  const [open, setOpen] = useState(false);
  const run = async () => {
    setBusy(true);
    setErr('');
    try {
      const r = await proApi<{ general: string[]; notes: ReviewNote[] }>('ia/rever', { plan, about });
      setRes(r);
      setPick(new Set(r.notes.map((_, k) => k)));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  if (!open)
    return <button className="btn ghost full" onClick={() => setOpen(true)}>✨ Revisão técnica com IA</button>;
  return (
    <section className="card pro-review">
      <div className="row"><h3 style={{ margin: 0 }}>✨ Revisão técnica com IA</h3><button className="x" aria-label="Fechar" onClick={() => setOpen(false)}>×</button></div>
      <p className="small mute">A IA olha para o plano todo (equilíbrio, volume, ordem, descansos) e sugere notas de execução para os exercícios sem nota. Você decide o que fica.</p>
      <input className="field sm" style={{ width: '100%', boxSizing: 'border-box' }} value={about} maxLength={300} onChange={(e) => setAbout(e.target.value)} placeholder="Sobre o aluno (opcional): ex. iniciante, quer hipertrofia, dor no joelho" aria-label="Sobre o aluno" />
      <button className="btn sm" style={{ marginTop: 8 }} disabled={busy} onClick={run}>{busy ? 'A rever…' : res ? 'Rever outra vez' : 'Rever o plano'}</button>
      {err && <p className="small warn-t">{err}</p>}
      {res && (
        <>
          {res.general.length > 0 && (
            <>
              <p className="small" style={{ fontWeight: 700, margin: '12px 0 4px' }}>Observações para si</p>
              <ul className="small pro-review-list">{res.general.map((g) => <li key={g}>{g}</li>)}</ul>
              <button className="link small inline" onClick={() => onPlan({ ...plan, notes: `${plan.notes}${plan.notes ? '\n' : ''}${res.general.join(' ')}`.slice(0, 600) })}>Juntar às observações gerais do aluno</button>
            </>
          )}
          {res.notes.length > 0 ? (
            <>
              <p className="small" style={{ fontWeight: 700, margin: '12px 0 4px' }}>Notas sugeridas para o aluno</p>
              {res.notes.map((n, k) => (
                <label key={k} className="small pro-review-note">
                  <input type="checkbox" checked={pick.has(k)} onChange={() => { const s = new Set(pick); if (s.has(k)) s.delete(k); else s.add(k); setPick(s); }} />
                  <span><b>{n.workout} · {n.name}:</b> {n.note}</span>
                </label>
              ))}
              <button className="btn sm" style={{ marginTop: 8 }} disabled={!pick.size} onClick={() => { onPlan(applyReviewNotes(plan, res.notes.filter((_, k) => pick.has(k)))); setRes({ ...res, notes: [] }); }}>Pôr {pick.size} nota{pick.size === 1 ? '' : 's'} nos exercícios</button>
            </>
          ) : res.general.length === 0 ? <p className="small mute">Sem sugestões: o plano parece equilibrado.</p> : null}
        </>
      )}
    </section>
  );
}
