import { useEffect, useState } from 'react';
import { Bar } from '../components/Charts';
import { CycleCalendar, CycleDay, CycleHero, CycleHistory, CycleInsights, CyclePrint, CycleSettings } from '../components/Cycle';
import { fmtNum, shortDate, todayKey } from '../domain/dates';
import { MENO_SYMPTOMS, PREG_SYMPTOMS, TRIMESTER_TIP, menoSleep, predict, pregnancy, topSymptoms, type WomenMode } from '../domain/women';
import { requestListen } from '../domain/voice';
import type { Nav } from '../App';
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

function CycleView({ go }: { go: Nav }) {
  const { S, update } = useStore();
  const [sel, setSel] = useState(todayKey());
  const [printing, setPrinting] = useState(false);
  const [first, setFirst] = useState('');
  useEffect(() => {
    if (!printing) return;
    const done = () => setPrinting(false);
    window.addEventListener('afterprint', done);
    const t = setTimeout(() => window.print(), 300);
    return () => { clearTimeout(t); window.removeEventListener('afterprint', done); };
  }, [printing]);
  const known = !!predict(S);
  return (
    <>
      {printing && <CyclePrint />}
      {known ? (
        <CycleHero onAsk={() => { requestListen(); go('coach'); }} />
      ) : (
        <section className="card hero">
          <h2 style={{ margin: '4px 0 6px' }}>Quando começou a última menstruação?</h2>
          <div className="row" style={{ gap: 8, justifyContent: 'flex-start' }}>
            <input className="field sm" type="date" max={todayKey()} value={first} onChange={(e) => setFirst(e.target.value)} aria-label="Início da última menstruação" />
            <button className="btn sm" disabled={!first} onClick={() => update((d) => { d.women = { ...(d.women ?? { mode: 'ciclo' }), lastStart: first }; })}>Guardar</button>
          </div>
          <p className="small" style={{ margin: '8px 0 0', opacity: 0.85 }}>Ou marque os dias no calendário em baixo.</p>
        </section>
      )}
      <CycleCalendar selected={sel} onSelect={setSel} />
      <CycleDay k={sel} />
      <CycleInsights />
      <CycleHistory onPrint={() => setPrinting(true)} />
      <CycleSettings />
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
export function Women({ go }: { go: Nav }) {
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
      {mode === 'gravidez' ? <PregnancyView /> : mode === 'menopausa' ? <MenopauseView /> : <CycleView go={go} />}
      <p className="small mute">
        Estes dados ficam no seu telemóvel (e na sua conta, se tiver uma) e nunca aparecem na comunidade nem são partilhados. As datas são estimativas gerais: não servem como método contracetivo nem substituem a consulta. Dores fortes, sangramentos fora do habitual ou sintomas que preocupam: fale com o seu médico.
        {' '}
        <button className="link small inline" onClick={() => update((d) => { d.women = { ...(d.women ?? { mode: 'ciclo' }), mode: 'nao', show: false }; })}>Esconder este separador</button>
      </p>
    </>
  );
}

