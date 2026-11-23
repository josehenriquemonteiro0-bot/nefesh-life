import { useState } from 'react';
import { searchNFoods } from '../domain/foodSearch';
import { proApi } from '../domain/pro';
import { dayTotals, itemFrom, type NItem, type NMeal, type NutriRx } from '../domain/proNutri';
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

/** Ditado por voz (ou escrito) do plano do dia e revisão técnica pela IA. */
export function NutriAICard({ rx, dayIndex, profile, onRx }: { rx: NutriRx; dayIndex: number; profile: StudentProfile | null; onRx: (r: NutriRx) => void }) {
  const [mode, setMode] = useState<'' | 'ditar' | 'rever'>('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [review, setReview] = useState<{ general: string[]; notes: { meal: string; note: string }[] } | null>(null);
  const mic = useLongDictation((t) => setText((x) => joinText(x, t).slice(0, 4000)), (m) => setErr(m));
  const day = rx.days[Math.min(dayIndex, rx.days.length - 1)];
  const about = [profileText(profile), ...Object.entries(profile?.anamnese ?? {}).map(([k, v]) => `${k}: ${v}`)].filter(Boolean).join('; ');

  const dictate = async () => {
    setBusy(true); setErr(''); setMsg('');
    try {
      const r = await proApi<{ meals: NMeal[]; removed?: string[]; summary: string; doubts: string }>('ia/nutri-ditado', { text, day: day.name, meals: day.meals, about });
      const got = r.meals.map((m) => ({ ...m, options: m.options.map((o) => ({ ...o, items: matchToBase(o.items) })) }));
      const meals = mergeMeals(day.meals, got, r.removed ?? []);
      onRx({ ...rx, days: rx.days.map((d) => (d === day ? { ...d, meals } : d)) });
      setMsg(`${r.summary}${r.doubts ? ` · ⚠️ ${r.doubts}` : ''}`);
      setText('');
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const runReview = async () => {
    setBusy(true); setErr('');
    try {
      setReview(await proApi('ia/nutri-rever', { day: day.name, meals: day.meals, targets: rx.targets, totals: dayTotals(day), about }));
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <section className="card pro-ai">
      <div className="row" style={{ gap: 8, justifyContent: 'flex-start', flexWrap: 'wrap' }}>
        <button className={`btn sm ${mode === 'ditar' ? '' : 'ghost'}`} onClick={() => setMode(mode === 'ditar' ? '' : 'ditar')}>🎙️ Ditar o plano</button>
        <button className={`btn sm ${mode === 'rever' ? '' : 'ghost'}`} onClick={() => setMode(mode === 'rever' ? '' : 'rever')}>✨ Revisão pela IA</button>
      </div>
      {mode === 'ditar' && (
        <div style={{ marginTop: 10 }}>
          <p className="small mute" style={{ margin: '0 0 8px' }}>Dite uma ou várias refeições de "{day.name}". Ex.: <i>"Pequeno-almoço às 7h30: 2 ovos mexidos, 2 fatias de pão integral e café sem açúcar. Almoço: 4 colheres de arroz integral, 1 concha de feijão, 1 filé de frango grelhado e salada; opção B: patinho com mandioca."</i></p>
          <div className="row" style={{ gap: 10, justifyContent: 'flex-start', flexWrap: 'nowrap', marginBottom: 8 }}>
            <button className={`pro-mic sm ${mic.on ? 'on' : ''}`} onClick={mic.on ? mic.stop : () => { setErr(''); mic.start(); }} disabled={busy || mic.transcribing} aria-label={mic.on ? 'Parar de ouvir' : 'Ditar'}>{mic.on ? '■' : '🎙️'}</button>
            <span className="small">{mic.on ? <>A ouvir… <b>{mic.clock}</b> · toque em ■ quando acabar</> : mic.transcribing ? 'A passar a texto…' : 'Toque e fale, ou escreva em baixo.'}</span>
          </div>
          <textarea className="field" rows={4} style={{ width: '100%', boxSizing: 'border-box' }} value={mic.on && mic.partial ? joinText(text, mic.partial) : text} maxLength={4000} onChange={(e) => setText(e.target.value)} aria-label="Ditado do plano" />
          <button className="btn sm" style={{ marginTop: 8 }} disabled={busy || mic.on || mic.transcribing || text.trim().length < 3} onClick={dictate}>{busy ? 'A montar…' : 'Montar com a IA'}</button>
          <p className="small mute" style={{ margin: '6px 0 0' }}>Os alimentos ficam com os valores da TACO quando o nome corresponde; os restantes ficam marcados "≈ estimativa". Reveja sempre antes de enviar.</p>
        </div>
      )}
      {mode === 'rever' && (
        <div style={{ marginTop: 10 }}>
          <p className="small mute" style={{ margin: '0 0 8px' }}>A IA compara "{day.name}" com as metas e a ficha (alergias, condições, preferências) e deixa sugestões. Nada é alterado no plano.</p>
          <button className="btn sm" disabled={busy} onClick={runReview}>{busy ? 'A rever…' : review ? 'Rever outra vez' : 'Rever este dia'}</button>
          {review && (
            <div className="pro-review" style={{ marginTop: 10 }}>
              {review.general.map((g, i) => <p key={i} className="small" style={{ margin: '0 0 6px' }}>• {g}</p>)}
              {review.notes.map((n, i) => <p key={`n${i}`} className="small" style={{ margin: '0 0 6px' }}><b>{n.meal}:</b> {n.note}</p>)}
              <p className="small mute" style={{ margin: '6px 0 0' }}>Sugestões da IA para a sua decisão profissional.</p>
            </div>
          )}
        </div>
      )}
      {msg && <p className="small neon" style={{ margin: '8px 0 0' }}>✓ {msg}</p>}
      {err && <p className="small warn-t" style={{ margin: '8px 0 0' }}>{err}</p>}
    </section>
  );
}
