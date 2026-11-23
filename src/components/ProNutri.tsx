import { useEffect, useMemo, useState } from 'react';
import { shortDate } from '../domain/dates';
import { PROTOCOLS } from '../domain/fasting';
import { saveMyFood, searchNFoods, type NFood } from '../domain/foodSearch';
import type { ParsedWorkoutPlan } from '../domain/planRead';
import { proApi, type ProLog, type ProStudent } from '../domain/pro';
import {
  NMEALS, dayTotals, emptyMeal, emptyRx, itemFrom, mealTotals, nutriFilled, scaleItem, suggestTargets, vsTargets,
  type Macros, type NDay, type NItem, type NMeal, type NMealKey, type NTargets, type NutriDayLog, type NutriRx,
} from '../domain/proNutri';
import { profileText } from '../domain/proProfile';
import { useStore } from '../state/store';
import { NutriAICard } from './ProNutriAI';

const WD = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const fmt = (v: number) => String(Math.round(v * 10) / 10).replace('.', ',');

/** Nutricionistas e médicos: indicar jejum intermitente ao paciente (ele ativa na app). */
export function FastRxEditor({ value, onChange, canSendAlone, busy, onSend }: { value?: ParsedWorkoutPlan['jejum']; onChange: (j: ParsedWorkoutPlan['jejum']) => void; canSendAlone: boolean; busy: boolean; onSend: () => void }) {
  const [open, setOpen] = useState(!!value);
  const j = value;
  if (!open) return <button className="btn ghost sm" style={{ margin: '0 0 12px' }} onClick={() => { setOpen(true); onChange({ protocol: '14:10', open: '10:00', notes: '' }); }}>🌙 Indicar jejum intermitente</button>;
  return (
    <section className="card">
      <div className="row"><h2 style={{ margin: 0 }}>🌙 Jejum intermitente</h2><button className="link small inline" onClick={() => { setOpen(false); onChange(undefined); }}>Retirar</button></div>
      <div className="chips" role="group" aria-label="Protocolo" style={{ marginTop: 8 }}>
        {PROTOCOLS.map((p) => <button key={p.id} className={`chip sm ${j?.protocol === p.id ? 'on' : ''}`} aria-pressed={j?.protocol === p.id} onClick={() => onChange({ ...(j ?? { open: '10:00' }), protocol: p.id, ...(p.id === '5:2' ? { lowDays: j?.lowDays?.length === 2 ? j.lowDays : [1, 4] } : { lowDays: undefined }) })}>{p.label}</button>)}
      </div>
      {j && j.protocol !== '5:2' ? (
        <label className="hin" style={{ width: 150, marginTop: 8 }}><span>Janela abre às</span><input type="time" value={j.open} onChange={(e) => e.target.value && onChange({ ...j, open: e.target.value })} aria-label="Janela abre às" /></label>
      ) : j ? (
        <div className="chips" role="group" aria-label="Dias de poucas calorias" style={{ marginTop: 8 }}>
          {WD.map((d, i) => { const on = (j.lowDays ?? []).includes(i); return <button key={d} className={`chip sm ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => onChange({ ...j, lowDays: on ? (j.lowDays ?? []).filter((x) => x !== i) : [...(j.lowDays ?? []), i].slice(-2) })}>{d}</button>; })}
        </div>
      ) : null}
      <input className="field sm" style={{ width: '100%', marginTop: 8 }} maxLength={200} value={j?.notes ?? ''} onChange={(e) => j && onChange({ ...j, notes: e.target.value })} placeholder="Orientação para o paciente (opcional)" aria-label="Orientação" />
      <p className="small mute" style={{ margin: '8px 0 0' }}>O paciente recebe a indicação na Nutrição e ativa-a com um toque; a app conta as horas e organiza as refeições dentro da janela.</p>
      {canSendAlone && <button className="btn sm" style={{ marginTop: 10 }} disabled={busy || !j || (j.protocol === '5:2' && (j.lowDays ?? []).length !== 2)} onClick={onSend}>Enviar só a indicação de jejum</button>}
    </section>
  );
}

/** Pesquisa de alimentos (TACO + base da app + próprios) e criação de um alimento próprio. */
function FoodPicker({ onPick, onClose }: { onPick: (it: NItem) => void; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [pick, setPick] = useState<NFood | null>(null);
  const [grams, setGrams] = useState('100');
  const [measure, setMeasure] = useState('');
  const [mine, setMine] = useState<{ name: string; kcal: string; p: string; c: string; f: string } | null>(null);
  const list = useMemo(() => searchNFoods(q, 25), [q]);
  const g = Number(grams.replace(',', '.')) || 0;
  if (mine)
    return (
      <div className="nutri-pick">
        <p className="small" style={{ margin: '0 0 6px' }}><b>Novo alimento</b> (valores por 100 g, ex.: do rótulo)</p>
        <input className="field sm" style={{ width: '100%' }} value={mine.name} onChange={(e) => setMine({ ...mine, name: e.target.value })} placeholder="Nome" aria-label="Nome do alimento" />
        <div className="pro-ex-grid" style={{ gridTemplateColumns: 'repeat(4,minmax(0,1fr))', marginTop: 6 }}>
          {(['kcal', 'p', 'c', 'f'] as const).map((k) => <label key={k} className="small">{{ kcal: 'kcal', p: 'Prot.', c: 'Hidr.', f: 'Gord.' }[k]}<input className="field sm" inputMode="decimal" value={mine[k]} onChange={(e) => setMine({ ...mine, [k]: e.target.value })} /></label>)}
        </div>
        <div className="row" style={{ marginTop: 8 }}>
          <button className="btn ghost sm" onClick={() => setMine(null)}>Voltar</button>
          <button className="btn sm" disabled={mine.name.trim().length < 2 || !Number(mine.kcal.replace(',', '.'))} onClick={() => {
            const v = (x: string) => Number(x.replace(',', '.')) || 0;
            const f = { name: mine.name.trim(), cat: 'Meus alimentos', kcal: v(mine.kcal), p: v(mine.p), c: v(mine.c), f: v(mine.f), fib: 0 };
            saveMyFood(f);
            setPick({ ...f, src: 'Meu' });
            setMine(null);
          }}>Guardar alimento</button>
        </div>
      </div>
    );
  if (pick)
    return (
      <div className="nutri-pick">
        <p className="small" style={{ margin: '0 0 6px' }}><b>{pick.name}</b> <span className="mute">· {pick.src} · por 100 g: {Math.round(pick.kcal)} kcal, P {fmt(pick.p)} g</span></p>
        <div className="row" style={{ gap: 8, justifyContent: 'flex-start', flexWrap: 'nowrap' }}>
          <label className="hin" style={{ width: 90 }}><span>Gramas</span><input inputMode="decimal" value={grams} onChange={(e) => setGrams(e.target.value)} aria-label="Gramas" /></label>
          <label className="hin" style={{ flex: 1 }}><span>Medida caseira</span><input value={measure} maxLength={40} onChange={(e) => setMeasure(e.target.value)} placeholder="ex.: 4 colheres de sopa" aria-label="Medida caseira" /></label>
        </div>
        {pick.portion && <button className="link small inline" style={{ marginTop: 4 }} onClick={() => { setGrams(String(pick.grams)); setMeasure(pick.portion!.replace(/\s*\(.*\)$/, '')); }}>Usar a porção habitual: {pick.portion}</button>}
        <p className="small" style={{ margin: '6px 0 0' }}>{g ? `${Math.round((pick.kcal * g) / 100)} kcal · P ${fmt((pick.p * g) / 100)} g · H ${fmt((pick.c * g) / 100)} g · G ${fmt((pick.f * g) / 100)} g` : ''}</p>
        <div className="row" style={{ marginTop: 8 }}>
          <button className="btn ghost sm" onClick={() => setPick(null)}>Outro alimento</button>
          <button className="btn sm" disabled={!g} onClick={() => { onPick(itemFrom(pick, g, measure.trim())); onClose(); }}>Juntar</button>
        </div>
      </div>
    );
  return (
    <div className="nutri-pick">
      <input className="field sm" style={{ width: '100%' }} autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pesquisar alimento (ex.: arroz integral, frango grelhado)" aria-label="Pesquisar alimento" />
      {list.length > 0 && (
        <ul className="pro-ac-list static" role="listbox">
          {list.map((f) => (
            <li key={`${f.src}${f.name}`}><button type="button" onClick={() => { setPick(f); setGrams(f.grams ? String(f.grams) : '100'); setMeasure(f.portion ? f.portion.replace(/\s*\(.*\)$/, '') : ''); }}>
              <span>{f.name}</span><span className="small mute">{Math.round(f.kcal)} kcal/100 g · {f.src}</span>
            </button></li>
          ))}
        </ul>
      )}
      {q.trim().length >= 3 && !list.length && <p className="small mute" style={{ margin: '6px 0 0' }}>Nada encontrado.</p>}
      <div className="row" style={{ marginTop: 6 }}>
        <button className="link small inline" onClick={onClose}>Fechar</button>
        <button className="link small inline" onClick={() => setMine({ name: q, kcal: '', p: '', c: '', f: '' })}>+ Criar alimento próprio</button>
      </div>
    </div>
  );
}

const MacroLine = ({ t }: { t: Macros }) => <span className="small mute">{t.kcal} kcal · P {fmt(t.p)} · H {fmt(t.c)} · G {fmt(t.f)}{t.fib ? ` · fibra ${fmt(t.fib)}` : ''}</span>;

/** Uma refeição do plano: hora, opções (A, B…), alimentos com quantidades e totais. */
function MealCard({ m, onChange, onRemove }: { m: NMeal; onChange: (m: NMeal) => void; onRemove: () => void }) {
  const [opt, setOpt] = useState(0);
  const [adding, setAdding] = useState(false);
  const o = m.options[Math.min(opt, m.options.length - 1)];
  const oi = m.options.indexOf(o);
  const setItems = (items: NItem[]) => onChange({ ...m, options: m.options.map((x, i) => (i === oi ? { ...x, items } : x)) });
  return (
    <section className="card nutri-meal">
      <div className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
        <input className="field sm nutri-meal-name" value={m.label} maxLength={40} onChange={(e) => onChange({ ...m, label: e.target.value })} aria-label="Nome da refeição" />
        <input className="field sm nutri-time" type="time" value={m.time} onChange={(e) => e.target.value && onChange({ ...m, time: e.target.value })} aria-label={`Hora de ${m.label}`} />
        <button className="x" aria-label={`Retirar ${m.label}`} onClick={() => confirm(`Retirar ${m.label} do plano?`) && onRemove()}>×</button>
      </div>
      <div className="chips" style={{ marginTop: 8 }} role="tablist" aria-label="Opções">
        {m.options.map((x, i) => <button key={i} role="tab" aria-selected={i === oi} className={`chip sm ${i === oi ? 'on' : ''}`} onClick={() => setOpt(i)}>{x.name}{x.items.length ? ` (${sumKcal(x.items)} kcal)` : ''}</button>)}
        {m.options.length < 4 && <button className="chip sm" onClick={() => { onChange({ ...m, options: [...m.options, { name: `Opção ${'ABCD'[m.options.length]}`, items: [] }] }); setOpt(m.options.length); }}>+ Opção</button>}
      </div>
      {o.items.length > 0 && (
        <ul className="nutri-items">
          {o.items.map((it, i) => (
            <li key={i}>
              <span className="nutri-food">{it.food}{it.measure ? <span className="small mute"> · {it.measure}</span> : null}<br /><span className="small mute">{it.kcal} kcal · P {fmt(it.p)} · H {fmt(it.c)} · G {fmt(it.f)}</span></span>
              <label className="nutri-g"><input inputMode="decimal" value={it.grams} onChange={(e) => { const g = Number(e.target.value.replace(',', '.')); if (Number.isFinite(g)) setItems(o.items.map((x, j) => (j === i ? scaleItem(x, g) : x))); }} aria-label={`Gramas de ${it.food}`} />g</label>
              <button className="x" aria-label={`Retirar ${it.food}`} onClick={() => setItems(o.items.filter((_, j) => j !== i))}>×</button>
            </li>
          ))}
        </ul>
      )}
      {adding ? <FoodPicker onPick={(it) => setItems([...o.items, it])} onClose={() => setAdding(false)} /> : <button className="btn ghost sm" style={{ marginTop: 8 }} onClick={() => setAdding(true)}>+ Alimento</button>}
      {o.items.length > 0 && <p style={{ margin: '8px 0 0' }}><MacroLine t={mealTotals({ ...m, options: [o] })} /></p>}
      {m.options.length > 1 && oi > 0 && <button className="link small inline" onClick={() => { onChange({ ...m, options: m.options.filter((_, i) => i !== oi) }); setOpt(0); }}>Apagar {o.name}</button>}
      <input className="field sm" style={{ width: '100%', marginTop: 8 }} maxLength={200} value={m.notes} onChange={(e) => onChange({ ...m, notes: e.target.value })} placeholder="Nota desta refeição (opcional)" aria-label={`Nota de ${m.label}`} />
    </section>
  );
}
const sumKcal = (items: NItem[]) => items.reduce((t, x) => t + x.kcal, 0);

/** Totais do dia contra as metas. */
function DayVsTargets({ day, targets }: { day: NDay; targets: NTargets }) {
  const t = dayTotals(day);
  const v = vsTargets(t, targets);
  const row = (label: string, val: number, goal: number, pct: number | null, unit: string) => (
    <div key={label}>
      <div className="row small"><span>{label}</span><span className={pct === null ? 'mute' : pct < 85 || pct > 115 ? 'warn-t' : 'neon'}>{fmt(val)}{goal ? ` / ${goal}` : ''} {unit}{pct !== null ? ` (${pct}%)` : ''}</span></div>
      <div className="bar"><i style={{ width: `${Math.min(100, pct ?? 0)}%` }} /></div>
    </div>
  );
  return (
    <section className="card nutri-totals">
      <h3 style={{ margin: '0 0 6px' }}>Total de {day.name.toLowerCase()} (opção A de cada refeição)</h3>
      <div className="macrobars">
        {row('Energia', t.kcal, targets.kcal, v.kcal, 'kcal')}
        {row('Proteína', t.p, targets.protein, v.protein, 'g')}
        {row('Hidratos', t.c, targets.carbs, v.carbs, 'g')}
        {row('Gordura', t.f, targets.fat, v.fat, 'g')}
        {row('Fibra', t.fib, targets.fiber, v.fiber, 'g')}
      </div>
    </section>
  );
}

/** Montar ou editar o plano alimentar de um paciente. */
export function NutriEditor({ student, others, onClose, onSaved }: { student: ProStudent; others: ProStudent[]; onClose: () => void; onSaved: () => void }) {
  const { toast } = useStore();
  const base = student.draft ?? student.plan;
  const [rx, setRx] = useState<NutriRx>(() => {
    const r = base?.nutri ?? emptyRx();
    if (!base?.nutri) { const t = suggestTargets(student.profile ?? {}); if (t) r.targets = t; }
    return r;
  });
  const [jejum, setJejum] = useState<ParsedWorkoutPlan['jejum']>(base?.jejum);
  const [di, setDi] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [savedAt, setSavedAt] = useState<string | null>(student.draftAt ?? null);
  const [saved, setSaved] = useState(() => JSON.stringify({ rx: base?.nutri ?? null, jejum: base?.jejum ?? null }));
  const plan = (): ParsedWorkoutPlan => ({ is_workout: true, workouts: [], per_week: 3, professional: '', notes: '', nutri: rx, ...(jejum ? { jejum } : {}) });
  const dirty = JSON.stringify({ rx, jejum: jejum ?? null }) !== saved;
  const day = rx.days[Math.min(di, rx.days.length - 1)];
  const setDay = (d: NDay) => setRx({ ...rx, days: rx.days.map((x, i) => (i === di ? d : x)) });
  const setT = (k: keyof NTargets, v: string) => setRx({ ...rx, targets: { ...rx.targets, [k]: Number(v.replace(',', '.')) || 0 } });
  const prof = student.profile;
  const warn = [prof?.anamnese?.alergias && `Alergias/intolerâncias: ${prof.anamnese.alergias}`, prof?.anamnese?.patologias && `Condições: ${prof.anamnese.patologias}`, prof?.anamnese?.aversoes && `Não come: ${prof.anamnese.aversoes}`].filter(Boolean) as string[];
  const templates = others.filter((o) => o.code !== student.code && o.plan?.nutri);
  useEffect(() => { if (di >= rx.days.length) setDi(0); }, [rx.days.length, di]);

  const saveDraft = async (quiet = false) => {
    setBusy(true); setErr('');
    try {
      const r = await proApi<{ at: string }>('aluno/rascunho', { code: student.code, plan: plan() });
      setSavedAt(r.at); setSaved(JSON.stringify({ rx, jejum: jejum ?? null }));
      if (!quiet) toast('Plano guardado. O paciente ainda não o vê.');
      return true;
    } catch (e) { setErr((e as Error).message); return false; } finally { setBusy(false); }
  };
  const send = async () => {
    if (!nutriFilled(rx) && !jejum) { setErr('Acrescente pelo menos um alimento ao plano.'); return; }
    if (!confirm(`Enviar o plano a ${student.name}? ${student.linked ? 'Passa a vê-lo no diário da app.' : 'Vê-o quando usar o código na app.'}`)) return;
    setBusy(true); setErr('');
    try {
      await proApi('aluno/guardar', { code: student.code, plan: { ...plan(), ...(nutriFilled(rx) ? {} : { nutri: undefined }) } });
      toast(`Plano enviado a ${student.name}.`);
      onSaved();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const leave = async () => {
    if (dirty && nutriFilled(rx) && confirm('Tem alterações por guardar. Guardar antes de sair? (o paciente não recebe nada)')) { if (await saveDraft(true)) return onSaved(); return; }
    onClose();
  };
  const missing = NMEALS.filter(([k]) => !day.meals.some((m) => m.key === k));
  const order = (meals: NMeal[]) => [...meals].sort((a, b) => a.time.localeCompare(b.time));

  return (
    <>
      <button className="btn ghost sm" onClick={leave}>← Pacientes</button>
      <h1 style={{ marginBottom: 4 }}>Plano alimentar de {student.name}</h1>
      {student.draft && student.plan && <p className="small gold" style={{ marginTop: 0 }}>📝 A editar o rascunho. O paciente continua a ver o plano enviado antes.</p>}
      {prof && profileText(prof) && <p className="small mute pro-prof-line" style={{ marginTop: 0 }}>👤 {profileText(prof)}</p>}
      {warn.map((w) => <p key={w} className="small warn-t" style={{ margin: '0 0 4px' }}>⚠️ {w}</p>)}
      {templates.length > 0 && (
        <label className="small" style={{ display: 'block', margin: '6px 0 12px' }}>
          Partir do plano de outro paciente:{' '}
          <select className="field sm" defaultValue="" onChange={(e) => { const o = templates.find((t) => t.code === e.target.value); if (o?.plan?.nutri && confirm(`Copiar o plano de ${o.name}? O que está neste ecrã é substituído.`)) { setRx(structuredClone(o.plan.nutri)); setDi(0); } }}>
            <option value="">escolher…</option>
            {templates.map((t) => <option key={t.code} value={t.code}>{t.name}</option>)}
          </select>
        </label>
      )}

      <NutriAICard rx={rx} dayIndex={di} profile={prof ?? null} onRx={(r) => setRx(r)} />

      <section className="card">
        <div className="row"><h2 style={{ margin: 0 }}>Metas diárias</h2>
          <button className="link small inline" onClick={() => { const t = suggestTargets(prof ?? {}); if (t) setRx({ ...rx, targets: t }); else toast('Registe peso e altura na ficha do paciente para sugerir metas.'); }}>Sugerir pela ficha</button>
        </div>
        <div className="pro-ex-grid" style={{ gridTemplateColumns: 'repeat(3,minmax(0,1fr))', marginTop: 8 }}>
          {([['kcal', 'Energia (kcal)'], ['protein', 'Proteína (g)'], ['carbs', 'Hidratos (g)'], ['fat', 'Gordura (g)'], ['fiber', 'Fibra (g)'], ['water', 'Água (L)']] as [keyof NTargets, string][]).map(([k, l]) => (
            <label key={k} className="small">{l}<input className="field sm" inputMode="decimal" value={rx.targets[k] || ''} onChange={(e) => setT(k, e.target.value)} placeholder="—" /></label>
          ))}
        </div>
        <p className="small mute" style={{ margin: '6px 0 0' }}>A sugestão usa Mifflin-St Jeor, os dias de treino e o objetivo da ficha. Ajuste ao seu critério.</p>
      </section>

      <div className="chips" role="tablist" aria-label="Tipos de dia" style={{ marginBottom: 8 }}>
        {rx.days.map((d, i) => <button key={i} role="tab" aria-selected={i === di} className={`chip ${i === di ? 'on' : ''}`} onClick={() => setDi(i)}>{d.name}</button>)}
        {rx.days.length < 3 && <button className="chip" onClick={() => { const copy: NDay = { ...structuredClone(day), name: rx.days.length === 1 ? 'Dias de treino' : 'Fim de semana', weekdays: rx.days.length === 1 ? [1, 3, 5] : [0, 6] }; setRx({ ...rx, days: [...rx.days, copy] }); setDi(rx.days.length); }}>+ Tipo de dia</button>}
      </div>
      {rx.days.length > 1 && (
        <section className="card">
          <div className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
            <input className="field sm" style={{ flex: 1 }} value={day.name} maxLength={40} onChange={(e) => setDay({ ...day, name: e.target.value })} aria-label="Nome do tipo de dia" />
            {di > 0 && <button className="link small inline" onClick={() => confirm(`Apagar "${day.name}"?`) && setRx({ ...rx, days: rx.days.filter((_, i) => i !== di) })}>Apagar</button>}
          </div>
          <div className="chips" style={{ marginTop: 8 }} role="group" aria-label="Dias da semana">
            {WD.map((d, i) => { const on = day.weekdays.includes(i); return <button key={d} className={`chip sm ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => setDay({ ...day, weekdays: on ? day.weekdays.filter((x) => x !== i) : [...day.weekdays, i].sort() })}>{d}</button>; })}
          </div>
          <p className="small mute" style={{ margin: '6px 0 0' }}>{day.weekdays.length ? `Vale às ${day.weekdays.map((w) => WD[w].toLowerCase()).join(', ')}.` : 'Sem dias marcados: vale nos dias que não são de outro tipo.'}</p>
        </section>
      )}

      {order(day.meals).map((m) => {
        const idx = day.meals.indexOf(m);
        return <MealCard key={`${di}-${idx}-${m.key}`} m={m} onChange={(nm) => setDay({ ...day, meals: day.meals.map((x, i) => (i === idx ? nm : x)) })} onRemove={() => setDay({ ...day, meals: day.meals.filter((_, i) => i !== idx) })} />;
      })}
      {missing.length > 0 && (
        <div className="chips" style={{ margin: '0 0 12px' }}>
          {missing.map(([k, l]) => <button key={k} className="chip sm" onClick={() => setDay({ ...day, meals: [...day.meals, emptyMeal(k as NMealKey)] })}>+ {l}</button>)}
        </div>
      )}

      <DayVsTargets day={day} targets={rx.targets} />

      <FastRxEditor value={jejum} onChange={setJejum} canSendAlone={false} busy={busy} onSend={send} />

      <section className="card">
        <h3 style={{ margin: '0 0 6px' }}>Recomendações gerais</h3>
        <textarea className="field" rows={3} maxLength={600} value={rx.notes} onChange={(e) => setRx({ ...rx, notes: e.target.value })} placeholder="ex.: 2 L de água por dia; temperar com ervas; evitar refrigerantes" aria-label="Recomendações gerais" />
        <label className="small" style={{ display: 'block', marginTop: 8 }}>Spirulina (g por dia, opcional)
          <input className="field sm" inputMode="decimal" style={{ width: 90, marginLeft: 8 }} value={rx.spirulina ?? ''} onChange={(e) => { const v = Number(e.target.value.replace(',', '.')); setRx({ ...rx, spirulina: v > 0 ? Math.min(15, v) : undefined }); }} aria-label="Spirulina em gramas por dia" />
        </label>
        <p className="small mute" style={{ margin: '4px 0 0' }}>Se indicar a dose, substitui a recomendação geral da app e o paciente vê que foi indicada por si.</p>
      </section>

      <div className="pro-savebar">
        <button className="btn ghost sm" disabled={busy || !dirty} onClick={() => saveDraft()}>💾 Guardar</button>
        <span className="small mute">{dirty ? 'Alterações por guardar' : savedAt ? `Guardado · o paciente ainda não vê` : student.plan ? 'Igual ao que o paciente tem' : ''}</span>
      </div>
      <section className="card pro-send">
        <p className="small" style={{ margin: '0 0 8px' }}><b>Pronto?</b> Ao enviar, {student.name} passa a ver o plano no diário, refeição a refeição{student.plan ? ' (substitui o anterior)' : ''}.</p>
        <button className="btn full" disabled={busy || (!nutriFilled(rx) && !jejum)} onClick={send}>{busy ? 'A enviar…' : 'Concluir e enviar ao paciente'}</button>
      </section>
      {err && <p className="small warn-t">{err}</p>}
    </>
  );
}

/** Registos de alimentação do paciente (dia a dia). */
export function NutriLogs({ student, onClose, onComment }: { student: ProStudent; onClose: () => void; onComment: (ref: string) => void }) {
  const [logs, setLogs] = useState<(ProLog & Partial<NutriDayLog>)[] | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => { proApi<{ logs: (ProLog & Partial<NutriDayLog>)[] }>('aluno/registos', { code: student.code }).then((r) => setLogs(r.logs.filter((l) => l.workout === '__nutri'))).catch((e) => setErr((e as Error).message)); }, [student.code]);
  const ST: Record<string, string> = { seguido: '✓', alterado: '✎', saltado: '–' };
  return (
    <>
      <button className="btn ghost sm" onClick={onClose}>← Pacientes</button>
      <h1 style={{ marginBottom: 4 }}>Registos de {student.name}</h1>
      <p className="small mute" style={{ marginTop: 0 }}>O que o paciente marcou no plano, dia a dia (✓ seguiu · ✎ com alterações · – não fez).</p>
      {student.alerts?.length ? <section className="card pro-attn">{student.alerts.map((a) => <p key={a.kind} className="small" style={{ margin: '0 0 4px' }}>⚠️ {a.text}</p>)}</section> : null}
      {err && <p className="small warn-t">{err}</p>}
      {!logs && !err && <p className="small mute">A carregar…</p>}
      {logs && !logs.length && <p className="small mute">Ainda sem registos. Aparecem quando o paciente marcar as refeições do plano.</p>}
      {logs?.map((l) => (
        <section className="card" key={l.day}>
          <div className="row"><h3 style={{ margin: 0 }}>{shortDate(l.day)}</h3><span className={`small ${(l.pct ?? 0) >= 70 ? 'neon' : (l.pct ?? 0) >= 40 ? 'gold' : 'warn-t'}`}>adesão {l.pct ?? 0}%</span></div>
          {(l.meals ?? []).filter((m) => m.status).map((m) => <p key={m.label} className="small" style={{ margin: '4px 0 0' }}>{ST[m.status]} <b>{m.label}</b>{m.changes.length ? `: ${m.changes.join(', ')}` : ''}</p>)}
          <p className="small mute" style={{ margin: '6px 0 0' }}>
            {[l.kcal ? `${l.kcal} kcal` : '', l.prot ? `${l.prot} g proteína` : '', l.water !== undefined ? (l.water ? 'água na meta' : 'água abaixo da meta') : '', l.hunger ? `fome ${l.hunger}/5` : '', l.fastH ? `jejum ${fmt(l.fastH)} h` : '', l.weight ? `${fmt(l.weight)} kg` : ''].filter(Boolean).join(' · ')}
          </p>
          <button className="link small inline" style={{ marginTop: 6 }} onClick={() => onComment(`Registo de ${shortDate(l.day)}`)}>Comentar este dia</button>
        </section>
      ))}
    </>
  );
}

export { DayVsTargets };
