import { Columns } from '../components/Charts';
import { DecimalInput } from '../components/DecimalInput';
import { PremiumTag } from '../components/PremiumTag';
import { fmtNum, keyDaysAgo, longToday } from '../domain/dates';
import { canAccess } from '../domain/features';
import { useStore } from '../state/store';
import { SourceTag } from '../components/SourceTag';
import { setSource, sourceCount, sourceSummary } from '../domain/sources';

const CHIPS = [5, 6, 7, 8, 9];
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** Sono: horas da última noite, as últimas 2 semanas e a regularidade (tendências: Premium). */
export function Sleep() {
  const { S, todayLog: l, updateToday } = useStore();
  const days = (n: number) => Array.from({ length: n }, (_, i) => S.logs[keyDaysAgo(n - 1 - i)]);
  const last14 = days(14).map((x) => x?.sleepH);
  const known = last14.filter((v): v is number => v !== undefined);
  const avg = mean(known);
  const sd = known.length >= 3 && avg !== null ? Math.sqrt(mean(known.map((v) => (v - avg) ** 2))!) : null;
  const regular = sd === null ? null : sd <= 0.75 ? 'regular' : sd <= 1.5 ? 'pouco regular' : 'irregular';
  // tendência: sono e energia (30 dias)
  const d30 = days(30).filter((x) => x?.sleepH !== undefined && x?.e);
  const good = mean(d30.filter((x) => x!.sleepH! >= 7).map((x) => x!.e!));
  const bad = mean(d30.filter((x) => x!.sleepH! < 7).map((x) => x!.e!));
  const set = (v: number | undefined) => updateToday((d) => { if (v === undefined) delete d.sleepH; else d.sleepH = Math.max(0, Math.min(16, Math.round(v * 2) / 2)); setSource(d, 'sleepH', null); });

  return (
    <>
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
          {l.sleepH === undefined ? 'Toque nas horas ou escreva o valor exato. Com o relógio ligado ao app Saúde, chega sozinho.' : l.sleepH >= 7 ? 'Boa noite de sono. 🌙' : 'Abaixo de 7 horas: tente deitar-se um pouco mais cedo hoje.'}
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

      <section className="card">
        <div className="row"><h2 style={{ margin: 0 }}>Sono e energia</h2><PremiumTag f="sonoTendencias" /></div>
        {canAccess(S, 'sonoTendencias') ? (
          good !== null && bad !== null ? (
            <p className="small" style={{ margin: '8px 0 0' }}>
              Nas noites com 7 horas ou mais, a sua energia foi <b>{fmtNum(Math.round(good * 10) / 10)}</b> em 5; nas mais curtas, <b>{fmtNum(Math.round(bad * 10) / 10)}</b>. (Últimos 30 dias, observação sobre si, não avaliação clínica.)
            </p>
          ) : (
            <p className="small mute" style={{ margin: '8px 0 0' }}>Com algumas noites curtas e longas registadas, e o check-in da energia, mostramos aqui a relação entre o seu sono e a sua energia.</p>
          )
        ) : (
          <p className="small mute">No Premium vê a relação entre o seu sono, a energia e o ritual.</p>
        )}
      </section>

      <section className="card tip">
        <p className="small gold" style={{ margin: '0 0 4px', fontWeight: 700 }}>Para dormir melhor</p>
        <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
          <li>Deite-se e levante-se à mesma hora, também ao fim de semana.</li>
          <li>Evite cafeína depois das 15h e ecrãs na última meia hora.</li>
          <li>Quarto escuro, fresco e silencioso.</li>
        </ul>
        <p className="small mute" style={{ margin: '8px 0 0' }}>Se o sono estiver muito alterado durante semanas, fale com um profissional de saúde.</p>
      </section>
    </>
  );
}
