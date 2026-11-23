import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { results, type Assessment } from '../domain/proAssess';
import { shortDate } from '../domain/dates';
import { PROTOCOLS } from '../domain/fasting';
import { saveMyFood, searchNFoods, type NFood } from '../domain/foodSearch';
import type { ParsedWorkoutPlan } from '../domain/planRead';
import { proApi, type ProLog, type ProStudent } from '../domain/pro';
import {
  DAY_MODES, NMEALS, applyDayMode, dayModeOf, dayTotals, emptyRx, itemFrom, mealFilled, mealTotals, nutriFilled, scaleItem, setMeals, suggestTargets, vsTargets,
  type Macros, type NDay, type NItem, type NMeal, type NMealKey, type NTargets, type NutriDayLog, type NutriRx,
} from '../domain/proNutri';
import { profileText } from '../domain/proProfile';
import { ANAMNESE } from '../domain/proNutri';
import { useStore } from '../state/store';
import { MealDictation, NutriReview, SuggestOption } from './ProNutriAI';

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
function MealCard({ m, onChange, onRemove }: { m: NMeal; onChange: (m: NMeal) => void; onRemove?: () => void }) {
  const [opt, setOpt] = useState(0);
  const [adding, setAdding] = useState(false);
  const o = m.options[Math.min(opt, m.options.length - 1)];
  const oi = m.options.indexOf(o);
  const setItems = (items: NItem[]) => onChange({ ...m, options: m.options.map((x, i) => (i === oi ? { ...x, items } : x)) });
  return (
    <section className="card nutri-meal">
      <div className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
        <h2 style={{ margin: 0 }}>{m.label} <span className="small mute" style={{ fontWeight: 400 }}>· {m.time}</span></h2>
        {onRemove && <button className="x" aria-label={`Retirar ${m.label}`} onClick={() => confirm(`Retirar ${m.label} do plano?`) && onRemove()}>×</button>}
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

/** Montar ou editar o plano alimentar de um paciente, por etapas: metas → estrutura → refeições → rever e enviar. */
type Step = 'metas' | 'estrutura' | 'refeicoes' | 'enviar';
const STEPS: [Step, string][] = [['metas', 'Metas'], ['estrutura', 'Estrutura'], ['refeicoes', 'Refeições'], ['enviar', 'Rever e enviar']];
const MODE_KEY = 'nefesh-life-nutri-modo';

export function NutriEditor({ student, others, onClose, onSaved }: { student: ProStudent; others: ProStudent[]; onClose: () => void; onSaved: () => void }) {
  const { toast } = useStore();
  const base = student.draft ?? student.plan;
  const [rx, setRx] = useState<NutriRx>(() => {
    const r = base?.nutri ?? emptyRx();
    if (!base?.nutri) { const t = suggestTargets(student.profile ?? {}); if (t) r.targets = t; }
    return r;
  });
  const [jejum, setJejum] = useState<ParsedWorkoutPlan['jejum']>(base?.jejum);
  const [step, setStep] = useState<Step>(() => (nutriFilled(base?.nutri) ? 'refeicoes' : 'metas'));
  const [di, setDi] = useState(0);
  const [mi, setMi] = useState(0);
  const [mode, setModeState] = useState<'manual' | 'voz'>(() => { try { return localStorage.getItem(MODE_KEY) === 'voz' ? 'voz' : 'manual'; } catch { return 'manual'; } });
  const setMode = (m: 'manual' | 'voz') => { setModeState(m); try { localStorage.setItem(MODE_KEY, m); } catch { /* */ } };
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [savedAt, setSavedAt] = useState<string | null>(student.draftAt ?? null);
  const [saved, setSaved] = useState(() => JSON.stringify({ rx: base?.nutri ?? null, jejum: base?.jejum ?? null }));
  const plan = (): ParsedWorkoutPlan => ({ is_workout: true, workouts: [], per_week: 3, professional: '', notes: '', nutri: rx, ...(jejum ? { jejum } : {}) });
  const dirty = JSON.stringify({ rx, jejum: jejum ?? null }) !== saved;
  const day = rx.days[Math.min(di, rx.days.length - 1)];
  const meals = day.meals;
  const meal = meals[Math.min(mi, Math.max(0, meals.length - 1))];
  const setDay = (d: NDay) => setRx({ ...rx, days: rx.days.map((x, i) => (i === di ? d : x)) });
  const setMeal = (m: NMeal) => setDay({ ...day, meals: day.meals.map((x) => (x === meal ? m : x)) });
  const setT = (k: keyof NTargets, v: string) => setRx({ ...rx, targets: { ...rx.targets, [k]: Number(v.replace(',', '.')) || 0 } });
  const prof = student.profile;
  const about = [profileText(prof), ...Object.entries(prof?.anamnese ?? {}).map(([k, v]) => `${k}: ${v}`)].filter(Boolean).join('; ');
  const warn = [prof?.anamnese?.alergias && `Alergias/intolerâncias: ${prof.anamnese.alergias}`, prof?.anamnese?.patologias && `Condições: ${prof.anamnese.patologias}`, prof?.anamnese?.aversoes && `Não come: ${prof.anamnese.aversoes}`].filter(Boolean) as string[];
  const templates = others.filter((o) => o.code !== student.code && o.plan?.nutri);
  const dMode = dayModeOf(rx);
  useEffect(() => { if (di >= rx.days.length) setDi(0); }, [rx.days.length, di]);
  useEffect(() => { if (mi >= meals.length) setMi(0); }, [meals.length, mi]);
  const top = () => window.scrollTo({ top: 0, behavior: 'smooth' });
  const go = (s2: Step) => { setStep(s2); top(); };

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
  const filledCount = meals.filter(mealFilled).length;

  return (
    <>
      <button className="btn ghost sm" onClick={leave}>← Pacientes</button>
      <h1 style={{ marginBottom: 4 }}>Plano alimentar de {student.name}</h1>
      {student.draft && student.plan && <p className="small gold" style={{ marginTop: 0 }}>📝 A editar o rascunho. O paciente continua a ver o plano enviado antes.</p>}
      {prof && profileText(prof) && <p className="small mute pro-prof-line" style={{ marginTop: 0 }}>👤 {profileText(prof)}</p>}
      {warn.map((w) => <p key={w} className="small warn-t" style={{ margin: '0 0 4px' }}>⚠️ {w}</p>)}

      <div className="nutri-steps" role="navigation" aria-label="Etapas do plano">
        {STEPS.map(([k, t], i) => <button key={k} className={step === k ? 'on' : STEPS.findIndex((x) => x[0] === step) > i ? 'done' : ''} aria-current={step === k ? 'step' : undefined} onClick={() => go(k)}><b>{i + 1}</b>{t}</button>)}
      </div>

      {step === 'metas' && (
        <>
          <TeamCard team={student.team} />
          <section className="card">
            <div className="row"><h2 style={{ margin: 0 }}>Metas diárias</h2>
              <button className="link small inline" onClick={() => { const t = suggestTargets(prof ?? {}); if (t) setRx({ ...rx, targets: t }); else toast('Registe peso e altura na ficha do paciente para sugerir metas.'); }}>Sugerir pela ficha</button>
            </div>
            <div className="pro-ex-grid" style={{ gridTemplateColumns: 'repeat(3,minmax(0,1fr))', marginTop: 8 }}>
              {([['kcal', 'Energia (kcal)'], ['protein', 'Proteína (g)'], ['carbs', 'Hidratos (g)'], ['fat', 'Gordura (g)'], ['fiber', 'Fibra (g)'], ['water', 'Água (L)']] as [keyof NTargets, string][]).map(([k, l]) => (
                <label key={k} className="small">{l}<input className="field sm" inputMode="decimal" value={rx.targets[k] ? String(rx.targets[k]).replace('.', ',') : ''} onChange={(e) => setT(k, e.target.value)} placeholder="—" /></label>
              ))}
            </div>
            <p className="small mute" style={{ margin: '6px 0 0' }}>A sugestão usa Mifflin-St Jeor, os dias de treino e o objetivo da ficha. Ajuste ao seu critério.</p>
          </section>
          {templates.length > 0 && (
            <label className="small" style={{ display: 'block', margin: '0 0 12px' }}>
              Ou partir do plano de outro paciente:{' '}
              <select className="field sm" defaultValue="" onChange={(e) => { const o = templates.find((t) => t.code === e.target.value); if (o?.plan?.nutri && confirm(`Copiar o plano de ${o.name}? O que está neste ecrã é substituído.`)) { setRx(structuredClone(o.plan.nutri)); setDi(0); setMi(0); go('refeicoes'); } }}>
                <option value="">escolher…</option>
                {templates.map((t) => <option key={t.code} value={t.code}>{t.name}</option>)}
              </select>
            </label>
          )}
          <button className="btn full" onClick={() => go('estrutura')}>Seguinte: estrutura do plano →</button>
        </>
      )}

      {step === 'estrutura' && (
        <>
          <section className="card">
            <h2 style={{ marginTop: 0 }}>Duração</h2>
            <div className="chips">
              {[2, 3, 4, 8, 0].map((w) => <button key={w} className={`chip ${(rx.weeks ?? 0) === w ? 'on' : ''}`} aria-pressed={(rx.weeks ?? 0) === w} onClick={() => setRx({ ...rx, weeks: w || undefined })}>{w ? `${w} semanas` : 'Sem prazo'}</button>)}
            </div>
            <p className="small mute" style={{ margin: '6px 0 0' }}>{rx.weeks ? `Começa no dia em que enviar. Avisamos quando faltarem 3 dias para acabar, para marcar o retorno.` : 'O plano fica até o atualizar.'}</p>
          </section>
          <section className="card">
            <h2 style={{ marginTop: 0 }}>Refeições do dia</h2>
            <p className="small mute" style={{ margin: '0 0 8px' }}>Toque para ligar ou desligar; acerte a hora.</p>
            {NMEALS.map(([k, l, t0]) => {
              const cur = rx.days[0].meals.find((m) => m.key === k);
              const list = () => rx.days[0].meals.map((m) => ({ key: m.key, time: m.time }));
              return (
                <div key={k} className="row nutri-mealrow">
                  <label className="check" style={{ margin: 0, flex: 1 }}>
                    <input type="checkbox" checked={!!cur} onChange={(e) => {
                      if (!e.target.checked && rx.days.some((d) => d.meals.some((m) => m.key === k && mealFilled(m))) && !confirm(`${l} já tem alimentos. Tirar do plano?`)) return;
                      setRx(setMeals(rx, e.target.checked ? [...list(), { key: k as NMealKey, time: t0 }] : list().filter((x) => x.key !== k)));
                    }} />
                    <span>{l}</span>
                  </label>
                  {cur && <input className="field sm nutri-time" style={{ width: 124, flex: 'none' }} type="time" value={cur.time} onChange={(e) => e.target.value && setRx(setMeals(rx, list().map((x) => (x.key === k ? { ...x, time: e.target.value } : x))))} aria-label={`Hora de ${l}`} />}
                </div>
              );
            })}
          </section>
          <section className="card">
            <h2 style={{ marginTop: 0 }}>Os dias da semana</h2>
            <div className="pro-area-pick" role="radiogroup" aria-label="Organização dos dias">
              {DAY_MODES.map(([k, t, d]) => (
                <button key={k} role="radio" aria-checked={dMode === k} className={dMode === k ? 'on' : ''} onClick={() => {
                  if (dMode === k) return;
                  if (k === 'iguais' && rx.days[1]?.meals.some(mealFilled) && !confirm(`"${rx.days[1].name}" já tem alimentos e vai ser apagado. Continuar?`)) return;
                  setRx(applyDayMode(rx, k)); setDi(0);
                }}>
                  <span className="pro-area-icon">{k === 'iguais' ? '📅' : k === 'treino' ? '🏋️' : '🌤️'}</span><b>{t}</b><span className="small mute">{d}</span>
                </button>
              ))}
            </div>
            {dMode === 'treino' && (
              <>
                <p className="small" style={{ margin: '10px 0 6px' }}>Dias de treino:</p>
                <div className="chips" role="group" aria-label="Dias de treino">
                  {WD.map((d, i) => { const on = rx.days[1].weekdays.includes(i); return <button key={d} className={`chip sm ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => setRx({ ...rx, days: rx.days.map((x, j) => (j === 1 ? { ...x, weekdays: on ? x.weekdays.filter((w) => w !== i) : [...x.weekdays, i].sort() } : x)) })}>{d}</button>; })}
                </div>
              </>
            )}
          </section>
          <section className="card">
            <h2 style={{ marginTop: 0 }}>Como quer montar</h2>
            <div className="pro-mode" role="tablist" aria-label="Como montar">
              <button role="tab" aria-selected={mode === 'manual'} className={mode === 'manual' ? 'on' : ''} onClick={() => setMode('manual')}><b>✍️ Manual</b><span>pesquisar alimentos</span></button>
              <button role="tab" aria-selected={mode === 'voz'} className={mode === 'voz' ? 'on' : ''} onClick={() => setMode('voz')}><b>🎙️ Por voz</b><span>ditar, a IA monta</span></button>
            </div>
          </section>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn ghost" onClick={() => go('metas')}>← Metas</button>
            <button className="btn" style={{ flex: 1 }} disabled={!rx.days[0].meals.length} onClick={() => { setMi(0); go('refeicoes'); }}>Seguinte: montar as refeições →</button>
          </div>
        </>
      )}

      {step === 'refeicoes' && (
        <>
          {rx.days.length > 1 && (
            <div className="pro-area-switch" role="tablist" aria-label="Tipo de dia">
              {rx.days.map((d, i) => <button key={i} role="tab" aria-selected={i === di} className={i === di ? 'on' : ''} onClick={() => { setDi(i); setMi(0); }}>{d.name}</button>)}
            </div>
          )}
          {rx.days.length > 1 && di > 0 && !day.meals.some(mealFilled) && rx.days[0].meals.some(mealFilled) && (
            <button className="btn ghost sm" style={{ marginBottom: 10 }} onClick={() => setDay({ ...cloneDayOf(rx.days[0]), name: day.name, weekdays: day.weekdays })}>Copiar de "{rx.days[0].name}" e ajustar</button>
          )}
          <div className="chips" role="tablist" aria-label="Refeições" style={{ marginBottom: 8 }}>
            {meals.map((m, i) => <button key={m.key} role="tab" aria-selected={i === mi} className={`chip sm ${i === mi ? 'on' : ''}`} onClick={() => setMi(i)}>{mealFilled(m) ? '✓ ' : ''}{m.label}</button>)}
          </div>
          <p className="small mute" style={{ margin: '0 0 8px' }}>{filledCount} de {meals.length} refeições montadas{rx.days.length > 1 ? ` em "${day.name}"` : ''} · {dayTotals(day).kcal} de {rx.targets.kcal || '—'} kcal · P {fmt(dayTotals(day).p)} de {rx.targets.protein || '—'} g</p>
          {meal && mode === 'voz' && <MealDictation key={`voz-${di}-${meal.key}`} meal={meal} dayName={day.name} about={about} onMeal={setMeal} />}
          {meal && <MealCard key={`card-${di}-${meal.key}`} m={meal} onChange={setMeal} />}
          <div className="row" style={{ gap: 8 }}>
            {mi > 0 ? <button className="btn ghost" onClick={() => { setMi(mi - 1); top(); }}>← {meals[mi - 1].label}</button> : <button className="btn ghost" onClick={() => go('estrutura')}>← Estrutura</button>}
            {mi < meals.length - 1
              ? <button className="btn" style={{ flex: 1 }} onClick={() => { setMi(mi + 1); top(); void saveDraft(true); }}>Seguinte: {meals[mi + 1].label} →</button>
              : di < rx.days.length - 1
                ? <button className="btn" style={{ flex: 1 }} onClick={() => { setDi(di + 1); setMi(0); top(); void saveDraft(true); }}>Seguinte: {rx.days[di + 1].name} →</button>
                : <button className="btn" style={{ flex: 1 }} onClick={() => { go('enviar'); void saveDraft(true); }}>Seguinte: rever e enviar →</button>}
          </div>
        </>
      )}

      {step === 'enviar' && (
        <>
          {rx.days.length > 1 && (
            <div className="pro-area-switch" role="tablist" aria-label="Tipo de dia">
              {rx.days.map((d, i) => <button key={i} role="tab" aria-selected={i === di} className={i === di ? 'on' : ''} onClick={() => setDi(i)}>{d.name}</button>)}
            </div>
          )}
          <DayVsTargets day={day} targets={rx.targets} />
          {day.meals.filter((m) => !mealFilled(m)).length > 0 && <p className="small warn-t" style={{ marginTop: 0 }}>Por montar: {day.meals.filter((m) => !mealFilled(m)).map((m) => m.label).join(', ')} (não aparecem ao paciente).</p>}
          <section className="card">
            <h3 style={{ margin: '0 0 4px' }}>Confirmar as refeições</h3>
            <p className="small mute" style={{ margin: '0 0 6px' }}>Toque numa refeição para a corrigir. Se quiser, peça à IA uma alternativa equivalente: só entra no plano se a juntar.</p>
            {day.meals.filter(mealFilled).map((m) => (
              <div key={m.key} className="row" style={{ gap: 8, alignItems: 'flex-start', flexWrap: 'nowrap' }}>
                <div style={{ flex: 1 }}><SuggestOption meal={m} dayName={day.name} about={about} onMeal={(nm) => setDay({ ...day, meals: day.meals.map((x) => (x === m ? nm : x)) })} /></div>
                <button className="link small inline" onClick={() => { setMi(day.meals.indexOf(m)); go('refeicoes'); }}>corrigir</button>
              </div>
            ))}
          </section>
          <NutriReview rx={rx} dayIndex={di} profile={prof ?? null} />
          <FastRxEditor value={jejum} onChange={setJejum} canSendAlone={false} busy={busy} onSend={send} />
          <section className="card">
            <h3 style={{ margin: '0 0 6px' }}>Recomendações gerais</h3>
            <textarea className="field" rows={3} maxLength={600} value={rx.notes} onChange={(e) => setRx({ ...rx, notes: e.target.value })} placeholder="ex.: 2 L de água por dia; temperar com ervas; evitar refrigerantes" aria-label="Recomendações gerais" />
            <label className="small" style={{ display: 'block', marginTop: 8 }}>Spirulina (g por dia, opcional)
              <input className="field sm" inputMode="decimal" style={{ width: 90, marginLeft: 8 }} value={rx.spirulina ?? ''} onChange={(e) => { const v = Number(e.target.value.replace(',', '.')); setRx({ ...rx, spirulina: v > 0 ? Math.min(15, v) : undefined }); }} aria-label="Spirulina em gramas por dia" />
            </label>
            <p className="small mute" style={{ margin: '4px 0 0' }}>Se indicar a dose, substitui a recomendação geral da app e o paciente vê que foi indicada por si.</p>
          </section>
          <section className="card pro-send">
            <p className="small" style={{ margin: '0 0 8px' }}><b>Pronto?</b> Ao enviar, {student.name} passa a ver o plano no diário, refeição a refeição{rx.weeks ? ` (${rx.weeks} semanas a partir de hoje)` : ''}{student.plan ? '; substitui o anterior' : ''}.</p>
            <button className="btn full" disabled={busy || (!nutriFilled(rx) && !jejum)} onClick={send}>{busy ? 'A enviar…' : 'Concluir e enviar ao paciente'}</button>
          </section>
        </>
      )}

      <div className="pro-savebar">
        <button className="btn ghost sm" disabled={busy || !dirty} onClick={() => saveDraft()}>💾 Guardar</button>
        <span className="small mute">{dirty ? 'Alterações por guardar' : savedAt ? 'Guardado · o paciente ainda não vê' : student.plan ? 'Igual ao que o paciente tem' : ''}</span>
      </div>
      {err && <p className="small warn-t">{err}</p>}
    </>
  );
}
const cloneDayOf = (d: NDay): NDay => JSON.parse(JSON.stringify(d)) as NDay;

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

interface NoteRow { id: number; kind: 'nota' | 'retorno'; day: string; time: string; text: string; created: string }
interface CheckinRow { id: number; day: string; request?: boolean; fome?: number; saciedade?: number; intestino?: number; energia?: number; adesao?: number; nota?: string }

/** Consultas: próximo retorno (o paciente vê e recebe lembrete), notas da consulta (só o profissional vê) e check-ins semanais. */
export function NutriVisits({ student, onClose }: { student: ProStudent; onClose: () => void }) {
  const { toast } = useStore();
  const [printing, setPrinting] = useState(false);
  const [notes, setNotes] = useState<NoteRow[] | null>(null);
  const [checkins, setCheckins] = useState<CheckinRow[]>([]);
  const [text, setText] = useState('');
  const [vDay, setVDay] = useState('');
  const [vTime, setVTime] = useState('');
  const [vText, setVText] = useState('');
  const [err, setErr] = useState('');
  const load = () => {
    proApi<{ list: NoteRow[] }>('aluno/notas', { code: student.code }).then((r) => setNotes(r.list)).catch((e) => setErr((e as Error).message));
    proApi<{ list: CheckinRow[] }>('aluno/checkins', { code: student.code }).then((r) => setCheckins(r.list)).catch(() => undefined);
  };
  useEffect(load, [student.code]); // eslint-disable-line react-hooks/exhaustive-deps
  const today = new Date().toISOString().slice(0, 10);
  const next = notes?.filter((n) => n.kind === 'retorno' && n.day >= today).sort((a, b) => a.day.localeCompare(b.day))[0];
  const add = (body: Record<string, unknown>, msg: string) => proApi('aluno/nota', { code: student.code, ...body }).then(() => { toast(msg); load(); }).catch((e) => setErr((e as Error).message));
  return (
    <>
      <button className="btn ghost sm" onClick={onClose}>← Pacientes</button>
      <h1 style={{ marginBottom: 4 }}>Consultas de {student.name}</h1>
      <button className="btn ghost sm" style={{ marginBottom: 12 }} onClick={() => setPrinting(true)}>📄 Exportar ficha (PDF)</button>
      {printing && <PatientPrint student={student} onDone={() => setPrinting(false)} />}
      {err && <p className="small warn-t">{err}</p>}
      <section className="card">
        <h2 style={{ marginTop: 0 }}>📅 Próximo retorno</h2>
        {next ? <p className="small" style={{ marginTop: 0 }}><b>{shortDate(next.day)}{next.time ? ` às ${next.time}` : ''}</b>{next.text ? ` · ${next.text}` : ''} · {student.name} vê na app e recebe um lembrete na véspera.</p> : <p className="small mute" style={{ marginTop: 0 }}>Sem retorno marcado.</p>}
        <div className="row" style={{ gap: 8, justifyContent: 'flex-start', flexWrap: 'wrap' }}>
          <input className="field sm" type="date" min={today} value={vDay} onChange={(e) => setVDay(e.target.value)} aria-label="Dia do retorno" />
          <input className="field sm nutri-time" type="time" value={vTime} onChange={(e) => setVTime(e.target.value)} aria-label="Hora do retorno" />
        </div>
        <input className="field sm" style={{ width: '100%', marginTop: 8 }} maxLength={200} value={vText} onChange={(e) => setVText(e.target.value)} placeholder="Local ou link da videochamada (opcional)" aria-label="Local do retorno" />
        <button className="btn sm" style={{ marginTop: 8 }} disabled={!vDay} onClick={() => { add({ kind: 'retorno', day: vDay, time: vTime, text: vText }, `Retorno marcado para ${shortDate(vDay)}.`); setVDay(''); setVTime(''); setVText(''); }}>{next ? 'Mudar o retorno' : 'Marcar retorno'}</button>
      </section>
      <section className="card">
        <div className="row"><h2 style={{ margin: 0 }}>📝 Check-ins semanais</h2>
          <button className="link small inline" onClick={() => proApi('aluno/checkin/pedir', { code: student.code }).then(() => { toast(`Pedido enviado: ${student.name} vê o check-in na app.`); load(); })}>Pedir agora</button>
        </div>
        <p className="small mute" style={{ margin: '4px 0 8px' }}>O paciente responde na app de 7 em 7 dias (ou quando pedir): fome, saciedade, intestino, energia e adesão.</p>
        {checkins.filter((c) => !c.request).length === 0 && <p className="small mute">Ainda sem respostas.</p>}
        {checkins.filter((c) => !c.request).map((c) => (
          <p key={c.id} className="small" style={{ margin: '0 0 6px' }}>
            <b>{shortDate(c.day)}</b> · fome {c.fome || '—'}/5 · saciedade {c.saciedade || '—'}/5 · intestino {c.intestino || '—'}/5 · energia {c.energia || '—'}/5 · adesão <b>{c.adesao ?? '—'}/10</b>{c.nota ? ` · "${c.nota}"` : ''}
          </p>
        ))}
      </section>
      <section className="card">
        <h2 style={{ marginTop: 0 }}>🔒 Notas da consulta</h2>
        <p className="small mute" style={{ margin: '0 0 8px' }}>Só você vê. Use o formato que preferir (ex.: S/O/A/P).</p>
        <textarea className="field" rows={4} maxLength={2000} style={{ width: '100%', boxSizing: 'border-box' }} value={text} onChange={(e) => setText(e.target.value)} placeholder="ex.: S: refere mais fome à tarde. O: −1,2 kg em 3 semanas, cintura −3 cm. A: boa adesão ao almoço. P: aumentar proteína no lanche; retorno em 3 semanas." aria-label="Nota da consulta" />
        <button className="btn sm" style={{ marginTop: 8 }} disabled={text.trim().length < 2} onClick={() => { add({ kind: 'nota', text }, 'Nota guardada.'); setText(''); }}>Guardar nota</button>
        {notes?.filter((n) => n.kind === 'nota').map((n) => (
          <div key={n.id} className="note-row">
            <p className="small" style={{ margin: 0, whiteSpace: 'pre-wrap' }}><b>{shortDate(n.day)}</b> · {n.text}</p>
            <button className="link small inline" onClick={() => confirm('Apagar esta nota?') && proApi('aluno/nota/apagar', { code: student.code, id: n.id }).then(load)}>apagar</button>
          </div>
        ))}
      </section>
    </>
  );
}

const KIND_NAME: Record<string, string> = { personal: 'personal', nutricionista: 'nutricionista', medico: 'médico(a)', outro: 'profissional' };
/** Os outros profissionais do mesmo paciente (o paciente autorizou): o essencial que cada um definiu. */
export function TeamCard({ team, compact = false }: { team?: ProStudent['team']; compact?: boolean }) {
  if (!team?.length) return null;
  if (compact) return <p className="small mute" style={{ margin: '0 0 6px' }}>👥 Em equipa com {team.map((t) => `${t.pro} (${KIND_NAME[t.kind] ?? t.kind})`).join(', ')}</p>;
  return (
    <section className="card team-card">
      <h3 style={{ margin: '0 0 6px' }}>👥 Equipa</h3>
      {team.map((t) => (
        <div key={t.pro} style={{ marginBottom: 6 }}>
          <p className="small" style={{ margin: 0 }}><b>{t.pro}</b> · {KIND_NAME[t.kind] ?? t.kind}</p>
          {t.summary.map((x) => <p key={x} className="small mute" style={{ margin: '2px 0 0' }}>{x}</p>)}
        </div>
      ))}
      <p className="small mute" style={{ margin: '6px 0 0' }}>O paciente autorizou esta partilha e pode desligá-la a qualquer momento.</p>
    </section>
  );
}

/** Ficha do paciente para imprimir ou guardar em PDF: ficha e anamnese, avaliações, plano, check-ins, adesão e notas. */
export function PatientPrint({ student, onDone }: { student: ProStudent; onDone: () => void }) {
  const [data, setData] = useState<{ notes: NoteRow[]; checkins: CheckinRow[]; assess: (Assessment & { id: number })[]; logs: (ProLog & Partial<NutriDayLog>)[] } | null>(null);
  useEffect(() => {
    Promise.all([
      proApi<{ list: NoteRow[] }>('aluno/notas', { code: student.code }).catch(() => ({ list: [] })),
      proApi<{ list: CheckinRow[] }>('aluno/checkins', { code: student.code }).catch(() => ({ list: [] })),
      proApi<{ list: (Assessment & { id: number })[] }>('aluno/avaliacoes', { code: student.code }).catch(() => ({ list: [] })),
      proApi<{ logs: (ProLog & Partial<NutriDayLog>)[] }>('aluno/registos', { code: student.code }).catch(() => ({ logs: [] })),
    ]).then(([n, c, a, l]) => setData({ notes: n.list, checkins: c.list.filter((x) => !x.request), assess: a.list, logs: l.logs.filter((x) => x.workout === '__nutri') }));
  }, [student.code]);
  useEffect(() => {
    if (!data) return;
    const done = () => onDone();
    window.addEventListener('afterprint', done);
    const t = setTimeout(() => window.print(), 300);
    return () => { clearTimeout(t); window.removeEventListener('afterprint', done); };
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!data) return null;
  const p = student.profile;
  const rx = student.plan?.nutri;
  const adh = data.logs.slice(0, 14);
  const avg = adh.length ? Math.round(adh.reduce((t, x) => t + (x.pct ?? 0), 0) / adh.length) : null;
  return createPortal(
    <div className="print-report">
      <div className="pr-head"><span>NEFESH Life Pro</span><div><b>Ficha de {student.name}</b><span>{new Date().toLocaleDateString('pt-PT')}</span></div></div>
      <section>
        <h3>Ficha</h3>
        <p>{profileText(p) || 'Sem ficha registada.'}</p>
        {p?.anamnese && <ul>{ANAMNESE.filter(([k]) => p.anamnese?.[k]).map(([k, l]) => <li key={k}><b>{l}:</b> {p.anamnese![k]}</li>)}</ul>}
      </section>
      {data.assess.length > 0 && (
        <section>
          <h3>Avaliações físicas</h3>
          <table className="pr-table"><thead><tr><th>Data</th><th>Peso</th><th>% gordura</th><th>Massa gorda</th><th>Massa magra</th><th>Cintura</th></tr></thead>
            <tbody>{data.assess.map((a) => { const r = results(a); return <tr key={a.id}><td>{shortDate(a.day)}</td><td>{a.peso ?? '—'} kg</td><td>{r.gordura ?? '—'}%</td><td>{r.gorda ?? '—'}</td><td>{r.magra ?? '—'}</td><td>{a.medidas.cintura ?? '—'}</td></tr>; })}</tbody>
          </table>
        </section>
      )}
      {rx && (
        <section>
          <h3>Plano alimentar atual</h3>
          <p className="pr-small">Metas: {rx.targets.kcal || '—'} kcal · proteína {rx.targets.protein || '—'} g · hidratos {rx.targets.carbs || '—'} g · gordura {rx.targets.fat || '—'} g · fibra {rx.targets.fiber || '—'} g · água {rx.targets.water ? fmt(rx.targets.water) : '—'} L{rx.spirulina ? ` · Spirulina ${rx.spirulina} g/dia` : ''}</p>
          {rx.days.map((d) => (
            <div key={d.name}>
              <p><b>{d.name}</b>{d.weekdays.length ? ` (${d.weekdays.map((w) => WD[w]).join(', ')})` : ''} · total {dayTotals(d).kcal} kcal, P {fmt(dayTotals(d).p)} g</p>
              <ul>{d.meals.map((m) => <li key={m.label}><b>{m.time} {m.label}:</b> {m.options.filter((o) => o.items.length).map((o) => `${o.name}: ${o.items.map((i) => `${i.food} ${i.grams} g${i.measure ? ` (${i.measure})` : ''}`).join('; ')}`).join(' | ')}</li>)}</ul>
            </div>
          ))}
          {rx.notes && <p className="pr-small">Recomendações: {rx.notes}</p>}
          {student.plan?.jejum && <p className="pr-small">Jejum intermitente: {student.plan.jejum.protocol}{student.plan.jejum.protocol !== '5:2' ? `, janela a partir das ${student.plan.jejum.open}` : ''}</p>}
        </section>
      )}
      <section>
        <h3>Adesão ao plano (últimos registos)</h3>
        <p>{avg !== null ? `Média de ${avg}% em ${adh.length} ${adh.length === 1 ? 'dia registado' : 'dias registados'}.` : 'Sem registos.'}</p>
        {adh.length > 0 && <p className="pr-small">{adh.map((x) => `${shortDate(x.day)} ${x.pct ?? 0}%`).join(' · ')}</p>}
      </section>
      {data.checkins.length > 0 && (
        <section>
          <h3>Check-ins semanais</h3>
          <ul>{data.checkins.slice(0, 8).map((c) => <li key={c.id}>{shortDate(c.day)}: fome {c.fome || '—'}/5, saciedade {c.saciedade || '—'}/5, intestino {c.intestino || '—'}/5, energia {c.energia || '—'}/5, adesão {c.adesao ?? '—'}/10{c.nota ? ` — "${c.nota}"` : ''}</li>)}</ul>
        </section>
      )}
      {data.notes.filter((n) => n.kind === 'nota').length > 0 && (
        <section>
          <h3>Notas da consulta</h3>
          <ul>{data.notes.filter((n) => n.kind === 'nota').map((n) => <li key={n.id} style={{ whiteSpace: 'pre-wrap' }}><b>{shortDate(n.day)}:</b> {n.text}</li>)}</ul>
        </section>
      )}
      <p className="pr-foot">Documento confidencial com dados de saúde, gerado no NEFESH Life Pro. Guarde-o de acordo com as regras de proteção de dados (RGPD/LGPD).</p>
    </div>,
    document.body,
  );
}
