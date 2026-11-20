import { AREAS, GOAL_LABEL } from '../domain/content';
import { fmtNum, keyDaysAgo, shortDate } from '../domain/dates';
import { BODY_GOAL_LABEL, bodyOf, targetsFor } from '../domain/body';
import { indexOf, planFor } from '../domain/plan';
import { doseText } from '../domain/lots';
import { totals } from '../domain/foods';
import { adherence, streak, took } from '../domain/stats';
import { isMeasured, sourceOf } from '../domain/sources';
import { compareEvals, weeklySummary, workoutKcal } from '../domain/progress';
import { weekAdherence, weekChanges } from '../domain/planAdherence';
import { trainChanges, weekTrainAdherence } from '../domain/trainAdherence';
import { useStore } from '../state/store';
import { careReportLines } from '../domain/care';

/** Gráfico simples de 14 dias para papel (largura fixa, cores escuras). */
function PrintChart({ series }: { series: { color: string; label: string; values: (number | undefined)[] }[] }) {
  const W = 640, H = 170, pl = 22, pr = 8, pt = 8, pb = 20;
  const n = series[0].values.length;
  const x = (i: number) => pl + ((W - pl - pr) * i) / (n - 1);
  const y = (v: number) => pt + ((H - pt - pb) * (5 - v)) / 4;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="pchart" role="img" aria-label="Energia, sono e disposição nos últimos 14 dias">
      {[1, 2, 3, 4, 5].map((v) => (
        <g key={v}>
          <line x1={pl} x2={W - pr} y1={y(v)} y2={y(v)} stroke="#dde3df" />
          <text x={4} y={y(v) + 4} fontSize={10} fill="#6b7a72">{v}</text>
        </g>
      ))}
      <text x={x(0)} y={H - 4} fontSize={10} fill="#6b7a72">há {n} dias</text>
      <text x={x(n - 1)} y={H - 4} fontSize={10} fill="#6b7a72" textAnchor="end">hoje</text>
      {series.map(({ color, values }) => {
        let d = '';
        values.forEach((v, i) => {
          if (!v) return;
          d += `${d ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
        });
        return (
          <g key={color}>
            <path d={d} fill="none" stroke={color} strokeWidth={2} />
            {values.map((v, i) => (v ? <circle key={i} cx={x(i)} cy={y(v)} r={2.5} fill={color} /> : null))}
          </g>
        );
      })}
    </svg>
  );
}

/**
 * Relatório para imprimir ou guardar em PDF (diálogo de impressão do sistema:
 * no iPhone, Partilhar → Imprimir → Guardar em Ficheiros).
 */
export function PrintReport() {
  const { S } = useStore();
  if (!S.ans) return null;
  const now = new Date();
  const c = planFor(S);
  const ev = S.evals[S.evals.length - 1];
  const b = bodyOf(S.ans);
  const tg = targetsFor(S);
  const cmp = compareEvals(S);
  const w = weeklySummary(S, now);
  const keys = Array.from({ length: 14 }, (_, i) => keyDaysAgo(13 - i, now));
  const last7 = keys.slice(-7);
  const na = S.nutriPlan ? weekAdherence(S, 7, now) : null;
  const nc = S.nutriPlan ? weekChanges(S, 7, now) : [];
  const ta = S.trainPlan ? weekTrainAdherence(S, now) : null;
  const tc = S.trainPlan ? trainChanges(S, 7, now) : [];
  const series = [
    { color: '#0a8f55', label: 'Energia', values: keys.map((k) => S.logs[k]?.e) },
    { color: '#a8822c', label: 'Sono', values: keys.map((k) => S.logs[k]?.s) },
    { color: '#34403a', label: 'Disposição', values: keys.map((k) => S.logs[k]?.d) },
  ];
  const hasChart = series.some((s) => s.values.some(Boolean));

  return (
    <div className="print-report">
      <header className="pr-head">
        <img src={`${import.meta.env.BASE_URL}brand/logo-header.png`} alt="nefesh" width={130} height={30} />
        <div>
          <b>Relatório NEFESH Life</b>
          <span>{now.toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
        </div>
      </header>

      <section>
        <h2>{S.ans.name || 'Utilizador'}{S.ans.idade && typeof S.ans.idade === 'number' ? `, ${S.ans.idade} anos` : ''}</h2>
        <p>
          Objetivo: {GOAL_LABEL[S.ans.goal ?? 'energia']}{b ? ` · ${BODY_GOAL_LABEL[b.corpo]}` : ''}
          {S.planStart ? ` · ritual desde ${shortDate(S.planStart)}` : ''} · {streak(S, now)} dias seguidos · adesão 14 dias {adherence(S, 14, now)}%
        </p>
      </section>

      <section className="pr-grid">
        <div>
          <h3>Índice NEFESH</h3>
          <p className="pr-big">{ev ? indexOf(ev.sc) : '—'}<small>/100</small></p>
          {ev && <p className="pr-small">{AREAS.map(([k, t]) => `${t} ${ev.sc[k]}`).join(' · ')}</p>}
        </div>
        <div>
          <h3>Spirulina</h3>
          <p className="pr-big">{fmtNum(c.g)}<small> g/dia</small></p>
          <p className="pr-small">{doseText(c.caps, c.format)} por dia{S.proDose ? ` · definida por ${S.proDose.by}` : ''}</p>
        </div>
        {b && (
          <div>
            <h3>Corpo</h3>
            <p className="pr-big">{fmtNum(S.ans.peso!)}<small> kg</small></p>
            <p className="pr-small">IMC {fmtNum(b.bmi)} ({b.bmiLabel}) · gordura {fmtNum(b.fat)}%{S.ans.cintura ? ` · cintura ${fmtNum(S.ans.cintura)} cm` : ''}</p>
          </div>
        )}
        {b && (
          <div>
            <h3>Meta diária</h3>
            <p className="pr-big">{tg.kcal.toLocaleString('pt-PT')}<small> kcal</small></p>
            <p className="pr-small">{tg.protein} g de proteína · {tg.source === 'pro' ? `definida por ${tg.by}` : 'referência geral da app'}</p>
          </div>
        )}
      </section>

      {cmp && (
        <section>
          <h3>Antes e depois ({cmp.days} dias)</h3>
          <table className="pr-table">
            <thead><tr><th /><th>{shortDate(cmp.first.date)}</th><th>{shortDate(cmp.last.date)}</th><th>diferença</th></tr></thead>
            <tbody>
              <tr><td>Índice NEFESH</td><td>{indexOf(cmp.first.sc)}</td><td>{indexOf(cmp.last.sc)}</td><td>{cmp.index > 0 ? '+' : ''}{cmp.index}</td></tr>
              {cmp.peso !== null && <tr><td>Peso (kg)</td><td>{fmtNum(cmp.first.body!.peso)}</td><td>{fmtNum(cmp.last.body!.peso)}</td><td>{cmp.peso > 0 ? '+' : ''}{fmtNum(cmp.peso)}</td></tr>}
              {cmp.fat !== null && <tr><td>Gordura (%)</td><td>{fmtNum(cmp.first.body!.fat!)}</td><td>{fmtNum(cmp.last.body!.fat!)}</td><td>{cmp.fat > 0 ? '+' : ''}{fmtNum(cmp.fat)}</td></tr>}
              {cmp.cintura !== null && <tr><td>Cintura (cm)</td><td>{fmtNum(cmp.first.body!.cintura!)}</td><td>{fmtNum(cmp.last.body!.cintura!)}</td><td>{cmp.cintura > 0 ? '+' : ''}{fmtNum(cmp.cintura)}</td></tr>}
            </tbody>
          </table>
        </section>
      )}

      {hasChart && (
        <section>
          <h3>Como se tem sentido (14 dias, escala 1 a 5)</h3>
          <PrintChart series={series} />
          <p className="pr-legend">{series.map((s) => <span key={s.label}><i style={{ background: s.color }} />{s.label}</span>)}</p>
        </section>
      )}

      <section>
        <h3>Últimos 7 dias</h3>
        <table className="pr-table">
          <thead>
            <tr><th>Dia</th><th>Spirulina</th><th>Água</th><th>Passos</th><th>Sono</th><th>Energia</th><th>Comida</th><th>Treino</th></tr>
          </thead>
          <tbody>
            {last7.map((k) => {
              const l = S.logs[k];
              const food = l?.meals ? totals(Object.values(l.meals).flat() as never) : null;
              const mins = (l?.workouts ?? []).reduce((t, x) => t + x.minutes, 0);
              return (
                <tr key={k}>
                  <td>{shortDate(k)}</td>
                  <td>{took(S, l, now) ? 'sim' : '—'}</td>
                  <td>{l?.water ? `${l.water} copos` : '—'}</td>
                  <td>{l?.steps !== undefined ? `${l.steps.toLocaleString('pt-PT')}${isMeasured(sourceOf(l, 'steps')) ? ' ⌚' : ''}` : '—'}</td>
                  <td>{l?.sleepH !== undefined ? `${fmtNum(l.sleepH)} h${isMeasured(sourceOf(l, 'sleepH')) ? ' ⌚' : ''}` : '—'}</td>
                  <td>{l?.e ? `${l.e}/5` : '—'}</td>
                  <td>{food && food.kcal ? `${Math.round(food.kcal)} kcal` : '—'}</td>
                  <td>{mins ? `${mins} min (${workoutKcal(S, k)} kcal)` : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="pr-small">
          Na semana: Spirulina em {w.spirulina}/7 dias · água na meta em {w.water}/7 · {w.minutes} min de atividade
          {w.sleep !== null ? ` · sono médio ${fmtNum(w.sleep)} h` : ''}{w.energy !== null ? ` · energia média ${fmtNum(w.energy)}/5` : ''}
        </p>
        <p className="pr-small">⌚ medido pelo relógio ou telemóvel (app Saúde). Sem ⌚: registado pela pessoa. Energia, sono e disposição de 1 a 5 são sempre a avaliação da pessoa.</p>
      </section>

      {S.nutriPlan && (
        <section>
          <h3>Plano alimentar{S.plans?.nutri?.by ? ` (${S.plans.nutri.by})` : ''}</h3>
          <p>Adesão nos últimos 7 dias: <b>{na?.pct === null || na === null ? 'sem registos' : `${na.pct}%`}</b>{na && na.pct !== null ? ` em ${na.loggedDays} ${na.loggedDays === 1 ? 'dia registado' : 'dias registados'}` : ''}</p>
          {nc.length > 0 && <ul>{nc.map((x) => <li key={x}>{x}</li>)}</ul>}
        </section>
      )}

      {S.trainPlan && ta && (
        <section>
          <h3>Plano de treino do personal</h3>
          <p>Treinos esta semana: <b>{ta.done} de {ta.planned}</b></p>
          {tc.length > 0 && <ul>{tc.map((x) => <li key={x}>{x}</li>)}</ul>}
        </section>
      )}

      {(() => {
        const c = careReportLines(S, now);
        if (!c.meds.length && !c.labs.length && !c.prev.length) return null;
        return (
          <section>
            <h3>Cuidados</h3>
            {c.meds.length > 0 && <><p><b>Medicação e suplementos</b></p><ul>{c.meds.map((x) => <li key={x}>{x}</li>)}</ul></>}
            {c.labs.length > 0 && <><p><b>Análises (evolução)</b></p><ul>{c.labs.map((x) => <li key={x}>{x}</li>)}</ul></>}
            {c.prev.length > 0 && <><p><b>Prevenção por rever</b></p><ul>{c.prev.map((x) => <li key={x}>{x}</li>)}</ul></>}
            <p className="pr-small">Valores de referência gerais ou do laboratório, quando indicados. A interpretação é do médico.</p>
          </section>
        );
      })()}

      <footer className="pr-foot">
        A NEFESH Life é uma ferramenta de bem-estar: não faz diagnósticos nem substitui um profissional de saúde.
        As estimativas de calorias e composição corporal são aproximadas.
      </footer>
    </div>
  );
}
