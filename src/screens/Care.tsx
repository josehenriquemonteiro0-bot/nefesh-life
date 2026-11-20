import { useState } from 'react';
import { DecimalInput } from '../components/DecimalInput';
import { LABS, VISIT_KINDS, labDef, labFlag, labSeries, newId, preventionFor, type LabResult, type PrevStatus } from '../domain/care';
import { fmtNum, shortDate, todayKey } from '../domain/dates';
import { declaredWarnings, doseKey, medWarnings, medsToday, type Med } from '../domain/meds';
import { useStore } from '../state/store';

const fmt = (k: string) => k.split('-').reverse().join('/');
const STATUS: Record<PrevStatus, [string, string]> = {
  atrasado: ['em atraso', 'warn'],
  breve: ['em breve', 'gold'],
  'em-dia': ['em dia', 'neon'],
  'sem-data': ['quando foi?', 'mute'],
};

/** Mini-gráfico da evolução de uma análise. */
function Spark({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 96 + 2},${30 - ((v - min) / (max - min || 1)) * 26}`).join(' ');
  return (
    <svg viewBox="0 0 100 32" width="100" height="32" aria-hidden="true" className="spark">
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/* ---------- medicação ---------- */

function MedForm({ onDone, med }: { onDone: () => void; med?: Med }) {
  const { update, toast } = useStore();
  const [name, setName] = useState(med?.name ?? '');
  const [dose, setDose] = useState(med?.dose ?? '');
  const [kind, setKind] = useState<Med['kind']>(med?.kind ?? 'medicamento');
  const [times, setTimes] = useState<string[]>(med?.times ?? ['08:00']);
  const [by, setBy] = useState(med?.by ?? '');
  const warn = name.trim().length >= 3 ? medWarnings(name) : [];
  return (
    <div className="med-form">
      <div className="seg" style={{ gridTemplateColumns: 'repeat(2,minmax(0,1fr))', marginBottom: 8 }} role="group" aria-label="Tipo">
        {(['medicamento', 'suplemento'] as const).map((k) => (
          <button key={k} type="button" className={kind === k ? 'on' : ''} aria-pressed={kind === k} onClick={() => setKind(k)}>{k === 'medicamento' ? 'Medicamento' : 'Suplemento'}</button>
        ))}
      </div>
      <input className="field sm" value={name} onChange={(e) => setName(e.target.value)} placeholder={kind === 'medicamento' ? 'Nome (ex.: Levotiroxina)' : 'Nome (ex.: Vitamina D)'} maxLength={60} aria-label="Nome" />
      <input className="field sm" style={{ marginTop: 8 }} value={dose} onChange={(e) => setDose(e.target.value)} placeholder="Dose (ex.: 50 mcg, 1 comprimido)" maxLength={40} aria-label="Dose" />
      <p className="small mute" style={{ margin: '10px 0 4px' }}>Horas da toma</p>
      <div className="row" style={{ gap: 6, justifyContent: 'flex-start', flexWrap: 'wrap' }}>
        {times.map((t, i) => (
          <span key={i} className="time-chip">
            <input type="time" value={t} onChange={(e) => setTimes(times.map((x, j) => (j === i ? e.target.value : x)))} aria-label={`Hora ${i + 1}`} />
            {times.length > 1 && <button type="button" className="x" onClick={() => setTimes(times.filter((_, j) => j !== i))} aria-label="Tirar esta hora">×</button>}
          </span>
        ))}
        {times.length < 6 && <button type="button" className="btn ghost sm" onClick={() => setTimes([...times, '20:00'])}>+ hora</button>}
      </div>
      <input className="field sm" style={{ marginTop: 8 }} value={by} onChange={(e) => setBy(e.target.value)} placeholder="Receitado por (opcional)" maxLength={40} aria-label="Receitado por" />
      {warn.map((w) => <p key={w.text} className={`small med-warn ${w.level}`}>⚠️ {w.text}</p>)}
      <div className="row" style={{ gap: 8, justifyContent: 'flex-start', marginTop: 10 }}>
        <button
          className="btn sm"
          disabled={name.trim().length < 2 || !times.every((t) => /^\d\d:\d\d$/.test(t))}
          onClick={() => {
            const m: Med = { id: med?.id ?? newId(), name: name.trim(), dose: dose.trim() || undefined, kind, times: [...new Set(times)].sort(), active: true, by: by.trim() || undefined };
            update((d) => {
              const list = d.care?.meds ?? [];
              d.care = { ...(d.care ?? {}), meds: med ? list.map((x) => (x.id === med.id ? m : x)) : [...list, m] };
            });
            toast(med ? 'Guardado.' : `${m.name} adicionado. Os lembretes chegam às ${m.times.join(', ')}.`);
            onDone();
          }}
        >
          Guardar
        </button>
        <button className="btn ghost sm" onClick={onDone}>Cancelar</button>
      </div>
    </div>
  );
}

function MedsCard() {
  const { S, todayLog: l, updateToday, update } = useStore();
  const [adding, setAdding] = useState(false);
  const [edit, setEdit] = useState<Med | null>(null);
  const today = medsToday(S, l);
  const meds = S.care?.meds ?? [];
  const general = declaredWarnings(S);
  return (
    <section className="card" data-tour="medicacao">
      <div className="row">
        <h2 style={{ margin: 0 }}>💊 Medicação e suplementos</h2>
        {!adding && !edit && <button className="btn ghost sm" onClick={() => setAdding(true)}>+ Adicionar</button>}
      </div>
      {general.map((g) => <p key={g} className="small med-warn alto">⚠️ {g}</p>)}
      {[...new Map(meds.filter((m) => m.active).flatMap((m) => medWarnings(m.name).map((w) => [w.text, { ...w, name: m.name }] as const))).values()].map((w) => (
        <p key={w.text} className={`small med-warn ${w.level}`}>⚠️ <b>{w.name}:</b> {w.text}</p>
      ))}
      {today.length > 0 && (
        <>
          <p className="small mute" style={{ margin: '10px 0 4px' }}>Hoje</p>
          <div className="planmeals">
            {today.map((t) => (
              <button
                key={t.key}
                className={`planrow ${t.taken ? 'st-seguido' : ''}`}
                aria-pressed={t.taken}
                onClick={() => updateToday((d) => { d.meds = { ...(d.meds ?? {}), [doseKey(t.med.id, t.time)]: !t.taken }; })}
              >
                <span className="st-dot" aria-hidden="true">{t.taken ? '✓' : ''}</span>
                <span style={{ flex: 1, display: 'grid' }}>
                  <b>{t.time} · {t.med.name}</b>
                  <span className="small mute">{t.med.dose ?? (t.med.kind === 'suplemento' ? 'suplemento' : 'medicamento')}{!t.taken && t.due ? ' · por tomar' : ''}</span>
                </span>
              </button>
            ))}
          </div>
        </>
      )}
      {!meds.length && !adding && <p className="small mute" style={{ margin: '8px 0 0' }}>Registe a medicação e os suplementos que toma: a app lembra-o à hora certa e avisa dos cuidados a ter com a Spirulina.</p>}
      {(adding || edit) && <MedForm med={edit ?? undefined} onDone={() => { setAdding(false); setEdit(null); }} />}
      {meds.length > 0 && !adding && !edit && (
        <details className="small" style={{ marginTop: 10 }}>
          <summary>Gerir a lista ({meds.length})</summary>
          {meds.map((m) => (
            <div key={m.id} className="row med-item">
              <span>
                <b>{m.name}</b>{m.dose ? ` · ${m.dose}` : ''} · {m.times.join(', ')}{m.active ? '' : ' · parado'}
                {medWarnings(m.name).map((w) => <span key={w.text} className={`med-warn ${w.level}`} style={{ display: 'block' }}>⚠️ {w.text}</span>)}
              </span>
              <span className="row" style={{ gap: 6 }}>
                <button className="link small inline" onClick={() => setEdit(m)}>editar</button>
                <button className="link small inline" onClick={() => update((d) => { d.care = { ...(d.care ?? {}), meds: (d.care?.meds ?? []).map((x) => (x.id === m.id ? { ...x, active: !x.active } : x)) }; })}>{m.active ? 'parar' : 'retomar'}</button>
                <button className="link small inline" onClick={() => confirm(`Apagar ${m.name}?`) && update((d) => { d.care = { ...(d.care ?? {}), meds: (d.care?.meds ?? []).filter((x) => x.id !== m.id) }; })}>apagar</button>
              </span>
            </div>
          ))}
        </details>
      )}
      <p className="small mute" style={{ margin: '10px 0 0' }}>Os lembretes chegam como notificação, só com a hora (o nome do medicamento fica no telemóvel). Não altere doses sem falar com o seu médico.</p>
    </section>
  );
}

/* ---------- prevenção ---------- */

function PreventionCard() {
  const { S, update, toast } = useStore();
  const list = preventionFor(S);
  const [open, setOpen] = useState<string | null>(null);
  const [date, setDate] = useState(todayKey());
  const late = list.filter((p) => p.status === 'atrasado' || p.status === 'sem-data').length;
  return (
    <section className="card">
      <div className="row">
        <h2 style={{ margin: 0 }}>Prevenção</h2>
        <span className="small mute">{late ? `${late} por rever` : 'tudo em dia ✓'}</span>
      </div>
      <p className="small mute" style={{ margin: '4px 0 8px' }}>Check-ups, rastreios e vacinas recomendados para a sua idade e sexo. Marque quando fez: a app calcula a próxima vez.</p>
      <div className="prev-list">
        {list.map((p) => (
          <div key={p.id} className="prev-item">
            <button className="prev-row" onClick={() => { setOpen(open === p.id ? null : p.id); setDate(todayKey()); }}>
              <span style={{ flex: 1, display: 'grid', textAlign: 'left' }}>
                <b className="small">{p.kind === 'vacina' ? '💉 ' : p.kind === 'rastreio' ? '🔎 ' : '🩺 '}{p.label}</b>
                <span className="small mute">{p.last ? `Última: ${fmt(p.last)} · próxima: ${fmt(p.next!)}` : `De ${p.months >= 12 ? `${p.months / 12} em ${p.months / 12} ${p.months === 12 ? 'ano' : 'anos'}` : `${p.months} em ${p.months} meses`}`}</span>
              </span>
              <span className={`small prev-st ${STATUS[p.status][1]}`}>{STATUS[p.status][0]}</span>
            </button>
            {open === p.id && (
              <div className="prev-edit">
                <p className="small mute" style={{ margin: '0 0 6px' }}>{p.note}</p>
                <div className="row" style={{ gap: 8, justifyContent: 'flex-start' }}>
                  <input className="field sm" type="date" max={todayKey()} value={date} onChange={(e) => setDate(e.target.value)} aria-label="Data em que fez" />
                  <button
                    className="btn sm"
                    disabled={!date}
                    onClick={() => {
                      update((d) => { d.care = { ...(d.care ?? {}), prev: { ...(d.care?.prev ?? {}), [p.id]: date } }; });
                      toast('Registado.');
                      setOpen(null);
                    }}
                  >
                    Fiz nesta data
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      <p className="small mute" style={{ margin: '8px 0 0' }}>Orientação geral: o seu médico de família decide o que se aplica a si e com que frequência.</p>
    </section>
  );
}

/* ---------- análises ---------- */

function LabsCard() {
  const { S, update, toast } = useStore();
  const sex = S.ans?.sexo === 'f' ? 'f' : S.ans?.sexo === 'm' ? 'm' : undefined;
  const [adding, setAdding] = useState(false);
  const [key, setKey] = useState(LABS[0].key);
  const [custom, setCustom] = useState('');
  const [unit, setUnit] = useState('');
  const [value, setValue] = useState<number | undefined>();
  const [date, setDate] = useState(todayKey());
  const [lo, setLo] = useState<number | undefined>();
  const [hi, setHi] = useState<number | undefined>();
  const series = labSeries(S);
  const def = labDef(key);
  return (
    <section className="card">
      <div className="row">
        <h2 style={{ margin: 0 }}>Análises</h2>
        {!adding && <button className="btn ghost sm" onClick={() => setAdding(true)}>+ Resultado</button>}
      </div>
      {adding && (
        <div className="med-form">
          <select className="field sm" value={key} onChange={(e) => setKey(e.target.value)} aria-label="Análise">
            {LABS.map((l) => <option key={l.key} value={l.key}>{l.name} ({l.unit})</option>)}
            <option value="outra">Outra…</option>
          </select>
          {key === 'outra' && (
            <div className="row" style={{ gap: 8, marginTop: 8 }}>
              <input className="field sm" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Nome da análise" maxLength={40} aria-label="Nome da análise" />
              <input className="field sm" style={{ width: 100 }} value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="unidade" maxLength={12} aria-label="Unidade" />
            </div>
          )}
          <div className="row" style={{ gap: 8, justifyContent: 'flex-start', marginTop: 8 }}>
            <label className="hin" style={{ width: 110 }}><span>valor</span><DecimalInput value={value} onValue={setValue} aria-label="Valor" /></label>
            <input className="field sm" type="date" max={todayKey()} value={date} onChange={(e) => setDate(e.target.value)} aria-label="Data da análise" style={{ width: 160 }} />
          </div>
          <p className="small mute" style={{ margin: '8px 0 4px' }}>Referência do laboratório (opcional){def ? `; sem ela, usamos ${def.ref(sex).map((x) => (x === null ? '—' : fmtNum(x))).join(' a ')} ${def.unit}` : ''}</p>
          <div className="row" style={{ gap: 8, justifyContent: 'flex-start' }}>
            <label className="hin" style={{ width: 100 }}><span>mínimo</span><DecimalInput value={lo} onValue={setLo} aria-label="Mínimo" /></label>
            <label className="hin" style={{ width: 100 }}><span>máximo</span><DecimalInput value={hi} onValue={setHi} aria-label="Máximo" /></label>
          </div>
          <div className="row" style={{ gap: 8, justifyContent: 'flex-start', marginTop: 10 }}>
            <button
              className="btn sm"
              disabled={value === undefined || !date || (key === 'outra' && custom.trim().length < 2)}
              onClick={() => {
                const r: LabResult = {
                  id: newId(), date, key: key === 'outra' ? `outra:${custom.trim().toLowerCase()}` : key, name: key === 'outra' ? custom.trim() : def!.name, value: value!, unit: key === 'outra' ? unit.trim() : def!.unit,
                  ...(lo !== undefined || hi !== undefined ? { lo: lo ?? null, hi: hi ?? null } : {}),
                };
                update((d) => { d.care = { ...(d.care ?? {}), labs: [...(d.care?.labs ?? []), r] }; });
                toast('Resultado guardado.');
                setAdding(false);
                setValue(undefined);
                setLo(undefined);
                setHi(undefined);
              }}
            >
              Guardar
            </button>
            <button className="btn ghost sm" onClick={() => setAdding(false)}>Cancelar</button>
          </div>
        </div>
      )}
      {!series.length && !adding && <p className="small mute" style={{ margin: '8px 0 0' }}>Guarde os resultados das suas análises: a app mostra a evolução de cada valor e junta-a ao relatório para o seu médico.</p>}
      {series.map((s) => {
        const flag = labFlag(s.last, sex);
        return (
          <div key={s.key} className="lab-row">
            <span style={{ flex: 1, display: 'grid' }}>
              <b className="small">{s.name}</b>
              <span className="small mute">{s.list.map((r) => `${fmtNum(r.value)} (${shortDate(r.date)})`).slice(-3).join(' → ')}</span>
            </span>
            <span className={flag ? 'warn-t' : 'neon'}><Spark values={s.list.map((r) => r.value)} /></span>
            <span className="small" style={{ textAlign: 'right', minWidth: 74 }}>
              <b>{fmtNum(s.last.value)}</b> {s.unit}
              {flag && <span className="warn-t" style={{ display: 'block' }}>{flag === 'alto' ? 'acima' : 'abaixo'} da ref.</span>}
            </span>
          </div>
        );
      })}
      {series.length > 0 && <p className="small mute" style={{ margin: '8px 0 0' }}>A app só compara com a referência: quem interpreta os resultados é o seu médico. O relatório em PDF (Perfil) inclui esta evolução.</p>}
    </section>
  );
}

/* ---------- consultas ---------- */

function VisitsCard() {
  const { S, update, toast } = useStore();
  const [adding, setAdding] = useState(false);
  const [date, setDate] = useState(todayKey());
  const [kind, setKind] = useState(VISIT_KINDS[0]);
  const [who, setWho] = useState('');
  const [note, setNote] = useState('');
  const visits = [...(S.care?.visits ?? [])].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <section className="card">
      <div className="row">
        <h2 style={{ margin: 0 }}>Consultas</h2>
        {!adding && <button className="btn ghost sm" onClick={() => setAdding(true)}>+ Consulta</button>}
      </div>
      {adding && (
        <div className="med-form">
          <div className="row" style={{ gap: 8 }}>
            <input className="field sm" type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Data" style={{ width: 160 }} />
            <select className="field sm" value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Especialidade">{VISIT_KINDS.map((k) => <option key={k}>{k}</option>)}</select>
          </div>
          <input className="field sm" style={{ marginTop: 8 }} value={who} onChange={(e) => setWho(e.target.value)} placeholder="Com quem (opcional)" maxLength={40} aria-label="Com quem" />
          <textarea className="field sm" style={{ marginTop: 8, minHeight: 60 }} value={note} onChange={(e) => setNote(e.target.value)} placeholder="O que ficou decidido (opcional)" maxLength={300} aria-label="Notas" />
          <div className="row" style={{ gap: 8, justifyContent: 'flex-start', marginTop: 8 }}>
            <button
              className="btn sm"
              disabled={!date}
              onClick={() => {
                update((d) => { d.care = { ...(d.care ?? {}), visits: [...(d.care?.visits ?? []), { id: newId(), date, kind, who: who.trim() || undefined, note: note.trim() || undefined }] }; });
                toast(date > todayKey() ? 'Consulta marcada.' : 'Consulta registada.');
                setAdding(false);
                setWho('');
                setNote('');
              }}
            >
              Guardar
            </button>
            <button className="btn ghost sm" onClick={() => setAdding(false)}>Cancelar</button>
          </div>
        </div>
      )}
      {!visits.length && !adding && <p className="small mute" style={{ margin: '8px 0 0' }}>Registe as consultas que fez ou que tem marcadas, com o que ficou decidido. Ficam na sua Timeline.</p>}
      {visits.slice(0, 6).map((v) => (
        <div key={v.id} className="lab-row">
          <span style={{ flex: 1, display: 'grid' }}>
            <b className="small">{v.kind}{v.who ? ` · ${v.who}` : ''}{v.date > todayKey() ? ' · marcada' : ''}</b>
            {v.note && <span className="small mute">{v.note}</span>}
          </span>
          <span className="small mute">{fmt(v.date)}</span>
          <button className="x" aria-label="Apagar consulta" onClick={() => confirm('Apagar esta consulta?') && update((d) => { d.care = { ...(d.care ?? {}), visits: (d.care?.visits ?? []).filter((x) => x.id !== v.id) }; })}>×</button>
        </div>
      ))}
    </section>
  );
}

/** Cuidados: medicação, prevenção, análises e consultas. */
export function Care() {
  return (
    <>
      <h1>Cuidados</h1>
      <MedsCard />
      <PreventionCard />
      <LabsCard />
      <VisitsCard />
    </>
  );
}
