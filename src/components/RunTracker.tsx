import { useEffect, useRef, useState } from 'react';
import { RUN_KINDS, RunTrack, compactRoute, fmtKm, fmtPace, fmtTime, newRecords, records, routePath, runKcal, runMvpa, toGpx, type GeoPoint, type RunKind, type RunSummary } from '../domain/gps';
import { geoProvider } from '../domain/geo';
import { RUN_PLANS, advancePlan, currentSession, planDone, planSegments, segCue, sessionMinutes, sessionText, startPlan, type PlanId, type Seg } from '../domain/runPlans';
import { keepScreenOn, speak, stopSpeaking, ttsSupported, voiceLang } from '../domain/voice';
import { deleteFile, loadFile, saveFile } from '../domain/files';
import { shortDate, todayKey } from '../domain/dates';
import { painToday } from '../domain/progression';
import { shareMoment } from '../domain/social';
import { useStore } from '../state/store';

const spokenTime = (s: number) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = Math.round(s % 60);
  return `${h ? `${h} ${h === 1 ? 'hora' : 'horas'}, ` : ''}${m} ${m === 1 ? 'minuto' : 'minutos'} e ${x} segundos`;
};
const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const KIND_LABEL = Object.fromEntries(RUN_KINDS.map(([k, t]) => [k, t])) as Record<RunKind, string>;
const KIND_ICON = Object.fromEntries(RUN_KINDS.map(([k, , i]) => [k, i])) as Record<RunKind, string>;
type Route = [number, number, number, number | null][];

/** Traçado do percurso (sem mapa: não mostra ruas nem a casa). */
function RouteSvg({ route }: { route: Route }) {
  if (route.length < 2) return <p className="small mute">Percurso curto demais para desenhar.</p>;
  const d = routePath(route, 300, 200);
  const [sx, sy] = d.slice(1).split('L')[0].split(',');
  const end = d.split('L').pop()!.replace('M', '').split(',');
  return (
    <svg viewBox="0 0 300 200" className="run-route" role="img" aria-label="Traçado do percurso">
      <path d={d} fill="none" stroke="var(--neon)" strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={sx} cy={sy} r={5} fill="#fff" />
      <circle cx={end[0]} cy={end[1]} r={5} fill="#e0486b" />
    </svg>
  );
}

/**
 * Registo com GPS: distância, tempo, ritmo atual e médio, parciais com voz a cada km e,
 * numa sessão de plano, os blocos de correr e caminhar com voz.
 */
export function RunTracker({ kind, plan, onClose }: { kind: RunKind; plan?: { segs: Seg[]; label: string }; onClose: (saved: boolean) => void }) {
  const { S, update, updateToday, toast } = useStore();
  const lang = voiceLang(S);
  const [phase, setPhase] = useState<'gps' | 'run' | 'pause' | 'done'>('gps');
  const [acc, setAcc] = useState<number | null>(null);
  const [err, setErr] = useState('');
  const [, tick] = useState(0);
  const [voice, setVoice] = useState(ttsSupported());
  const [gapNote, setGapNote] = useState('');
  const [feel, setFeel] = useState<'facil' | 'certo' | 'dificil' | undefined>();
  const track = useRef(new RunTrack(kind));
  const stop = useRef<() => void>(() => {});
  const t0 = useRef(0);
  const paused = useRef({ total: 0, since: 0 });
  const gap = useRef(false);
  const hiddenAt = useRef(0);
  const seg = useRef({ i: 0, startEl: 0, startDist: 0, complete: false });
  const spokenKm = useRef(0);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const provider = geoProvider();

  /** Liga o GPS (também ao tocar em "Tentar outra vez", que volta a pedir a autorização). */
  const startGps = () => {
    stop.current();
    setErr('');
    stop.current = provider.start(
      (p: GeoPoint) => {
        setAcc(Math.round(p.acc));
        setErr('');
        if (phaseRef.current !== 'run') return;
        track.current.add(p, gap.current);
        gap.current = false;
      },
      (m) => setErr(m),
    );
  };
  const say = (t: string) => { if (voice) speak(t, lang); };
  const elapsed = () => {
    if (!t0.current) return 0;
    const now = phaseRef.current === 'pause' ? paused.current.since : Date.now();
    return Math.max(0, (now - t0.current - paused.current.total) / 1000);
  };

  // GPS ligado desde a abertura (para ganhar sinal antes de começar)
  useEffect(() => {
    keepScreenOn(true);
    startGps();
    const id = window.setInterval(() => tick((x) => x + 1), 1000);
    const vis = () => {
      if (document.hidden) hiddenAt.current = Date.now();
      else if (hiddenAt.current && phaseRef.current === 'run' && !provider.background) {
        const s = Math.round((Date.now() - hiddenAt.current) / 1000);
        if (s > 20) {
          gap.current = true;
          setGapNote(`O ecrã esteve bloqueado ${Math.round(s / 60) || 1} min: o GPS pode ter parado nesse tempo e a distância desse troço foi estimada em linha reta. Mantenha o ecrã ligado.`);
        }
        hiddenAt.current = 0;
      }
    };
    document.addEventListener('visibilitychange', vis);
    return () => {
      stop.current();
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', vis);
      keepScreenOn(false);
      stopSpeaking();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const tr = track.current;
  const el = elapsed();

  // voz: a cada km e nos blocos do plano
  useEffect(() => {
    if (phase !== 'run') return;
    const n = tr.splits.length;
    if (n > spokenKm.current) {
      spokenKm.current = n;
      const lap = tr.splits[n - 1] - (n > 1 ? tr.splits[n - 2] : 0);
      say(`${n} ${n === 1 ? 'quilómetro' : 'quilómetros'}. Tempo: ${spokenTime(el)}. Último quilómetro em ${spokenTime(lap)}.`);
    }
    if (plan && !seg.current.complete) {
      const s = plan.segs[seg.current.i];
      const over = s.secs ? el - seg.current.startEl >= s.secs : tr.dist - seg.current.startDist >= (s.km ?? 0) * 1000;
      if (over) {
        seg.current = { ...seg.current, i: seg.current.i + 1, startEl: el, startDist: tr.dist };
        try { navigator.vibrate?.([200, 100, 200]); } catch { /* sem vibração */ }
        if (seg.current.i >= plan.segs.length) {
          seg.current.complete = true;
          say('Sessão concluída! Muito bem. Pode terminar o registo.');
        } else say(segCue(plan.segs[seg.current.i], seg.current.i, plan.segs));
      }
    }
  });

  const begin = () => {
    t0.current = Date.now();
    setPhase('run');
    phaseRef.current = 'run';
    if (plan) say(segCue(plan.segs[0], 0, plan.segs));
    else say(`${KIND_LABEL[kind]} a começar. Bom treino!`);
  };
  const togglePause = () => {
    if (phase === 'run') {
      paused.current.since = Date.now();
      setPhase('pause');
    } else {
      paused.current.total += Date.now() - paused.current.since;
      gap.current = true;
      setPhase('run');
    }
  };
  const end = () => {
    if (phase === 'pause') paused.current.total += Date.now() - paused.current.since;
    paused.current.since = Date.now();
    stop.current();
    setPhase('done');
    phaseRef.current = 'done';
    stopSpeaking();
  };

  const secs = Math.round((paused.current.since && phase === 'done' ? paused.current.since - t0.current - paused.current.total : el * 1000) / 1000);
  const moving = Math.min(secs, Math.round(tr.moving)) || secs;
  const summary: RunSummary = {
    id: '', date: todayKey(), kind, dist: Math.round(tr.dist), secs, moving, splits: tr.splits,
    kcal: runKcal(kind, tr.dist, moving, S.ans?.peso), ...(tr.climb >= 5 ? { climb: Math.round(tr.climb) } : {}),
  };

  const save = async () => {
    const run: RunSummary = { ...summary, id: newId(), ...(plan ? { plan: plan.label } : {}) };
    const route = compactRoute(tr.points);
    try {
      if (route.length >= 2) {
        await saveFile(`rota-${run.id}`, new Blob([JSON.stringify(route)], { type: 'application/json' }));
        run.route = true;
      }
    } catch { /* sem espaço: guarda só o resumo */ }
    const rec = newRecords(S.runs, run);
    const m = Math.max(1, Math.round(moving / 60));
    update((d) => {
      d.runs = [...(d.runs ?? []), run].slice(-200);
      if (plan && d.runPlan) d.runPlan = advancePlan(d.runPlan, seg.current.complete, feel ?? 'certo').state;
    });
    updateToday((d) => {
      d.workouts = [...(d.workouts || []), { sessionId: `gps-${kind}`, title: `${KIND_LABEL[kind]} ${fmtKm(run.dist)} km`, minutes: m, mvpa: runMvpa(kind, run.dist, moving), strength: false }];
      d.t = Math.max(d.t ?? 0, kind === 'corrida' ? 3 : kind === 'bicicleta' ? 2 : 1);
    });
    if (S.community && m >= 10) shareMoment('treino', m);
    const planWhy = plan && S.runPlan ? advancePlan(S.runPlan, seg.current.complete, feel ?? 'certo').why : '';
    toast(`${KIND_LABEL[kind]} guardada: ${fmtKm(run.dist)} km em ${fmtTime(moving)}.${rec.length ? ` 🏆 ${rec.join(' · ')}` : ''}${planWhy ? ` ${planWhy}` : ''}`);
    onClose(true);
  };

  const cur = phase === 'run' ? tr.currentPace(Date.now()) : null;
  const avg = tr.dist > 50 ? (moving / tr.dist) * 1000 : null;
  const s = plan && !seg.current.complete ? plan.segs[seg.current.i] : null;
  const segLeft = s ? (s.secs ? Math.max(0, s.secs - (el - seg.current.startEl)) : null) : null;
  const segKmLeft = s?.km ? Math.max(0, s.km * 1000 - (tr.dist - seg.current.startDist)) : null;

  return (
    <div className="breath-overlay run-overlay" role="dialog" aria-label={`Registo de ${KIND_LABEL[kind].toLowerCase()} com GPS`}>
      <p className="small gold" style={{ margin: 0, fontWeight: 700 }}>{KIND_ICON[kind]} {plan ? plan.label : KIND_LABEL[kind]}</p>
      {phase === 'done' ? (
        <>
          <div className="run-big"><b>{fmtKm(summary.dist)}</b><span>km</span></div>
          <div className="run-grid">
            <div><b>{fmtTime(moving)}</b><span>tempo</span></div>
            <div><b>{kind === 'bicicleta' ? (moving ? ((summary.dist / 1000) / (moving / 3600)).toFixed(1).replace('.', ',') : '0') : fmtPace(avg)}</b><span>{kind === 'bicicleta' ? 'km/h' : 'ritmo /km'}</span></div>
            <div><b>{summary.kcal}</b><span>kcal (est.)</span></div>
          </div>
          {tr.points.length >= 2 && <RouteSvg route={compactRoute(tr.points)} />}
          {plan && (
            <>
              <p className="small" style={{ margin: 0 }}>{seg.current.complete ? '✓ Sessão do plano completa.' : 'A sessão do plano ficou a meio: repete-se na próxima vez.'} Como correu?</p>
              <div className="chips" style={{ justifyContent: 'center' }}>
                {([['facil', 'Fácil'], ['certo', 'Certo'], ['dificil', 'Difícil']] as const).map(([k, t]) => (
                  <button key={k} className={`chip sm ${feel === k ? 'on' : ''}`} aria-pressed={feel === k} onClick={() => setFeel(k)}>{t}</button>
                ))}
              </div>
            </>
          )}
          <div className="row" style={{ gap: 8, justifyContent: 'center' }}>
            <button className="btn ghost sm" onClick={() => onClose(false)}>Descartar</button>
            <button className="btn" disabled={summary.dist < 50 || (!!plan && !feel)} onClick={save}>Guardar</button>
          </div>
          {summary.dist < 50 && <p className="small" style={{ opacity: 0.8 }}>Menos de 50 m registados: nada a guardar.</p>}
        </>
      ) : (
        <>
          <div className="run-big"><b>{fmtKm(tr.dist)}</b><span>km</span></div>
          <div className="run-grid">
            <div><b>{fmtTime(el)}</b><span>tempo</span></div>
            <div><b>{kind === 'bicicleta' ? (cur ? (3600 / cur).toFixed(1).replace('.', ',') : '–') : fmtPace(cur)}</b><span>{kind === 'bicicleta' ? 'km/h agora' : 'ritmo agora'}</span></div>
            <div><b>{fmtPace(avg)}</b><span>ritmo médio</span></div>
          </div>
          {s && phase !== 'gps' && (
            <p className={`run-seg ${s.k}`}>
              {s.k === 'corre' ? '🏃 Corra' : s.k === 'caminha' ? '🚶 Caminhe' : s.k === 'aquecer' ? '🔥 Aquecimento' : '🌬️ Arrefecer'}
              {segLeft !== null ? ` · ${fmtTime(segLeft)}` : segKmLeft !== null ? ` · faltam ${fmtKm(segKmLeft)} km` : ''}
            </p>
          )}
          {plan && seg.current.complete && <p className="run-seg corre">✓ Sessão concluída</p>}
          {tr.splits.length > 0 && (
            <p className="small" style={{ margin: 0, opacity: 0.85 }}>
              {tr.splits.slice(-3).map((x, i, arr) => { const n = tr.splits.length - arr.length + i; return `km ${n + 1}: ${fmtPace(x - (n ? tr.splits[n - 1] : 0))}`; }).join(' · ')}
            </p>
          )}
          {phase === 'gps' ? (
            <>
              <p className="small" style={{ margin: 0 }}>
                {err || (acc === null ? '📡 À procura do sinal de GPS…' : acc <= 30 ? `✓ GPS pronto (precisão ${acc} m)` : acc > 150 ? `📡 Precisão de ${acc} m: a "Localização exata" parece desligada.` : `📡 Sinal fraco (${acc} m): vá para um sítio aberto.`)}
              </p>
              {(err || (acc !== null && acc > 150)) && <GpsHelp precise={!err} onRetry={startGps} />}
              <button className="btn" onClick={begin} disabled={!!err}>▶ Começar</button>
              {plan && <p className="small" style={{ margin: 0, opacity: 0.85 }}>{sessionText(plan.segs)} · ~{sessionMinutes(plan.segs)} min, com aquecimento e arrefecimento. A voz avisa cada mudança.</p>}
            </>
          ) : (
            <div className="row" style={{ gap: 8, justifyContent: 'center' }}>
              <button className="btn ghost sm" onClick={togglePause}>{phase === 'pause' ? '▶ Retomar' : '⏸ Pausa'}</button>
              <button className="btn sm" onClick={end}>■ Terminar</button>
            </div>
          )}
          {gapNote && <p className="small warn" style={{ margin: 0 }}>{gapNote}</p>}
          {ttsSupported() && <button className="link small inline" onClick={() => setVoice(!voice)}>{voice ? '🔊 Voz ligada (a cada km)' : '🔈 Voz desligada'}</button>}
          {!provider.background && <p className="small" style={{ margin: 0, opacity: 0.7 }}>Mantenha o ecrã ligado: com o ecrã bloqueado o telemóvel pode parar o GPS. A app mantém o ecrã aceso.</p>}
          {phase === 'gps' && <button className="link small inline" onClick={() => onClose(false)}>Fechar</button>}
        </>
      )}
    </div>
  );
}

/** Passos para autorizar a localização (iPhone ou Android) e voltar a tentar. */
function GpsHelp({ precise, onRetry }: { precise: boolean; onRetry: () => void }) {
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const installed = window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
  return (
    <div className="gps-help small">
      {ios ? (
        <ol>
          <li><b>Definições (Ajustes) → Privacidade e segurança → Serviços de localização</b>: ligado.</li>
          <li>Na mesma lista, <b>Websites do Safari</b> (ou o navegador que usa) → <b>Durante a utilização</b> e <b>Localização exata</b> ligada.</li>
          {!installed && <li>No Safari, toque em <b>aA</b> (ou ☰) ao lado do endereço → <b>Definições do website</b> → <b>Localização</b> → <b>Perguntar</b> ou <b>Permitir</b>.</li>}
          <li>Volte aqui e toque em <b>Tentar outra vez</b>; se o iPhone perguntar, escolha <b>Permitir</b>.</li>
        </ol>
      ) : (
        <ol>
          <li>Ligue a <b>Localização</b> no painel rápido do telemóvel{precise ? ' e a opção de precisão (Precisão da localização Google)' : ''}.</li>
          <li>No Chrome, toque no cadeado ao lado do endereço → <b>Permissões</b> → <b>Localização</b> → <b>Permitir</b>.</li>
          <li>Toque em <b>Tentar outra vez</b>.</li>
        </ol>
      )}
      <button className="btn sm" onClick={onRetry}>↻ Tentar outra vez</button>
    </div>
  );
}

/** Detalhe de um treino guardado: percurso, parciais, exportar GPX e apagar. */
function RunDetail({ run, onClose }: { run: RunSummary; onClose: () => void }) {
  const { update } = useStore();
  const [route, setRoute] = useState<Route | null>(null);
  useEffect(() => {
    if (!run.route) return;
    loadFile(`rota-${run.id}`).then(async (b) => b && setRoute(JSON.parse(await b.text()))).catch(() => {});
  }, [run.id, run.route]);
  const gpx = () => {
    if (!route) return;
    const url = URL.createObjectURL(new Blob([toGpx(run, route)], { type: 'application/gpx+xml' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `nefesh-${run.kind}-${run.date}.gpx`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };
  return (
    <div className="modal show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Detalhe do treino">
        <h2 style={{ marginTop: 0 }}>{KIND_ICON[run.kind]} {KIND_LABEL[run.kind]} · {shortDate(run.date)}</h2>
        <p className="small">{fmtKm(run.dist)} km · {fmtTime(run.moving)} · {run.kind === 'bicicleta' ? `${((run.dist / 1000) / (run.moving / 3600 || 1)).toFixed(1).replace('.', ',')} km/h` : `${fmtPace((run.moving / run.dist) * 1000)} /km`} · {run.kcal} kcal{run.climb ? ` · ↗ ${run.climb} m` : ''}</p>
        {run.plan && <p className="small mute">{run.plan}</p>}
        {route && <RouteSvg route={route} />}
        {run.splits.length > 0 && (
          <table className="mydata small">
            <tbody>
              {run.splits.map((s, i) => (
                <tr key={i}><td>km {i + 1}</td><td>{fmtPace(s - (i ? run.splits[i - 1] : 0))} /km</td></tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="row" style={{ gap: 8, marginTop: 12 }}>
          {route && <button className="btn ghost sm" onClick={gpx}>⬇ GPX (Strava, Garmin)</button>}
          <button className="btn ghost sm" onClick={() => { if (confirm('Apagar este treino?')) { update((d) => { d.runs = (d.runs ?? []).filter((x) => x.id !== run.id); }); deleteFile(`rota-${run.id}`).catch(() => {}); onClose(); } }}>Apagar</button>
          <button className="btn sm" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  );
}

/** Plano de corrida que se ajusta: escolher, sessão de hoje e progresso. */
function PlanCard({ onStart }: { onStart: (segs: Seg[], label: string) => void }) {
  const { S, update } = useStore();
  const st = S.runPlan;
  if (!st)
    return (
      <div style={{ marginTop: 10 }}>
        <p className="small mute" style={{ margin: '0 0 6px' }}>Planos de corrida que se ajustam ao que faz:</p>
        {(Object.keys(RUN_PLANS) as PlanId[]).map((id) => (
          <button key={id} className="med-row" onClick={() => update((d) => { d.runPlan = startPlan(id); })}>
            <span className="med-play" aria-hidden="true">🏁</span>
            <span style={{ flex: 1, display: 'grid', textAlign: 'left' }}><b className="small">{RUN_PLANS[id].title}</b><span className="small mute">{RUN_PLANS[id].desc}</span></span>
          </button>
        ))}
      </div>
    );
  const p = RUN_PLANS[st.id];
  if (planDone(st))
    return (
      <div className="phase-hint card" style={{ marginTop: 10 }}>
        <p className="small" style={{ margin: 0 }}>🎉 <b>{p.title} concluído!</b> {st.id === 'c5k' ? 'Já corre 30 minutos seguidos. Próximo passo: Rumo aos 10 km?' : 'Está pronto para os 10 km.'}</p>
        <div className="row" style={{ gap: 8, justifyContent: 'flex-start', marginTop: 8 }}>
          {st.id === 'c5k' && <button className="btn sm" onClick={() => update((d) => { d.runPlan = startPlan('k10'); })}>Começar os 10 km</button>}
          <button className="btn ghost sm" onClick={() => update((d) => { delete d.runPlan; })}>Fechar plano</button>
        </div>
      </div>
    );
  const c = currentSession(st);
  const segs = planSegments({ ...st, week: c.week, session: c.session });
  const label = `${p.title} · semana ${c.week}, sessão ${c.session}`;
  const today = (S.runs ?? []).some((r) => r.date === todayKey() && r.plan);
  return (
    <div className="card plan-run" style={{ marginTop: 10 }}>
      <div className="row"><b className="small">{p.title}</b><span className="small mute">semana {c.week} de {p.weeks.length}</span></div>
      <div className="plan-dots" aria-hidden="true">{p.weeks.map((_, i) => <i key={i} className={i + 1 < c.week ? 'done' : i + 1 === c.week ? 'now' : ''} />)}</div>
      <p className="small" style={{ margin: '6px 0' }}>Sessão {c.session} de 3: <b>{sessionText(segs)}</b> · ~{sessionMinutes(segs)} min</p>
      {c.back && <p className="small gold" style={{ margin: '0 0 6px' }}>Mais de 10 dias sem correr: repete a última sessão para voltar com calma.</p>}
      {painToday(S) && <p className="small gold" style={{ margin: '0 0 6px' }}>Hoje registou dor: se preferir, faça só a caminhada.</p>}
      {today && <p className="small neon" style={{ margin: '0 0 6px' }}>✓ Já fez uma sessão hoje. Descanse um dia entre sessões.</p>}
      <div className="row" style={{ gap: 8, justifyContent: 'flex-start' }}>
        <button className="btn sm" onClick={() => onStart(segs, label)}>▶ Começar sessão</button>
        <button className="link small inline" onClick={() => { if (confirm('Terminar este plano? O progresso fica no histórico.')) update((d) => { delete d.runPlan; }); }}>Terminar plano</button>
      </div>
    </div>
  );
}

/** Cartão "Ao ar livre com GPS" no Treino. */
export function OutdoorCard() {
  const { S } = useStore();
  const [run, setRun] = useState<{ kind: RunKind; plan?: { segs: Seg[]; label: string } } | null>(null);
  const [detail, setDetail] = useState<RunSummary | null>(null);
  const [all, setAll] = useState(false);
  const runs = [...(S.runs ?? [])].reverse();
  const rec = records(S.runs, 'corrida');
  return (
    <section className="card">
      {run && <RunTracker kind={run.kind} plan={run.plan} onClose={() => setRun(null)} />}
      {detail && <RunDetail run={detail} onClose={() => setDetail(null)} />}
      <h2 style={{ marginTop: 0 }}>Ao ar livre com GPS</h2>
      <div className="seg seg-wide run-kinds" style={{ gridTemplateColumns: 'repeat(3,minmax(0,1fr))' }}>
        {RUN_KINDS.map(([k, t, i]) => <button key={k} onClick={() => setRun({ kind: k })}>{i} {t}</button>)}
      </div>
      <PlanCard onStart={(segs, label) => setRun({ kind: 'corrida', plan: { segs, label } })} />
      {rec && (
        <p className="small" style={{ margin: '10px 0 0' }}>
          🏆 <b>Recordes de corrida:</b> maior distância {fmtKm(rec.longest.dist)} km{rec.km1 ? ` · km mais rápido ${fmtPace(rec.km1.secs)}` : ''}{rec.k5 ? ` · 5 km em ${fmtTime(rec.k5.secs)}` : ''}{rec.k10 ? ` · 10 km em ${fmtTime(rec.k10.secs)}` : ''}
        </p>
      )}
      {runs.length > 0 && (
        <ul className="weeklist" style={{ marginTop: 8 }}>
          {(all ? runs : runs.slice(0, 4)).map((r) => (
            <li key={r.id}>
              <button onClick={() => setDetail(r)}>
                <span className="small mute" style={{ width: 62 }}>{shortDate(r.date)}</span>
                <span aria-hidden="true">{KIND_ICON[r.kind]}</span>
                <span style={{ flex: 1 }}>{fmtKm(r.dist)} km · {fmtTime(r.moving)}</span>
                <span className="small mute">{r.kind === 'bicicleta' ? `${((r.dist / 1000) / (r.moving / 3600 || 1)).toFixed(1).replace('.', ',')} km/h` : `${fmtPace((r.moving / r.dist) * 1000)} /km`}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {runs.length > 4 && <button className="link small inline" onClick={() => setAll(!all)}>{all ? 'Ver menos' : `Ver todos (${runs.length})`}</button>}
      <p className="small mute" style={{ margin: '8px 0 0' }}>O percurso fica só no seu telemóvel; na comunidade aparecem só os minutos.</p>
    </section>
  );
}
