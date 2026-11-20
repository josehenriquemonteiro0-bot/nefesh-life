import { useEffect, useRef, useState } from 'react';
import { Icon } from '../components/Icon';
import { PremiumTag } from '../components/PremiumTag';
import type { Nav } from '../App';
import { applyCoachActions, askCoach, clearHistory, CoachError, loadHistory, saveHistory, type CoachMsg } from '../domain/coach';
import { todayKey } from '../domain/dates';
import { dailyQuota, TEST_MODE } from '../domain/features';
import { ritualJustDone } from '../state/doses';
import { useStore } from '../state/store';
import type { DayLog } from '../domain/types';

const STARTERS = [
  'Bebi 2 copos de água',
  'Tomei a Spirulina',
  'Dormi 7 horas e acordei com energia',
  'Comi dois ovos e pão ao pequeno-almoço',
  'O que posso jantar hoje?',
];

/** AI Coach por texto (a voz chega no módulo 6). */
export function Coach({ go }: { go: Nav }) {
  const { S, update, toast } = useStore();
  const [hist, setHist] = useState<CoachMsg[]>(loadHistory);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [quota, setQuota] = useState<{ remaining: number; limit: number } | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const free = dailyQuota(S, 'coach');

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'end', behavior: 'smooth' });
  }, [hist.length, busy]);

  const save = (h: CoachMsg[]) => {
    setHist(h);
    saveHistory(h);
  };

  const send = async (raw: string) => {
    const t = raw.trim();
    if (!t || busy) return;
    const now = new Date().toISOString();
    const withUser = [...hist, { role: 'user' as const, text: t, at: now }];
    save(withUser);
    setText('');
    setErr(null);
    setBusy(true);
    try {
      const r = await askCoach(S, withUser);
      if (r.limit !== undefined && r.remaining !== undefined) setQuota({ remaining: r.remaining, limit: r.limit });
      const key = todayKey();
      const before: DayLog | null = S.logs[key] ? structuredClone(S.logs[key]) : null;
      let applied: string[] = [];
      if (r.actions.length) {
        // aplica num rascunho para saber o que mudou, e grava o dia de uma vez
        const draft = structuredClone(S);
        applied = applyCoachActions(draft, r.actions);
        const after = draft.logs[key];
        update((d) => {
          d.logs[key] = after;
        });
        const done = ritualJustDone(S, before ?? undefined, after);
        if (done) toast(done);
      }
      save([
        ...withUser,
        { role: 'assistant', text: r.reply, at: new Date().toISOString(), applied, undo: applied.length ? { day: key, log: before } : undefined, pro: r.suggest_professional },
      ]);
    } catch (e) {
      const ce = e as CoachError;
      setErr(ce.message);
      if (ce.status === 429) setQuota((q) => (q ? { ...q, remaining: 0 } : q));
    } finally {
      setBusy(false);
    }
  };

  const undo = (idx: number) => {
    const m = hist[idx];
    if (!m.undo) return;
    const { day, log } = m.undo;
    update((d) => {
      if (log) d.logs[day] = log;
      else delete d.logs[day];
    });
    save(hist.map((x, i) => (i === idx ? { ...x, undone: true } : x)));
    toast('Registos desfeitos.');
  };
  // só a última resposta com registos pode ser desfeita (desfazer repõe o dia como estava antes dela)
  const lastUndoable = hist.map((m, i) => (m.applied?.length && !m.undone ? i : -1)).filter((i) => i >= 0).pop();

  return (
    <>
      <div className="row">
        <h1 style={{ margin: 0 }}>Coach NEFESH</h1>
        <PremiumTag f="coach" />
      </div>

      {hist.length === 0 && (
        <section className="card hero coach-hero">
          <div className="coach-mic" aria-hidden="true"><Icon name="mic" width={2} /></div>
          <h2 style={{ margin: '12px 0 6px' }}>Escreva como falaria com um amigo</h2>
          <p className="small" style={{ margin: 0, opacity: 0.9 }}>
            "Dormi mal, comi dois ovos e pão, vou treinar à tarde e estou cansado." O Coach regista o sono, a refeição e a energia, e devolve uma sugestão para o seu dia.
          </p>
        </section>
      )}

      <div className="coach-chat" aria-live="polite">
        {hist.map((m, i) => (
          <div key={i} className={`bubble ${m.role}`}>
            <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{m.text}</p>
            {m.applied && m.applied.length > 0 && (
              <div className={`coach-applied ${m.undone ? 'undone' : ''}`}>
                {m.applied.map((a, k) => <span key={k} className="small">{m.undone ? '' : '✓ '}{a}</span>)}
                {m.undone ? (
                  <span className="small mute">Desfeito.</span>
                ) : i === lastUndoable ? (
                  <button className="link small inline" onClick={() => undo(i)}>Desfazer</button>
                ) : null}
              </div>
            )}
            {m.pro && (
              <button className="btn ghost sm" style={{ marginTop: 8 }} onClick={() => go('pros')}>Ver profissionais de saúde</button>
            )}
          </div>
        ))}
        {busy && <div className="bubble assistant typing"><span /><span /><span /></div>}
        <div ref={endRef} />
      </div>

      {err && <p className="small" style={{ color: 'var(--warn, #ffb37a)' }}>{err}</p>}

      {hist.length === 0 && (
        <div className="chips coach-starters">
          {STARTERS.map((s) => <button key={s} className="chip" onClick={() => send(s)} disabled={busy}>{s}</button>)}
        </div>
      )}

      <form
        className="coach-input"
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
      >
        <textarea
          rows={2}
          value={text}
          maxLength={1200}
          placeholder="Escreva aqui… ex.: almocei frango com arroz"
          aria-label="Mensagem para o Coach"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send(text);
            }
          }}
        />
        <button className="btn" disabled={busy || !text.trim()} aria-label="Enviar">Enviar</button>
      </form>

      <p className="small mute" style={{ margin: '8px 0 0' }}>
        🎙️ Falar com o Coach chega na próxima atualização.{' '}
        {TEST_MODE
          ? 'Fase de teste: aberto a todos (no plano grátis serão 5 mensagens por dia).'
          : Number.isFinite(free)
            ? `Plano grátis: ${quota ? `${quota.remaining} de ${quota.limit}` : `${free}`} mensagens hoje.`
            : ''}
      </p>
      <p className="small mute" style={{ margin: '4px 0 0' }}>
        O Coach apoia, não substitui profissionais, e não faz diagnósticos. Os valores são estimativas. As mensagens vão à IA só para responder e a NEFESH não as guarda: o histórico fica neste telemóvel.
        {hist.length > 0 && (
          <>
            {' '}
            <button
              className="link small inline"
              onClick={() => {
                if (!confirm('Apagar a conversa com o Coach? Os registos feitos ficam no diário.')) return;
                clearHistory();
                setHist([]);
              }}
            >
              Apagar conversa
            </button>
          </>
        )}
      </p>
    </>
  );
}
