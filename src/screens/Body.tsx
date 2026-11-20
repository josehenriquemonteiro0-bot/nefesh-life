import { useEffect, useRef, useState } from 'react';
import { DecimalInput } from '../components/DecimalInput';
import { bodyOf } from '../domain/body';
import { MEASURES, MONTHS, bodySeries, change, monthly, photoKey, type Measure } from '../domain/bodyLog';
import { newId } from '../domain/care';
import { fmtNum, shortDate, todayKey } from '../domain/dates';
import { deleteFile, loadFile, saveFile } from '../domain/files';
import { compressImage } from '../domain/photo';
import { useStore } from '../state/store';

/** Gráfico de linha mensal (pontos ligados; meses sem registo ficam vazios). */
function MonthChart({ data, unit }: { data: { month: string; value: number | null }[]; unit: string }) {
  const vals = data.map((d) => d.value).filter((v): v is number => v !== null);
  if (vals.length < 2) return <p className="small mute" style={{ margin: '6px 0 0' }}>Com registos em dois meses diferentes aparece aqui o gráfico.</p>;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const W = 320;
  const H = 120;
  const x = (i: number) => 14 + (i / (data.length - 1)) * (W - 28);
  const y = (v: number) => 24 + (1 - (v - min) / (max - min || 1)) * (H - 50);
  const pts = data.map((d, i) => (d.value === null ? null : [x(i), y(d.value), d.value] as const)).filter((p): p is readonly [number, number, number] => !!p);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="month-chart" role="img" aria-label={`Evolução mensal em ${unit}`}>
      <polyline points={pts.map((p) => `${p[0]},${p[1]}`).join(' ')} fill="none" stroke="var(--neon)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p[0]} cy={p[1]} r="4" fill="var(--neon)" />
          {(i === 0 || i === pts.length - 1) && <text x={p[0]} y={p[1] - 9} textAnchor="middle" fontSize="11" fill="currentColor">{fmtNum(p[2])}</text>}
        </g>
      ))}
      {data.map((d, i) => (i % 2 === (data.length - 1) % 2 ? <text key={d.month} x={x(i)} y={H - 4} textAnchor="middle" fontSize="10" fill="var(--mute)">{MONTHS[Number(d.month.slice(5)) - 1]}</text> : null))}
    </svg>
  );
}

/** Uma foto de progresso guardada no telemóvel. */
function LocalPhoto({ id, alt }: { id: string; alt: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let u: string | null = null;
    loadFile(photoKey(id)).then((b) => {
      if (b) {
        u = URL.createObjectURL(b);
        setUrl(u);
      }
    });
    return () => {
      if (u) URL.revokeObjectURL(u);
    };
  }, [id]);
  return url ? <img src={url} alt={alt} /> : <span className="small mute">sem imagem</span>;
}

function Photos() {
  const { S, update, toast } = useStore();
  const input = useRef<HTMLInputElement>(null);
  const [pose, setPose] = useState<'frente' | 'lado' | 'costas'>('frente');
  const photos = [...(S.progressPhotos ?? [])].sort((a, b) => a.date.localeCompare(b.date));
  const same = photos.filter((p) => p.pose === pose);
  const first = same[0];
  const last = same.length > 1 ? same[same.length - 1] : null;
  return (
    <section className="card">
      <h2 style={{ marginTop: 0 }}>Fotos de progresso</h2>
      <p className="small mute" style={{ marginTop: 0 }}>🔒 Ficam só neste telemóvel: não vão para a conta, para a comunidade nem para a IA, e não entram na cópia de dados.</p>
      <div className="seg" style={{ gridTemplateColumns: 'repeat(3,minmax(0,1fr))', marginBottom: 10 }} role="group" aria-label="Posição">
        {(['frente', 'lado', 'costas'] as const).map((k) => (
          <button key={k} className={pose === k ? 'on' : ''} aria-pressed={pose === k} onClick={() => setPose(k)}>{k[0].toUpperCase() + k.slice(1)}</button>
        ))}
      </div>
      {first && (
        <div className="photo-compare">
          <figure><LocalPhoto id={first.id} alt={`${pose} em ${shortDate(first.date)}`} /><figcaption className="small">{shortDate(first.date)}</figcaption></figure>
          {last && <figure><LocalPhoto id={last.id} alt={`${pose} em ${shortDate(last.date)}`} /><figcaption className="small">{shortDate(last.date)}</figcaption></figure>}
        </div>
      )}
      <button className="btn sm" style={{ marginTop: 10 }} onClick={() => input.current?.click()}>📷 Tirar foto ({pose})</button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          try {
            const img = await compressImage(f, 1280);
            const blob = await (await fetch(`data:${img.media_type};base64,${img.data}`)).blob();
            const id = newId();
            await saveFile(photoKey(id), blob);
            update((d) => { d.progressPhotos = [...(d.progressPhotos ?? []), { id, date: todayKey(), pose }]; });
            toast('Foto guardada neste telemóvel.');
          } catch {
            toast('Não foi possível guardar a foto.');
          }
        }}
      />
      {same.length > 0 && (
        <details className="small" style={{ marginTop: 10 }}>
          <summary>Todas as fotos ({same.length})</summary>
          {same.map((p) => (
            <div key={p.id} className="row" style={{ padding: '6px 0', borderTop: '1px solid var(--line)' }}>
              <span>{shortDate(p.date)}</span>
              <button
                className="link small inline"
                onClick={async () => {
                  if (!confirm('Apagar esta foto?')) return;
                  await deleteFile(photoKey(p.id)).catch(() => undefined);
                  update((d) => { d.progressPhotos = (d.progressPhotos ?? []).filter((x) => x.id !== p.id); });
                }}
              >
                apagar
              </button>
            </div>
          ))}
        </details>
      )}
    </section>
  );
}

export function Body() {
  const { S, update, toast } = useStore();
  const series = bodySeries(S);
  const [m, setM] = useState<Measure>('peso');
  const [vals, setVals] = useState<Partial<Record<Measure, number>>>({});
  const [date, setDate] = useState(todayKey());
  const [toPlan, setToPlan] = useState(true);
  const w = change(series, 'peso');
  const latest = Object.fromEntries(MEASURES.map(([k]) => [k, change(series, k)?.last])) as Record<Measure, number | undefined>;
  const b = S.ans ? bodyOf({ ...S.ans, ...(latest.peso ? { peso: latest.peso } : {}), ...(latest.cintura ? { cintura: latest.cintura } : {}), ...(latest.anca ? { anca: latest.anca } : {}), ...(latest.pescoco ? { pescoco: latest.pescoco } : {}) }) : null;
  const unit = MEASURES.find((x) => x[0] === m)![2];
  const c = change(series, m);
  return (
    <>
      <h1>Corpo</h1>
      <section className="card hero">
        {w ? (
          <>
            <p className="small" style={{ margin: 0, opacity: 0.8 }}>Último registo: {shortDate(w.lastDate)}</p>
            <h2 style={{ margin: '4px 0 2px' }}>{fmtNum(w.last)} kg</h2>
            <p className="small" style={{ margin: 0, opacity: 0.85 }}>
              {w.sinceStart ? `${w.sinceStart > 0 ? '+' : ''}${fmtNum(w.sinceStart)} kg desde ${shortDate(w.firstDate)}` : 'Sem variação desde o início'}
              {w.since30 !== null ? ` · ${w.since30 > 0 ? '+' : ''}${fmtNum(w.since30)} kg em 30 dias` : ''}
            </p>
            {b && <p className="small" style={{ margin: '6px 0 0', opacity: 0.85 }}>IMC {fmtNum(b.bmi)} ({b.bmiLabel}) · gordura estimada {fmtNum(b.fat)}%</p>}
          </>
        ) : (
          <h2 style={{ margin: 0 }}>Registe o seu peso e as medidas</h2>
        )}
        <p className="small" style={{ margin: '10px 0 0', opacity: 0.85 }}>Uma vez por semana, à mesma hora (de manhã, em jejum), é o suficiente. O que conta é a tendência, não o dia.</p>
      </section>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>Novo registo</h2>
        <div className="body-inputs">
          {MEASURES.map(([k, t, u]) => (
            <label key={k} className="hin">
              <span>{t} ({u})</span>
              <DecimalInput value={vals[k]} onValue={(v) => setVals({ ...vals, [k]: v })} aria-label={t} placeholder={latest[k] !== undefined ? fmtNum(latest[k]!) : ''} />
            </label>
          ))}
        </div>
        <div className="row" style={{ gap: 8, justifyContent: 'flex-start', marginTop: 8 }}>
          <input className="field sm" type="date" max={todayKey()} value={date} onChange={(e) => setDate(e.target.value)} aria-label="Data" style={{ width: 160 }} />
        </div>
        {vals.peso !== undefined && S.ans && (
          <label className="check" style={{ marginTop: 8 }}>
            <input type="checkbox" checked={toPlan} onChange={(e) => setToPlan(e.target.checked)} />
            <span className="small">Atualizar o meu plano com este peso (água, metas e dose de Spirulina)</span>
          </label>
        )}
        <button
          className="btn sm"
          style={{ marginTop: 8 }}
          disabled={!Object.values(vals).some((v) => v !== undefined && v > 0)}
          onClick={() => {
            const clean = Object.fromEntries(Object.entries(vals).filter(([, v]) => v !== undefined && v > 0)) as Partial<Record<Measure, number>>;
            update((d) => {
              d.bodyLog = [...(d.bodyLog ?? []).filter((e) => e.date !== date), { ...((d.bodyLog ?? []).find((e) => e.date === date) ?? {}), date, ...clean }];
              if (toPlan && d.ans && date >= (series[series.length - 1]?.date ?? '')) d.ans = { ...d.ans, ...clean };
            });
            toast('Registo guardado.');
            setVals({});
          }}
        >
          Guardar
        </button>
      </section>

      <section className="card">
        <div className="chips" role="group" aria-label="Medida">
          {MEASURES.map(([k, t]) => (
            <button key={k} className={`chip sm ${m === k ? 'on' : ''}`} aria-pressed={m === k} onClick={() => setM(k)}>{t}</button>
          ))}
        </div>
        <h2 style={{ margin: '10px 0 0' }}>Últimos 12 meses</h2>
        <MonthChart data={monthly(series, m, 12)} unit={unit} />
        {c && <p className="small" style={{ margin: '6px 0 0' }}>Agora {fmtNum(c.last)} {unit} · {c.sinceStart > 0 ? '+' : ''}{fmtNum(c.sinceStart)} {unit} desde {shortDate(c.firstDate)}</p>}
        {series.length > 0 && (
          <details className="small" style={{ marginTop: 8 }}>
            <summary>Histórico ({series.length})</summary>
            {[...series].reverse().slice(0, 24).map((e) => (
              <p key={e.date} style={{ margin: '6px 0 0' }}>
                <b>{shortDate(e.date)}</b> · {MEASURES.filter(([k]) => e[k] !== undefined).map(([k, t, u]) => `${t.toLowerCase()} ${fmtNum(e[k]!)} ${u}`).join(' · ')}
              </p>
            ))}
          </details>
        )}
      </section>

      <Photos />
    </>
  );
}
