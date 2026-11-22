import { useRef, useState } from 'react';
import { bodySeries, saveEvals, type FullEval } from '../domain/bodyLog';
import { fmtNum, shortDate, todayKey } from '../domain/dates';
import { readHealthReport } from '../domain/pro';
import { MEASURES as PERIMETERS, type MeasureKey } from '../domain/proProfile';
import { useStore } from '../state/store';
import { DecimalInput } from './DecimalInput';

type Goals = { kcal: number | null; protein: number | null; by: string };
const BASIC: ['altura' | 'peso' | 'gordura' | 'magra' | 'fc', string, string][] = [
  ['altura', 'Altura', 'cm'], ['peso', 'Peso', 'kg'], ['gordura', '% de gordura', '%'], ['magra', 'Massa magra', 'kg'], ['fc', 'FC em repouso', 'bpm'],
];
const num = (v: number | null | undefined) => (typeof v === 'number' && v > 0 ? v : undefined);

/**
 * "Os seus dados estão certos?": ajuste manual com uma avaliação completa
 * ou leitura de um relatório de acompanhamento (nutricionista, médico, academia).
 */
export function BodyAdjust() {
  const { S, update, toast } = useStore();
  const file = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<FullEval>({ date: todayKey() });
  const [por, setPor] = useState('');
  const [older, setOlder] = useState<FullEval[]>([]);
  const [goals, setGoals] = useState<Goals | null>(null);
  const [useGoals, setUseGoals] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const a = S.ans;

  const startManual = () => {
    const last = [...bodySeries(S)].reverse();
    const pick = <K extends 'cintura' | 'anca' | 'pescoco'>(k: K) => last.find((e) => e[k] !== undefined)?.[k] ?? a?.[k];
    setF({
      date: todayKey(),
      altura: a?.altura, peso: last.find((e) => e.peso !== undefined)?.peso ?? a?.peso,
      gordura: a?.gorduraMedida, magra: a?.magraMedida,
      medidas: { cintura: pick('cintura'), quadril: pick('anca'), pescoco: pick('pescoco') },
    });
    setPor(a?.medidaPor ?? '');
    setOlder([]);
    setGoals(null);
    setErr(null);
    setOpen(true);
  };

  const readFile = async (fl: File) => {
    setBusy(true);
    setErr(null);
    try {
      const r = await readHealthReport(fl);
      const evals = (r.evals ?? []).map((e) => ({ ...e, date: e.date || todayKey() }));
      if (!r.found || (!evals.length && !r.kcal)) {
        setErr('Não encontrámos medidas neste documento. Pode preencher à mão.');
        return;
      }
      const newest = evals[evals.length - 1];
      setF(newest ?? { date: todayKey() });
      setOlder(evals.slice(0, -1));
      setPor(r.by ?? '');
      setGoals(r.kcal || r.protein ? { kcal: r.kcal ?? null, protein: r.protein ?? null, by: r.by ?? '' } : null);
      setUseGoals(true);
      setOpen(true);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    const fromReport = older.length > 0 || goals !== null;
    update((d) => {
      saveEvals(d, [...older, f], fromReport ? 'relatorio' : 'manual', por);
      if (goals && useGoals && (goals.kcal || goals.protein)) {
        d.nutriPro = { kcal: goals.kcal ?? undefined, protein: goals.protein ?? undefined, by: goals.by.trim() || por.trim() || 'o seu profissional', at: todayKey() };
      }
    });
    toast(older.length ? `Guardadas ${older.length + 1} avaliações no seu histórico.` : 'Dados ajustados. Os cálculos já usam estes números.');
    setOpen(false);
  };

  const setM = (k: MeasureKey, v: number | undefined) => setF({ ...f, medidas: { ...(f.medidas ?? {}), [k]: v } });
  const anything = [f.peso, f.altura, f.gordura, f.magra, f.fc, ...Object.values(f.medidas ?? {})].some((v) => num(v) !== undefined);

  return (
    <section className="card">
      <h2 style={{ marginTop: 0 }}>Os seus dados estão certos?</h2>
      {a?.gorduraMedida && a.medidaData ? (
        <p className="small" style={{ marginTop: 0 }}>
          ✓ A usar a sua avaliação de <b>{shortDate(a.medidaData)}</b>{a.medidaPor ? ` (${a.medidaPor})` : ''}: <b>{fmtNum(a.gorduraMedida)}%</b> de gordura{a.magraMedida ? ` · ${fmtNum(a.magraMedida)} kg de massa magra` : ''}.
        </p>
      ) : (
        <p className="small mute" style={{ marginTop: 0 }}>
          O IMC não distingue músculo de gordura: quem tem muita massa muscular aparece com "excesso de peso". Se já fez uma avaliação física (bioimpedância, dobras) ou é acompanhado por um nutricionista ou médico, use os números medidos e os cálculos ficam muito mais certos.
        </p>
      )}
      {!open && (
        <>
          <div className="row" style={{ gap: 8, justifyContent: 'flex-start', flexWrap: 'wrap' }}>
            <button className="btn sm" onClick={startManual}>✏️ Ajustar os meus dados</button>
            <button className="btn ghost sm" disabled={busy} onClick={() => file.current?.click()}>{busy ? 'A ler o relatório…' : '📄 Anexar relatório de acompanhamento'}</button>
          </div>
          <p className="small mute" style={{ margin: '8px 0 0' }}>
            Já tem acompanhamento? Anexe o PDF ou uma foto do relatório do nutricionista, médico ou academia. A IA lê só as medidas e as metas (incluindo avaliações anteriores, para o histórico); o documento não fica guardado e pode rever tudo antes de guardar.
          </p>
          <input
            ref={file}
            type="file"
            accept="application/pdf,image/*"
            hidden
            onChange={(e) => {
              const fl = e.target.files?.[0];
              e.target.value = '';
              if (fl) readFile(fl);
            }}
          />
          {err && <p className="small warn-t" style={{ margin: '8px 0 0' }}>{err}</p>}
        </>
      )}
      {open && (
        <div className="adjust">
          {older.length > 0 && (
            <p className="small neon" style={{ margin: '0 0 10px' }}>
              Lemos {older.length + 1} avaliações (de {shortDate(older[0].date)} a {shortDate(f.date)}). Confira os números da mais recente; as {older.length === 1 ? 'anterior entra' : `${older.length} anteriores entram`} no seu histórico.
            </p>
          )}
          <label className="hin" style={{ marginBottom: 8 }}>
            <span>Data da avaliação</span>
            <input type="date" max={todayKey()} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} aria-label="Data da avaliação" />
          </label>
          <div className="body-inputs">
            {BASIC.map(([k, t, u]) => (
              <label key={k} className="hin">
                <span>{t} ({u})</span>
                <DecimalInput value={num(f[k])} decimals={k !== 'altura' && k !== 'fc'} onValue={(v) => setF({ ...f, [k]: v })} aria-label={t} placeholder="—" />
              </label>
            ))}
          </div>
          <h3 style={{ margin: '14px 0 6px' }}>Perímetros (cm)</h3>
          <div className="body-inputs three">
            {PERIMETERS.map(([k, t]) => (
              <label key={k} className="hin">
                <span>{t}</span>
                <DecimalInput value={num(f.medidas?.[k])} onValue={(v) => setM(k, v)} aria-label={t} placeholder="—" />
              </label>
            ))}
          </div>
          <input className="field sm" style={{ width: '100%', marginTop: 10 }} value={por} onChange={(e) => setPor(e.target.value)} placeholder="Quem fez a avaliação? (opcional, ex.: nutricionista, clínica)" aria-label="Quem fez a avaliação" />
          {goals && (
            <label className="check" style={{ marginTop: 10 }}>
              <input type="checkbox" checked={useGoals} onChange={(e) => setUseGoals(e.target.checked)} />
              <span className="small">
                Usar as metas do relatório no diário: {[goals.kcal ? `${goals.kcal.toLocaleString('pt-PT')} kcal` : '', goals.protein ? `${goals.protein} g de proteína` : ''].filter(Boolean).join(' · ')} por dia
              </span>
            </label>
          )}
          <p className="small mute" style={{ margin: '10px 0 0' }}>Deixe em branco o que não sabe. A % de gordura medida passa a valer em vez da estimada pelo IMC (durante 1 ano).</p>
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn ghost sm" onClick={() => setOpen(false)}>Cancelar</button>
            <button className="btn sm" disabled={!anything || !/^\d{4}-\d{2}-\d{2}$/.test(f.date)} onClick={save}>Guardar</button>
          </div>
        </div>
      )}
    </section>
  );
}
