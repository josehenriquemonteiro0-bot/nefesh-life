import { useEffect, useRef, useState } from 'react';
import { bodyOf, targetsFor } from '../domain/body';
import { bodySeries, mergeEvals, saveEvals, type FullEval } from '../domain/bodyLog';
import { fmtNum, shortDate, todayKey } from '../domain/dates';
import { readHealthReport } from '../domain/pro';
import { MEASURES as PERIMETERS, type MeasureKey } from '../domain/proProfile';
import type { AppState } from '../domain/types';
import { useStore } from '../state/store';
import { DecimalInput } from './DecimalInput';

type Goals = { kcal: number | null; protein: number | null; by: string };
const BASIC: ['altura' | 'peso' | 'gordura' | 'magra' | 'fc', string, string][] = [
  ['altura', 'Altura', 'cm'], ['peso', 'Peso', 'kg'], ['gordura', '% de gordura', '%'], ['magra', 'Massa magra', 'kg'], ['fc', 'FC em repouso', 'bpm'],
];
const num = (v: number | null | undefined) => (typeof v === 'number' && v > 0 ? v : undefined);

/** Os números que a app calcula a partir do corpo. */
function snapshot(S: AppState) {
  const b = S.ans ? bodyOf(S.ans) : null;
  if (!b) return null;
  const t = targetsFor(S);
  return { bmi: b.bmi, bmiLabel: b.bmiLabel, fat: b.fat, fatLabel: b.fatLabel, fatMethod: b.fatMethod, bmr: b.bmr, kcal: t.kcal, protein: t.protein, pro: t.source === 'pro', muscleNote: b.muscleNote };
}
type Snap = NonNullable<ReturnType<typeof snapshot>>;
const METHOD = { avaliacao: 'medida', medidas: 'pelas medidas', imc: 'estimada pelo IMC' } as const;

/** Antes e depois do ajuste: IMC, gordura, metabolismo e meta diária. */
function Recalc({ before, after, saved, onClose }: { before: Snap | null; after: Snap; saved: boolean; onClose?: () => void }) {
  const rows: [string, string, string, boolean][] = [
    ['IMC', before ? `${fmtNum(before.bmi)} (${before.bmiLabel})` : '—', `${fmtNum(after.bmi)} (${after.bmiLabel})`, !before || before.bmi !== after.bmi],
    ['Gordura corporal', before ? `${fmtNum(before.fat)}% (${METHOD[before.fatMethod]})` : '—', `${fmtNum(after.fat)}% (${METHOD[after.fatMethod]})`, !before || before.fat !== after.fat],
    ['Classificação da gordura', before?.fatLabel ?? '—', after.fatLabel, !before || before.fatLabel !== after.fatLabel],
    ['Metabolismo basal', before ? `${before.bmr.toLocaleString('pt-PT')} kcal` : '—', `${after.bmr.toLocaleString('pt-PT')} kcal`, !before || before.bmr !== after.bmr],
    ['Meta diária', before ? `${before.kcal.toLocaleString('pt-PT')} kcal` : '—', `${after.kcal.toLocaleString('pt-PT')} kcal${after.pro ? ' (do profissional)' : ''}`, !before || before.kcal !== after.kcal],
    ['Proteína por dia', before ? `${before.protein} g` : '—', `${after.protein} g`, !before || before.protein !== after.protein],
  ];
  return (
    <div className="recalc">
      <div className="row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start', gap: 8 }}>
        <b>{saved ? '✓ Os seus números foram recalculados' : 'Com estes dados, os seus números ficam assim'}</b>
        {onClose && <button className="link small inline" onClick={onClose} aria-label="Fechar">✕</button>}
      </div>
      <table className="cmp">
        <thead><tr><th /><th>antes</th><th>agora</th></tr></thead>
        <tbody>{rows.map(([k, a, b, changed]) => <tr key={k}><td>{k}</td><td>{a}</td><td>{changed ? <b>{b}</b> : b}</td></tr>)}</tbody>
      </table>
      {after.muscleNote && <p className="small neon" style={{ margin: '8px 0 0' }}>💪 {after.muscleNote}</p>}
      {!saved && <p className="small mute" style={{ margin: '8px 0 0' }}>Ainda não está guardado: toque em Guardar para passar a usar estes números.</p>}
    </div>
  );
}

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

  const [progress, setProgress] = useState('');
  /** Lê um ou vários relatórios (um de cada vez) e junta tudo por data numa só revisão. */
  const readFiles = async (files: File[]) => {
    setBusy(true);
    setErr(null);
    const lists: FullEval[][] = [];
    const fails: string[] = [];
    let latestGoals: Goals | null = null;
    let latestGoalsDate = '';
    let by = '';
    try {
      for (const [i, fl] of files.entries()) {
        setProgress(files.length > 1 ? ` ${i + 1} de ${files.length}` : '');
        try {
          const r = await readHealthReport(fl);
          const evals = (r.evals ?? []).map((e) => ({ ...e, date: e.date || todayKey() }));
          if (!r.found || (!evals.length && !r.kcal)) { fails.push(fl.name); continue; }
          lists.push(evals);
          const last = evals[evals.length - 1]?.date ?? '';
          if (r.by && last >= latestGoalsDate) by = r.by;
          if ((r.kcal || r.protein) && last >= latestGoalsDate) { latestGoals = { kcal: r.kcal ?? null, protein: r.protein ?? null, by: r.by ?? '' }; latestGoalsDate = last; }
        } catch (e) {
          if (files.length === 1) throw e;
          fails.push(fl.name);
        }
      }
      const all = mergeEvals(lists);
      if (!all.length && !latestGoals) {
        setErr(files.length > 1 ? 'Não encontrámos medidas nestes documentos. Pode preencher à mão.' : 'Não encontrámos medidas neste documento. Pode preencher à mão.');
        return;
      }
      setF(all[all.length - 1] ?? { date: todayKey() });
      setOlder(all.slice(0, -1));
      setPor(by);
      setGoals(latestGoals);
      setUseGoals(true);
      setOpen(true);
      if (fails.length) setErr(`Não consegui ler: ${fails.join(', ')}. Os outros foram lidos.`);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
      setProgress('');
    }
  };

  const apply = (d: AppState) => {
    const fromReport = older.length > 0 || goals !== null;
    saveEvals(d, [...older, f], fromReport ? 'relatorio' : 'manual', por);
    if (goals && useGoals && (goals.kcal || goals.protein)) {
      d.nutriPro = { kcal: goals.kcal ?? undefined, protein: goals.protein ?? undefined, by: goals.by.trim() || por.trim() || 'o seu profissional', at: todayKey() };
    }
  };
  // "Recalcular": o que mudaria, sem guardar
  const [calc, setCalc] = useState<{ before: Snap | null; after: Snap | null; saved: boolean } | null>(null);
  const preview = () => {
    const d = structuredClone(S);
    apply(d);
    return { before: snapshot(S), after: snapshot(d) };
  };
  useEffect(() => { if (open) setCalc(null); }, [f, older, goals, useGoals, open]);
  const save = () => {
    const r = preview();
    update(apply);
    toast(older.length ? `Guardadas ${older.length + 1} avaliações no seu histórico.` : 'Dados guardados. Os cálculos já usam estes números.');
    setOpen(false);
    setCalc({ ...r, saved: true });
  };

  const setM = (k: MeasureKey, v: number | undefined) => setF({ ...f, medidas: { ...(f.medidas ?? {}), [k]: v } });
  const anything = [f.peso, f.altura, f.gordura, f.magra, f.fc, ...Object.values(f.medidas ?? {}), ...(f.extra ?? []).map((x) => x.v)].some((v) => num(v) !== undefined);

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
      {!open && calc?.saved && calc.after && <Recalc before={calc.before} after={calc.after} saved onClose={() => setCalc(null)} />}
      {!open && (
        <>
          <div className="row" style={{ gap: 8, justifyContent: 'flex-start', flexWrap: 'wrap' }}>
            <button className="btn sm" onClick={startManual}>✏️ Ajustar os meus dados</button>
            <button className="btn ghost sm" disabled={busy} onClick={() => file.current?.click()}>{busy ? `A ler${progress}…` : '📄 Anexar relatórios ou bioimpedância'}</button>
          </div>
          <p className="small mute" style={{ margin: '8px 0 0' }}>
            Já tem acompanhamento ou fez uma bioimpedância (InBody, Tanita…)? Anexe o PDF ou uma foto do relatório do nutricionista, médico ou academia. Tem vários? Escolha-os todos de uma vez (até 10): juntamos tudo pela data no seu histórico e nos gráficos. A IA lê só as medidas e as metas (incluindo avaliações anteriores, para o histórico); o documento não fica guardado e pode rever tudo antes de guardar.
          </p>
          <input
            ref={file}
            type="file"
            accept="application/pdf,image/*"
            multiple
            hidden
            onChange={(e) => {
              const fls = [...(e.target.files ?? [])].slice(0, 10);
              e.target.value = '';
              if (fls.length) readFiles(fls);
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
          {(f.extra?.length ?? 0) > 0 && (
            <>
              <h3 style={{ margin: '14px 0 2px' }}>Outros dados do relatório</h3>
              <p className="small mute" style={{ margin: '0 0 6px' }}>Campos criados a partir do documento. Ficam no seu histórico, com gráfico.</p>
              <div className="body-inputs three">
                {f.extra!.map((x, i) => (
                  <label key={x.label} className="hin">
                    <span>{x.label}{x.u ? ` (${x.u})` : ''}</span>
                    <DecimalInput value={x.v ?? undefined} onValue={(v) => setF({ ...f, extra: f.extra!.map((y, j) => (j === i ? { ...y, v } : y)) })} aria-label={x.label} placeholder="—" />
                  </label>
                ))}
              </div>
            </>
          )}
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
          {calc && !calc.saved && (calc.after ? <Recalc before={calc.before} after={calc.after} saved={false} /> : <p className="small warn-t" style={{ margin: '10px 0 0' }}>Para recalcular precisamos da altura e do peso.</p>)}
          <div className="row" style={{ marginTop: 10, gap: 8 }}>
            <button className="btn ghost sm" onClick={() => setOpen(false)}>Cancelar</button>
            <button className="btn ghost sm" disabled={!anything || !/^\d{4}-\d{2}-\d{2}$/.test(f.date)} onClick={() => setCalc({ ...preview(), saved: false })}>🔄 Recalcular</button>
            <button className="btn sm" disabled={!anything || !/^\d{4}-\d{2}-\d{2}$/.test(f.date)} onClick={save}>Guardar</button>
          </div>
        </div>
      )}
    </section>
  );
}
