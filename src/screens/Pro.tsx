import { useEffect, useState } from 'react';
import { getAuth } from '../domain/account';
import { shortDate } from '../domain/dates';
import { GYM } from '../domain/gymData';
import { EXERCISES } from '../domain/training';
import { inviteText, proApi, type ProInfo, type ProLog, type ProStudent } from '../domain/pro';
import type { ParsedWorkoutPlan, PlanWorkout, WorkoutExercise } from '../domain/planRead';
import { whatsappShare } from '../domain/content';
import { useStore } from '../state/store';
import { isTestCopy } from '../testDate';
import type { Nav } from '../App';

const LIB = [...new Set([...Object.values(GYM).map((e) => e.name), ...EXERCISES.map((e) => e.name)])].sort((a, b) => a.localeCompare(b, 'pt'));
const STATUS: Record<string, string> = { seguido: 'concluído como planeado', alterado: 'feito com alterações', saltado: 'não fez' };
const newEx = (): WorkoutExercise => ({ name: '', sets: 3, reps: '10', load: '', rest: '60 s', notes: '' });
const newWorkout = (i: number): PlanWorkout => ({ name: `Treino ${String.fromCharCode(65 + i)}`, focus: '', day: '', exercises: [newEx()] });

/** Montar ou editar o treino de um aluno. */
function PlanEditor({ student, others, onClose, onSaved }: { student: ProStudent; others: ProStudent[]; onClose: () => void; onSaved: () => void }) {
  const { toast } = useStore();
  const [plan, setPlan] = useState<ParsedWorkoutPlan>(() => student.plan ?? { is_workout: true, workouts: [newWorkout(0)], per_week: 3, professional: '', notes: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const setW = (i: number, f: (w: PlanWorkout) => PlanWorkout) => setPlan({ ...plan, workouts: plan.workouts.map((w, j) => (j === i ? f(w) : w)) });
  const setE = (i: number, k: number, patch: Partial<WorkoutExercise>) => setW(i, (w) => ({ ...w, exercises: w.exercises.map((e, j) => (j === k ? { ...e, ...patch } : e)) }));
  const moveE = (i: number, k: number, d: number) => setW(i, (w) => {
    const ex = [...w.exercises];
    const t = k + d;
    if (t < 0 || t >= ex.length) return w;
    [ex[k], ex[t]] = [ex[t], ex[k]];
    return { ...w, exercises: ex };
  });
  const save = async () => {
    setBusy(true);
    setErr('');
    try {
      await proApi('aluno/guardar', { code: student.code, plan });
      toast(`Treino de ${student.name} guardado.${student.linked ? ' O aluno recebe-o ao abrir a app.' : ''}`);
      onSaved();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const templates = others.filter((o) => o.plan && o.code !== student.code);
  return (
    <>
      <button className="btn ghost sm" onClick={onClose}>← Alunos</button>
      <h1 style={{ marginBottom: 4 }}>Treino de {student.name}</h1>
      <datalist id="pro-ex-lib">{LIB.map((n) => <option key={n} value={n} />)}</datalist>
      {templates.length > 0 && (
        <label className="small" style={{ display: 'block', margin: '0 0 12px' }}>
          Partir do treino de outro aluno:{' '}
          <select className="field sm" defaultValue="" onChange={(e) => { const o = templates.find((t) => t.code === e.target.value); if (o?.plan && confirm(`Copiar o treino de ${o.name}? O que está neste ecrã é substituído.`)) setPlan(o.plan); }}>
            <option value="">escolher…</option>
            {templates.map((t) => <option key={t.code} value={t.code}>{t.name}</option>)}
          </select>
        </label>
      )}
      <section className="card">
        <div className="row" style={{ gap: 8, justifyContent: 'flex-start' }}>
          <label className="small">Treinos por semana <input className="field sm" type="number" min={1} max={7} style={{ width: 64 }} value={plan.per_week} onChange={(e) => setPlan({ ...plan, per_week: Math.max(1, Math.min(7, Number(e.target.value) || 1)) })} /></label>
        </div>
        <label className="small" style={{ display: 'block', marginTop: 8 }}>Observações gerais
          <textarea className="field" rows={2} maxLength={600} value={plan.notes} onChange={(e) => setPlan({ ...plan, notes: e.target.value })} placeholder="ex.: aquecer 10 min; beber água entre séries" />
        </label>
      </section>
      {plan.workouts.map((w, i) => (
        <section className="card pro-workout" key={i}>
          <div className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
            <input className="field sm" style={{ flex: 1, fontWeight: 700 }} value={w.name} maxLength={60} onChange={(e) => setW(i, (x) => ({ ...x, name: e.target.value }))} aria-label="Nome do treino" />
            {plan.workouts.length > 1 && <button className="x" aria-label={`Apagar ${w.name}`} onClick={() => confirm(`Apagar ${w.name}?`) && setPlan({ ...plan, workouts: plan.workouts.filter((_, j) => j !== i) })}>×</button>}
          </div>
          <div className="row" style={{ gap: 8, marginTop: 6 }}>
            <input className="field sm" style={{ flex: 2 }} value={w.focus} maxLength={80} placeholder="Foco (ex.: inferior)" onChange={(e) => setW(i, (x) => ({ ...x, focus: e.target.value }))} aria-label="Foco" />
            <input className="field sm" style={{ flex: 1 }} value={w.day} maxLength={30} placeholder="Dia (ex.: seg)" onChange={(e) => setW(i, (x) => ({ ...x, day: e.target.value }))} aria-label="Dia" />
          </div>
          {w.exercises.map((e, k) => (
            <div className="pro-ex" key={k}>
              <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                <span className="small mute">{k + 1}.</span>
                <input className="field sm" style={{ flex: 1, minWidth: 0 }} list="pro-ex-lib" value={e.name} maxLength={80} placeholder="Exercício (escreva ou escolha)" onChange={(ev) => setE(i, k, { name: ev.target.value })} aria-label={`Exercício ${k + 1}`} />
              </div>
              <div className="pro-ex-grid">
                <label className="small">Séries<input className="field sm" type="number" min={1} max={10} value={e.sets} onChange={(ev) => setE(i, k, { sets: Math.max(1, Math.min(10, Number(ev.target.value) || 1)) })} /></label>
                <label className="small">Repetições<input className="field sm" value={e.reps} maxLength={30} placeholder="10 ou 8-12" onChange={(ev) => setE(i, k, { reps: ev.target.value })} /></label>
                <label className="small">Carga<input className="field sm" value={e.load} maxLength={30} placeholder="20 kg" onChange={(ev) => setE(i, k, { load: ev.target.value })} /></label>
                <label className="small">Descanso<input className="field sm" value={e.rest} maxLength={30} placeholder="60 s" onChange={(ev) => setE(i, k, { rest: ev.target.value })} /></label>
              </div>
              <div className="row" style={{ gap: 6, flexWrap: 'nowrap', marginTop: 6 }}>
                <input className="field sm" style={{ flex: 1, minWidth: 0 }} value={e.notes} maxLength={240} placeholder="Nota (técnica, cadência, vídeo…)" onChange={(ev) => setE(i, k, { notes: ev.target.value })} aria-label="Nota do exercício" />
                <button className="btn ghost sm" aria-label="Subir" onClick={() => moveE(i, k, -1)}>↑</button>
                <button className="btn ghost sm" aria-label="Descer" onClick={() => moveE(i, k, 1)}>↓</button>
                <button className="x" aria-label="Apagar exercício" onClick={() => setW(i, (x) => ({ ...x, exercises: x.exercises.filter((_, j) => j !== k) }))}>×</button>
              </div>
            </div>
          ))}
          <button className="btn ghost sm" style={{ marginTop: 8 }} disabled={w.exercises.length >= 20} onClick={() => setW(i, (x) => ({ ...x, exercises: [...x.exercises, newEx()] }))}>+ Exercício</button>
        </section>
      ))}
      <button className="btn ghost full" disabled={plan.workouts.length >= 10} onClick={() => setPlan({ ...plan, workouts: [...plan.workouts, newWorkout(plan.workouts.length)] })}>+ Treino</button>
      <p />
      <button className="btn full" disabled={busy} onClick={save}>{busy ? 'A guardar…' : 'Guardar e enviar ao aluno'}</button>
      {err && <p className="small warn-t">{err}</p>}
    </>
  );
}

/** Registos de treino de um aluno. */
function StudentLogs({ student, onClose }: { student: ProStudent; onClose: () => void }) {
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
          <p className="small" style={{ margin: '4px 0' }}>{STATUS[g.status] ?? g.status}{g.minutes ? ` · ${g.minutes} min` : ''}</p>
          {g.note && <p className="small" style={{ margin: '4px 0' }}>💬 "{g.note}"</p>}
          {g.changes?.length > 0 && <p className="small mute" style={{ margin: '4px 0' }}>Alterações: {g.changes.join('; ')}</p>}
          {g.exercises?.length > 0 && (
            <table className="mydata small">
              <tbody>
                {g.exercises.map((e) => <tr key={e.name}><td>{e.name}</td><td>{e.sets}/{e.of} séries{e.reps ? ` · ${e.reps}` : ''}{e.load ? ` · ${e.load}` : ''}</td></tr>)}
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
  const [form, setForm] = useState({ name: '', reg: '', kind: 'personal' });
  const [newName, setNewName] = useState('');
  const [edit, setEdit] = useState<ProStudent | null>(null);
  const [logs, setLogs] = useState<ProStudent | null>(null);
  const load = () => proApi<{ pro: ProInfo | null; students?: ProStudent[] }>('estado').then((r) => { setPro(r.pro); setStudents(r.students ?? []); setErr(''); }).catch((e) => setErr((e as Error).message));
  useEffect(() => { if (auth) load(); }, [auth?.token]); // eslint-disable-line react-hooks/exhaustive-deps
  const appUrl = `${location.origin}${import.meta.env.BASE_URL}`;

  if (!auth)
    return (
      <>
        <h1>NEFESH Life Pro</h1>
        <section className="card hero">
          <h2 style={{ marginTop: 0 }}>Para personais e outros profissionais</h2>
          <p className="small">Monte o treino dos seus alunos, envie-lhes um código e veja quando concluem cada treino, com as cargas e os comentários.</p>
          <button className="btn" onClick={openAccount}>Entrar ou criar conta</button>
        </section>
      </>
    );
  if (edit) return <PlanEditor student={edit} others={students} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />;
  if (logs) return <StudentLogs student={logs} onClose={() => setLogs(null)} />;

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
          <label className="small" style={{ display: 'block' }}>Nome profissional<input className="field" value={form.name} maxLength={60} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label className="small" style={{ display: 'block', marginTop: 8 }}>Área
            <select className="field sm" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
              <option value="personal">Personal trainer / educação física</option>
              <option value="nutricionista">Nutricionista</option>
              <option value="medico">Médico(a)</option>
              <option value="outro">Outro</option>
            </select>
          </label>
          <label className="small" style={{ display: 'block', marginTop: 8 }}>Registo profissional (CREF no Brasil, título profissional em Portugal)<input className="field" value={form.reg} maxLength={40} onChange={(e) => setForm({ ...form, reg: e.target.value })} /></label>
          <button className="btn" style={{ marginTop: 12 }} onClick={() => proApi<{ pro: ProInfo }>('registar', form).then((r) => setPro(r.pro)).catch((e) => setErr((e as Error).message))}>{isTestCopy() ? 'Ativar' : 'Pedir acesso'}</button>
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
          {!S.notifications && <p className="small warn">Ative as notificações no Perfil para saber quando os alunos concluem um treino.</p>}
          <section className="card">
            <h2 style={{ marginTop: 0 }}>Novo aluno</h2>
            <div className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
              <input className="field sm" style={{ flex: 1 }} value={newName} maxLength={40} placeholder="Nome do aluno" onChange={(e) => setNewName(e.target.value)} aria-label="Nome do aluno" />
              <button className="btn sm" disabled={newName.trim().length < 2} onClick={() => proApi<{ code: string }>('aluno/novo', { name: newName }).then((r) => { toast(`Código criado: ${r.code}`); setNewName(''); load(); }).catch((e) => setErr((e as Error).message))}>Criar código</button>
            </div>
          </section>
          {students.length === 0 && <p className="small mute">Ainda sem alunos. Crie um código para cada aluno e monte o treino dele.</p>}
          {students.map((s) => (
            <section className="card pro-student" key={s.code}>
              <div className="row"><h2 style={{ margin: 0 }}>{s.name}</h2><span className="small mute">{s.code}</span></div>
              <p className="small" style={{ margin: '4px 0' }}>
                {s.linked ? '✓ Ligado na app' : '⏳ À espera que o aluno use o código'}
                {s.plan ? ` · ${s.plan.workouts.length} ${s.plan.workouts.length === 1 ? 'treino' : 'treinos'}` : ' · treino por montar'}
                {s.linked ? ` · ${s.week} esta semana` : ''}
              </p>
              {s.last && <p className="small mute" style={{ margin: '0 0 6px' }}>Último: {s.last.workout}, {shortDate(s.last.day)} · {STATUS[s.last.status] ?? s.last.status}{s.last.note ? ` · "${s.last.note}"` : ''}</p>}
              <div className="row" style={{ gap: 8, justifyContent: 'flex-start', flexWrap: 'wrap' }}>
                <button className="btn sm" onClick={() => setEdit(s)}>{s.plan ? 'Editar treino' : 'Montar treino'}</button>
                <button className="btn ghost sm" onClick={() => setLogs(s)}>Registos</button>
                {!s.linked && <a className="btn ghost sm" href={whatsappShare(inviteText(s.name, s.code, pro.name, appUrl))} target="_blank" rel="noreferrer">Enviar código</a>}
                <button className="link small inline" onClick={() => confirm(`Apagar ${s.name} e os registos?`) && proApi('aluno/apagar', { code: s.code }).then(load)}>Apagar</button>
              </div>
            </section>
          ))}
        </>
      )}
    </>
  );
}
