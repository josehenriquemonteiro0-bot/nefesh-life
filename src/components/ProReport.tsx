import { useEffect, useState } from 'react';
import { proApi, type ProStudent } from '../domain/pro';
import type { ShareDay, ShareSummary } from '../domain/proShare';

const fmt = (n: number | null | undefined, d = 1) => (n === null || n === undefined ? '—' : String(Math.round(n * 10 ** d) / 10 ** d).replace('.', ','));
const dm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
const GOAL: Record<string, string> = { energia: 'mais energia', desporto: 'desempenho no desporto', imunidade: 'imunidade', foco: 'foco', nutricao: 'nutrição', peso: 'controlo do peso' };

/** Barras de 14 dias para uma métrica. */
function Days({ days, pick, max, label }: { days: ShareDay[]; pick: (d: ShareDay) => number | undefined; max: number; label: string }) {
  if (!days.some((d) => pick(d))) return null;
  return (
    <div className="share-days" role="img" aria-label={`${label}: ${days.map((d) => `${dm(d.d)} ${pick(d) ?? 'sem registo'}`).join(', ')}`}>
      {days.map((d) => {
        const v = pick(d);
        return <i key={d.d} className={v ? '' : 'empty'} style={{ height: `${v ? Math.max(6, Math.min(100, (v / max) * 100)) : 4}%` }} title={`${dm(d.d)}: ${v ?? '—'}`} />;
      })}
    </div>
  );
}

/** Relatório de bem-estar que o aluno partilhou (últimos 14 dias). */
export function ShareReport({ student, onClose }: { student: ProStudent; onClose: () => void }) {
  const [r, setR] = useState<{ report: ShareSummary; updated: string } | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    proApi<{ report: ShareSummary; updated: string }>('aluno/relatorio', { code: student.code }).then(setR).catch((e) => setErr((e as Error).message));
  }, [student.code]);
  const x = r?.report;
  return (
    <>
      <button className="btn ghost sm" onClick={onClose}>← Alunos</button>
      <h1 style={{ marginBottom: 4 }}>Relatório de {student.name}</h1>
      {err && <p className="small warn-t">{err}</p>}
      {!r && !err && <p className="small mute">A carregar…</p>}
      {x && (
        <>
          <p className="small mute" style={{ marginTop: 0 }}>{dm(x.from)} a {dm(x.to)} · partilhado por {student.name} (pode deixar de partilhar a qualquer momento){x.goal ? ` · objetivo na app: ${GOAL[x.goal] ?? x.goal}` : ''}</p>
          <div className="share-grid">
            <section className="card"><p className="small mute">⚡ Energia</p><b className="big">{fmt(x.avg.energy)}<small>/5</small></b><Days days={x.days} pick={(d) => d.e} max={5} label="Energia" /></section>
            <section className="card"><p className="small mute">🌙 Sono</p><b className="big">{fmt(x.avg.sleep)}<small> h</small></b><Days days={x.days} pick={(d) => d.sleepH} max={10} label="Sono" /></section>
            <section className="card"><p className="small mute">😮‍💨 Stress</p><b className="big">{fmt(x.avg.stress)}<small>/5</small></b><Days days={x.days} pick={(d) => d.stress} max={5} label="Stress" /></section>
            <section className="card"><p className="small mute">👟 Passos</p><b className="big">{x.avg.steps ? Math.round(x.avg.steps).toLocaleString('pt-PT') : '—'}</b><Days days={x.days} pick={(d) => d.steps} max={15000} label="Passos" /></section>
            <section className="card"><p className="small mute">🏋️ Treino</p><b className="big">{x.trainMin}<small> min</small></b>{x.train && <p className="small" style={{ margin: '4px 0 0' }}>{x.train.done > x.train.planned ? `${x.train.done} treinos esta semana (meta: ${x.train.planned}) ✓` : `${x.train.done} de ${x.train.planned} treinos esta semana`}</p>}<Days days={x.days} pick={(d) => d.train} max={90} label="Treino" /></section>
            <section className="card"><p className="small mute">🍽️ Alimentação</p><b className="big">{x.avg.kcal ? Math.round(x.avg.kcal) : '—'}<small> kcal</small></b><p className="small" style={{ margin: '4px 0 0' }}>{x.avg.prot ? `${Math.round(x.avg.prot)} g de proteína · ` : ''}{x.foodDays} de 14 dias registados</p></section>
            <section className="card"><p className="small mute">💧 Água</p><b className="big">{x.waterDays}<small>/14</small></b><p className="small" style={{ margin: '4px 0 0' }}>dias na meta</p></section>
            <section className="card"><p className="small mute">🌿 Spirulina</p><b className="big">{x.spirulinaDays}<small>/14</small></b><p className="small" style={{ margin: '4px 0 0' }}>dias</p></section>
            {x.weight && <section className="card"><p className="small mute">⚖️ Peso</p><b className="big">{fmt(x.weight.last)}<small> kg</small></b><p className="small" style={{ margin: '4px 0 0' }}>{x.weight.last - x.weight.first >= 0 ? '+' : ''}{fmt(x.weight.last - x.weight.first)} kg desde {dm(x.weight.from)}</p></section>}
          </div>
          <p className="small mute">Valores registados pelo aluno na NEFESH Life. Médias só dos dias com registo. Atualizado a {new Date(r!.updated).toLocaleDateString('pt-PT')}.</p>
        </>
      )}
    </>
  );
}
