import { useEffect, useRef, useState } from 'react';
import { compressImage } from '../domain/photo';
import { proApi, readAssessmentFile, type ProStudent } from '../domain/pro';
import { FOLD_NAME, METRICS, POSES, POSE_NAME, PROTOCOL_NAME, cleanAssessment, foldsFor, results, series, type Assessment, type Fold, type MetricKey, type Pose, type Protocol } from '../domain/proAssess';
import { MEASURES, type MeasureKey } from '../domain/proProfile';
import { useStore } from '../state/store';
import { NumField } from './ProProfile';

const fmt = (n: number | null | undefined, d = 1) => (n === null || n === undefined ? '—' : String(Math.round(n * 10 ** d) / 10 ** d).replace('.', ','));
const dmy = (d: string) => d.split('-').reverse().join('/');
const todayIso = () => new Date().toLocaleDateString('en-CA');

/** Gráfico simples de uma métrica ao longo do tempo. */
function MetricChart({ points, unit }: { points: { day: string; v: number }[]; unit: string }) {
  if (points.length < 2) return <p className="small mute">Com 2 ou mais avaliações aparece aqui o gráfico da evolução.</p>;
  const W = 320, H = 150, P = 26;
  const vs = points.map((p) => p.v);
  const lo = Math.min(...vs), hi = Math.max(...vs);
  const pad = (hi - lo) * 0.15 || 1;
  const y = (v: number) => H - P - ((v - (lo - pad)) / (hi + pad - (lo - pad))) * (H - 2 * P);
  const x = (i: number) => P + (i / (points.length - 1)) * (W - 2 * P);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  return (
    <svg className="pro-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Evolução: ${points.map((p) => `${dmy(p.day)} ${fmt(p.v)} ${unit}`).join(', ')}`}>
      <path d={d} fill="none" stroke="var(--neon)" strokeWidth="2.5" strokeLinejoin="round" />
      {points.map((p, i) => (
        <g key={p.day + i}>
          <circle cx={x(i)} cy={y(p.v)} r="4" fill="var(--neon)" />
          {(i === 0 || i === points.length - 1 || points.length <= 5) && (
            <>
              <text x={x(i)} y={y(p.v) - 9} textAnchor="middle" fontSize="11" fill="currentColor">{fmt(p.v)}</text>
              <text x={x(i)} y={H - 6} textAnchor="middle" fontSize="10" fill="var(--mute)">{dmy(p.day).slice(0, 5)}</text>
            </>
          )}
        </g>
      ))}
    </svg>
  );
}

/** Foto guardada (carrega só quando aparece). */
function Photo({ code, id, alt }: { code: string; id: number; alt: string }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let on = true;
    proApi<{ image: string }>('aluno/foto/ver', { code, id }).then((r) => on && setSrc(`data:image/jpeg;base64,${r.image}`)).catch(() => undefined);
    return () => { on = false; };
  }, [code, id]);
  return src ? <img className="pro-photo" src={src} alt={alt} /> : <div className="pro-photo ph" aria-label={`${alt} a carregar`} />;
}

async function photoData(f: File) {
  let i = await compressImage(f, 900);
  if (i.data.length > 390_000) i = await compressImage(f, 650);
  return i.data;
}

/** Nova avaliação ou correção de uma existente. */
function AssessForm({ student, base, onClose, onSaved }: { student: ProStudent; base: Assessment | null; onClose: () => void; onSaved: () => void }) {
  const { toast } = useStore();
  const prof = student.profile;
  const [a, setA] = useState<Assessment>(() => base ?? cleanAssessment({ sexo: prof?.sexo, idade: prof?.idade, altura: prof?.altura, protocol: 'jp3' }, todayIso()));
  const [pending, setPending] = useState<Partial<Record<Pose, string>>>({});
  const [consent, setConsent] = useState(!!base?.photos?.length);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const docRef = useRef<HTMLInputElement>(null);
  const set = (p: Partial<Assessment>) => setA((c) => ({ ...c, ...p }));
  const setFold = (f: Fold, v: number | null) => setA((c) => { const folds = { ...c.folds }; if (v === null) delete folds[f]; else folds[f] = v; return { ...c, folds }; });
  const setM = (k: MeasureKey, v: number | null) => setA((c) => { const medidas = { ...c.medidas }; if (v === null) delete medidas[k]; else medidas[k] = v; return { ...c, medidas }; });
  const r = results(a);
  const folds = foldsFor(a.protocol, a.sexo);
  const readDoc = async (f: File) => {
    setBusy(true); setErr(''); setMsg('');
    try {
      const x = await readAssessmentFile(f);
      if (!x.found || !x.profile) { setMsg('Não encontrei dados de avaliação neste documento.'); return; }
      const p = x.profile;
      setA((c) => ({
        ...c, day: p.dataAval || c.day, sexo: p.sexo || c.sexo, idade: p.idade ?? c.idade, altura: p.altura ?? c.altura, peso: p.peso ?? c.peso, fc: p.fc ?? c.fc,
        ...(p.gordura ? { protocol: 'medido' as Protocol, gorduraMedida: p.gordura } : {}),
        medidas: { ...c.medidas, ...Object.fromEntries(Object.entries(p.medidas ?? {}).filter(([, v]) => v !== null && v !== undefined)) },
      }));
      setMsg('Preenchido a partir do documento. Confira antes de guardar.');
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); if (docRef.current) docRef.current.value = ''; }
  };
  const save = async () => {
    if (Object.keys(pending).length && !consent) { setErr('Para guardar fotos, confirme que o aluno autorizou.'); return; }
    setBusy(true); setErr('');
    try {
      const { id } = await proApi<{ id: number }>('aluno/avaliacao', { code: student.code, id: base?.id, assessment: a });
      for (const [pose, image] of Object.entries(pending)) await proApi('aluno/foto', { code: student.code, assess: id, pose, image, consent: true });
      toast('Avaliação guardada.');
      onSaved();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const chip = (on: boolean, label: string, f: () => void) => <button key={label} className={`chip sm ${on ? 'on' : ''}`} aria-pressed={on} onClick={f}>{label}</button>;
  return (
    <>
      <button className="btn ghost sm" onClick={onClose}>← Avaliações</button>
      <h1 style={{ marginBottom: 4 }}>{base ? 'Corrigir avaliação' : 'Nova avaliação'}</h1>
      <p className="small mute" style={{ marginTop: 0 }}>{student.name}</p>
      <section className="card pro-upload">
        <input ref={docRef} type="file" accept="application/pdf,image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) readDoc(f); }} />
        <button className="btn sm" disabled={busy} onClick={() => docRef.current?.click()}>📄 Preencher a partir de um documento</button>
        {msg && <p className="small neon" style={{ margin: '8px 0 0' }}>{msg}</p>}
      </section>
      <section className="card pro-profile">
        <div className="pro-ex-grid" style={{ gridTemplateColumns: 'repeat(2,minmax(0,1fr))' }}>
          <label className="small">Data<input className="field sm" type="date" value={a.day} onChange={(e) => set({ day: e.target.value || todayIso() })} /></label>
          <label className="small">Peso (kg)<NumField value={a.peso} onNum={(v) => set({ peso: v })} placeholder="kg" /></label>
        </div>
        <p className="small lbl">Sexo</p>
        <div className="chips">{chip(a.sexo === 'f', 'Mulher', () => set({ sexo: 'f' }))}{chip(a.sexo === 'm', 'Homem', () => set({ sexo: 'm' }))}</div>
        <div className="pro-ex-grid" style={{ gridTemplateColumns: 'repeat(3,minmax(0,1fr))', marginTop: 10 }}>
          <label className="small">Idade<NumField value={a.idade} decimal={false} onNum={(v) => set({ idade: v })} placeholder="anos" /></label>
          <label className="small">Altura<NumField value={a.altura} decimal={false} onNum={(v) => set({ altura: v })} placeholder="cm" /></label>
          <label className="small">FC repouso<NumField value={a.fc} decimal={false} onNum={(v) => set({ fc: v })} placeholder="bpm" /></label>
        </div>
        <p className="small lbl">Composição corporal</p>
        <div className="chips">{(Object.keys(PROTOCOL_NAME) as Protocol[]).map((p) => chip(a.protocol === p, PROTOCOL_NAME[p], () => set({ protocol: p })))}</div>
        {a.protocol === 'medido' ? (
          <label className="small" style={{ display: 'block', marginTop: 8 }}>% de gordura <NumField value={a.gorduraMedida} onNum={(v) => set({ gorduraMedida: v })} placeholder="%" /></label>
        ) : !a.sexo ? (
          <p className="small mute">Escolha o sexo para ver as dobras deste protocolo.</p>
        ) : (
          <div className="pro-ex-grid" style={{ gridTemplateColumns: 'repeat(3,minmax(0,1fr))', marginTop: 8 }}>
            {folds.map((f) => <label key={f} className="small">{FOLD_NAME[f]}<NumField value={a.folds[f]} onNum={(v) => setFold(f, v)} placeholder="mm" /></label>)}
          </div>
        )}
        <div className="pro-results">
          <span><b>{fmt(r.gordura)}%</b> gordura</span>
          <span><b>{fmt(r.magra)} kg</b> massa magra</span>
          <span><b>{fmt(r.gorda)} kg</b> massa gorda</span>
          <span><b>{fmt(r.imc)}</b> IMC</span>
          {r.rcq !== null && <span><b>{fmt(r.rcq, 2)}</b> cintura/quadril</span>}
        </div>
        {a.protocol !== 'medido' && a.sexo && !a.idade && <p className="small warn-t">Falta a idade para calcular a % de gordura.</p>}
        <p className="small lbl">Perímetros (cm)</p>
        <div className="pro-ex-grid" style={{ gridTemplateColumns: 'repeat(3,minmax(0,1fr))' }}>
          {MEASURES.map(([k, l]) => <label key={k} className="small">{l}<NumField value={a.medidas[k]} onNum={(v) => setM(k, v)} placeholder="cm" /></label>)}
        </div>
        <label className="small" style={{ display: 'block', marginTop: 10 }}>Notas
          <textarea className="field" rows={2} maxLength={300} value={a.notas} onChange={(e) => set({ notas: e.target.value })} placeholder="ex.: avaliação em jejum, manhã" />
        </label>
      </section>
      <section className="card">
        <h3 style={{ marginTop: 0 }}>📷 Fotos (opcional)</h3>
        <label className="small pro-review-note"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} /><span>O aluno autorizou o registo das fotos. Ficam visíveis apenas para mim e apagam-se se apagar o aluno.</span></label>
        {consent && (
          <div className="pro-photos">
            {POSES.map((p) => {
              const saved = base?.photos?.find((x) => x.pose === p);
              return (
                <label key={p} className="pro-photo-slot">
                  {pending[p] ? <img className="pro-photo" src={`data:image/jpeg;base64,${pending[p]}`} alt={POSE_NAME[p]} /> : saved ? <Photo code={student.code} id={saved.id} alt={POSE_NAME[p]} /> : <div className="pro-photo ph">+</div>}
                  <span className="small">{POSE_NAME[p]}</span>
                  <input type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) { const d = await photoData(f); setPending((c) => ({ ...c, [p]: d })); } }} />
                </label>
              );
            })}
          </div>
        )}
      </section>
      <button className="btn full" disabled={busy} onClick={save}>{busy ? 'A guardar…' : 'Guardar avaliação'}</button>
      {err && <p className="small warn-t">{err}</p>}
    </>
  );
}

/** Histórico de avaliações do aluno: evolução em gráfico, comparação de fotos, nova avaliação. */
export function StudentAssessments({ student, onClose }: { student: ProStudent; onClose: () => void }) {
  const [list, setList] = useState<Assessment[] | null>(null);
  const [err, setErr] = useState('');
  const [form, setForm] = useState<Assessment | null | 'new'>(null);
  const [metric, setMetric] = useState<MetricKey>('peso');
  const [pose, setPose] = useState<Pose>('frente');
  const load = () => proApi<{ list: Assessment[] }>('aluno/avaliacoes', { code: student.code }).then((r) => setList(r.list)).catch((e) => setErr((e as Error).message));
  useEffect(() => { load(); }, [student.code]); // eslint-disable-line react-hooks/exhaustive-deps
  if (form) return <AssessForm student={student} base={form === 'new' ? null : form} onClose={() => setForm(null)} onSaved={() => { setForm(null); load(); }} />;
  const m = METRICS.find((x) => x.key === metric)!;
  const pts = list ? series(list, metric) : [];
  const available = list ? METRICS.filter((x) => series(list, x.key).length > 0) : [];
  const withPose = (list ?? []).filter((a) => a.photos?.some((p) => p.pose === pose)).sort((x, y) => x.day.localeCompare(y.day));
  const firstP = withPose[0], lastP = withPose[withPose.length - 1];
  return (
    <>
      <button className="btn ghost sm" onClick={onClose}>← Alunos</button>
      <h1 style={{ marginBottom: 4 }}>Avaliações de {student.name}</h1>
      <button className="btn" style={{ margin: '8px 0 12px' }} onClick={() => setForm('new')}>+ Nova avaliação</button>
      {err && <p className="small warn-t">{err}</p>}
      {!list && !err && <p className="small mute">A carregar…</p>}
      {list && !list.length && <p className="small mute">Ainda sem avaliações. A primeira fica como ponto de partida para ver a evolução.</p>}
      {list && list.length > 0 && (
        <section className="card">
          <h3 style={{ marginTop: 0 }}>Evolução</h3>
          <div className="chips">{available.map((x) => <button key={x.key} className={`chip sm ${metric === x.key ? 'on' : ''}`} onClick={() => setMetric(x.key)}>{x.label}</button>)}</div>
          <MetricChart points={pts} unit={m.unit} />
          {pts.length >= 2 && (
            <p className="small" style={{ margin: '4px 0 0' }}>
              {m.label}: {fmt(pts[0].v)} → <b>{fmt(pts[pts.length - 1].v)} {m.unit}</b> ({pts[pts.length - 1].v - pts[0].v >= 0 ? '+' : ''}{fmt(pts[pts.length - 1].v - pts[0].v)} {m.unit === '%' ? 'p.p.' : m.unit} desde {dmy(pts[0].day)})
            </p>
          )}
        </section>
      )}
      {withPose.length > 0 && (
        <section className="card">
          <h3 style={{ marginTop: 0 }}>Fotos: antes e depois</h3>
          <div className="chips">{POSES.map((p) => <button key={p} className={`chip sm ${pose === p ? 'on' : ''}`} onClick={() => setPose(p)}>{POSE_NAME[p]}</button>)}</div>
          <div className="pro-compare">
            <figure><Photo code={student.code} id={firstP.photos!.find((x) => x.pose === pose)!.id} alt={`${POSE_NAME[pose]} ${dmy(firstP.day)}`} /><figcaption className="small mute">{dmy(firstP.day)}</figcaption></figure>
            {lastP !== firstP && <figure><Photo code={student.code} id={lastP.photos!.find((x) => x.pose === pose)!.id} alt={`${POSE_NAME[pose]} ${dmy(lastP.day)}`} /><figcaption className="small mute">{dmy(lastP.day)}</figcaption></figure>}
          </div>
        </section>
      )}
      {list?.map((a, i) => {
        const r = results(a);
        const prev = list[i + 1];
        const d = (v: number | null, pv: number | null | undefined) => (v !== null && pv !== null && pv !== undefined ? ` (${v - pv >= 0 ? '+' : ''}${fmt(v - pv)})` : '');
        return (
          <section className="card" key={a.id}>
            <div className="row"><b>{dmy(a.day)}</b><span className="small mute">{a.protocol === 'medido' ? 'medida' : PROTOCOL_NAME[a.protocol]}{a.photos?.length ? ` · 📷 ${a.photos.length}` : ''}</span></div>
            <p className="small" style={{ margin: '6px 0' }}>
              Peso <b>{fmt(a.peso)} kg</b>{d(a.peso ?? null, prev?.peso)} · Gordura <b>{fmt(r.gordura)}%</b>{prev ? d(r.gordura, results(prev).gordura) : ''} · Massa magra <b>{fmt(r.magra)} kg</b>{prev ? d(r.magra, results(prev).magra) : ''}
              {a.medidas.cintura ? <> · Cintura <b>{fmt(a.medidas.cintura)} cm</b>{d(a.medidas.cintura, prev?.medidas.cintura)}</> : null}
            </p>
            {a.notas && <p className="small mute" style={{ margin: '0 0 6px' }}>{a.notas}</p>}
            <div className="row" style={{ gap: 8, justifyContent: 'flex-start' }}>
              <button className="btn ghost sm" onClick={() => setForm(a)}>Corrigir</button>
              <button className="link small inline" onClick={() => confirm(`Apagar a avaliação de ${dmy(a.day)}${a.photos?.length ? ' e as fotos' : ''}?`) && proApi('aluno/avaliacao/apagar', { code: student.code, id: a.id }).then(load)}>Apagar</button>
            </div>
          </section>
        );
      })}
    </>
  );
}
