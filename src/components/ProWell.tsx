import { useEffect, useState } from 'react';
import { proApi, type ProStudent } from '../domain/pro';
import { PRACTICE_IDS, WHEN_LABEL, practiceOf, type WellPlan } from '../domain/proWell';
import { shortDate } from '../domain/dates';
import { useStore } from '../state/store';
import { convertText, currentLocale } from '../i18n/locale';

const EMPTY: WellPlan = { goals: '', habits: [{ text: '', when: 'manha' }], practices: [], notes: '' };
const WHENS = Object.keys(WHEN_LABEL) as WellPlan['habits'][number]['when'][];
/** Sugestões para começar (o terapeuta escreve os seus). */
const SUGGEST = ['Água morna ao acordar', 'Luz natural de manhã, 10 a 20 minutos', 'Jantar leve até 3 horas antes de deitar', 'Sem ecrãs na última hora antes de deitar', 'Caminhada de 20 minutos', 'Mastigar devagar, sem ecrãs à mesa', 'Respiração antes de dormir', 'Diário de gratidão'];

/** Terapias integrativas: o terapeuta monta o plano de bem-estar (objetivos, hábitos, práticas guiadas e orientações). */
export function WellEditor({ student, onClose, onSaved }: { student: ProStudent; onClose: () => void; onSaved: () => void }) {
  const { toast } = useStore();
  const [p, setP] = useState<WellPlan>(() => (student.draft?.bemestar ?? student.plan?.bemestar ?? EMPTY) as WellPlan);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const setH = (i: number, patch: Partial<WellPlan['habits'][number]>) => setP({ ...p, habits: p.habits.map((h, j) => (j === i ? { ...h, ...patch } : h)) });
  const togglePractice = (id: string) => setP({ ...p, practices: p.practices.includes(id) ? p.practices.filter((x) => x !== id) : [...p.practices, id].slice(0, 8) });
  const body = () => ({ code: student.code, plan: { is_workout: true, workouts: [], per_week: 1, professional: '', notes: '', bemestar: { ...p, habits: p.habits.filter((h) => h.text.trim().length >= 2) } } });
  const send = async () => {
    setErr('');
    setBusy(true);
    try {
      await proApi('aluno/guardar', body());
      toast(`Plano enviado a ${student.name}. 🌿`);
      onSaved();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const draft = async () => {
    setBusy(true);
    try { await proApi('aluno/rascunho', body()); toast('Guardado. Ainda não foi enviado.'); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <>
      <button className="btn ghost sm" onClick={onClose}>← Pacientes</button>
      <h1 style={{ marginBottom: 4 }}>Plano de bem-estar de {student.name}</h1>
      <p className="small mute" style={{ marginTop: 0 }}>Hábitos e práticas que o paciente marca na app, todos os dias. Sem prescrição de dieta nem de medicação.</p>
      <section className="card">
        <label className="small">Objetivos<textarea className="field" rows={2} maxLength={300} value={p.goals} onChange={(e) => setP({ ...p, goals: e.target.value })} placeholder="ex.: dormir melhor, mais energia de manhã, digestão mais tranquila" /></label>
        <label className="small" style={{ display: 'block', marginTop: 8 }}>Duração
          <select className="field sm" value={p.weeks ?? 0} onChange={(e) => setP({ ...p, weeks: Number(e.target.value) || undefined })}>
            <option value={0}>sem prazo</option>
            {[2, 4, 6, 8, 12].map((w) => <option key={w} value={w}>{w} semanas</option>)}
          </select>
        </label>
      </section>
      <section className="card">
        <h2 style={{ marginTop: 0 }}>Hábitos diários</h2>
        {p.habits.map((h, i) => (
          <div key={i} style={{ margin: '8px 0 12px' }}>
            <input className="field sm" style={{ width: '100%', boxSizing: 'border-box' }} maxLength={100} value={h.text} onChange={(e) => setH(i, { text: e.target.value })} placeholder="ex.: água morna com limão ao acordar" aria-label={`Hábito ${i + 1}`} />
            <div className="row" style={{ gap: 8, flexWrap: 'nowrap', marginTop: 4 }}>
              <select className="field sm" style={{ flex: '0 1 auto', width: 'auto', minHeight: 36 }} value={h.when} onChange={(e) => setH(i, { when: e.target.value as WellPlan['habits'][number]['when'] })} aria-label={`Momento do hábito ${i + 1}`}>
                {WHENS.map((w) => <option key={w} value={w}>{WHEN_LABEL[w]}</option>)}
              </select>
              <button className="link small inline" onClick={() => setP({ ...p, habits: p.habits.filter((_, j) => j !== i) })} aria-label={`Apagar hábito ${i + 1}`}>Apagar</button>
            </div>
          </div>
        ))}
        {p.habits.length < 12 && <button className="btn ghost sm" onClick={() => setP({ ...p, habits: [...p.habits, { text: '', when: 'dia' }] })}>+ Hábito</button>}
        <details className="small" style={{ marginTop: 8 }}>
          <summary>Sugestões para começar</summary>
          <div className="chips" style={{ marginTop: 6 }}>
            {SUGGEST.filter((x) => !p.habits.some((h) => h.text === x)).map((x) => (
              <button key={x} className="chip sm" onClick={() => setP({ ...p, habits: [...p.habits.filter((h) => h.text.trim()), { text: convertText(x, currentLocale()), when: (/acordar|manhã/.test(x) ? 'manha' : /deitar|dormir|Jantar/.test(x) ? 'noite' : 'dia') as WellPlan['habits'][number]['when'] }].slice(0, 12) })}>+ {x}</button>
            ))}
          </div>
        </details>
      </section>
      <section className="card">
        <h2 style={{ marginTop: 0 }}>Práticas guiadas da app</h2>
        <p className="small mute" style={{ marginTop: 0 }}>O paciente começa-as com um toque, guiadas por voz.</p>
        <div className="chips">
          {PRACTICE_IDS.map((id) => { const x = practiceOf(id)!; return <button key={id} className={`chip sm ${p.practices.includes(id) ? 'on' : ''}`} aria-pressed={p.practices.includes(id)} onClick={() => togglePractice(id)}>{x.kind === 'respiracao' ? '😮‍💨' : '🧘'} {x.name}</button>; })}
        </div>
      </section>
      <section className="card">
        <label className="small">Orientações para o paciente<textarea className="field" rows={4} maxLength={800} value={p.notes} onChange={(e) => setP({ ...p, notes: e.target.value })} placeholder="ex.: rotina da manhã, chás que pode tomar, o que observar até à próxima sessão" /></label>
        <p className="small mute" style={{ margin: '6px 0 0' }}>Sem diagnósticos, prescrição de dieta ou de medicação, nem indicação para deixar tratamentos médicos.</p>
      </section>
      {err && <p className="small warn-t">{err}</p>}
      <div className="row" style={{ gap: 8, justifyContent: 'flex-start' }}>
        <button className="btn" disabled={busy} onClick={send}>{busy ? 'A enviar…' : 'Enviar ao paciente'}</button>
        <button className="btn ghost" disabled={busy} onClick={draft}>Guardar sem enviar</button>
      </div>
    </>
  );
}

/** Registos do paciente: hábitos feitos por dia (últimos 30 dias). */
export function WellLogs({ student, onClose }: { student: ProStudent; onClose: () => void }) {
  const [logs, setLogs] = useState<{ day: string; workout: string; done?: number[]; of?: number; note?: string }[] | null>(null);
  useEffect(() => { proApi<{ logs: typeof logs }>('aluno/registos', { code: student.code }).then((r) => setLogs((r.logs ?? []).filter((l) => l.workout === '__bemestar'))).catch(() => setLogs([])); }, [student.code]);
  const habits = student.plan?.bemestar?.habits ?? [];
  return (
    <>
      <button className="btn ghost sm" onClick={onClose}>← Pacientes</button>
      <h1>Hábitos de {student.name}</h1>
      {logs === null && <p className="small mute">A carregar…</p>}
      {logs?.length === 0 && <p className="small mute">Ainda sem hábitos marcados.</p>}
      {logs?.map((l) => (
        <section className="card" key={l.day}>
          <div className="row"><b>{shortDate(l.day)}</b><span className="small">{l.done?.length ?? 0} de {l.of ?? habits.length}</span></div>
          <p className="small mute" style={{ margin: '4px 0 0' }}>{(l.done ?? []).map((i) => habits[i]?.text).filter(Boolean).join(' · ') || 'Nenhum hábito marcado.'}</p>
          {l.note && <p className="small" style={{ margin: '4px 0 0' }}>💬 {l.note}</p>}
        </section>
      ))}
    </>
  );
}
