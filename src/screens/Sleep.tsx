import { useState } from 'react';
import { Columns } from '../components/Charts';
import { SleepDiaryCard } from '../components/sleep/SleepDiaryCard';
import { SleepTools } from '../components/sleep/SleepTools';
import { SleepRitual, takeRitualRequest } from '../components/sleep/SleepRitual';
import { IntegrativeCard, SleepFlagsCard, SleepPatternsCard, SleepProgramCard, SleepScheduleCard } from '../components/sleep/SleepCards';
import { usePractice } from '../components/sleep/usePractice';
import type { Nav } from '../App';
import { DecimalInput } from '../components/DecimalInput';
import { fmtNum, keyDaysAgo, longToday } from '../domain/dates';
import { useStore } from '../state/store';
import { SourceTag } from '../components/SourceTag';
import { setSource, sourceCount, sourceSummary } from '../domain/sources';

const CHIPS = [5, 6, 7, 8, 9];
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

/**
 * Sono: horas da última noite e diário do sono, ritual da noite, técnicas para adormecer,
 * programa "Dormir melhor em 14 dias", padrões pessoais, práticas integrativas e sinais de alerta.
 */
export function Sleep({ go }: { go?: Nav }) {
  const { S, todayLog: l, updateToday } = useStore();
  const [ritual, setRitual] = useState(takeRitualRequest);
  const practice = usePractice();
  const days = (n: number) => Array.from({ length: n }, (_, i) => S.logs[keyDaysAgo(n - 1 - i)]);
  const last14 = days(14).map((x) => x?.sleepH);
  const known = last14.filter((v): v is number => v !== undefined);
  const avg = mean(known);
  const sd = known.length >= 3 && avg !== null ? Math.sqrt(mean(known.map((v) => (v - avg) ** 2))!) : null;
  const regular = sd === null ? null : sd <= 0.75 ? 'regular' : sd <= 1.5 ? 'pouco regular' : 'irregular';
  const set = (v: number | undefined) => updateToday((d) => { if (v === undefined) delete d.sleepH; else d.sleepH = Math.max(0, Math.min(16, Math.round(v * 2) / 2)); setSource(d, 'sleepH', null); });

  return (
    <>
      {ritual && <SleepRitual onClose={() => setRitual(false)} />}
      {practice.node}
      <section className="card hero">
        <p className="small" style={{ margin: 0, opacity: 0.8 }}>{longToday()}</p>
        <h2 style={{ margin: '4px 0 10px' }}>Quantas horas dormiu esta noite?</h2>
        <div className="chips">
          {CHIPS.map((h) => (
            <button key={h} className={`chip ${l.sleepH === h ? 'on' : ''}`} aria-pressed={l.sleepH === h} onClick={() => set(l.sleepH === h ? undefined : h)}>{h === 9 ? '9+' : h} h</button>
          ))}
          <label className="hin" style={{ width: 92 }}>
            <span>outro</span>
            <DecimalInput placeholder="7,5" value={l.sleepH !== undefined && !CHIPS.includes(l.sleepH) ? l.sleepH : undefined} aria-label="Horas de sono exatas" onValue={set} />
          </label>
        </div>
        <p className="small" style={{ margin: '10px 0 0', opacity: 0.85 }}>
          {l.sleepH === undefined ? 'Toque nas horas ou escreva o valor exato. Com o relógio ligado ao app Saúde, chega sozinho.' : l.sleepH >= 7 ? 'Boa noite de sono. 🌙' : 'Abaixo de 7 horas. Mantenha a hora de acordar e, à noite, deite-se quando tiver sono: o ritual da noite ajuda.'}
        </p>
        {l.sleepH !== undefined && <p style={{ margin: '8px 0 0' }}><SourceTag l={l} f="sleepH" /></p>}
      </section>

      <section className="card">
        <div className="row"><h2 style={{ margin: 0 }}>Últimas 2 semanas</h2><span className="small mute">meta 7 h</span></div>
        {known.length ? (
          <>
            <Columns values={last14.map((v) => v ?? 0)} goal={7} label={(v) => `${fmtNum(v)} h`} />
            <p className="small" style={{ margin: '8px 0 0' }}>
              Média: <b>{fmtNum(Math.round(avg! * 10) / 10)} h</b>
              {regular ? <> · horário <b>{regular}</b></> : null}
            </p>
            <p className="small mute" style={{ margin: '4px 0 0' }}>Origem: {sourceSummary(sourceCount(S, 'sleepH', 14))}.</p>
          </>
        ) : (
          <p className="small mute">Ainda sem registos. Escreva as horas acima ou no check-in.</p>
        )}
      </section>

      <SleepDiaryCard id="sono-diario" />
      <SleepScheduleCard onRitual={() => setRitual(true)} />
      <SleepTools />
      <SleepProgramCard onPractice={practice.start} onRitual={() => setRitual(true)} onDiary={() => scrollTo('sono-diario')} onFlags={() => scrollTo('sono-alerta')} />
      <SleepPatternsCard />
      <IntegrativeCard />
      <SleepFlagsCard id="sono-alerta" onPros={go ? () => go('pros') : undefined} />

      <section className="card tip">
        <p className="small gold" style={{ margin: '0 0 4px', fontWeight: 700 }}>Para dormir melhor</p>
        <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
          <li>Deite-se e levante-se à mesma hora, também ao fim de semana.</li>
          <li>Luz natural de manhã; luzes baixas e ecrãs de lado na última hora antes de deitar.</li>
          <li>Última cafeína 8 horas antes de deitar; álcool e jantares pesados atrapalham o sono.</li>
          <li>Quarto escuro, fresco (18 a 20 °C) e silencioso; a cama é para dormir.</li>
          <li>Não adormece em 20 minutos? Levante-se, faça algo calmo e volte com sono.</li>
        </ul>
        <p className="small mute" style={{ margin: '8px 0 0' }}>Se o sono estiver muito alterado durante semanas, fale com um profissional de saúde (veja os sinais de alerta acima).</p>
      </section>
    </>
  );
}
