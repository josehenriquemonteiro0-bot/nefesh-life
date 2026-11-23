import { useState } from 'react';
import { searchNFoods } from '../domain/foodSearch';
import { proApi } from '../domain/pro';
import { dayTotals, itemFrom, mealFilled, type NItem, type NMeal, type NutriRx } from '../domain/proNutri';
import { profileText, type StudentProfile } from '../domain/proProfile';
import { useLongDictation } from './ProAI';

const joinText = (a: string, b: string) => (a.trim() ? `${a.trim()} ${b.trim()}` : b.trim());
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

/** Ditado de UMA refeição (modo "por voz"): a IA monta só esta refeição. */
export function MealDictation({ meal, dayName, about, onMeal }: { meal: NMeal; dayName: string; about: string; onMeal: (m: NMeal) => void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const mic = useLongDictation((t) => setText((x) => joinText(x, t).slice(0, 4000)), (m) => setErr(m));
  const go = async () => {
    setBusy(true); setErr(''); setMsg('');
    try {
      const r = await proApi<{ meals: NMeal[]; summary: string; doubts: string }>('ia/nutri-ditado', { text, day: dayName, meals: [meal], focus: meal.label, about });
      const got = r.meals.find((m) => m.key === meal.key) ?? r.meals[0];
      if (!got) { setErr('Não percebi os alimentos. Tente outra vez, com as quantidades.'); return; }
      onMeal({ ...meal, notes: got.notes || meal.notes, options: got.options.map((o) => ({ ...o, items: matchToBase(o.items) })) });
      setMsg(`${r.summary}${r.doubts ? ` · ⚠️ ${r.doubts}` : ''}`);
      setText('');
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <section className="card pro-ai">
      <p className="small" style={{ margin: '0 0 8px' }}><b>🎙️ Dite o {meal.label.toLowerCase()}</b> <span className="mute">· ex.: "2 ovos mexidos, 2 fatias de pão integral e café sem açúcar; opção B: iogurte natural com aveia"</span></p>
      <div className="row" style={{ gap: 10, justifyContent: 'flex-start', flexWrap: 'nowrap', marginBottom: 8 }}>
        <button className={`pro-mic sm ${mic.on ? 'on' : ''}`} onClick={mic.on ? mic.stop : () => { setErr(''); mic.start(); }} disabled={busy || mic.transcribing} aria-label={mic.on ? 'Parar de ouvir' : `Ditar ${meal.label}`}>{mic.on ? '■' : '🎙️'}</button>
        <span className="small">{mic.on ? <>A ouvir… <b>{mic.clock}</b> · toque em ■ quando acabar</> : mic.transcribing ? 'A passar a texto…' : 'Toque e fale, ou escreva em baixo.'}</span>
      </div>
      <textarea className="field" rows={3} style={{ width: '100%', boxSizing: 'border-box' }} value={mic.on && mic.partial ? joinText(text, mic.partial) : text} maxLength={4000} onChange={(e) => setText(e.target.value)} aria-label={`Ditado de ${meal.label}`} />
      <button className="btn sm" style={{ marginTop: 8 }} disabled={busy || mic.on || mic.transcribing || text.trim().length < 3} onClick={go}>{busy ? 'A montar…' : mealFilled(meal) ? 'Substituir com a IA' : 'Montar com a IA'}</button>
      {msg && <p className="small neon" style={{ margin: '8px 0 0' }}>✓ {msg}</p>}
      {err && <p className="small warn-t" style={{ margin: '8px 0 0' }}>{err}</p>}
      <p className="small mute" style={{ margin: '6px 0 0' }}>Os alimentos ficam com os valores da TACO quando o nome corresponde; os outros ficam "≈ estimativa". Pode corrigir em baixo.</p>
    </section>
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
      <h3 style={{ margin: '0 0 4px' }}>✨ Revisão pela IA{rx.days.length > 1 ? ` · ${day.name}` : ''}</h3>
      <p className="small mute" style={{ margin: '0 0 8px' }}>Compara com as metas e a ficha (alergias, condições, preferências). Só sugestões: nada é alterado.</p>
      <button className="btn sm" disabled={busy} onClick={run}>{busy ? 'A rever…' : review ? 'Rever outra vez' : 'Rever'}</button>
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
