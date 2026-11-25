import { useState } from 'react';
import { diaryCalc, diaryReading, diaryStats, saveDiary, validTime, type SleepDiary } from '../../domain/sleep';
import { fmtNum } from '../../domain/dates';
import { useStore } from '../../state/store';

const LAT: [number, string][] = [[5, 'menos de 5 min'], [15, '15 min'], [30, '30 min'], [45, '45 min'], [60, '1 h ou mais']];
const WAKES: [number, string][] = [[0, 'nenhuma'], [1, '1 vez'], [2, '2 vezes'], [3, '3 ou mais']];
const WASO: [number, string][] = [[5, 'poucos minutos'], [15, '15 min'], [30, '30 min'], [60, '1 h'], [90, '1 h 30 ou mais']];
const QUAL = ['Muito mal', 'Mal', 'Assim-assim', 'Bem', 'Muito bem'];

/** Diário do sono da noite passada (TCC-I): horas de deitar e levantar, tempo a adormecer, acordares e qualidade. */
export function SleepDiaryCard({ id }: { id?: string }) {
  const { S, todayLog: l, updateToday, toast } = useStore();
  const saved = l.sleepD;
  const [open, setOpen] = useState(!saved);
  const [d, setD] = useState<SleepDiary>(() => saved ?? { bed: S.sleep?.bed, up: S.sleep?.wake });
  const calc = diaryCalc(d);
  const st = diaryStats(S);
  const reading = diaryReading(st);
  const set = (p: Partial<SleepDiary>) => setD((x) => ({ ...x, ...p }));
  const chip = <K extends 'lat' | 'wakes' | 'waso'>(k: K, list: [number, string][]) => (
    <div className="chips" role="group">
      {list.map(([v, t]) => (
        <button key={v} className={`chip sm ${d[k] === v ? 'on' : ''}`} aria-pressed={d[k] === v} onClick={() => set({ [k]: d[k] === v ? undefined : v } as Partial<SleepDiary>)}>{t}</button>
      ))}
    </div>
  );

  const save = () => {
    let c: ReturnType<typeof diaryCalc> = null;
    updateToday((x) => { c = saveDiary(x, { ...d, waso: d.wakes ? d.waso : 0 }); });
    setOpen(false);
    const r = c as ReturnType<typeof diaryCalc>;
    toast(r ? `Diário guardado: dormiu cerca de ${fmtNum(r.hours)} h, eficiência de ${r.eff}%. 🌙` : 'Diário guardado. 🌙');
  };

  const sc = diaryCalc(saved);
  return (
    <section className="card" id={id}>
      <div className="row">
        <h2 style={{ margin: 0 }}>📓 Diário do sono</h2>
        {saved && !open && <button className="link small inline" onClick={() => setOpen(true)}>Editar</button>}
      </div>
      {!open && saved ? (
        <p className="small" style={{ margin: '8px 0 0' }}>
          Esta noite: {saved.bed ?? '?'} → {saved.up ?? '?'}
          {sc ? <> · dormiu cerca de <b>{fmtNum(sc.hours)} h</b> · eficiência <b>{sc.eff}%</b></> : null}
          {saved.q ? <> · {QUAL[saved.q - 1].toLowerCase()}</> : null}
        </p>
      ) : (
        <>
          <p className="small mute" style={{ margin: '6px 0 10px' }}>30 segundos de manhã, sobre a noite passada. É a ferramenta base da terapia para a insónia: mostra o que acontece de verdade.</p>
          <div className="row" style={{ gap: 10, justifyContent: 'flex-start', flexWrap: 'wrap' }}>
            <label className="small time-field">
              Deitei-me às
              <input type="time" className="field sm" value={d.bed ?? ''} onChange={(e) => set({ bed: e.target.value || undefined })} />
            </label>
            <label className="small time-field">
              Levantei-me às
              <input type="time" className="field sm" value={d.up ?? ''} onChange={(e) => set({ up: e.target.value || undefined })} />
            </label>
          </div>
          <p className="small" style={{ margin: '10px 0 4px' }}>Quanto tempo demorei a adormecer</p>
          {chip('lat', LAT)}
          <p className="small" style={{ margin: '10px 0 4px' }}>Acordei durante a noite</p>
          {chip('wakes', WAKES)}
          {(d.wakes ?? 0) > 0 && (
            <>
              <p className="small" style={{ margin: '10px 0 4px' }}>Tempo acordado, ao todo</p>
              {chip('waso', WASO)}
            </>
          )}
          <p className="small" style={{ margin: '10px 0 4px' }}>Como dormi</p>
          <div className="chips" role="group" aria-label="Qualidade do sono">
            {QUAL.map((t, i) => (
              <button key={t} className={`chip sm ${d.q === i + 1 ? 'on' : ''}`} aria-pressed={d.q === i + 1} onClick={() => set({ q: d.q === i + 1 ? undefined : i + 1 })}>{t}</button>
            ))}
          </div>
          {calc && (
            <p className="small" style={{ margin: '10px 0 0' }}>
              Na cama {fmtNum(Math.round((calc.inBed / 60) * 10) / 10)} h · dormiu cerca de <b>{fmtNum(calc.hours)} h</b> · eficiência <b>{calc.eff}%</b>
            </p>
          )}
          <div className="row" style={{ gap: 8, justifyContent: 'flex-start', marginTop: 10 }}>
            <button className="btn sm" disabled={!validTime(d.bed) && !validTime(d.up) && d.lat === undefined && d.q === undefined} onClick={save}>Guardar</button>
            {saved && <button className="btn ghost sm" onClick={() => { setD(saved); setOpen(false); }}>Cancelar</button>}
          </div>
          {l.src?.sleepH && <p className="small mute" style={{ margin: '8px 0 0' }}>As horas de sono vêm do relógio; o diário acrescenta o resto.</p>}
        </>
      )}
      {st.nights >= 3 && (
        <div style={{ marginTop: 12 }}>
          <p className="small" style={{ margin: '0 0 4px' }}>
            <b>Últimas {st.nights} noites:</b>
            {st.eff !== null && <> eficiência {st.eff}% ·</>}
            {st.lat !== null && <> adormecer {st.lat} min ·</>}
            {st.wakes !== null && <> acordou {fmtNum(st.wakes)} vezes por noite ·</>}
            {st.upAvg && <> levantar ~{st.upAvg}</>}
          </p>
          {reading.map((t) => <p key={t} className="small mute" style={{ margin: '4px 0 0' }}>• {t}</p>)}
        </div>
      )}
    </section>
  );
}
