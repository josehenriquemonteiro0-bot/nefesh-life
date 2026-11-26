import { appUrl, legalUrl } from '../domain/platform';
import { useEffect, useState } from 'react';
import { getAuth } from '../domain/account';
import { shortDate } from '../domain/dates';
import { GYM } from '../domain/gymData';
import { EXERCISES } from '../domain/training';
import { inviteText, proApi, type ProArea, type ProInfo, type ProLog, type ProStudent } from '../domain/pro';
import { FOCUS_PRESETS, GROUP_NAME, INTRO, OUTRO, addFromLibrary, applySplit, hasBookend, isFinal, isWarmup, letter, searchExercises, splitName, toggleBookend, type Bookend, type LibExercise } from '../domain/proLibrary';
import type { ParsedWorkoutPlan, PlanWorkout, WorkoutExercise } from '../domain/planRead';
import { whatsappShare } from '../domain/content';
import { useStore } from '../state/store';
import { DictationCard, ReviewCard } from '../components/ProAI';
import { ProfileEditor } from '../components/ProProfile';
import { IntegProfileEditor } from '../components/ProInteg';
import { libraryVideo, loadVideos } from '../domain/exVideos';
import { StudentAssessments } from '../components/ProAssess';
import { ChatThread } from '../components/ProChat';
import { ShareReport } from '../components/ProReport';
import { DirectoryEditor } from '../components/ProDirectory';
import { FastRxEditor, NutriEditor, NutriLogs, NutriVisits, TeamCard } from '../components/ProNutri';
import { isNutriKind } from '../domain/proNutriClient';
import { WellEditor, WellLogs } from '../components/ProWell';
import { profileText } from '../domain/proProfile';
import { isTestCopy } from '../testDate';
import type { Nav } from '../App';

/** Versão dos Termos do NEFESH Life Pro (igual a PRO_TERMS no servidor). */
const PRO_TERMS = '2026-11-26';

const LIB = [...Object.values(GYM), ...EXERCISES].map((e) => ({ name: e.name, area: e.area }));
const EFFORT: Record<string, string> = { facil: 'fácil', ok: 'na medida', dificil: 'difícil' };
/** Áreas do NEFESH Life Pro: [kind, ícone, nome, o que faz]. */
const AREAS: [string, string, string, string][] = [
  ['personal', '🏋️', 'Personal trainer', 'Treinos, periodização, avaliações físicas'],
  ['nutricionista', '🥗', 'Nutricionista', 'Planos alimentares, jejum, adesão, consultas'],
  ['medico', '🩺', 'Médico(a)', 'Ficha clínica, plano alimentar, análises, consultas'],
  ['integrativo', '🌿', 'Terapias integrativas', 'Plano de bem-estar, hábitos, práticas guiadas, sessões'],
];
/** O que escrever no registo de cada área. */
const REG_HINT: Record<string, string> = {
  nutricionista: 'CRN no Brasil, cédula da Ordem dos Nutricionistas em Portugal',
  medico: 'CRM no Brasil, cédula da Ordem dos Médicos em Portugal',
  integrativo: 'formação ou certificação: naturopatia, terapias integrativas…',
  personal: 'CREF no Brasil, título profissional em Portugal',
};
const ALERT_ICON: Record<string, string> = { enviar: '📨', dor: '😣', parado: '⏸️', saltou: '⏭️', dificil: '🥵', subir: '📈', fim: '📅', adesao: '📉', fome: '🍽️', peso: '⚖️', checkin: '📝', retorno: '📅', sintomas: '📊', anamnese: '📝' };
const STATUS: Record<string, string> = { seguido: 'concluído como planeado', alterado: 'feito com alterações', saltado: 'não fez' };
const newEx = (): WorkoutExercise => ({ name: '', sets: 3, reps: '10', load: '', rest: '60 s', notes: '' });

const MODE_KEY = 'nefesh-life-pro-modo';

/** Periodização: duração em semanas e fases (opcional). */
function PeriodEditor({ plan, setPlan }: { plan: ParsedWorkoutPlan; setPlan: (p: ParsedWorkoutPlan) => void }) {
  const phases = plan.phases ?? [];
  const sum = phases.reduce((a, f) => a + f.weeks, 0);
  const setPhases = (list: NonNullable<ParsedWorkoutPlan['phases']>) => setPlan({ ...plan, phases: list.length ? list : undefined, weeks: list.length ? list.reduce((a, f) => a + f.weeks, 0) : plan.weeks });
  const setF = (k: number, patch: Partial<NonNullable<ParsedWorkoutPlan['phases']>[number]>) => setPhases(phases.map((f, j) => (j === k ? { ...f, ...patch } : f)));
  return (
    <div className="pro-period">
      <label className="small" style={{ display: 'block', marginTop: 10 }}>Duração do plano{' '}
        <input className="field sm" type="number" min={0} max={52} style={{ width: 64 }} value={plan.weeks ?? ''} disabled={phases.length > 0} placeholder="—"
          onChange={(e) => { const w = Math.max(0, Math.min(52, Number(e.target.value) || 0)); setPlan({ ...plan, weeks: w || undefined }); }} /> semanas
      </label>
      {plan.start && <p className="small mute" style={{ margin: '4px 0 0' }}>Começou a {plan.start.split('-').reverse().join('/')}. <button className="link small inline" onClick={() => setPlan({ ...plan, start: undefined })}>Recomeçar no dia em que enviar</button></p>}
      <p className="small" style={{ margin: '10px 0 4px' }}><b>Fases</b> <span className="mute">(opcional: adaptação, hipertrofia, força, descarga…)</span></p>
      {phases.map((f, k) => (
        <div key={k} className="pro-phase">
          <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
            <input className="field sm" style={{ flex: 1, minWidth: 0 }} value={f.name} maxLength={40} placeholder={`Fase ${k + 1} (ex.: Adaptação)`} onChange={(e) => setF(k, { name: e.target.value })} aria-label={`Nome da fase ${k + 1}`} />
            <input className="field sm" type="number" min={1} max={26} style={{ flex: '0 0 52px', width: 52, minWidth: 0, boxSizing: 'border-box' }} value={f.weeks} onChange={(e) => setF(k, { weeks: Math.max(1, Math.min(26, Number(e.target.value) || 1)) })} aria-label={`Semanas da fase ${k + 1}`} />
            <span className="small mute">sem.</span>
            <button className="x" aria-label={`Apagar fase ${k + 1}`} onClick={() => setPhases(phases.filter((_, j) => j !== k))}>×</button>
          </div>
          <input className="field sm" style={{ width: '100%', boxSizing: 'border-box', marginTop: 4 }} value={f.notes} maxLength={300} placeholder="Orientação para o aluno (ex.: 4×10, subir 2,5 kg por semana)" onChange={(e) => setF(k, { notes: e.target.value })} aria-label={`Orientação da fase ${k + 1}`} />
        </div>
      ))}
      <button className="btn ghost sm" disabled={phases.length >= 8} onClick={() => setPhases([...phases, { name: '', weeks: 2, notes: '' }])}>+ Fase</button>
      {phases.length > 0 && <span className="small mute" style={{ marginLeft: 8 }}>Total: {sum} semanas</span>}
    </div>
  );
}

/** Nome do exercício com lista de sugestões que se vai filtrando enquanto se escreve. */
function ExerciseInput({ value, focus, onPick, onType, label }: { value: string; focus: string; onPick: (e: LibExercise) => void; onType: (t: string) => void; label: string }) {
  const [open, setOpen] = useState(false);
  const list = open ? searchExercises(value, focus, LIB) : [];
  return (
    <div className="pro-ac">
      <input className="field sm" style={{ width: '100%', boxSizing: 'border-box' }} value={value} maxLength={80} placeholder="Escreva ou escolha o exercício" autoComplete="off"
        onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)} onChange={(ev) => { onType(ev.target.value); setOpen(true); }} aria-label={label} />
      {open && list.length > 0 && !(list.length === 1 && list[0].name === value) && (
        <ul className="pro-ac-list" role="listbox">
          {list.map((e) => (
            <li key={e.name}><button type="button" onMouseDown={(ev) => ev.preventDefault()} onClick={() => { onPick(e); setOpen(false); }}>
              <span>{e.name}</span><span className="small mute">{GROUP_NAME[e.group]}</span>
            </button></li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Montar ou editar o treino de um aluno: divisão (A, AB, ABC…), um treino de cada vez, sugestões pelo foco. */
function PlanEditor({ student, others, onClose, onSaved, kind = 'personal' }: { student: ProStudent; others: ProStudent[]; onClose: () => void; onSaved: () => void; kind?: string }) {
  const { toast } = useStore();
  const [plan, setPlan] = useState<ParsedWorkoutPlan>(() => student.draft ?? student.plan ?? { is_workout: true, workouts: [], per_week: 3, professional: '', notes: '' });
  // rascunho: 'Guardar' não envia; 'Concluir e enviar' é que o aluno passa a ver
  const [savedJson, setSavedJson] = useState(() => JSON.stringify(student.draft ?? student.plan ?? { is_workout: true, workouts: [], per_week: 3, professional: '', notes: '' }));
  const [savedAt, setSavedAt] = useState<string | null>(student.draftAt ?? null);
  const [touched, setTouched] = useState(false);
  const dirty = JSON.stringify(plan) !== savedJson;
  const [cur, setCur] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  // lista de sugestões: fechada por omissão; abre sozinha só no treino vazio, no modo manual
  const [sugOpen, setSugOpen] = useState<boolean | null>(null);
  const [warmAll, setWarmAll] = useState(false);
  /** liga/desliga um item do início/fim neste treino (ou em todos, com o mesmo estado) */
  const [bookOpen, setBookOpen] = useState<boolean | null>(null);
  const setBook = (x: Bookend) => {
    setBookOpen(true);
    const on = !hasBookend(plan.workouts[Math.min(cur, Math.max(0, plan.workouts.length - 1))], x);
    setPlan({ ...plan, workouts: plan.workouts.map((wk, j) => (j === Math.min(cur, plan.workouts.length - 1) || warmAll ? toggleBookend(wk, x, on) : wk)) });
  };
  const [, setVids] = useState(0);
  useEffect(() => { loadVideos().then(() => setVids((x) => x + 1)); }, []);
  const [mode, setModeState] = useState<'manual' | 'voz'>(() => { try { return localStorage.getItem(MODE_KEY) === 'voz' ? 'voz' : 'manual'; } catch { return 'manual'; } });
  const setMode = (m: 'manual' | 'voz') => { setModeState(m); try { localStorage.setItem(MODE_KEY, m); } catch { /* sem armazenamento */ } };
  const top = () => document.querySelector('.pro-tabs, .pro-workout')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const [setupOpen, setSetupOpen] = useState(false);
  const n = plan.workouts.length;
  const i = Math.min(cur, Math.max(0, n - 1));
  const w = plan.workouts[i];
  const setW = (f: (w: PlanWorkout) => PlanWorkout) => setPlan({ ...plan, workouts: plan.workouts.map((x, j) => (j === i ? f(x) : x)) });
  const setE = (k: number, patch: Partial<WorkoutExercise>) => setW((x) => ({ ...x, exercises: x.exercises.map((e, j) => (j === k ? { ...e, ...patch } : e)) }));
  const moveE = (k: number, d: number) => setW((x) => {
    const ex = [...x.exercises];
    const t = k + d;
    if (t < 0 || t >= ex.length) return x;
    [ex[k], ex[t]] = [ex[t], ex[k]];
    return { ...x, exercises: ex };
  });
  const chooseSplit = (m: number) => {
    const lost = plan.workouts.slice(m).filter((x) => x.exercises.some((e) => e.name.trim()));
    if (lost.length && !confirm(`Passar para ${m} treino${m > 1 ? 's' : ''}? ${lost.map((x) => x.name).join(', ')} ${lost.length > 1 ? 'são apagados' : 'é apagado'}.`)) return;
    setPlan({ ...plan, workouts: applySplit(plan.workouts, m), per_week: n ? plan.per_week : m });
    setCur(0);
  };
  const filled = (x: PlanWorkout) => x.exercises.filter((e) => e.name.trim()).length;
  const saveDraft = async (quiet = false) => {
    if (!plan.workouts.length) return true;
    if (!dirty) return true;
    if (!quiet) setBusy(true);
    setErr('');
    try {
      const r = await proApi<{ at: string }>('aluno/rascunho', { code: student.code, plan });
      setSavedJson(JSON.stringify(plan));
      setSavedAt(r.at);
      setTouched(true);
      if (!quiet) toast('Treino guardado. O aluno ainda não o vê.');
      return true;
    } catch (e) {
      setErr((e as Error).message);
      return false;
    } finally {
      if (!quiet) setBusy(false);
    }
  };
  const save = async () => {
    const onlyFast = !plan.workouts.some(filled) && !!plan.jejum;
    if (!plan.workouts.some(filled) && !plan.jejum) { setErr('Junte pelo menos um exercício.'); return; }
    if (!confirm(`Enviar ${onlyFast ? 'a indicação de jejum' : 'o treino'} a ${student.name}? ${student.linked ? 'Passa a vê-lo na app.' : 'Vê-o quando usar o código na app.'}`)) return;
    setBusy(true);
    setErr('');
    try {
      await proApi('aluno/guardar', { code: student.code, plan });
      toast(`${onlyFast ? 'Indicação de jejum enviada' : 'Treino enviado'} a ${student.name}.${student.linked ? ' Recebe-o ao abrir a app.' : ''}`);
      onSaved();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const leave = async () => {
    if (dirty && plan.workouts.length && confirm('Tem alterações por guardar. Guardar antes de sair? (o aluno não recebe nada)')) {
      if (!(await saveDraft(true))) return;
      return onSaved();
    }
    if (touched) onSaved();
    else onClose();
  };
  const hhmm = (iso: string) => new Date(iso).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  const saveBar = (
    <div className="pro-savebar">
      <button className="btn ghost sm" disabled={busy || !dirty} onClick={() => saveDraft()}>💾 Guardar</button>
      <span className="small mute">{dirty ? 'Alterações por guardar' : savedAt ? `Guardado ${hhmm(savedAt)} · o aluno ainda não vê` : student.plan ? 'Igual ao que o aluno tem' : ''}</span>
    </div>
  );
  const templates = others.filter((o) => o.plan && o.code !== student.code);
  const about = profileText(student.profile);
  const sugg = w ? searchExercises('', w.focus, [], 60) : [];
  const has = (name: string) => !!w?.exercises.some((e) => e.name === name);
  const showSugg = !!sugOpen;
  // ao entrar num treino: abre a lista só se estiver vazio e for o modo manual
  useEffect(() => { setSugOpen(mode === 'manual' && !!w && !filled(w)); }, [i, n, mode]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setBookOpen(null); }, [i]); // eslint-disable-line react-hooks/exhaustive-deps
  // treino ainda sem nenhuma linha (ex.: criado na etapa 1 por voz): no modo manual mostra já uma linha para escrever
  useEffect(() => { if (mode === 'manual' && w && !w.exercises.length) setW((x) => ({ ...x, exercises: [newEx()] })); }, [i, n, mode]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <button className="btn ghost sm" onClick={leave}>← Alunos</button>
      <h1 style={{ marginBottom: 4 }}>Treino de {student.name}</h1>
      {student.draft && student.plan && <p className="small gold" style={{ marginTop: 0 }}>📝 A editar o rascunho. O aluno continua a ver o treino enviado antes.</p>}
      {about && <p className="small mute pro-prof-line" style={{ marginTop: 0 }} title={about}>👤 {about}</p>}
      <TeamCard team={student.team} />
      {templates.length > 0 && (
        <label className="small" style={{ display: 'block', margin: '0 0 12px' }}>
          Partir do treino de outro aluno:{' '}
          <select className="field sm" defaultValue="" onChange={(e) => { const o = templates.find((t) => t.code === e.target.value); if (o?.plan && confirm(`Copiar o treino de ${o.name}? O que está neste ecrã é substituído.`)) { setPlan(o.plan); setCur(0); } }}>
            <option value="">escolher…</option>
            {templates.map((t) => <option key={t.code} value={t.code}>{t.name}</option>)}
          </select>
        </label>
      )}
      {(kind === 'nutricionista' || kind === 'medico') && (
        <FastRxEditor value={plan.jejum} onChange={(j) => setPlan({ ...plan, jejum: j })} canSendAlone={!plan.workouts.some(filled)} busy={busy} onSend={save} />
      )}
      <div className="pro-mode" role="tablist" aria-label="Como montar">
        <button role="tab" aria-selected={mode === 'manual'} className={mode === 'manual' ? 'on' : ''} onClick={() => setMode('manual')}><b>✍️ Manual</b><span>escrever e escolher</span></button>
        <button role="tab" aria-selected={mode === 'voz'} className={mode === 'voz' ? 'on' : ''} onClick={() => setMode('voz')}><b>🎙️ Por voz</b><span>ditar, a IA monta</span></button>
      </div>
      {mode === 'voz' && <DictationCard plan={plan} current={i} setCurrent={setCur} about={about} onPlan={(p) => { setPlan(p); setErr(''); }} />}
      {n > 0 && !setupOpen ? (
        <section className="card pro-setup">
          <div className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
            <p style={{ margin: 0 }}><b>Divisão {splitName(n)}</b> · {plan.per_week}× por semana{plan.weeks ? ` · ${plan.weeks} semanas` : ''}</p>
            <button className="btn ghost sm" onClick={() => setSetupOpen(true)}>Ajustar</button>
          </div>
          {plan.phases?.length ? <p className="small mute" style={{ margin: '6px 0 0' }}>📈 {plan.phases.map((f) => `${f.name || 'Fase'} (${f.weeks} sem.)`).join(' → ')}</p> : null}
          {plan.notes && <p className="small mute" style={{ margin: '6px 0 0' }}>📝 {plan.notes}</p>}
        </section>
      ) : (mode === 'manual' || n > 0) && (
      <section className="card">
        <div className="row"><h3 style={{ margin: 0 }}>{n ? 'Divisão do treino' : 'Quantos treinos diferentes?'}</h3>{n > 0 && <button className="btn sm" onClick={() => setSetupOpen(false)}>Feito</button>}</div>
        <div className="chips" style={{ marginTop: 10 }}>
          {[1, 2, 3, 4, 5, 6].map((m) => (
            <button key={m} className={`chip pro-split ${n === m ? 'on' : ''}`} onClick={() => { chooseSplit(m); if (!n) setSetupOpen(false); }} aria-pressed={n === m}>
              <b>{splitName(m)}</b><span>{m} treino{m > 1 ? 's' : ''}</span>
            </button>
          ))}
        </div>
        {!n && <p className="small mute" style={{ marginBottom: 0 }}>Escolha a divisão: os treinos são criados já com um foco sugerido, que pode mudar.</p>}
        {n > 0 && (
          <>
            <label className="small" style={{ display: 'block', marginTop: 10 }}>Treinos por semana <input className="field sm" type="number" min={1} max={7} style={{ width: 64 }} value={plan.per_week} onChange={(e) => setPlan({ ...plan, per_week: Math.max(1, Math.min(7, Number(e.target.value) || 1)) })} /></label>
            <PeriodEditor plan={plan} setPlan={setPlan} />
            <label className="small" style={{ display: 'block', marginTop: 8 }}>Observações gerais
              <textarea className="field" rows={2} maxLength={600} value={plan.notes} onChange={(e) => setPlan({ ...plan, notes: e.target.value })} placeholder="ex.: aquecer 10 min; beber água entre séries" />
            </label>
          </>
        )}
      </section>
      )}
      {w && (
        <>
          {mode === 'manual' && <div className="pro-tabs" role="tablist">
            {plan.workouts.map((x, j) => (
              <button key={j} role="tab" aria-selected={j === i} className={j === i ? 'on' : ''} onClick={() => setCur(j)}>
                <b>{letter(j)}</b><span>{filled(x) ? `${filled(x)} ex.` : '—'}</span>
              </button>
            ))}
          </div>}
          <section className="card pro-workout">
            <div className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
              <input className="field sm" style={{ flex: 1, fontWeight: 700 }} value={w.name} maxLength={60} onChange={(e) => setW((x) => ({ ...x, name: e.target.value }))} aria-label="Nome do treino" />
              <input className="field sm" style={{ width: 90 }} value={w.day} maxLength={30} placeholder="Dia (seg)" onChange={(e) => setW((x) => ({ ...x, day: e.target.value }))} aria-label="Dia" />
            </div>
            <input className="field sm" style={{ width: '100%', boxSizing: 'border-box', marginTop: 6 }} value={w.focus} maxLength={80} placeholder="Foco (ex.: inferior, peito e tríceps)" onChange={(e) => setW((x) => ({ ...x, focus: e.target.value }))} aria-label="Foco" />
            {mode === 'manual' && <div className="chips" style={{ marginTop: 6 }}>
              {FOCUS_PRESETS.map((p) => <button key={p.label} className={`chip sm ${w.focus === p.label ? 'on' : ''}`} onClick={() => setW((x) => ({ ...x, focus: p.label }))}>{p.label}</button>)}
            </div>}
            {!(bookOpen ?? (mode === 'manual' && !w.exercises.some((e) => isWarmup(e) || isFinal(e)))) && (
              <div className="pro-warmup row" style={{ gap: 8, flexWrap: 'nowrap' }}>
                <span className="small" style={{ flex: 1, minWidth: 0 }}>🔥 <b>Início:</b> {w.exercises.filter(isWarmup).map((e) => `${e.name.split(' (')[0]} ${e.reps}`).join(', ') || '—'} · 🧘 <b>Fim:</b> {w.exercises.filter(isFinal).map((e) => `${e.name.split(' (')[0]} ${e.reps}`).join(', ') || '—'}</span>
                <button className="link small inline" onClick={() => setBookOpen(true)}>Editar</button>
              </div>
            )}
            {(bookOpen ?? (mode === 'manual' && !w.exercises.some((e) => isWarmup(e) || isFinal(e)))) && (
              <div className="pro-warmup">
                <div className="row" style={{ gap: 8 }}>
                  <span className="small" style={{ fontWeight: 700 }}>🔥 Início do treino</span>
                  {n > 1 && <label className="small mute" style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={warmAll} onChange={(e) => setWarmAll(e.target.checked)} /> em todos os treinos</label>}
                </div>
                {w.exercises.some((e) => isWarmup(e) || isFinal(e)) && (
                  <div className="pro-book-list">
                    {w.exercises.map((e, k) => (isWarmup(e) || isFinal(e)) && (
                      <div key={k} className="pro-book-item">
                        <span className="small">{isFinal(e) ? '🧘' : '🔥'} {e.name}</span>
                        <input className="field sm" value={e.reps} maxLength={30} onChange={(ev) => setE(k, { reps: ev.target.value })} aria-label={`Duração de ${e.name}`} />
                        <button className="x" aria-label={`Tirar ${e.name}`} onClick={() => setW((x) => ({ ...x, exercises: x.exercises.filter((_, j) => j !== k) }))}>×</button>
                      </div>
                    ))}
                  </div>
                )}
                <p className="small mute" style={{ margin: '6px 0 4px' }}>Aeróbico</p>
                <div className="chips">
                  {INTRO.filter((x) => x.kind === 'aerobico').map((x) => <button key={x.label} className={`chip sm ${hasBookend(w, x) ? 'on' : ''}`} aria-pressed={hasBookend(w, x)} onClick={() => setBook(x)}>{x.label}</button>)}
                </div>
                <p className="small mute" style={{ margin: '8px 0 4px' }}>Mobilidade e ativação</p>
                <div className="chips">
                  {INTRO.filter((x) => x.kind === 'mobilidade').map((x) => <button key={x.label} className={`chip sm ${hasBookend(w, x) ? 'on' : ''}`} aria-pressed={hasBookend(w, x)} onClick={() => setBook(x)}>{x.label}</button>)}
                </div>
                <p className="small" style={{ margin: '10px 0 4px', fontWeight: 700 }}>🧘 Fim do treino</p>
                <div className="chips">
                  {OUTRO.map((x) => <button key={x.label} className={`chip sm ${hasBookend(w, x) ? 'on' : ''}`} aria-pressed={hasBookend(w, x)} onClick={() => setBook(x)}>{x.label}</button>)}
                </div>
                <div className="row" style={{ marginTop: 6, gap: 8 }}>
                  <span className="small mute" style={{ flex: 1 }}>🧍 O aluno vê cada um explicado com o bonequinho animado. Toque outra vez para tirar.</span>
                  {w.exercises.some((e) => isWarmup(e) || isFinal(e)) && <button className="link small inline" onClick={() => setBookOpen(false)}>Fechar</button>}
                </div>
              </div>
            )}
            {w.exercises.map((e, k) => !isWarmup(e) && !isFinal(e) && (
              <div className="pro-ex" key={k}>
                <div className="row" style={{ gap: 6, flexWrap: 'nowrap', alignItems: 'flex-start' }}>
                  <span className="small mute" style={{ paddingTop: 8 }}>{w.exercises.slice(0, k + 1).filter((x) => !isWarmup(x) && !isFinal(x)).length}.</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <ExerciseInput value={e.name} focus={w.focus} label={`Exercício ${k + 1}`} onType={(t) => setE(k, { name: t })}
                      onPick={(l) => setE(k, { name: l.name, sets: l.sets, reps: l.reps, rest: l.rest })} />
                  </div>
                </div>
                <div className="pro-ex-grid">
                  <label className="small">Séries<input className="field sm" type="number" min={1} max={10} value={e.sets} onChange={(ev) => setE(k, { sets: Math.max(1, Math.min(10, Number(ev.target.value) || 1)) })} /></label>
                  <label className="small">Repetições<input className="field sm" value={e.reps} maxLength={30} placeholder="10 ou 8-12" onChange={(ev) => setE(k, { reps: ev.target.value })} /></label>
                  <label className="small">Carga<input className="field sm" value={e.load} maxLength={30} placeholder="kg" onChange={(ev) => setE(k, { load: ev.target.value })} /></label>
                  <label className="small">Descanso<input className="field sm" value={e.rest} maxLength={30} placeholder="60 s" onChange={(ev) => setE(k, { rest: ev.target.value })} /></label>
                </div>
                <div className="row" style={{ gap: 6, flexWrap: 'nowrap', marginTop: 6 }}>
                  <input className="field sm" style={{ flex: 1, minWidth: 0 }} value={e.notes} maxLength={240} placeholder="Nota para o aluno (técnica, cadência…)" onChange={(ev) => setE(k, { notes: ev.target.value })} aria-label="Nota do exercício" />
                  <button className="btn ghost sm" aria-label="Subir" onClick={() => moveE(k, -1)}>↑</button>
                  <button className="btn ghost sm" aria-label="Descer" onClick={() => moveE(k, 1)}>↓</button>
                  <button className="x" aria-label="Apagar exercício" onClick={() => setW((x) => ({ ...x, exercises: x.exercises.filter((_, j) => j !== k) }))}>×</button>
                </div>
                <input className="field sm pro-video" type="url" inputMode="url" value={e.video ?? ''} maxLength={300} placeholder="🎬 Link do vídeo (YouTube, Instagram…) — opcional" onChange={(ev) => setE(k, { video: ev.target.value.trim() || undefined })} aria-label={`Vídeo do exercício ${k + 1}`} />
                {!e.video && e.name.trim() && libraryVideo(e.name) && <span className="pro-video-lib">🎬 Vídeo NEFESH disponível: o aluno vê este se não puser o seu.</span>}
              </div>
            ))}
            <button className="btn ghost sm" style={{ marginTop: 8 }} disabled={w.exercises.length >= 20} onClick={() => setW((x) => ({ ...x, exercises: [...x.exercises, newEx()] }))}>+ Exercício</button>
            {mode === 'manual' && sugg.length > 0 && (
              <div className="pro-sugg">
                <button className="link small inline" onClick={() => setSugOpen(!showSugg)} aria-expanded={showSugg}>{showSugg ? '▾ Fechar a lista' : `+ Juntar da lista · ${w.focus.toLowerCase()}`}</button>
                {showSugg && (
                  <ul>
                    {sugg.map((e) => (
                      <li key={e.name}>
                        <button disabled={has(e.name) || w.exercises.length >= 20} onClick={() => setW((x) => addFromLibrary(x, e))}>
                          <span>{has(e.name) ? '✓' : '+'} {e.name}</span><span className="small mute">{GROUP_NAME[e.group]} · {e.sets} × {e.reps}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>
          {(mode === 'voz' || i === n - 1) && plan.workouts.some(filled) && <><div className="pro-end" /><ReviewCard plan={plan} onPlan={setPlan} profile={about} /><p /></>}
          {mode === 'manual' && i < n - 1 ? (
            <>
              <button className="btn full" disabled={!filled(w)} onClick={() => { setCur(i + 1); top(); void saveDraft(true); }}>Concluir {w.name} → montar o {plan.workouts[i + 1].name}</button>
              {saveBar}
            </>
          ) : (
            <>
              {saveBar}
              <section className="card pro-send">
                <p className="small" style={{ margin: '0 0 8px' }}><b>Pronto?</b> Ao enviar, {student.name} passa a ver este treino na app{student.plan ? ' (substitui o anterior)' : ''}.</p>
                <button className="btn full" disabled={busy || !plan.workouts.some(filled)} onClick={save}>{busy ? 'A enviar…' : 'Concluir e enviar ao aluno'}</button>
              </section>
            </>
          )}
          {mode === 'manual' && !filled(w) && <p className="small mute">Junte pelo menos um exercício a este treino para avançar.</p>}
        </>
      )}
      {err && <p className="small warn-t">{err}</p>}
    </>
  );
}

/** Registos de treino de um aluno. */
function StudentLogs({ student, onClose, onComment }: { student: ProStudent; onClose: () => void; onComment: (ref: string) => void }) {
  const [logs, setLogs] = useState<ProLog[] | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    proApi<{ logs: ProLog[] }>('aluno/registos', { code: student.code }).then((r) => setLogs(r.logs)).catch((e) => setErr((e as Error).message));
  }, [student.code]);
  return (
    <>
      <button className="btn ghost sm" onClick={onClose}>← Alunos</button>
      <h1 style={{ marginBottom: 4 }}>Treinos de {student.name}</h1>
      {err && <p className="small warn-t">{err}</p>}
      {!logs && !err && <p className="small mute">A carregar…</p>}
      {logs && !logs.length && <p className="small mute">Ainda sem treinos registados.</p>}
      {logs?.map((g) => (
        <section className="card" key={`${g.day}-${g.workout}`}>
          <div className="row"><b>{g.workout}</b><span className="small mute">{shortDate(g.day)}</span></div>
          <p className="small" style={{ margin: '4px 0' }}>{STATUS[g.status] ?? g.status}{g.minutes ? ` · ${g.minutes} min` : ''}{g.effort ? ` · ${EFFORT[g.effort]}` : ''}{g.pain ? <b className="warn-t"> · 😣 relatou dor</b> : null}</p>
          {g.note && <p className="small" style={{ margin: '4px 0' }}>💬 "{g.note}"</p>}
          {g.changes?.length > 0 && <p className="small mute" style={{ margin: '4px 0' }}>Alterações: {g.changes.join('; ')}</p>}
          <button className="link small inline" onClick={() => onComment(`${g.workout} · ${shortDate(g.day)}`)}>💬 Comentar este treino</button>
          {g.status !== 'saltado' && g.exercises?.length > 0 && (
            <table className="mydata small">
              <tbody>
                {g.exercises.map((e) => <tr key={e.name}><td>{e.pain ? '😣 ' : ''}{e.name}</td><td>{e.sets}/{e.of} séries{e.reps ? ` · ${e.reps}` : ''}{e.load ? ` · ${e.load}` : ''}{e.effort ? ` · ${EFFORT[e.effort]}` : ''}</td></tr>)}
              </tbody>
            </table>
          )}
        </section>
      ))}
    </>
  );
}

/** NEFESH Life Pro: o profissional monta treinos e acompanha os alunos. */
export function Pro({ go, openAccount }: { go: Nav; openAccount: () => void }) {
  const { S, toast } = useStore();
  const auth = getAuth();
  const [pro, setPro] = useState<ProInfo | null | undefined>(undefined);
  const [students, setStudents] = useState<ProStudent[]>([]);
  const [err, setErr] = useState('');
  const [areas, setAreas] = useState<ProArea[]>([]);
  const [addArea, setAddArea] = useState<{ kind: string; reg: string } | null>(null);
  const [visitsOf, setVisitsOf] = useState<ProStudent | null>(null);
  const [form, setForm] = useState({ name: '', reg: '', kind: 'personal' });
  // aceitação dos Termos do NEFESH Life Pro e do acordo de tratamento de dados (obrigatória)
  const [termsOk, setTermsOk] = useState(false);
  const termsLabel = (
    <label className="check" style={{ marginTop: 10 }}>
      <input type="checkbox" checked={termsOk} onChange={(e) => setTermsOk(e.target.checked)} />
      <span className="small">Li e aceito os <a href={legalUrl('termos').replace('termos.html', 'termos-pro.html')} target="_blank" rel="noreferrer">Termos do NEFESH Life Pro e o acordo de tratamento de dados</a>: sou responsável pelas orientações que dou e pelos dados dos meus alunos ou pacientes.</span>
    </label>
  );
  const [newName, setNewName] = useState('');
  const [edit, setEdit] = useState<ProStudent | null>(null);
  const [profileOf, setProfileOf] = useState<ProStudent | null>(null);
  const [assessOf, setAssessOf] = useState<ProStudent | null>(null);
  const [reportOf, setReportOf] = useState<ProStudent | null>(null);
  const [chatOf, setChatOf] = useState<{ s: ProStudent; ref: string } | null>(null);
  const [askPlan, setAskPlan] = useState<ProStudent | null>(null);
  const [askProfile, setAskProfile] = useState<{ code: string; name: string } | null>(null);
  const [logs, setLogs] = useState<ProStudent | null>(null);
  const load = () => proApi<{ pro: ProInfo | null; students?: ProStudent[]; areas?: ProArea[] }>('estado').then((r) => { setPro(r.pro); setStudents(r.students ?? []); setAreas(r.areas ?? []); setErr(''); }).catch((e) => setErr((e as Error).message));
  useEffect(() => { if (auth) load(); }, [auth?.token]); // eslint-disable-line react-hooks/exhaustive-deps
  const appLink = appUrl();

  if (!auth)
    return (
      <>
        <h1>NEFESH Life Pro</h1>
        <section className="card hero">
          <h2 style={{ marginTop: 0 }}>Para personais, nutricionistas, médicos e terapeutas</h2>
          <p className="small">Personal: monte o treino dos alunos e veja cada treino concluído. Nutricionista ou médico: monte o plano alimentar dos pacientes e acompanhe a adesão. Terapeuta de práticas integrativas: monte um plano de bem-estar com hábitos e práticas guiadas. Cada um recebe um código e tudo entra na app dele.</p>
          <button className="btn" onClick={openAccount}>Entrar ou criar conta</button>
        </section>
      </>
    );
  const nutri = isNutriKind(pro?.kind);
  const well = pro?.kind === 'integrativo';
  const who = nutri || well ? 'paciente' : 'aluno';
  if (edit && well) return <WellEditor student={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />;
  if (logs && well) return <WellLogs student={logs} onClose={() => setLogs(null)} />;
  if (edit && nutri) return <NutriEditor student={edit} others={students} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />;
  if (edit) return <PlanEditor kind={pro?.kind} student={edit} others={students} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />;
  if (reportOf) return <ShareReport who={who} student={reportOf} onClose={() => setReportOf(null)} />;
  if (chatOf) return <ChatThread code={chatOf.s.code} me="pro" other={chatOf.s.name} initialRef={chatOf.ref} onClose={() => { setChatOf(null); load(); }} />;
  if (assessOf) return <StudentAssessments student={students.find((x) => x.code === assessOf.code) ?? assessOf} onClose={() => { setAssessOf(null); load(); }} />;
  if (profileOf && well) return <IntegProfileEditor student={profileOf} onClose={() => setProfileOf(null)} onSaved={(profile) => { const st = { ...profileOf, profile }; setProfileOf(null); load(); if (!st.plan) setAskPlan(st); }} />;
  if (profileOf) return <ProfileEditor nutri={nutri} student={profileOf} onClose={() => setProfileOf(null)} onSaved={(profile) => { const st = { ...profileOf, profile }; setProfileOf(null); load(); if (!st.plan) setAskPlan(st); }} />;
  if (visitsOf) return <NutriVisits student={visitsOf} onClose={() => { setVisitsOf(null); load(); }} />;
  if (logs && nutri) return <NutriLogs student={logs} onClose={() => setLogs(null)} onComment={(ref) => { setChatOf({ s: logs, ref }); setLogs(null); }} />;
  if (logs) return <StudentLogs student={logs} onClose={() => setLogs(null)} onComment={(ref) => { setChatOf({ s: logs, ref }); setLogs(null); }} />;

  return (
    <>
      <button className="btn ghost sm" onClick={() => go('perfil')}>← Perfil</button>
      <h1 style={{ marginBottom: 4 }}>NEFESH Life Pro</h1>
      {err && <p className="small warn-t">{err}</p>}
      {pro === undefined && !err && <p className="small mute">A carregar…</p>}
      {pro === null && (
        <section className="card">
          <h2 style={{ marginTop: 0 }}>{isTestCopy() ? 'Ativar o modo profissional' : 'Pedir acesso como profissional'}</h2>
          <p className="small mute" style={{ marginTop: 0 }}>{isTestCopy() ? 'Cópia de teste: o acesso fica ativo logo, sem aprovação. O registo profissional é opcional aqui.' : 'A equipa NEFESH confirma o seu registo profissional e aprova o acesso.'}</p>
          <p className="small lbl" style={{ marginTop: 0 }}>A sua área</p>
          <div className="pro-area-pick" role="group" aria-label="Área">
            {AREAS.map(([k, icon, t, d]) => (
              <button key={k} className={form.kind === k ? 'on' : ''} aria-pressed={form.kind === k} onClick={() => setForm({ ...form, kind: k })}>
                <span className="pro-area-icon">{icon}</span><b>{t}</b><span className="small mute">{d}</span>
              </button>
            ))}
          </div>
          <label className="small" style={{ display: 'block', marginTop: 10 }}>Nome profissional<input className="field" value={form.name} maxLength={60} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          {form.kind === 'integrativo' && <p className="small mute" style={{ margin: '6px 0 0' }}>Para terapeutas de práticas integrativas (naturopatia e outras): ficha e anamnese, plano de bem-estar com hábitos diários e práticas guiadas da app, adesão, conversa, sessões e notas privadas. Sem prescrição de dieta nem de medicação: as práticas integrativas complementam o acompanhamento médico.</p>}
          {isNutriKind(form.kind) && <p className="small mute" style={{ margin: '6px 0 0' }}>{form.kind === 'medico' ? 'Para médicos: ficha clínica e anamnese, plano alimentar e jejum, análises e medidas partilhadas pelo paciente, check-ins semanais, consultas de retorno e notas privadas.' : 'Para nutricionistas: ficha e anamnese, construtor de planos alimentares com a tabela TACO, jejum, adesão diária, check-ins semanais, consultas e notas privadas.'}</p>}
          <label className="small" style={{ display: 'block', marginTop: 8 }}>{form.kind === 'integrativo' ? 'Formação' : 'Registo profissional'} ({REG_HINT[form.kind] ?? REG_HINT.personal})<input className="field" value={form.reg} maxLength={40} onChange={(e) => setForm({ ...form, reg: e.target.value })} /></label>
          {termsLabel}
          <button className="btn" style={{ marginTop: 12 }} disabled={!termsOk} onClick={() => proApi<{ pro: ProInfo }>('registar', { ...form, terms: PRO_TERMS }).then((r) => setPro(r.pro)).catch((e) => setErr((e as Error).message))}>{isTestCopy() ? 'Ativar' : 'Pedir acesso'}</button>
        </section>
      )}
      {pro && pro.status !== 'aprovado' && (
        <section className="card">
          <h2 style={{ marginTop: 0 }}>{pro.status === 'recusado' ? 'Pedido não aprovado' : 'Pedido enviado ✓'}</h2>
          <p className="small" style={{ margin: 0 }}>{pro.status === 'recusado' ? 'Fale connosco para rever o seu registo.' : `Obrigado, ${pro.name}. A equipa NEFESH confirma o registo ${pro.reg} e aprova o acesso. Volte a abrir esta página depois.`}</p>
          <button className="btn ghost sm" style={{ marginTop: 8 }} onClick={load}>Atualizar</button>
        </section>
      )}
      {pro?.status === 'aprovado' && (
        <>
          <p className="small mute" style={{ marginTop: 0 }}>{pro.name} · {pro.reg}</p>
          <div className="pro-area-switch" role="group" aria-label="As suas áreas">
            {AREAS.map(([k, icon, t]) => {
              const a = areas.find((x) => x.kind === k) ?? (pro.kind === k ? { kind: k, reg: pro.reg, status: pro.status } : null);
              const name = t.split(' ')[0];
              if (a?.status === 'aprovado') return <button key={k} className={pro.kind === k ? 'on' : ''} aria-pressed={pro.kind === k} onClick={() => pro.kind !== k && proApi<{ pro: ProInfo }>('area', { kind: k }).then((r) => { setPro(r.pro); setEdit(null); load(); }).catch((e) => setErr((e as Error).message))}>{icon} {name}</button>;
              if (a?.status === 'pendente') return <button key={k} disabled title="À espera da validação da equipa NEFESH">⏳ {name} · em validação</button>;
              return <button key={k} className="add" onClick={() => setAddArea({ kind: k, reg: '' })}>+ {name}</button>;
            })}
          </div>
          {addArea && (
            <section className="card pro-ask">
              <p className="small" style={{ margin: '0 0 6px' }}><b>Também é {AREAS.find((x) => x[0] === addArea.kind)?.[2].toLowerCase()}?</b> {isTestCopy() ? 'Na cópia de teste fica ativo logo.' : 'A equipa NEFESH confirma o registo e ativa a área; os seus alunos e pacientes ficam separados por área.'}</p>
              <input className="field sm" style={{ width: '100%' }} maxLength={40} value={addArea.reg} onChange={(e) => setAddArea({ ...addArea, reg: e.target.value })} placeholder={`${addArea.kind === 'integrativo' ? 'Formação' : 'Registo'}: ${REG_HINT[addArea.kind] ?? REG_HINT.personal}`} aria-label="Registo profissional da nova área" />
              {termsLabel}
              <div className="row" style={{ gap: 8, justifyContent: 'flex-start', marginTop: 8 }}>
                <button className="btn sm" disabled={addArea.reg.trim().length < 3 || !termsOk} onClick={() => proApi<{ areas: ProArea[] }>('area/pedir', { ...addArea, terms: PRO_TERMS }).then((r) => { setAreas(r.areas); setAddArea(null); toast(isTestCopy() ? 'Área ativada. Toque nela para trocar.' : 'Pedido enviado: avisamos quando a área for validada.'); }).catch((e) => setErr((e as Error).message))}>{isTestCopy() ? 'Ativar' : 'Pedir validação'}</button>
                <button className="btn ghost sm" onClick={() => setAddArea(null)}>Cancelar</button>
              </div>
            </section>
          )}
          {!S.notifications && <p className="small warn">Ative as notificações no Perfil para saber {nutri || well ? 'quando os pacientes lhe escrevem' : 'quando os alunos concluem um treino'}.</p>}
          {students.some((s) => s.alerts?.length) && (
            <section className="card pro-attn">
              <h2 style={{ marginTop: 0 }}>Precisa de atenção</h2>
              {students.filter((s) => s.alerts?.length).map((s) => (
                <button key={s.code} className="pro-attn-row" onClick={() => setLogs(s)}>
                  <b>{s.name}</b>
                  {s.alerts!.map((a) => <span key={a.kind} className={`small a-${a.kind}`}>{ALERT_ICON[a.kind]} {a.text}</span>)}
                </button>
              ))}
            </section>
          )}
          <section className="card">
            <h2 style={{ marginTop: 0 }}>Novo {who}</h2>
            <div className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
              <input className="field sm" style={{ flex: 1 }} value={newName} maxLength={40} placeholder={`Nome do ${who}`} onChange={(e) => setNewName(e.target.value)} aria-label={`Nome do ${who}`} />
              <button className="btn sm" disabled={newName.trim().length < 2} onClick={() => proApi<{ code: string; name: string }>('aluno/novo', { name: newName }).then((r) => { setAskProfile({ code: r.code, name: r.name }); setAskPlan(null); setNewName(''); load(); }).catch((e) => setErr((e as Error).message))}>Criar código</button>
            </div>
            {askProfile && (
              <div className="pro-ask">
                <p className="small" style={{ margin: 0 }}><b>✓ Código de {askProfile.name}: {askProfile.code}</b></p>
                <p className="small" style={{ margin: '6px 0 8px' }}>{well ? `Quer preencher a ficha de ${askProfile.name}? Motivo da consulta, saúde, sono, digestão, emoções, ambiente e exames. Pode ditar a consulta e carregar os exames: a IA organiza.` : nutri ? `Quer preencher a ficha de ${askProfile.name} (medidas, objetivo, anamnese: doenças, medicação, alergias, rotina)? As metas do plano são sugeridas a partir dela.` : `Quer registar um perfil mais detalhado de ${askProfile.name} (sexo, idade, medidas, objetivo, experiência, lesões)? Ajuda a IA a adaptar o treino.`}</p>
                <div className="row" style={{ gap: 8, justifyContent: 'flex-start' }}>
                  <button className="btn sm" onClick={() => { const st = students.find((x) => x.code === askProfile.code) ?? ({ code: askProfile.code, name: askProfile.name, profile: null } as ProStudent); setAskProfile(null); setProfileOf(st); }}>{nutri || well ? 'Preencher ficha' : 'Registar perfil'}</button>
                  <button className="btn ghost sm" onClick={() => { const st = students.find((x) => x.code === askProfile.code); setAskProfile(null); if (st) setEdit(st); }}>{nutri || well ? 'Agora não, montar plano' : 'Agora não, montar treino'}</button>
                </div>
              </div>
            )}
            {askPlan && !askProfile && (
              <div className="pro-ask">
                <p className="small" style={{ margin: '0 0 8px' }}>{nutri || well ? `Ficha de ${askPlan.name} guardada.` : `Perfil de ${askPlan.name} guardado.`} Montar o {well ? 'plano de bem-estar' : nutri ? 'plano alimentar' : 'treino'} agora?</p>
                <div className="row" style={{ gap: 8, justifyContent: 'flex-start' }}>
                  <button className="btn sm" onClick={() => { const st = students.find((x) => x.code === askPlan.code) ?? askPlan; setAskPlan(null); setEdit(st); }}>{nutri || well ? 'Montar plano' : 'Montar treino'}</button>
                  <button className="link small inline" onClick={() => setAskPlan(null)}>Depois</button>
                </div>
              </div>
            )}
          </section>
          {students.length === 0 && <p className="small mute">{well ? 'Ainda sem pacientes. Crie um código para cada paciente e monte o plano de bem-estar dele.' : nutri ? 'Ainda sem pacientes. Crie um código para cada paciente e monte o plano alimentar dele.' : 'Ainda sem alunos. Crie um código para cada aluno e monte o treino dele.'}</p>}
          {students.map((s) => (
            <section className="card pro-student" key={s.code}>
              <div className="row"><h2 style={{ margin: 0 }}>{s.name}</h2><span className="small mute">{s.code}</span></div>
              {well ? (
                <p className="small" style={{ margin: '4px 0' }}>
                  {s.linked ? '✓ Ligado na app' : '⏳ À espera que o paciente use o código'}
                  {s.plan?.bemestar ? ` · plano enviado (${s.plan.bemestar.habits.length} ${s.plan.bemestar.habits.length === 1 ? 'hábito' : 'hábitos'})` : s.draft ? ' · plano por enviar' : ' · plano por montar'}
                  {s.linked && s.plan?.bemestar ? ` · ${s.wellWeek ?? 0} ${s.wellWeek === 1 ? 'dia' : 'dias'} com hábitos nos últimos 7${s.wellPct != null ? `, adesão ${s.wellPct}%` : ''}` : ''}
                  {s.wellNote ? ` · "${s.wellNote}"` : ''}
                </p>
              ) : null}
              {well && s.symptoms?.length ? (
                <p className="small" style={{ margin: '0 0 4px' }}>📊 {s.symptoms.map((x) => `${x.label} ${x.n > 1 ? `${x.first}→${x.last}` : x.last}`).join(' · ')}{s.symAt ? <span className="mute"> ({shortDate(s.symAt)})</span> : null}</p>
              ) : null}
              {well && s.intakeAt ? (
                <p className="small gold" style={{ margin: '0 0 4px' }}>📝 Pré-anamnese recebida ({shortDate(s.intakeAt.slice(0, 10))}): abra a Ficha e toque em Juntar.</p>
              ) : null}
              {well ? null : nutri ? (
                <p className="small" style={{ margin: '4px 0' }}>
                  {s.linked ? '✓ Ligado na app' : '⏳ À espera que o paciente use o código'}
                  {s.plan?.nutri ? ' · plano enviado' : s.draft ? ' · plano por enviar' : ' · plano por montar'}
                  {s.linked ? ` · ${s.nutriWeek ?? 0} ${s.nutriWeek === 1 ? 'dia registado' : 'dias registados'} nos últimos 7` : ''}
                  {s.nutriLast ? ` · último: ${shortDate(s.nutriLast.day)}, adesão ${s.nutriLast.pct}%` : ''}
                </p>
              ) : (
              <p className="small" style={{ margin: '4px 0' }}>
                {s.linked ? '✓ Ligado na app' : '⏳ À espera que o aluno use o código'}
                {s.plan ? ` · ${s.plan.workouts.length} ${s.plan.workouts.length === 1 ? 'treino enviado' : 'treinos enviados'}` : s.draft ? ' · treino por enviar' : ' · treino por montar'}
                {s.linked ? ` · ${s.week} ${s.week === 1 ? 'treino' : 'treinos'} nos últimos 7 dias` : ''}
              </p>
              )}
              {s.draft && <p className="small gold" style={{ margin: '0 0 6px' }}>📝 {nutri || well ? 'Plano' : 'Treino'} guardado, ainda não enviado{s.draftAt ? ` (${new Date(s.draftAt).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' })})` : ''}</p>}
              {s.profile && profileText(s.profile) && <p className="small mute pro-prof-line" style={{ margin: '0 0 6px' }}>👤 {profileText(s.profile)}</p>}
              <TeamCard team={s.team} compact />
              {s.last && <p className="small mute" style={{ margin: '0 0 6px' }}>Último: {s.last.workout}, {shortDate(s.last.day)} · {STATUS[s.last.status] ?? s.last.status}{s.last.note ? ` · "${s.last.note}"` : ''}</p>}
              <div className="row" style={{ gap: 8, justifyContent: 'flex-start', flexWrap: 'wrap' }}>
                <button className="btn sm" onClick={() => setEdit(s)}>{nutri || well ? (s.draft ? 'Continuar plano' : s.plan ? 'Editar plano' : 'Montar plano') : s.draft ? 'Continuar treino' : s.plan ? 'Editar treino' : 'Montar treino'}</button>
                <button className="btn ghost sm" onClick={() => setProfileOf(s)}>{nutri || well ? (s.profile ? 'Ficha' : '+ Ficha') : s.profile ? 'Perfil' : '+ Perfil'}</button>
                <button className="btn ghost sm" onClick={() => setChatOf({ s, ref: '' })}>💬 Conversa{s.unread ? <span className="badge">{s.unread}</span> : null}</button>
                {s.shareAt && <button className="btn ghost sm" onClick={() => setReportOf(s)}>📊 Relatório</button>}
                {(nutri || well) && <button className="btn ghost sm" onClick={() => setVisitsOf(s)}>🗓️ {well ? 'Sessões' : 'Consultas'}</button>}
                {!well && <button className="btn ghost sm" onClick={() => setAssessOf(s)}>Avaliações</button>}
                <button className="btn ghost sm" onClick={() => setLogs(s)}>Registos</button>
                {!s.linked && <a className="btn ghost sm" href={whatsappShare(inviteText(s.name, s.code, pro.name, appLink))} target="_blank" rel="noreferrer">Enviar código</a>}
                <button className="link small inline" onClick={() => confirm(`Apagar ${s.name} e os registos?`) && proApi('aluno/apagar', { code: s.code }).then(load)}>Apagar</button>
              </div>
            </section>
          ))}
          <DirectoryEditor />
        </>
      )}
    </>
  );
}
