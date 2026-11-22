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

const MAX_MS = 120000;

/**
 * Ditado guiado por etapas:
 * 1) estrutura — quantos dias e o que treina em cada dia (cria Treino A, B, C… com o foco);
 * 2) um treino de cada vez — os exercícios desse treino.
 * O microfone não corta nas pausas: ouve até tocar para parar (máx. 2 min).
 */
export function DictationCard({ plan, current, setCurrent, onPlan }: { plan: ParsedWorkoutPlan; current: number; setCurrent: (i: number) => void; onPlan: (p: ParsedWorkoutPlan) => void }) {
  const { S } = useStore();
  const [text, setText] = useState('');
  const [partial, setPartial] = useState('');
  const [on, setOn] = useState(false);
  const [secs, setSecs] = useState(0);
  const [busy, setBusy] = useState<'' | 'ouvir' | 'montar'>('');
  const [msg, setMsg] = useState<{ ok?: string; doubt?: string; err?: string; next?: boolean }>({});
  const [restructure, setRestructure] = useState(false);
  const rec = useRef<Listening | null>(null);
  const userStop = useRef(false);
  useEffect(() => () => { userStop.current = true; rec.current?.abort(); }, []);
  useEffect(() => {
    if (!on) return;
    setSecs(0);
    const t0 = Date.now();
    const id = window.setInterval(() => setSecs(Math.round((Date.now() - t0) / 1000)), 500);
    return () => window.clearInterval(id);
  }, [on]);
  const n = plan.workouts.length;
  const stage: 'estrutura' | 'treino' = !n || restructure ? 'estrutura' : 'treino';
  const w = plan.workouts[current];
  const add = (t: string) => setText((x) => `${x}${x && !/\s$/.test(x) ? ' ' : ''}${t.trim()}`);
  const stop = () => { userStop.current = true; rec.current?.stop(); };
  const start = () => {
    setMsg({});
    primeAudio();
    userStop.current = false;
    if (shouldRecord(isIOS())) {
      setOn(true);
      rec.current = record({
        onDone: async (audio) => {
          setOn(false);
          rec.current = null;
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
      }, { manual: true, maxMs: MAX_MS });
      return;
    }
    if (!speechSupported()) return setMsg({ err: 'Aqui o microfone da app não está disponível: toque no campo de texto e use o 🎤 do teclado para ditar.' });
    const t0 = Date.now();
    // o reconhecimento do navegador pára sozinho nas pausas: volta a ouvir até a pessoa tocar para parar
    const go = (): boolean => {
      const r = listen(voiceLang(S), {
        onText: (t) => setPartial(t),
        onDone: (t) => {
          setPartial('');
          if (t) add(t);
          if (!userStop.current && Date.now() - t0 < MAX_MS && go()) return;
          setOn(false);
          rec.current = null;
        },
        onError: (m, code) => {
          setPartial('');
          if (code === 'no-speech' && !userStop.current && Date.now() - t0 < MAX_MS && go()) return;
          setOn(false);
          rec.current = null;
          setMsg({ err: m });
        },
      }, { continuous: true });
      if (!r) return false;
      rec.current = r;
      return true;
    };
    if (!go()) return setMsg({ err: 'Não foi possível usar o microfone. Use o 🎤 do teclado no campo de texto.' });
    setOn(true);
  };
  const build = async () => {
    setBusy('montar');
    setMsg({});
    try {
      const r = await proApi<{ plan: ParsedWorkoutPlan; summary: string; doubts: string }>('ia/ditado', { text, plan, current, stage });
      onPlan({ ...plan, ...r.plan, is_workout: true, professional: plan.professional });
      setText('');
      if (stage === 'estrutura') {
        setRestructure(false);
        setCurrent(0);
        setMsg({ ok: r.summary || 'Estrutura feita.', doubt: r.doubts || undefined });
      } else setMsg({ ok: r.summary || 'Treino atualizado. Confira em baixo.', doubt: r.doubts || undefined, next: true });
    } catch (e) {
      setMsg({ err: (e as Error).message });
    } finally {
      setBusy('');
    }
  };
  const question = stage === 'estrutura'
    ? { n: '1', t: 'Quantos dias o aluno vai treinar e o que treina em cada dia?', ex: '“5 vezes por semana. Treino A superior, treino B inferior, treino C peito e tríceps, treino D costas e bíceps, treino E pernas e glúteos.”' }
    : { n: '2', t: `${w?.name ?? 'Treino'}${w?.focus ? ` · ${w.focus.toLowerCase()}` : ''}: diga os exercícios, séries, repetições, carga e observações.`, ex: '“Agachamento livre 4 de 10 com 40 quilos. Cadeira extensora 3 de 12, segurar 2 segundos em cima. Mesa flexora 3 de 12.”' };
  const last = current >= n - 1;
  return (
    <section className="card pro-voice">
      <div className="pro-steps" aria-label="Etapas">
        <span className={stage === 'estrutura' ? 'on' : n ? 'done' : ''}>{n && stage !== 'estrutura' ? '✓ ' : ''}Estrutura</span>
        {plan.workouts.map((x, k) => (
          <button key={k} className={stage === 'treino' && k === current ? 'on' : x.exercises.some((e) => e.name.trim()) ? 'done' : ''} onClick={() => { setRestructure(false); setCurrent(k); setMsg({}); }}>
            {x.exercises.some((e) => e.name.trim()) ? '✓ ' : ''}{String.fromCharCode(65 + k)}
          </button>
        ))}
      </div>
      <p className="pro-q"><b>{question.n === '1' ? 'Etapa 1' : 'Etapa 2'}</b> · {question.t}</p>
      <div className="row" style={{ gap: 10, justifyContent: 'flex-start', flexWrap: 'nowrap' }}>
        <button className={`pro-mic ${on ? 'on' : ''}`} onClick={on ? stop : start} disabled={!!busy} aria-label={on ? 'Parar de ouvir' : 'Começar a ditar'}>{on ? '■' : '🎙️'}</button>
        <span className="small">{on ? <>A ouvir… <b>{Math.floor(secs / 60)}:{String(secs % 60).padStart(2, '0')}</b><br />Fale à vontade, com pausas. Toque em ■ quando acabar.</> : busy === 'ouvir' ? 'A passar a texto…' : 'Toque no microfone e responda.'}</span>
      </div>
      <textarea className="field" rows={4} style={{ marginTop: 10 }} maxLength={4000} value={on && partial ? `${text}${text ? ' ' : ''}${partial}` : text} onChange={(e) => setText(e.target.value)}
        placeholder="O que disser aparece aqui; também pode escrever ou corrigir." aria-label="Texto do ditado" />
      <div className="row" style={{ gap: 8, justifyContent: 'flex-start', marginTop: 8 }}>
        <button className="btn sm" disabled={!text.trim() || !!busy || on} onClick={build}>{busy === 'montar' ? 'A montar…' : stage === 'estrutura' ? '✨ Criar os treinos' : `✨ Montar o ${w?.name ?? 'treino'}`}</button>
        {text && !busy && !on && <button className="link small inline" onClick={() => setText('')}>Limpar</button>}
      </div>
      {msg.ok && <p className="small neon" style={{ marginBottom: 0 }}>✓ {msg.ok}</p>}
      {msg.doubt && <p className="small gold" style={{ marginBottom: 0 }}>Confira: {msg.doubt}</p>}
      {msg.err && <p className="small warn-t" style={{ marginBottom: 0 }}>{msg.err}</p>}
      {msg.next && !text && (
        <div className="row" style={{ gap: 8, justifyContent: 'flex-start', marginTop: 8 }}>
          {!last && <button className="btn sm" onClick={() => { setCurrent(current + 1); setMsg({}); }}>Próximo: {plan.workouts[current + 1].name} →</button>}
          {last && <button className="btn sm" onClick={() => { setMsg({}); document.querySelector('.pro-end')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }}>Rever e enviar ao aluno ↓</button>}
          <span className="small mute">ou dite mais para o {w?.name}</span>
        </div>
      )}
      {!text && !msg.ok && !on && <p className="small mute" style={{ margin: '8px 0 0' }}>Exemplo: {question.ex}</p>}
      {stage === 'treino' && !on && <button className="link small inline" style={{ marginTop: 8 }} onClick={() => { setRestructure(true); setMsg({}); }}>Refazer a etapa 1 (dias e divisão)</button>}
      {restructure && n > 0 && <button className="link small inline" style={{ marginTop: 8 }} onClick={() => setRestructure(false)}>Manter a estrutura atual</button>}
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
