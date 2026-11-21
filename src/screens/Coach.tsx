import { useEffect, useRef, useState } from 'react';
import { Icon } from '../components/Icon';
import { PremiumTag } from '../components/PremiumTag';
import type { Nav } from '../App';
import { applyCoachActions, askCoach, clearHistory, CoachError, loadHistory, NEEDS_CONFIRM, saveHistory, type CoachMsg } from '../domain/coach';
import { SCREEN_TAB, daySummary } from '../domain/assistant';
import { asksNow } from '../domain/prompts';
import { useSocial } from '../domain/social';
import { MemoryPanel, ProposalCard } from '../components/AssistantParts';
import { todayKey } from '../domain/dates';
import { dailyQuota, TEST_MODE } from '../domain/features';
import { ritualJustDone } from '../state/doses';
import { useStore } from '../state/store';
import { requestBreath } from '../domain/mind';
import type { DayLog } from '../domain/types';
import { notePremiumUse } from '../domain/analytics';
import { KEYBOARD_DICTATION_HINT, keepScreenOn, listen, primeAudio, record, speak, speechSupported, stopSpeaking, takeListenRequest, transcribe, ttsSupported, shouldRecord, voiceLang, type Listening } from '../domain/voice';
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
  const [showMemory, setShowMemory] = useState(false);
  // pergunta do momento (sono de manhã, almoço, energia à noite, peso semanal)
  const ask = asksNow(S)[0];
  const { state: social } = useSocial(120_000);
  // conversa por voz: depois de responder em voz alta, volta a ouvir
  const convo = useRef(false);
  const [convoOn, setConvoOn] = useState(false);
  const afterSpeech = () => {
    if (convo.current) window.setTimeout(() => startRef.current(), 350);
  };
  const setConvo = (on: boolean) => {
    convo.current = on;
    setConvoOn(on);
    keepScreenOn(on);
    if (!on) {
      rec.current?.abort();
      keepScreenOn(false);
      rec.current = null;
      setListening(false);
    }
  };
  /** O que a pessoa disse por voz: na conversa por voz, "obrigado"/"parar" termina. */
  const heard = (t: string) => {
    if (convo.current && /^(obrigad[oa]|parar|para|chega|tchau|adeus|até logo|até já|terminar|fim)\b/i.test(t.trim())) {
      setConvo(false);
      speak('Até já!', lang);
      return;
    }
    send(t, true);
  };

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
    // escreveu com o microfone ligado: desliga-o
    if (!viaVoice && rec.current) {
      rec.current.abort();
      rec.current = null;
      setListening(false);
    }
    const now = new Date().toISOString();
    const withUser = [...hist, { role: 'user' as const, text: t, at: now, voice: viaVoice || undefined }];
    save(withUser);
    setText('');
    setErr(null);
    setNote(null);
    setBusy(true);
    try {
      const r = await askCoach(S, withUser, { friends: S.community ? (social?.friends ?? []).map((f) => f.nick) : undefined });
      if (r.limit !== undefined && r.remaining !== undefined) setQuota({ remaining: r.remaining, limit: r.limit });
      const key = todayKey();
      const before: DayLog | null = S.logs[key] ? structuredClone(S.logs[key]) : null;
      const extra = structuredClone({ memory: S.memory, gymLoadLog: S.gymLoadLog, gymLoads: S.gymLoads, exNames: S.exNames, bodyLog: S.bodyLog, ans: S.ans });
      let applied: string[] = [];
      const auto = r.actions.filter((a) => !NEEDS_CONFIRM.includes(a.type));
      if (auto.length) {
        // aplica num rascunho para saber o que mudou, e grava de uma vez
        const draft = structuredClone(S);
        applied = applyCoachActions(draft, auto);
        const after = draft.logs[key];
        update((d) => {
          if (after) d.logs[key] = after;
          d.memory = draft.memory;
          d.gymLoadLog = draft.gymLoadLog;
          d.gymLoads = draft.gymLoads;
          d.exNames = draft.exNames;
          d.bodyLog = draft.bodyLog;
          d.ans = draft.ans;
        });
        const done = after ? ritualJustDone(S, before ?? undefined, after) : null;
        if (done) toast(done);
      }
      const proposals = r.actions.filter((a) => NEEDS_CONFIRM.includes(a.type));
      const open = [...new Set(r.actions.filter((a) => a.type === 'abrir' && a.screen && SCREEN_TAB[a.screen]).map((a) => a.screen!))];
      const wantsSummary = r.actions.some((a) => a.type === 'resumo');
      const next: CoachMsg[] = [
        ...withUser,
        {
          role: 'assistant', text: r.reply, at: new Date().toISOString(), applied,
          undo: applied.length ? { day: key, log: before, extra } : undefined,
          pro: r.suggest_professional, breath: r.actions.find((a) => a.type === 'respiracao')?.value,
          proposals: proposals.length ? proposals : undefined, proposalStatus: proposals.length ? 'pendente' : undefined, open: open.length ? open : undefined,
        },
      ];
      const sum = wantsSummary ? daySummary(S) : '';
      if (sum) next.push({ role: 'assistant', text: `🔊 ${sum}`, at: new Date().toISOString(), summary: true });
      save(next);
      if (S.voiceReply || convo.current) speak(sum ? `${r.reply} ${sum}` : r.reply, lang, afterSpeech);
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
    primeAudio();
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
            if (convo.current) setConvo(false);
            return;
          }
          setBusy(true);
          setText('');
          try {
            const t = await transcribe(audio, PHOTO_API, deviceId());
            setBusy(false);
            if (t) heard(t);
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
        if (t) heard(t);
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
  // versão sempre atual (com a conversa de agora) para o toque no botão do centro
  const startRef = useRef(startVoice);
  startRef.current = startVoice;
  // "Toca para falar" no Início abre o Coach já a ouvir
  useEffect(() => {
    if (takeListenRequest()) startVoice();
    // toque no botão do centro com o Coach já aberto
    const onAsk = () => {
      if (takeListenRequest() && !rec.current) startRef.current();
    };
    window.addEventListener('nefesh-ouvir', onAsk);
    return () => {
      window.removeEventListener('nefesh-ouvir', onAsk);
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
    const { day, log, extra } = m.undo;
    update((d) => {
      if (log) d.logs[day] = log;
      else delete d.logs[day];
      if (extra) Object.assign(d, extra);
    });
    save(hist.map((x, i) => (i === idx ? { ...x, undone: true } : x)));
    toast('Registos desfeitos.');
  };
  // só a última resposta com registos pode ser desfeita (desfazer repõe o dia como estava antes dela)
  const lastUndoable = hist.map((m, i) => (m.applied?.length && !m.undone ? i : -1)).filter((i) => i >= 0).pop();

  return (
    <>
      <div className="row">
        <h1 style={{ margin: 0 }}>NEFESH Voice Assistant</h1>
        <PremiumTag f="coach" />
      </div>
      <div className="row" style={{ gap: 8, justifyContent: 'flex-start', margin: '8px 0 0', flexWrap: 'wrap' }}>
        <button className={`chip sm ${showMemory ? 'on' : ''}`} aria-pressed={showMemory} onClick={() => setShowMemory(!showMemory)}>🧠 O que sei sobre si</button>
        <button className="chip sm" onClick={() => { primeAudio(); const t = daySummary(S); save([...hist, { role: 'assistant', text: `🔊 ${t}`, at: new Date().toISOString(), summary: true }]); speak(t, lang); }}>🔊 Resumo do meu dia</button>
      </div>
      {showMemory && <MemoryPanel />}

      {hist.length === 0 && (
        <section className="card hero coach-hero">
          <button className={`coach-mic ${listening ? 'on' : ''}`} style={micScale} onClick={startVoice} aria-label={listening ? 'Parar de ouvir' : 'Toca para falar'}><Icon name="mic" width={2} /></button>
          <h2 style={{ margin: '12px 0 6px' }}>{listening ? 'A ouvir… fale à vontade' : busy ? 'Um momento…' : 'Toca para falar'}</h2>
          <p className="small" style={{ margin: 0, opacity: 0.9 }}>
            Fale ou escreva como falaria com um amigo: "Dormi mal, comi dois ovos e pão, vou treinar à tarde e estou cansado." O assistente regista o sono, a refeição e a energia, e devolve uma sugestão para o seu dia.
          </p>
        </section>
      )}

      <div className="coach-chat" aria-live="polite">
        {ask && !hist.some((m) => new Date(m.at).toDateString() === new Date().toDateString()) && (
          <div className="bubble assistant ask-bubble">
            <p style={{ margin: 0 }}>{ask.text}</p>
            <div className="row" style={{ gap: 6, justifyContent: 'flex-start', flexWrap: 'wrap', marginTop: 8 }}>
              {ask.quick.map((q) => <button key={q} className="chip sm" disabled={busy} onClick={() => send(q)}>{q}</button>)}
              <button className="chip sm" disabled={busy} onClick={startVoice}>🎙️ Responder por voz</button>
            </div>
          </div>
        )}
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
            {m.proposals && <ProposalCard m={m} onDone={(status) => save(hist.map((x, j) => (j === i ? { ...x, proposalStatus: status } : x)))} />}
            {m.open && (
              <div className="row" style={{ gap: 6, justifyContent: 'flex-start', marginTop: 8, flexWrap: 'wrap' }}>
                {m.open.map((sc) => <button key={sc} className="btn ghost sm" onClick={() => go(SCREEN_TAB[sc][0])}>Abrir {SCREEN_TAB[sc][1]} ›</button>)}
              </div>
            )}
            {m.breath ? (
              <button className="btn sm" style={{ marginTop: 8 }} onClick={() => { requestBreath(m.breath!); go('mente'); }}>🌬️ Fazer a pausa ({m.breath} min)</button>
            ) : null}
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
          aria-label="Mensagem para o NEFESH Voice Assistant"
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

      <button
        className={`btn ${convoOn ? '' : 'ghost'} full convo-btn`}
        style={{ marginTop: 10 }}
        onClick={() => {
          if (convoOn) {
            setConvo(false);
            stopSpeaking();
            return;
          }
          primeAudio();
          setConvo(true);
          // começa por perguntar o que falta hoje (se houver), e depois ouve
          if (ask && !hist.some((m) => new Date(m.at).toDateString() === new Date().toDateString())) speak(ask.text, lang, afterSpeech);
          else if (!listening) startVoice();
        }}
      >
        {convoOn ? '⏹ Terminar a conversa por voz' : '🗣️ Conversa por voz (mãos-livres)'}
      </button>
      {convoOn && <p className="small mute" style={{ margin: '6px 0 0' }}>Fale à vontade: eu respondo em voz alta e volto a ouvir. Para terminar, diga "obrigado" ou toque no botão. Mantenha a app aberta.</p>}
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
        O NEFESH Voice Assistant apoia, não substitui profissionais, e não faz diagnósticos. Os valores são estimativas. As mensagens vão à IA só para responder e a NEFESH não as guarda: o histórico fica neste telemóvel.
        {hist.length > 0 && (
          <>
            {' '}
            <button
              className="link small inline"
              onClick={() => {
                if (!confirm('Apagar a conversa com o NEFESH Voice Assistant? Os registos feitos ficam no diário.')) return;
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
