import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Bar } from './Charts';
import { fmtNum, longToday, shortDate, todayKey } from '../domain/dates';
import { CYCLE_SYMPTOMS, FLOW_LABEL, GOALS, METHODS, MUCUS, PRODUCTS, type Method } from '../domain/cycleData';
import {
  PHASE_LABEL, PHASE_TIP, byPhase, phaseAdvice, showWomen, calendarMarks, cycleAlerts, cycleHistory, cycleInsights, cycleStats, isHormonal, methodLabel, methodOf, predict, type Phase,
} from '../domain/women';
import { doseKey } from '../domain/meds';
import type { DayLog } from '../domain/types';
import { useStore } from '../state/store';

type Cyc = NonNullable<DayLog['cycle']>;
const pk = (k: string) => new Date(`${k}T12:00:00`);
const kOf = (d: Date) => d.toLocaleDateString('en-CA');
const range = (a: string, b: string) => {
  const A = pk(a), B = pk(b);
  const f = (d: Date, m: boolean) => d.toLocaleDateString('pt-PT', m ? { day: 'numeric', month: 'short' } : { day: 'numeric' });
  return A.getMonth() === B.getMonth() ? `${f(A, false)}–${f(B, true)}` : `${f(A, true)} – ${f(B, true)}`;
};

/** Escreve no registo de um dia (hoje ou um dia passado escolhido no calendário). */
function useDayCycle(k: string) {
  const { S, update } = useStore();
  const c: Cyc = S.logs[k]?.cycle ?? {};
  const edit = (fn: (c: Cyc) => void) =>
    update((d) => {
      const l = (d.logs[k] = d.logs[k] ?? {});
      const n = { ...(l.cycle ?? {}) };
      fn(n);
      l.cycle = n;
    });
  return { c, edit };
}

/** Cabeçalho: dia do ciclo, fase, próxima menstruação com intervalo, atraso e janela fértil. */
export function CycleHero({ onAsk }: { onAsk: () => void }) {
  const { S } = useStore();
  const today = todayKey();
  const p = predict(S, today);
  const goal = S.women?.goal ?? 'acompanhar';
  if (!p) return null;
  const fert = p.fertile;
  return (
    <section className="card hero">
      <p className="small" style={{ margin: 0, opacity: 0.8 }}>{longToday()}</p>
      {p.stale ? (
        <>
          <h2 style={{ margin: '4px 0 6px' }}>Há muito tempo sem registos</h2>
          <p className="small" style={{ margin: 0 }}>Marque no calendário quando foi a última menstruação para as previsões voltarem a funcionar.</p>
        </>
      ) : (
        <>
          <h2 style={{ margin: '4px 0 2px' }}>
            {p.onPeriod ? `Menstruação · dia ${p.day}` : p.hormonal ? `Dia ${p.day} desde o último sangramento` : `Dia ${p.day} do ciclo · ${PHASE_LABEL[p.phase!]}`}
          </h2>
          {p.late > 0 ? (
            <p className="small" style={{ margin: '0 0 8px' }}>
              <b>Menstruação atrasada {p.late} {p.late === 1 ? 'dia' : 'dias'}.</b> Stress, viagens, doença ou mudanças no treino e no peso podem atrasar o ciclo.
              {!p.hormonal && ' Se houve relações sem proteção, um teste de gravidez já dá uma resposta fiável.'}
            </p>
          ) : (
            <p className="small" style={{ margin: '0 0 8px', opacity: 0.9 }}>
              {p.hormonal ? 'Próximo sangramento' : 'Próxima menstruação'}: <b>{range(p.range[0], p.range[1])}</b> ({p.inDays <= 0 ? 'a qualquer momento' : `daqui a ~${p.inDays} ${p.inDays === 1 ? 'dia' : 'dias'}`}) · ciclo de ~{p.len} dias
            </p>
          )}
          <Bar pct={Math.min(100, (p.day / p.len) * 100)} />
          {fert && (
            <p className="small" style={{ margin: '8px 0 0' }}>
              {p.fertileToday ? (
                <b>{goal === 'evitar' ? '⚠️ Hoje está na janela fértil estimada: maior probabilidade de gravidez.' : '💚 Hoje está na janela fértil (estimativa).'}</b>
              ) : fert.from > today ? (
                <>Janela fértil estimada: <b>{range(fert.from, fert.to)}</b>{fert.lh ? ' (pelo teste de ovulação)' : ''}.</>
              ) : (
                <>Janela fértil deste ciclo já passou.</>
              )}
              {goal === 'engravidar' && p.fertileToday && ' As relações a cada 1 ou 2 dias nesta janela dão mais hipóteses.'}
            </p>
          )}
          {p.phase && <p className="small" style={{ margin: '8px 0 0' }}>{PHASE_TIP[p.phase]}</p>}
        </>
      )}
      <button className="link small inline" style={{ marginTop: 8 }} onClick={onAsk}>🎙️ Registar por voz no assistente</button>
    </section>
  );
}

/** Calendário do mês: menstruação registada, prevista, janela fértil e ovulação. */
export function CycleCalendar({ selected, onSelect }: { selected: string; onSelect: (k: string) => void }) {
  const { S } = useStore();
  const today = todayKey();
  const [month, setMonth] = useState(() => { const d = pk(today); d.setDate(1); return d; });
  const marks = calendarMarks(S, today);
  const hormonal = isHormonal(S);
  const first = new Date(month);
  const lead = (first.getDay() + 6) % 7; // segunda-feira primeiro
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => kOf(new Date(month.getFullYear(), month.getMonth(), i + 1, 12)))];
  const move = (n: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1, 12));
  return (
    <section className="card">
      <div className="row">
        <button className="btn ghost sm" aria-label="Mês anterior" onClick={() => move(-1)}>‹</button>
        <h2 style={{ margin: 0 }}>{((t) => t[0].toUpperCase() + t.slice(1))(month.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' }))}</h2>
        <button className="btn ghost sm" aria-label="Mês seguinte" onClick={() => move(1)}>›</button>
      </div>
      <div className="cal" role="grid" aria-label="Calendário do ciclo">
        {['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map((d, i) => <span key={i} className="cal-h" aria-hidden="true">{d}</span>)}
        {cells.map((k, i) => {
          if (!k) return <span key={`e${i}`} />;
          const c = S.logs[k]?.cycle;
          const cls = [
            'cal-d',
            c?.p ? 'per' : c?.spot ? 'spot' : marks.periods.has(k) ? 'pred' : '',
            !c?.p && marks.ovu.has(k) ? 'ovu' : !c?.p && marks.fertile.has(k) ? 'fert' : '',
            k === today ? 'today' : '',
            k === selected ? 'sel' : '',
            k > today ? 'fut' : '',
          ].join(' ');
          const more = !!(c && (c.sy?.length || c.pain || c.mucus || c.sex || c.ovt || c.pt));
          return (
            <button key={k} className={cls} disabled={k > today} aria-pressed={k === selected} aria-label={pk(k).toLocaleDateString('pt-PT', { day: 'numeric', month: 'long' })} onClick={() => onSelect(k)}>
              {pk(k).getDate()}
              {more && <i aria-hidden="true" />}
            </button>
          );
        })}
      </div>
      <p className="small mute cal-legend">
        <span><i className="per" /> menstruação</span>
        <span><i className="pred" /> prevista</span>
        {!hormonal && <span><i className="fert" /> janela fértil</span>}
        {!hormonal && <span><i className="ovu" /> ovulação</span>}
      </p>
      <p className="small mute" style={{ margin: 0 }}>Toque num dia (até hoje) para registar ou corrigir.</p>
    </section>
  );
}

function Chips<T extends string | number>({ items, value, onPick, label }: { items: [T, string][]; value: T | undefined; onPick: (v: T | undefined) => void; label: string }) {
  return (
    <div className="chips" role="group" aria-label={label}>
      {items.map(([k, t]) => (
        <button key={String(k)} className={`chip sm ${value === k ? 'on' : ''}`} aria-pressed={value === k} onClick={() => onPick(value === k ? undefined : k)}>{t}</button>
      ))}
    </div>
  );
}

/** Registo de um dia: menstruação, fluxo, dor, sintomas e (em "Mais") muco, relações, testes e produtos. */
export function CycleDay({ k }: { k: string }) {
  const { S } = useStore();
  const { c, edit } = useDayCycle(k);
  const today = todayKey();
  const hormonal = isHormonal(S);
  const set = <K extends keyof Cyc>(key: K, v: Cyc[K] | undefined) => edit((n) => { if (v === undefined) delete n[key]; else n[key] = v; });
  const toggleIn = (key: 'sy' | 'prod', v: string) => edit((n) => { const cur = n[key] ?? []; n[key] = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]; });
  return (
    <section className="card">
      <h2 style={{ marginTop: 0 }}>{k === today ? 'Hoje' : pk(k).toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
      <div className="row" style={{ gap: 8, justifyContent: 'flex-start', flexWrap: 'wrap' }}>
        <button className={`btn ${c.p ? 'ghost' : ''} sm`} onClick={() => edit((n) => { n.p = !c.p; if (!n.p) delete n.flow; else delete n.spot; })}>
          {c.p ? '✓ Com menstruação (tocar para tirar)' : '🩸 Com menstruação'}
        </button>
        {!c.p && (
          <button className={`chip sm ${c.spot ? 'on' : ''}`} aria-pressed={!!c.spot} onClick={() => set('spot', c.spot ? undefined : true)}>Só borra / escape</button>
        )}
      </div>
      {c.p && (
        <div style={{ marginTop: 8 }}>
          <Chips label="Fluxo" items={([1, 2, 3, 4] as const).map((f) => [f, FLOW_LABEL[f]] as [1 | 2 | 3 | 4, string])} value={c.flow} onPick={(v) => set('flow', v)} />
        </div>
      )}
      <label className="small" style={{ display: 'block', margin: '12px 0 4px' }}>
        Dor: <b>{c.pain ? `${c.pain} em 10` : 'sem dor'}</b>
        <input type="range" min={0} max={10} step={1} value={c.pain ?? 0} aria-label="Dor de 0 a 10" style={{ width: '100%' }} onChange={(e) => set('pain', Number(e.target.value) || undefined)} />
      </label>
      <p className="small mute" style={{ margin: '8px 0 4px' }}>Sintomas</p>
      <div className="chips">
        {CYCLE_SYMPTOMS.map((s) => {
          const on = (c.sy ?? []).includes(s);
          return <button key={s} className={`chip sm ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => toggleIn('sy', s)}>{s}</button>;
        })}
      </div>
      <details className="small" style={{ marginTop: 10 }}>
        <summary>Mais registos: {hormonal ? '' : 'muco, '}relações, libido, testes e produtos</summary>
        {!hormonal && (
          <>
            <p className="small mute" style={{ margin: '10px 0 4px' }}>Muco cervical</p>
            <Chips label="Muco cervical" items={MUCUS} value={c.mucus} onPick={(v) => set('mucus', v)} />
          </>
        )}
        <p className="small mute" style={{ margin: '10px 0 4px' }}>Relação sexual</p>
        <Chips label="Relação sexual" items={[['p', 'Com proteção'], ['u', 'Sem proteção']]} value={c.sex} onPick={(v) => set('sex', v)} />
        <p className="small mute" style={{ margin: '10px 0 4px' }}>Libido</p>
        <Chips label="Libido" items={[[1, 'Baixa'], [2, 'Normal'], [3, 'Alta']]} value={c.libido} onPick={(v) => set('libido', v)} />
        {!hormonal && (
          <>
            <p className="small mute" style={{ margin: '10px 0 4px' }}>Teste de ovulação</p>
            <Chips label="Teste de ovulação" items={[['+', 'Positivo'], ['-', 'Negativo']]} value={c.ovt} onPick={(v) => set('ovt', v)} />
          </>
        )}
        <p className="small mute" style={{ margin: '10px 0 4px' }}>Teste de gravidez</p>
        <Chips label="Teste de gravidez" items={[['+', 'Positivo'], ['-', 'Negativo']]} value={c.pt} onPick={(v) => set('pt', v)} />
        {c.p && (
          <>
            <p className="small mute" style={{ margin: '10px 0 4px' }}>Produtos usados</p>
            <div className="chips">
              {PRODUCTS.map((x) => {
                const on = (c.prod ?? []).includes(x);
                return <button key={x} className={`chip sm ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => toggleIn('prod', x)}>{x}</button>;
              })}
            </div>
          </>
        )}
      </details>
    </section>
  );
}

/** Pílula: lembrete diário (pela Medicação, só a hora sai do telemóvel) e marcar a toma de hoje. */
function PillCard() {
  const { S, update, updateToday, todayLog } = useStore();
  const med = (S.care?.meds ?? []).find((m) => m.id === 'pilula');
  const [time, setTime] = useState('21:00');
  if (!med)
    return (
      <div className="row" style={{ gap: 8, justifyContent: 'flex-start', marginTop: 10, flexWrap: 'wrap' }}>
        <span className="small">💊 Lembrete diário da pílula às</span>
        <input className="field sm" type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Hora da pílula" />
        <button className="btn sm" onClick={() => update((d) => { d.care = { ...(d.care ?? {}), meds: [...(d.care?.meds ?? []), { id: 'pilula', name: 'Pílula', kind: 'medicamento', times: [time], active: true }] }; })}>Criar</button>
      </div>
    );
  const t = med.times[0];
  const taken = !!todayLog.meds?.[doseKey('pilula', t)];
  return (
    <div className="row" style={{ gap: 8, justifyContent: 'flex-start', marginTop: 10, flexWrap: 'wrap' }}>
      <button className={`btn ${taken ? 'ghost' : ''} sm`} onClick={() => updateToday((d) => { d.meds = { ...(d.meds ?? {}), [doseKey('pilula', t)]: !taken }; })}>
        {taken ? '✓ Pílula de hoje tomada' : `💊 Marcar a pílula de hoje (${t})`}
      </button>
      <span className="small mute">Lembrete {med.active ? 'ativo' : 'em pausa'} · gerir em Cuidados → Medicação (pode pausar na semana de descanso).</span>
    </div>
  );
}

/** Objetivo, método contracetivo, durações por defeito e avisos. */
export function CycleSettings() {
  const { S, update } = useStore();
  const w = S.women ?? { mode: 'ciclo' as const };
  const n = w.notif ?? {};
  const set = (fn: (x: NonNullable<typeof S.women>) => void) => update((d) => { const x = { ...(d.women ?? { mode: 'ciclo' as const }) }; fn(x); d.women = x; });
  const setN = (k: keyof NonNullable<typeof w.notif>, v: boolean | string) => set((x) => { x.notif = { ...(x.notif ?? {}), [k]: v }; });
  const method = methodOf(S);
  const hormonal = isHormonal(S);
  const fertileOn = n.fertile ?? w.goal === 'engravidar';
  return (
    <section className="card">
      <details>
        <summary><b>Objetivo, método e avisos</b> <span className="small mute">· {GOALS.find(([k]) => k === (w.goal ?? 'acompanhar'))![1]} · {methodLabel(method)}</span></summary>
        <p className="small mute" style={{ margin: '10px 0 4px' }}>O que procura</p>
        <Chips label="Objetivo" items={GOALS} value={w.goal ?? 'acompanhar'} onPick={(v) => set((x) => { x.goal = v ?? 'acompanhar'; })} />
        {w.goal === 'evitar' && <p className="small warn" style={{ margin: '6px 0 0' }}>⚠️ A app não é um método contracetivo: as datas são estimativas. Use sempre um método fiável.</p>}
        {w.goal === 'engravidar' && <p className="small mute" style={{ margin: '6px 0 0' }}>A janela fértil ganha destaque e recebe um aviso quando começa. Fale com o médico sobre o ácido fólico antes de engravidar.</p>}
        <p className="small mute" style={{ margin: '12px 0 4px' }}>Método contracetivo</p>
        <select className="field sm" value={method} aria-label="Método contracetivo" onChange={(e) => set((x) => { x.method = e.target.value as Method; })}>
          {METHODS.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
        </select>
        {hormonal && <p className="small mute" style={{ margin: '6px 0 0' }}>Com um método hormonal não há ovulação a prever: a app mostra os sangramentos, sintomas e humor, sem fases nem janela fértil.</p>}
        {method === 'pilula' && <PillCard />}
        <p className="small mute" style={{ margin: '12px 0 4px' }}>Sem histórico, a app usa estas durações</p>
        <div className="row" style={{ gap: 8, justifyContent: 'flex-start' }}>
          <label className="small">Ciclo <input className="field sm" style={{ width: 64 }} type="number" min={18} max={60} value={w.cycleLen ?? 28} onChange={(e) => set((x) => { x.cycleLen = Math.max(18, Math.min(60, Number(e.target.value) || 28)); })} /> dias</label>
          <label className="small">Menstruação <input className="field sm" style={{ width: 56 }} type="number" min={1} max={12} value={w.periodLen ?? 5} onChange={(e) => set((x) => { x.periodLen = Math.max(1, Math.min(12, Number(e.target.value) || 5)); })} /> dias</label>
        </div>
        <p className="small mute" style={{ margin: '12px 0 4px' }}>Avisos no telemóvel</p>
        {!S.notifications && <p className="small warn" style={{ margin: '0 0 6px' }}>Ative as notificações no Perfil para receber estes avisos.</p>}
        <div className="chips">
          <button className={`chip sm ${n.period !== false ? 'on' : ''}`} aria-pressed={n.period !== false} onClick={() => setN('period', n.period === false)}>Menstruação a chegar (2 dias antes)</button>
          {!hormonal && <button className={`chip sm ${fertileOn ? 'on' : ''}`} aria-pressed={fertileOn} onClick={() => setN('fertile', !fertileOn)}>Início da janela fértil</button>}
          <button className={`chip sm ${n.late !== false ? 'on' : ''}`} aria-pressed={n.late !== false} onClick={() => setN('late', n.late === false)}>Atraso de 3 dias</button>
          <button className={`chip sm ${n.plain ? 'on' : ''}`} aria-pressed={!!n.plain} onClick={() => setN('plain', !n.plain)}>Mostrar detalhes na notificação</button>
        </div>
        <label className="small" style={{ display: 'block', marginTop: 8 }}>Hora dos avisos <input className="field sm" type="time" value={n.time ?? '09:00'} onChange={(e) => setN('time', e.target.value || '09:00')} /></label>
        <p className="small mute" style={{ margin: '6px 0 0' }}>Por defeito, a notificação diz só "Lembrete do seu ciclo", para quem vê o ecrã não perceber do que se trata.</p>
      </details>
    </section>
  );
}

/** O que a app percebeu (padrões) e sinais para falar com o médico. */
export function CycleInsights() {
  const { S } = useStore();
  const alerts = cycleAlerts(S);
  const ins = cycleInsights(S);
  const phases = byPhase(S);
  const p = predict(S);
  return (
    <>
      {alerts.length > 0 && (
        <section className="card warn-card">
          <h2 style={{ marginTop: 0 }}>A falar com o médico</h2>
          {alerts.map((a) => <p key={a.id} className="small" style={{ margin: '0 0 8px' }}>• {a.text}</p>)}
          <p className="small mute" style={{ margin: 0 }}>A app não faz diagnósticos: estes sinais servem para levar à consulta. O relatório do ciclo (em baixo) ajuda.</p>
        </section>
      )}
      <section className="card">
        <h2 style={{ marginTop: 0 }}>O que a app percebeu</h2>
        {ins.length ? ins.map((t) => <p key={t} className="small" style={{ margin: '0 0 6px' }}>• {t}</p>) : <p className="small mute" style={{ margin: 0 }}>Com dois ciclos registados e o check-in diário (sono, energia, humor e treino), a app mostra os seus padrões: quando dorme pior, quando tem mais energia, o que alivia a dor.</p>}
        {!isHormonal(S) && phases && phases.some((x) => x.energy !== null) && (
          <table className="mydata small" style={{ marginTop: 8 }}>
            <tbody>
              <tr><td></td><td><b>Energia</b> (1–5)</td><td><b>Sono</b></td></tr>
              {phases.map((x) => (
                <tr key={x.phase} className={p?.phase === x.phase ? 'now' : ''}>
                  <td>{PHASE_LABEL[x.phase as Phase]}</td>
                  <td>{x.energy !== null ? fmtNum(x.energy) : '—'}</td>
                  <td>{x.sleep !== null ? `${fmtNum(x.sleep)} h` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}

/** Histórico: duração média, variação, regularidade e lista dos ciclos; relatório para a consulta. */
export function CycleHistory({ onPrint }: { onPrint: () => void }) {
  const { S } = useStore();
  const st = cycleStats(S);
  const h = cycleHistory(S).slice(-12).reverse();
  const maxLen = Math.max(35, ...(st?.lens ?? []));
  return (
    <section className="card">
      <h2 style={{ marginTop: 0 }}>Os seus ciclos</h2>
      {st ? (
        <>
          <div className="cyc-stats">
            <div><b>{fmtNum(st.mean)}</b><span className="small mute">dias em média</span></div>
            <div><b>{st.max - st.min} {st.max - st.min === 1 ? 'dia' : 'dias'}</b><span className="small mute">de variação ({st.min}–{st.max})</span></div>
            <div><b>{st.period}</b><span className="small mute">dias de menstruação</span></div>
          </div>
          <p className="small" style={{ margin: '8px 0' }}>
            {st.regular === null ? `Com ${st.n} ${st.n === 1 ? 'ciclo' : 'ciclos'} ainda é cedo para falar de regularidade.` : st.regular ? '✓ Ciclos regulares (variação até 7 dias).' : 'Ciclos variáveis (mais de 7 dias de diferença).'}
          </p>
          <div className="cyc-bars" role="img" aria-label={`Duração dos últimos ${st.lens.length} ciclos: ${st.lens.join(', ')} dias`}>
            {st.lens.map((l, i) => (
              <span key={i} style={{ height: `${(l / maxLen) * 100}%` }} className={l < 21 || l > 35 ? 'out' : ''}><small>{l}</small></span>
            ))}
          </div>
        </>
      ) : (
        <p className="small mute" style={{ margin: 0 }}>Depois de dois inícios de menstruação registados, aparecem aqui a duração de cada ciclo, a média e a regularidade.</p>
      )}
      {h.length > 0 && (
        <table className="mydata small" style={{ marginTop: 10 }}>
          <tbody>
            <tr><td><b>Início</b></td><td><b>Ciclo</b></td><td><b>Menstruação</b></td></tr>
            {h.map((c) => (
              <tr key={c.start}>
                <td>{shortDate(c.start)}</td>
                <td>{c.len ? `${c.len} dias` : 'atual'}</td>
                <td>{c.period} {c.period === 1 ? 'dia' : 'dias'}{c.maxPain >= 7 ? ' · dor forte' : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <button className="btn ghost sm" style={{ marginTop: 10 }} onClick={onPrint}>📄 Relatório do ciclo para a consulta (PDF)</button>
    </section>
  );
}

/** Relatório para imprimir ou guardar em PDF (vai para fora da app, só para impressão). */
export function CyclePrint() {
  const { S } = useStore();
  const st = cycleStats(S);
  const h = cycleHistory(S).slice(-12);
  const alerts = cycleAlerts(S);
  const ins = cycleInsights(S);
  const sy: Record<string, number> = {};
  for (const c of h.slice(-3)) for (const [s, n] of c.symptoms) sy[s] = (sy[s] ?? 0) + n;
  const meds = (S.care?.meds ?? []).filter((m) => m.active);
  const now = new Date();
  return createPortal(
    <div className="print-report">
      <header className="pr-head">
        <img src={`${import.meta.env.BASE_URL}brand/logo-header.png`} alt="nefesh" width={130} height={30} />
        <div>
          <b>Relatório do ciclo menstrual</b>
          <span>{now.toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
        </div>
      </header>
      <h2>{S.ans?.name ?? ''}</h2>
      <p className="pr-small">Método contracetivo: {methodLabel(methodOf(S))} · Objetivo: {GOALS.find(([k]) => k === (S.women?.goal ?? 'acompanhar'))![1]}</p>
      {st && (
        <section>
          <h3>Resumo</h3>
          <p>Duração média do ciclo: <b>{fmtNum(st.mean)} dias</b> (de {st.min} a {st.max}; {st.n} ciclos) · menstruação de cerca de <b>{st.period} dias</b> · {st.regular === null ? 'poucos ciclos para avaliar a regularidade' : st.regular ? 'regulares' : 'variáveis'}</p>
        </section>
      )}
      <section>
        <h3>Ciclos</h3>
        <table className="pr-table">
          <thead><tr><th>Início</th><th>Ciclo</th><th>Menstruação</th><th>Fluxo máx.</th><th>Dor máx.</th><th>Sintomas mais frequentes</th></tr></thead>
          <tbody>
            {h.map((c) => (
              <tr key={c.start}>
                <td>{pk(c.start).toLocaleDateString('pt-PT')}</td>
                <td>{c.len ? `${c.len} d` : 'atual'}</td>
                <td>{c.period} d</td>
                <td>{FLOW_LABEL[c.maxFlow] || '—'}{c.heavyDays ? ` (${c.heavyDays} d muito intenso)` : ''}</td>
                <td>{c.maxPain ? `${c.maxPain}/10` : '—'}</td>
                <td>{c.symptoms.slice(0, 3).map(([s]) => s).join(', ') || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {Object.keys(sy).length > 0 && (
        <section>
          <h3>Sintomas nos últimos 3 ciclos (dias registados)</h3>
          <p>{Object.entries(sy).sort((a, b) => b[1] - a[1]).map(([s, n]) => `${s} (${n})`).join(' · ')}</p>
        </section>
      )}
      {(alerts.length > 0 || ins.length > 0) && (
        <section>
          <h3>Observações da app</h3>
          <ul>{[...alerts.map((a) => a.text), ...ins].map((t) => <li key={t}>{t}</li>)}</ul>
        </section>
      )}
      {meds.length > 0 && (
        <section>
          <h3>Medicação e suplementos registados</h3>
          <p>{meds.map((m) => `${m.name}${m.dose ? ` ${m.dose}` : ''}`).join(' · ')}</p>
        </section>
      )}
      <p className="pr-foot">Registos feitos pela própria pessoa na app NEFESH Life. As fases e a janela fértil são estimativas e não substituem a avaliação clínica.</p>
    </div>,
    document.body,
  );
}

/** Dica de treino ou alimentação para a fase do ciclo de hoje (Treino e Nutrição). */
export function PhaseHint({ kind, go }: { kind: 'train' | 'food'; go?: () => void }) {
  const { S } = useStore();
  if (!showWomen(S)) return null;
  const a = phaseAdvice(S);
  if (!a) return null;
  return (
    <section className="card phase-hint">
      <p className="small" style={{ margin: 0 }}>
        🌸 <b>Dia {a.day} do ciclo.</b> {kind === 'train' ? a.train : a.food}
        {go && <> <button className="link small inline" onClick={go}>Ver o ciclo</button></>}
      </p>
    </section>
  );
}
