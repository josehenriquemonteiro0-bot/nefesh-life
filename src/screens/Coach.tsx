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
import { notePremiumUse } from '../domain/analytics';
import { KEYBOARD_DICTATION_HINT, listen, record, speak, speechSupported, stopSpeaking, takeListenRequest, transcribe, ttsSupported, shouldRecord, voiceLang, type Listening } from '../domain/voice';
import { deviceId, PHOTO_API } from '../domain/photo';
import { isIOS } from '../domain/push';

const STARTERS = [
  'Bebi 2 copos de água',
  'Tomei a Spirulina',
  'Dormi 7 horas e acordei com energia',
  'Comi dois ovos e pão ao pequeno-almoço',
  'O que posso jantar hoje?',
];

/** AI Coach por texto e voz. */
export function Coach({ go }: { go: Nav }) {
  const { S, update, toast } = useStore();
  const [hist, setHist] = useState<CoachMsg[]>(loadHistory);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [quota, setQuota] = useState<{ remaining: number; limit: number } | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const free = dailyQuota(S, 'coach');
  const lang = voiceLang(S);
  const [listening, setListening] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [level, setLevel] = useState(0);
  const rec = useRef<Listening | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'end', behavior: 'smooth' });
  }, [hist.length, busy]);

  const save = (h: CoachMsg[]) => {
    setHist(h);
    saveHistory(h);
  };

  const send = async (raw: string, viaVoice = false) => {
    const t = raw.trim();
    if (!t || busy) return;
    const now = new Date().toISOString();
    const withUser = [...hist, { role: 'user' as const, text: t, at: now, voice: viaVoice || undefined }];
    save(withUser);
    setText('');
    setErr(null);
    setNote(null);
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
      if (S.voiceReply) speak(r.reply, lang);
    } catch (e) {
      const ce = e as CoachError;
      setErr(ce.message);
      if (ce.status === 429) setQuota((q) => (q ? { ...q, remaining: 0 } : q));
    } finally {
      setBusy(false);
    }
  };

  // voz: fala → texto (reconhecimento do telemóvel) → mesmo caminho do Coach
  const startVoice = () => {
    if (busy) return;
    stopSpeaking();
    if (listening) {
      rec.current?.stop();
      return;
    }
    setErr(null);
    setNote(null);
    const done = () => {
      setListening(false);
      setLevel(0);
      rec.current = null;
    };
    // iPhone (e navegadores sem reconhecimento de voz): grava e o servidor passa a texto
    if (shouldRecord(isIOS())) {
      notePremiumUse('voz');
      rec.current = record({
        onLevel: (v) => setLevel(v),
        onDone: async (audio, spoke) => {
          done();
          if (!spoke) {
            setErr('Não ouvi nada. Toque no microfone e fale perto do telemóvel.');
            return;
          }
          setBusy(true);
          setText('');
          try {
            const t = await transcribe(audio, PHOTO_API, deviceId());
            setBusy(false);
            if (t) send(t, true);
            else setErr('Não percebi. Tente outra vez, mais perto do telemóvel.');
          } catch (e) {
            setBusy(false);
            setErr((e as Error).message);
          }
        },
        onError: (msg) => {
          done();
          setErr(msg);
        },
      });
      setText('');
      setListening(true);
      return;
    }
    if (!speechSupported()) {
      setNote(KEYBOARD_DICTATION_HINT);
      inputRef.current?.focus();
      return;
    }
    notePremiumUse('voz');
    const r = listen(lang, {
      onText: (t) => setText(t),
      onDone: (t) => {
        done();
        if (t) send(t, true);
      },
      onError: (msg) => {
        done();
        setErr(msg);
      },
    });
    if (!r) {
      setErr('Não foi possível ligar o microfone. Pode escrever, ou usar o 🎤 do teclado.');
      return;
    }
    rec.current = r;
    setText('');
    setListening(true);
  };
  // "Toca para falar" no Início abre o Coach já a ouvir
  useEffect(() => {
    if (takeListenRequest()) startVoice();
    return () => {
      rec.current?.abort();
      stopSpeaking();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // o microfone cresce com a voz enquanto grava
  const micScale = listening && level ? { transform: `scale(${1 + Math.min(0.22, level * 2.5)})` } : undefined;

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
          <button className={`coach-mic ${listening ? 'on' : ''}`} style={micScale} onClick={startVoice} aria-label={listening ? 'Parar de ouvir' : 'Toca para falar'}><Icon name="mic" width={2} /></button>
          <h2 style={{ margin: '12px 0 6px' }}>{listening ? 'A ouvir… fale à vontade' : busy ? 'Um momento…' : 'Toca para falar'}</h2>
          <p className="small" style={{ margin: 0, opacity: 0.9 }}>
            Fale ou escreva como falaria com um amigo: "Dormi mal, comi dois ovos e pão, vou treinar à tarde e estou cansado." O Coach regista o sono, a refeição e a energia, e devolve uma sugestão para o seu dia.
          </p>
        </section>
      )}

      <div className="coach-chat" aria-live="polite">
        {hist.map((m, i) => (
          <div key={i} className={`bubble ${m.role}`}>
            <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{m.voice ? '🎙️ ' : ''}{m.text}</p>
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

      {err && (
        <div className="coach-warn small" role="alert">
          <p style={{ margin: 0 }}>{err}</p>
          {/bloqueado/.test(err) && <p className="mute" style={{ margin: '6px 0 0' }}>Entretanto, pode escrever a mensagem na caixa abaixo.</p>}
        </div>
      )}
      {note && <p className="small coach-note">🎤 {note}</p>}

      {hist.length === 0 && (
        <div className="chips coach-starters">
          <button className="chip" onClick={startVoice} disabled={busy}>🎙️ Contar como foi o meu dia</button>
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
        <button type="button" className={`coach-mic sm ${listening ? 'on' : ''}`} style={micScale} onClick={startVoice} disabled={busy} aria-label={listening ? 'Parar de ouvir' : 'Falar'}>
          <Icon name="mic" width={2} />
        </button>
        <textarea
          ref={inputRef}
          rows={2}
          value={text}
          maxLength={1200}
          placeholder={listening ? 'A ouvir… quando parar de falar, eu envio' : busy ? 'A pensar…' : 'Fale ou escreva… ex.: almocei frango com arroz'}
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

      <div className="coach-voice-opts">
        <div className="chips" role="group" aria-label="Português da voz">
          {(['pt-PT', 'pt-BR'] as const).map((v) => (
            <button key={v} className={`chip sm ${lang === v ? 'on' : ''}`} aria-pressed={lang === v} onClick={() => update((d) => { d.voiceLang = v; })}>
              {v === 'pt-PT' ? '🇵🇹 Portugal' : '🇧🇷 Brasil'}
            </button>
          ))}
        </div>
        {ttsSupported() && (
          <label className="small toggle-line">
            <input type="checkbox" checked={!!S.voiceReply} onChange={(e) => { const on = e.target.checked; update((d) => { d.voiceReply = on; }); if (!on) stopSpeaking(); }} />
            Ler as respostas em voz alta
          </label>
        )}
        <PremiumTag f="voz" />
      </div>
      <p className="small mute" style={{ margin: '8px 0 0' }}>
        A voz é passada a texto pelo telemóvel ou pelo servidor da NEFESH, e o áudio não é guardado.{' '}
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
