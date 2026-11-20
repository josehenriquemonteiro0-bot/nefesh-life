import { useState } from 'react';
import { Bar } from '../components/Charts';
import { fmtNum, longToday, shortDate, todayKey } from '../domain/dates';
import {
  CYCLE_SYMPTOMS, MENO_SYMPTOMS, PHASE_LABEL, PHASE_TIP, PREG_SYMPTOMS, TRIMESTER_TIP, byPhase, cycleDay, menoSleep, periodStarts, pregnancy, topSymptoms, type Phase, type WomenMode,
} from '../domain/women';
import { useStore } from '../state/store';

const MODES: [WomenMode, string, string][] = [
  ['ciclo', 'Ciclo menstrual', '🌸'],
  ['gravidez', 'Gravidez', '🤰'],
  ['menopausa', 'Menopausa', '🌙'],
];

/** Sintomas de hoje (toque para marcar). */
function Symptoms({ list }: { list: string[] }) {
  const { todayLog: l, updateToday } = useStore();
  const sy = l.cycle?.sy ?? [];
  return (
    <div className="chips">
      {list.map((s) => {
        const on = sy.includes(s);
        return (
          <button
            key={s}
            className={`chip sm ${on ? 'on' : ''}`}
            aria-pressed={on}
            onClick={() => updateToday((d) => {
              const cur = d.cycle?.sy ?? [];
              d.cycle = { ...(d.cycle ?? {}), sy: on ? cur.filter((x) => x !== s) : [...cur, s] };
            })}
          >
            {s}
          </button>
        );
      })}
    </div>
  );
}

function CycleView() {
  const { S, todayLog: l, updateToday, update } = useStore();
  const c = cycleDay(S);
  const phases = byPhase(S);
  const starts = periodStarts(S);
  const onPeriod = !!l.cycle?.p;
  const [first, setFirst] = useState('');
  return (
    <>
      <section className="card hero">
        <p className="small" style={{ margin: 0, opacity: 0.8 }}>{longToday()}</p>
        {c ? (
          <>
            <h2 style={{ margin: '4px 0 2px' }}>Dia {c.day} do ciclo · {PHASE_LABEL[c.phase]}</h2>
            <p className="small" style={{ margin: '0 0 8px', opacity: 0.85 }}>
              Próxima menstruação prevista: <b>{shortDate(c.next)}</b> ({c.inDays <= 0 ? 'a qualquer momento' : `daqui a ${c.inDays} ${c.inDays === 1 ? 'dia' : 'dias'}`}) · ciclo de ~{c.len} dias
            </p>
            <Bar pct={(c.day / c.len) * 100} />
            <p className="small" style={{ margin: '8px 0 0' }}>{PHASE_TIP[c.phase]}</p>
          </>
        ) : (
          <>
            <h2 style={{ margin: '4px 0 6px' }}>Quando começou a última menstruação?</h2>
            <div className="row" style={{ gap: 8, justifyContent: 'flex-start' }}>
              <input className="field sm" type="date" max={todayKey()} value={first} onChange={(e) => setFirst(e.target.value)} aria-label="Início da última menstruação" />
              <button className="btn sm" disabled={!first} onClick={() => update((d) => { d.women = { ...(d.women ?? { mode: 'ciclo' }), lastStart: first }; })}>Guardar</button>
            </div>
          </>
        )}
        <button
          className={`btn ${onPeriod ? 'ghost' : ''} sm`}
          style={{ marginTop: 12 }}
          onClick={() => updateToday((d) => { d.cycle = { ...(d.cycle ?? {}), p: !onPeriod }; })}
        >
          {onPeriod ? '✓ Com menstruação hoje (tocar para tirar)' : '🩸 Estou com menstruação hoje'}
        </button>
        {onPeriod && (
          <div className="chips" role="group" aria-label="Fluxo" style={{ marginTop: 8 }}>
            {([1, 2, 3] as const).map((f) => (
              <button key={f} className={`chip sm ${l.cycle?.flow === f ? 'on' : ''}`} aria-pressed={l.cycle?.flow === f} onClick={() => updateToday((d) => { d.cycle = { ...(d.cycle ?? {}), flow: f }; })}>
                {['', 'Fluxo leve', 'Moderado', 'Intenso'][f]}
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>Como se sente hoje?</h2>
        <Symptoms list={CYCLE_SYMPTOMS} />
      </section>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>Energia e sono ao longo do ciclo</h2>
        {phases && phases.some((p) => p.energy !== null) ? (
          <table className="mydata small">
            <tbody>
              <tr><td></td><td><b>Energia</b> (1–5)</td><td><b>Sono</b></td></tr>
              {phases.map((p) => (
                <tr key={p.phase} className={c?.phase === p.phase ? 'now' : ''}>
                  <td>{PHASE_LABEL[p.phase as Phase]}</td>
                  <td>{p.energy !== null ? fmtNum(p.energy) : '—'}</td>
                  <td>{p.sleep !== null ? `${fmtNum(p.sleep)} h` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="small mute" style={{ margin: 0 }}>Marque os dias de menstruação e faça o check-in: ao fim de um ou dois ciclos, a app mostra como a sua energia e o sono mudam em cada fase.</p>
        )}
        {starts.length > 0 && <p className="small mute" style={{ margin: '8px 0 0' }}>Últimos inícios: {starts.slice(-4).map(shortDate).join(' · ')}</p>}
      </section>
    </>
  );
}

function PregnancyView() {
  const { S, update } = useStore();
  const p = pregnancy(S.women?.due);
  const [due, setDue] = useState(S.women?.due ?? '');
  return (
    <>
      <section className="card hero">
        {p ? (
          <>
            <p className="small" style={{ margin: 0, opacity: 0.8 }}>{p.trimester}.º trimestre</p>
            <h2 style={{ margin: '4px 0 2px' }}>Semana {p.week}{p.days ? ` e ${p.days} ${p.days === 1 ? 'dia' : 'dias'}` : ''}</h2>
            <p className="small" style={{ margin: '0 0 8px', opacity: 0.85 }}>Faltam cerca de {p.toGo} dias para a data prevista ({shortDate(S.women!.due!)}).</p>
            <Bar pct={(p.week / 40) * 100} />
            <p className="small" style={{ margin: '8px 0 0' }}>{TRIMESTER_TIP[p.trimester]}</p>
          </>
        ) : (
          <h2 style={{ margin: '4px 0 6px' }}>Qual é a data prevista do parto?</h2>
        )}
        <div className="row" style={{ gap: 8, justifyContent: 'flex-start', marginTop: 10 }}>
          <input className="field sm" type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Data prevista do parto" />
          <button className="btn ghost sm" disabled={!due} onClick={() => update((d) => { d.women = { ...(d.women ?? { mode: 'gravidez' }), due }; })}>Guardar</button>
        </div>
      </section>
      <section className="card warn-card">
        <p className="small" style={{ margin: 0 }}>
          🌿 <b>Spirulina, suplementos e medicação na gravidez e na amamentação:</b> só com a indicação do seu médico ou da sua parteira. A app não ajusta a dose sozinha.
        </p>
      </section>
      <section className="card">
        <h2 style={{ marginTop: 0 }}>Como se sente hoje?</h2>
        <Symptoms list={PREG_SYMPTOMS} />
      </section>
    </>
  );
}

function MenopauseView() {
  const { S } = useStore();
  const ms = menoSleep(S);
  const top = topSymptoms(S, 30).slice(0, 4);
  return (
    <>
      <section className="card hero">
        <h2 style={{ margin: '0 0 6px' }}>Menopausa e perimenopausa</h2>
        <p className="small" style={{ margin: 0, opacity: 0.9 }}>
          Registe os sintomas de cada dia: a app liga-os ao sono e à energia e mostra-lhe o que mais mexe consigo. Um relatório com esta evolução ajuda muito na consulta.
        </p>
      </section>
      <section className="card">
        <h2 style={{ marginTop: 0 }}>Hoje</h2>
        <Symptoms list={MENO_SYMPTOMS} />
      </section>
      <section className="card">
        <h2 style={{ marginTop: 0 }}>O que a app percebeu</h2>
        {ms ? (
          <p className="small" style={{ margin: 0 }}>
            Nas noites com afrontamentos ou suores dorme <b>{fmtNum(ms.with)} h</b>; sem eles, <b>{fmtNum(ms.without)} h</b>. Quarto fresco, roupa leve, menos álcool e cafeína à noite e uma rotina calma antes de deitar costumam ajudar.
          </p>
        ) : (
          <p className="small mute" style={{ margin: 0 }}>Com uma ou duas semanas de registos (sintomas e horas de sono), a app mostra como os sintomas afetam o seu sono.</p>
        )}
        {top.length > 0 && <p className="small mute" style={{ margin: '8px 0 0' }}>Mais frequentes nos últimos 30 dias: {top.map(([s, n]) => `${s} (${n})`).join(' · ')}</p>}
      </section>
    </>
  );
}

/** Saúde da mulher: ciclo, gravidez e menopausa. */
export function Women() {
  const { S, update } = useStore();
  const mode = S.women?.mode ?? 'ciclo';
  return (
    <>
      <h1>Saúde da mulher</h1>
      <div className="seg seg-wide" style={{ gridTemplateColumns: 'repeat(3,minmax(0,1fr))', marginBottom: 14 }} role="group" aria-label="Fase da vida">
        {MODES.map(([k, t, icon]) => (
          <button key={k} className={mode === k ? 'on' : ''} aria-pressed={mode === k} onClick={() => update((d) => { d.women = { ...(d.women ?? {}), mode: k }; })}>
            {icon} {t}
          </button>
        ))}
      </div>
      {mode === 'gravidez' ? <PregnancyView /> : mode === 'menopausa' ? <MenopauseView /> : <CycleView />}
      <p className="small mute">
        Estes dados ficam só no seu telemóvel e na sua conta, e nunca aparecem na comunidade. As datas são estimativas gerais: não servem como método contracetivo nem substituem a consulta. Dores fortes, sangramentos fora do habitual ou sintomas que preocupam: fale com o seu médico.
        {' '}
        <button className="link small inline" onClick={() => update((d) => { d.women = { ...(d.women ?? { mode: 'ciclo' }), mode: 'nao', show: false }; })}>Esconder este separador</button>
      </p>
    </>
  );
}

