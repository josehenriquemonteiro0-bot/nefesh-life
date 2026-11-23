import { useState } from 'react';
import { searchNFoods } from '../domain/foodSearch';
import { proApi } from '../domain/pro';
import { dayTotals, itemFrom, type NItem, type NMeal, type NutriRx } from '../domain/proNutri';
import { profileText, type StudentProfile } from '../domain/proProfile';
import { useLongDictation } from './ProAI';

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Os alimentos ditados ficam com os valores da base (TACO/app) quando o nome corresponde bem;
 * senão ficam com a estimativa da IA, marcada como "≈" na medida.
 */
export function matchToBase(items: NItem[]): NItem[] {
  return items.map((it) => {
    const words = norm(it.food).replace(/[,()]/g, ' ').split(/\s+/).filter((w) => w.length >= 3);
    const best = searchNFoods(it.food, 5).find((f) => { const n = norm(f.name); return words.filter((w) => n.includes(w)).length >= Math.max(1, Math.ceil(words.length * 0.75)); });
    if (best) return itemFrom(best, it.grams, it.measure);
    return { ...it, measure: it.measure ? `${it.measure} ≈` : '≈ estimativa' };
  });
}

/** Junta o que a IA devolveu às refeições que já existiam: as devolvidas substituem, as outras ficam (exceto as retiradas). */
export function mergeMeals(current: NMeal[], got: NMeal[], removed: string[]): NMeal[] {
  const keep = current.filter((m) => !got.some((g) => g.key === m.key) && !removed.includes(m.key));
  return [...keep, ...got].sort((a, b) => a.time.localeCompare(b.time));
}

/**
 * Voz numa refeição: o nutricionista fala e os alimentos entram logo na refeição (juntam-se aos que já estão).
 * A IA só passa a fala para alimentos e quantidades; quem decide é o nutricionista (pode desfazer ou corrigir).
 */
export function MealDictation({ meal, dayName, about, onMeal }: { meal: NMeal; dayName: string; about: string; onMeal: (m: NMeal) => void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [last, setLast] = useState<{ heard: string; added: string[]; before: NMeal } | null>(null);
  const add = async (said: string) => {
    const t = said.trim();
    if (t.length < 3) return;
    setBusy(true); setErr('');
    try {
      const r = await proApi<{ meals: NMeal[]; summary: string; doubts: string }>('ia/nutri-ditado', { text: t, day: dayName, meals: [meal], focus: meal.label, about, mode: 'acrescentar' });
      const got = r.meals.find((m) => m.key === meal.key) ?? r.meals[0];
      const newOpts = (got?.options ?? []).map((o) => ({ ...o, items: matchToBase(o.items) })).filter((o) => o.items.length);
      if (!newOpts.length) { setErr('Não percebi os alimentos. Tente outra vez, com as quantidades.'); return; }
      const options = [...meal.options];
      newOpts.forEach((o, i) => {
        if (options[i]) options[i] = { ...options[i], items: [...options[i].items, ...o.items] };
        else options.push({ name: `Opção ${'ABCD'[i] ?? i + 1}`, items: o.items });
      });
      onMeal({ ...meal, options: options.slice(0, 4) });
      setLast({ heard: t, added: newOpts.flatMap((o) => o.items.map((i) => `${i.food.split(',')[0]} ${i.grams} g`)), before: meal });
      if (r.doubts) setErr(`⚠️ ${r.doubts}`);
      setText('');
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const mic = useLongDictation((t) => { void add(t); }, (m) => setErr(m));
  return (
    <section className="card pro-ai">
      <div className="row" style={{ gap: 10, justifyContent: 'flex-start', flexWrap: 'nowrap' }}>
        <button className={`pro-mic ${mic.on ? 'on' : ''}`} onClick={mic.on ? mic.stop : () => { setErr(''); mic.start(); }} disabled={busy || mic.transcribing} aria-label={mic.on ? 'Parar de ouvir' : `Falar o ${meal.label.toLowerCase()}`}>{mic.on ? '■' : '🎙️'}</button>
        <span className="small">{mic.on ? <>A ouvir… <b>{mic.clock}</b> · toque em ■ quando acabar</> : mic.transcribing ? 'A passar a texto…' : busy ? 'A juntar ao plano…' : <>Fale o que entra no <b>{meal.label.toLowerCase()}</b>, com as quantidades.</>}</span>
      </div>
      {mic.on && mic.partial && <p className="small mute" style={{ margin: '8px 0 0' }}>“{mic.partial}”</p>}
      {last && (
        <div className="pro-ask" style={{ marginTop: 10 }}>
          <p className="small" style={{ margin: 0 }}>Ouvi: “{last.heard}”</p>
          <p className="small neon" style={{ margin: '4px 0 0' }}>✓ Juntei: {last.added.join(', ')}</p>
          <button className="link small inline" style={{ marginTop: 4 }} onClick={() => { onMeal(last.before); setLast(null); }}>Desfazer</button>
        </div>
      )}
      <div className="row" style={{ gap: 8, flexWrap: 'nowrap', marginTop: 10 }}>
        <input className="field sm" style={{ flex: 1 }} value={text} maxLength={600} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add(text)} placeholder="ou escreva: 2 ovos mexidos, 1 fatia de pão integral" aria-label={`Escrever ${meal.label}`} />
        <button className="btn ghost sm" disabled={busy || text.trim().length < 3} onClick={() => add(text)}>Adicionar</button>
      </div>
      {err && <p className="small warn-t" style={{ margin: '8px 0 0' }}>{err}</p>}
    </section>
  );
}

/** Pedir à IA uma alternativa equivalente para uma refeição (o nutricionista junta-a ou descarta). */
export function SuggestOption({ meal, dayName, about, onMeal }: { meal: NMeal; dayName: string; about: string; onMeal: (m: NMeal) => void }) {
  const [busy, setBusy] = useState(false);
  const [sug, setSug] = useState<NItem[] | null>(null);
  const [err, setErr] = useState('');
  const ask = async () => {
    setBusy(true); setErr('');
    try {
      const r = await proApi<{ meals: NMeal[] }>('ia/nutri-ditado', { text: 'Sugere uma alternativa equivalente.', day: dayName, meals: [meal], focus: meal.label, about, mode: 'sugerir' });
      const items = matchToBase((r.meals[0]?.options[0]?.items ?? []));
      if (!items.length) setErr('A IA não sugeriu nada desta vez.'); else setSug(items);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const name = `Opção ${'ABCD'[meal.options.length] ?? meal.options.length + 1}`;
  return (
    <div className="nutri-sug">
      <div className="row" style={{ gap: 8 }}>
        <span className="small"><b>{meal.label}</b> · {meal.time} · {meal.options[0]?.items.reduce((t, i) => t + i.kcal, 0) ?? 0} kcal, P {Math.round(meal.options[0]?.items.reduce((t, i) => t + i.p, 0) ?? 0)} g · {meal.options.length} {meal.options.length === 1 ? 'opção' : 'opções'}</span>
        {!sug && meal.options.length < 4 && <button className="link small inline" disabled={busy} onClick={ask}>{busy ? 'A pensar…' : '💡 Sugerir outra opção'}</button>}
      </div>
      {sug && (
        <div className="pro-ask" style={{ marginTop: 6 }}>
          <p className="small" style={{ margin: 0 }}>Sugestão da IA: {sug.map((i) => `${i.food.split(',')[0]} ${i.grams} g${i.measure ? ` (${i.measure})` : ''}`).join(' · ')} — {sug.reduce((t, i) => t + i.kcal, 0)} kcal</p>
          <div className="row" style={{ gap: 8, justifyContent: 'flex-start', marginTop: 6 }}>
            <button className="btn sm" onClick={() => { onMeal({ ...meal, options: [...meal.options, { name, items: sug }] }); setSug(null); }}>Juntar como {name}</button>
            <button className="btn ghost sm" onClick={() => setSug(null)}>Descartar</button>
          </div>
        </div>
      )}
      {err && <p className="small warn-t" style={{ margin: '4px 0 0' }}>{err}</p>}
    </div>
  );
}

/** Revisão técnica de um tipo de dia pela IA (no passo "Rever e enviar"). */
export function NutriReview({ rx, dayIndex, profile }: { rx: NutriRx; dayIndex: number; profile: StudentProfile | null }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [review, setReview] = useState<{ general: string[]; notes: { meal: string; note: string }[] } | null>(null);
  const day = rx.days[Math.min(dayIndex, rx.days.length - 1)];
  const about = [profileText(profile), ...Object.entries(profile?.anamnese ?? {}).map(([k, v]) => `${k}: ${v}`)].filter(Boolean).join('; ');
  const run = async () => {
    setBusy(true); setErr('');
    try { setReview(await proApi('ia/nutri-rever', { day: day.name, meals: day.meals, targets: rx.targets, totals: dayTotals(day), about })); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <section className="card pro-ai">
      <h3 style={{ margin: '0 0 4px' }}>✨ Segunda opinião da IA (opcional){rx.days.length > 1 ? ` · ${day.name}` : ''}</h3>
      <p className="small mute" style={{ margin: '0 0 8px' }}>A IA compara com as metas e a ficha (alergias, condições, preferências) e deixa notas. É só um apoio: nada é alterado e a decisão é sua.</p>
      <button className="btn sm" disabled={busy} onClick={run}>{busy ? 'A rever…' : review ? 'Pedir outra vez' : 'Pedir segunda opinião'}</button>
      {review && (
        <div className="pro-review" style={{ marginTop: 10 }}>
          {review.general.map((g, i) => <p key={i} className="small" style={{ margin: '0 0 6px' }}>• {g}</p>)}
          {review.notes.map((n, i) => <p key={`n${i}`} className="small" style={{ margin: '0 0 6px' }}><b>{n.meal}:</b> {n.note}</p>)}
        </div>
      )}
      {err && <p className="small warn-t" style={{ margin: '8px 0 0' }}>{err}</p>}
    </section>
  );
}
