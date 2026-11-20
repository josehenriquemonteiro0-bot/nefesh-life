import { useState } from 'react';
import { Bar, Columns, LineChart } from '../components/Charts';
import { Icon } from '../components/Icon';
import { STEP_GOAL } from '../domain/content';
import { daysSince, keyDaysAgo, shortDate } from '../domain/dates';
import { indexOf, planFor } from '../domain/plan';
import { adherence, badges, bestStreak, changeSinceStart, streak } from '../domain/stats';
import { useStore } from '../state/store';
import { weekAdherence, weekChanges } from '../domain/planAdherence';

export function Evolution({ openReport, go }: { openReport: () => void; go?: (t: 'check') => void }) {
  const { S } = useStore();
  const [days, setDays] = useState<14 | 30>(14);
  if (!S.ans) return null;
  const de = changeSinceStart(S, 'e');
  const dd = changeSinceStart(S, 'd');
  const gw = planFor(S).water;
  const bs = badges(S);
  const got = bs.filter((b) => b[2]).length;
  const range = (n: number) => Array.from({ length: n }, (_, i) => S.logs[keyDaysAgo(n - 1 - i)]);
  const lastEval = S.evals[S.evals.length - 1];

  return (
    <>
      <div className="row">
        <h1>A sua evolução</h1>
        {go && <button className="btn sm" onClick={() => go('check')}>Check-in de hoje</button>}
      </div>
      <section className="card hero">
        <p className="small" style={{ margin: 0, opacity: 0.8 }}>Resumo{S.planStart ? ` desde ${shortDate(S.planStart)}` : ''}</p>
        {de !== null ? (
          <>
            <h2 style={{ margin: '6px 0 4px', fontSize: 22 }}>
              A sua energia {de >= 0 ? 'subiu' : 'desceu'} <span className="neon">{Math.abs(de)}%</span> desde que começou
            </h2>
            <p className="small" style={{ margin: 0, opacity: 0.85 }}>
              Disposição: {dd! >= 0 ? '+' : ''}{dd}% · melhor sequência: {bestStreak(S)} dias
            </p>
          </>
        ) : (
          <h2 style={{ margin: '6px 0 0' }}>Faça check-in durante 10 dias para ver o seu primeiro resumo.</h2>
        )}
      </section>

      <div className="stats">
        <div className="stat"><b>{streak(S)}</b><span>dias seguidos</span></div>
        <div className="stat"><b>{adherence(S, 30)}%</b><span>adesão 30 dias</span></div>
        <div className="stat"><b>{got}/{bs.length}</b><span>conquistas</span></div>
      </div>

      <section className="card">
        <div className="row">
          <h2 style={{ margin: 0 }}>Como se tem sentido</h2>
          <div className="seg" role="group" aria-label="Período">
            <button className={days === 14 ? 'on' : ''} aria-pressed={days === 14} onClick={() => setDays(14)}>14 dias</button>
            <button className={days === 30 ? 'on' : ''} aria-pressed={days === 30} onClick={() => setDays(30)}>30 dias</button>
          </div>
        </div>
        <div className="legend" style={{ marginTop: 10 }}>
          <span><i style={{ background: '#00FE8A' }} />Energia</span>
          <span><i style={{ background: '#C9A85C' }} />Sono</span>
          <span><i style={{ background: '#e8ede9' }} />Disposição</span>
        </div>
        <LineChart
          days={days}
          series={[
            { color: '#00FE8A', values: range(days).map((l) => l?.e) },
            { color: '#C9A85C', values: range(days).map((l) => l?.s) },
            { color: '#e8ede9', values: range(days).map((l) => l?.d) },
          ]}
        />
      </section>

      {S.nutriPlan && (() => {
        const w = weekAdherence(S);
        const changes = weekChanges(S);
        return (
          <section className="card">
            <div className="row"><h2 style={{ margin: 0 }}>Plano alimentar</h2><span className="small mute">{w.pct === null ? 'sem registos' : `adesão ${w.pct}%`}</span></div>
            <div className="cols" style={{ gridTemplateColumns: 'repeat(7,minmax(0,1fr))' }}>
              {w.days.map((d) => <i key={d.key} className={d.pct >= 75 ? 'full' : ''} style={{ height: `${Math.max(d.done ? 4 : 0, d.pct)}%` }} title={`${d.pct}%`} />)}
            </div>
            <div className="cols-l"><span>há 7 dias</span><span>hoje</span></div>
            {changes.length > 0 && (
              <>
                <h3 style={{ marginTop: 12 }}>Alterações desta semana</h3>
                <ul className="small plan-list">{changes.slice(-6).map((c) => <li key={c}>{c}</li>)}</ul>
              </>
            )}
            <p className="small mute" style={{ margin: '8px 0 0' }}>Refeição seguida conta inteira; com alterações conta metade. Estes dados vão no relatório para o nutricionista.</p>
          </section>
        );
      })()}

      <section className="card">
        <div className="row"><h2 style={{ margin: 0 }}>Água</h2><span className="small mute">meta {gw} copos</span></div>
        <Columns values={range(14).map((l) => l?.water || 0)} goal={gw} label={(v) => `${v} copos`} />
      </section>

      {range(14).some((l) => l?.steps !== undefined) && (
        <section className="card">
          <div className="row"><h2 style={{ margin: 0 }}>Passos</h2><span className="small mute">meta {STEP_GOAL.toLocaleString('pt-PT')}</span></div>
          <Columns values={range(14).map((l) => l?.steps || 0)} goal={STEP_GOAL} variant="steps" label={(v) => `${v} passos`} />
        </section>
      )}
      {range(14).some((l) => l?.sleepH !== undefined) && (
        <section className="card">
          <div className="row"><h2 style={{ margin: 0 }}>Sono</h2><span className="small mute">meta 7 h</span></div>
          <Columns values={range(14).map((l) => l?.sleepH || 0)} goal={7} label={(v) => `${v} h`} />
        </section>
      )}

      <section className="card">
        <h2>Índice NEFESH</h2>
        <div className="evals">
          {S.evals.length ? (
            S.evals.map((e) => (
              <div className="ev" key={e.date}><span className="mute">{shortDate(e.date)}</span><Bar pct={indexOf(e.sc)} /><b>{indexOf(e.sc)}</b></div>
            ))
          ) : (
            <p className="small mute">Sem avaliações.</p>
          )}
        </div>
        <p className="small mute" style={{ margin: '10px 0 0' }}>
          {lastEval && daysSince(lastEval.date) >= 30 ? 'Já pode fazer a sua reavaliação mensal.' : 'Próxima reavaliação recomendada a cada 30 dias.'}
        </p>
      </section>

      <section className="card">
        <h2>Conquistas</h2>
        <div className="badges">
          {bs.map(([icon, t, on]) => (
            <div className={`badge ${on ? 'on' : ''}`} key={t}>
              <div className="b"><Icon name={icon} color={on ? '#1a1406' : 'currentColor'} width={2} /></div>
              {t}
            </div>
          ))}
        </div>
      </section>

      <button className="btn ghost full" onClick={openReport}>Partilhar relatório com um profissional</button>
    </>
  );
}
