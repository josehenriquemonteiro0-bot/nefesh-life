import { useState } from 'react';
import { Bar, Columns, LineChart } from '../components/Charts';
import { Icon } from '../components/Icon';
import { STEP_GOAL } from '../domain/content';
import { fmtNum, keyDaysAgo, shortDate } from '../domain/dates';
import { indexOf, planFor } from '../domain/plan';
import { adherence, badges, bestStreak, changeSinceStart, streak } from '../domain/stats';
import { useStore } from '../state/store';
import { weekAdherence, weekChanges } from '../domain/planAdherence';
import { compareEvals, nextReassessment, spirulinaInsight } from '../domain/progress';

/** A Spirulina e você: como se sentiu nos dias com e sem o ritual. */
export function SpirulinaInsight() {
  const { S } = useStore();
  const r = spirulinaInsight(S);
  const row = (t: string, a: number | null, b: number | null) => (
    <tr key={t}><td>{t}</td><td><b>{a === null ? '—' : fmtNum(a)}</b></td><td>{b === null ? '—' : fmtNum(b)}</td></tr>
  );
  return (
    <section className="card insight" data-tour="spirulina-voce">
      <h2 style={{ marginTop: 0 }}>🌿 A Spirulina e você</h2>
      {r.comparable ? (
        <>
          <p style={{ margin: '0 0 8px' }}>
            {r.energyDiff! > 0
              ? <>Nos dias em que fez o ritual, a sua energia foi <b className="neon">{fmtNum(r.energyDiff!)} pontos mais alta</b>.</>
              : r.energyDiff! < 0
                ? <>Por agora, a energia não foi mais alta nos dias com ritual. Dê tempo: os estudos medem efeitos ao fim de 4 a 12 semanas de uso diário.</>
                : <>Por agora, a energia é parecida nos dias com e sem ritual. A regularidade é o que faz a diferença.</>}
          </p>
          <table className="cmp">
            <thead><tr><th>últimos 30 dias (1 a 5)</th><th>com ritual ({r.with.n})</th><th>sem ritual ({r.without.n})</th></tr></thead>
            <tbody>{[row('Energia', r.with.e, r.without.e), row('Sono', r.with.s, r.without.s), row('Disposição', r.with.d, r.without.d)]}</tbody>
          </table>
        </>
      ) : r.allIn ? (
        <p style={{ margin: 0 }}>Fez o ritual em todos os dias com check-in: <b className="neon">energia média de {fmtNum(r.with.e!)}</b> em 5. Continue assim!</p>
      ) : (
        <p className="small mute" style={{ margin: 0 }}>
          Faça o check-in todos os dias. Com alguns dias com e sem ritual, mostramos aqui como se sente quando toma a Spirulina. ({r.checkins} {r.checkins === 1 ? 'check-in' : 'check-ins'} nos últimos 30 dias)
        </p>
      )}
      {r.index && (
        <p className="small" style={{ margin: '10px 0 0' }}>Índice NEFESH: {r.index.from} → <b>{r.index.to}</b> desde a primeira avaliação.</p>
      )}
      <p className="small mute" style={{ margin: '8px 0 0' }}>É uma observação sobre si, não uma prova científica: o sono, o stress e a alimentação também contam.</p>
    </section>
  );
}

/** Antes e depois: primeira avaliação contra a mais recente. */
export function Comparison() {
  const { S } = useStore();
  const c = compareEvals(S);
  if (!c) return null;
  const sign = (v: number) => `${v > 0 ? '+' : ''}${fmtNum(v)}`;
  const rows: [string, string, string, number | null][] = [
    ['Índice NEFESH', String(indexOf(c.first.sc)), String(indexOf(c.last.sc)), c.index],
  ];
  if (c.first.body && c.last.body) {
    rows.push(['Peso', `${fmtNum(c.first.body.peso)} kg`, `${fmtNum(c.last.body.peso)} kg`, c.peso]);
    if (c.bmi !== null) rows.push(['IMC', fmtNum(c.first.body.bmi!), fmtNum(c.last.body.bmi!), c.bmi]);
    if (c.fat !== null) rows.push(['Gordura corporal', `${fmtNum(c.first.body.fat!)}%`, `${fmtNum(c.last.body.fat!)}%`, c.fat]);
    if (c.cintura !== null) rows.push(['Cintura', `${fmtNum(c.first.body.cintura!)} cm`, `${fmtNum(c.last.body.cintura!)} cm`, c.cintura]);
  }
  return (
    <section className="card">
      <div className="row"><h2 style={{ margin: 0 }}>Antes e depois</h2><span className="small mute">{c.days} dias</span></div>
      <table className="cmp">
        <thead><tr><th /><th>{shortDate(c.first.date)}</th><th>{shortDate(c.last.date)}</th><th>diferença</th></tr></thead>
        <tbody>
          {rows.map(([k, a, b, d]) => (
            <tr key={k}><td>{k}</td><td>{a}</td><td><b>{b}</b></td><td className={d ? (d > 0 ? 'up' : 'down') : ''}>{d === null ? '—' : d === 0 ? '=' : sign(d)}</td></tr>
          ))}
        </tbody>
      </table>
      {!c.first.body && <p className="small mute" style={{ margin: '8px 0 0' }}>O peso e as medidas passam a ser comparados a partir desta avaliação.</p>}
    </section>
  );
}

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
  const re = nextReassessment(S);

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

      <SpirulinaInsight />

      <div className="stats">
        <div className="stat"><b>{streak(S)}</b><span>dias de ritual</span></div>
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

      <Comparison />

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
          {re?.due ? `Já pode fazer a reavaliação dos ${re.target} dias.` : re ? `Próxima reavaliação aos ${re.target} dias (daqui a ${re.inDays} ${re.inDays === 1 ? 'dia' : 'dias'}).` : 'Reavaliações aos 7, 15 e 30 dias.'}
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

      <button className="btn ghost full" onClick={openReport}>Relatório para um profissional</button>
    </>
  );
}
