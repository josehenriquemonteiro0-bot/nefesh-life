import { useEffect, useState } from 'react';
import { FOODS, MEALS, entryOf, type FoodEntry } from '../domain/foods';
import { STATUS_LABEL, describeChanges, type PlanMealLog, type PlanStatus } from '../domain/planAdherence';
import { diaryMeal, planEntries, type PlanItem } from '../domain/planRead';
import type { DayLog } from '../domain/types';
import { useStore } from '../state/store';
import { DecimalInput } from './DecimalInput';

const FACTORS = [0.5, 1, 1.5, 2];
const scale = (it: PlanItem, f: number): PlanItem =>
  f === 1
    ? it
    : { ...it, quantity: `${it.quantity || 'porção'} ×${String(f).replace('.', ',')}`, grams: it.grams * f, kcal: it.kcal * f, protein_g: it.protein_g * f, carbs_g: it.carbs_g * f, fat_g: it.fat_g * f };

/** Remove do diário as entradas que vieram desta refeição do plano. */
function clearPlanMeal(d: DayLog, ref: string) {
  if (d.meals) {
    const m = { ...d.meals };
    for (const k of Object.keys(m) as (keyof typeof m)[]) m[k] = (m[k] || []).filter((e) => e.planRef !== ref);
    d.meals = m;
  }
  if (d.planLog) {
    const p = { ...d.planLog };
    delete p[ref];
    d.planLog = p;
  }
}

/** Marcar uma refeição do plano: segui, fiz alterações ou não fiz. */
export function PlanMealSheet({ idx, onClose }: { idx: number; onClose: () => void }) {
  const { S, todayLog: l, updateToday, toast } = useStore();
  const meal = S.nutriPlan!.meals[idx];
  const ref = String(idx);
  const current = l.planLog?.[ref];
  const [opt, setOpt] = useState(current?.option ?? 0);
  const [edit, setEdit] = useState(false);
  const option = meal.options[opt] ?? meal.options[0];
  const [items, setItems] = useState(option.items.map(() => ({ eaten: true, factor: 1 })));
  const [extras, setExtras] = useState<{ name: string; kcal?: number }[]>([]);
  const [extraName, setExtraName] = useState('');
  const [extraKcal, setExtraKcal] = useState<number | undefined>();
  const [note, setNote] = useState(current?.note ?? '');
  const hide = !!S.hideCalories;
  const target = diaryMeal(meal.meal);
  const targetLabel = MEALS.find((m) => m[0] === target)![1];

  useEffect(() => setItems(option.items.map(() => ({ eaten: true, factor: 1 }))), [opt]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const save = (status: PlanStatus, entries: FoodEntry[], changes?: string[]) => {
    updateToday((d) => {
      clearPlanMeal(d, ref);
      if (entries.length) {
        d.meals = { ...(d.meals || {}) };
        d.meals[target] = [...(d.meals[target] || []), ...entries.map((e) => ({ ...e, planRef: ref }))];
      }
      const entry: PlanMealLog = { status, option: opt, ...(changes?.length ? { changes } : {}), ...(note.trim() ? { note: note.trim() } : {}) };
      d.planLog = { ...(d.planLog || {}), [ref]: entry };
    });
    toast(`${meal.label}: ${STATUS_LABEL[status].toLowerCase()}.`);
    onClose();
  };

  const followAsIs = () => save('seguido', planEntries(option.items));

  const saveEdited = () => {
    const eaten = option.items.map((it, i) => ({ it, ...items[i] })).filter((x) => x.eaten);
    const entries = planEntries(eaten.map((x) => scale(x.it, x.factor)));
    for (const x of extras) {
      const food = FOODS.find((f) => f.name.toLowerCase() === x.name.toLowerCase());
      entries.push(food ? entryOf(food, food.grams) : { id: `extra-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`, name: x.name, grams: 0, kcal: Math.round(x.kcal ?? 0), p: 0, c: 0, f: 0 });
    }
    const changes = describeChanges(option.items.map((it, i) => ({ name: it.name, ...items[i] })), extras.map((x) => x.name));
    save(changes.length ? 'alterado' : 'seguido', entries, changes);
  };

  const kcalOf = (list: PlanItem[]) => Math.round(list.reduce((t, it) => t + (it.kcal || 0), 0));
  /** calorias de um alimento extra: as escritas pela pessoa ou a porção habitual da base de alimentos */
  const kcalOfExtra = (x: { name: string; kcal?: number }) => {
    if (x.kcal) return x.kcal;
    const food = FOODS.find((f) => f.name.toLowerCase() === x.name.toLowerCase());
    return food ? Math.round((food.kcal * food.grams) / 100) : 0;
  };
  const editedKcal =
    kcalOf(option.items.map((it, i) => (items[i]?.eaten ? scale(it, items[i].factor) : { ...it, kcal: 0 }))) +
    extras.reduce((t, x) => t + kcalOfExtra(x), 0);

  return (
    <div className="modal show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={meal.label}>
        <div className="row">
          <h2 style={{ margin: 0 }}>{meal.label}{meal.time ? ` · ${meal.time}` : ''}</h2>
          <button className="btn ghost sm" onClick={onClose}>Fechar</button>
        </div>
        {current && (
          <div className={`plan-status st-${current.status}`}>
            <span><b>{STATUS_LABEL[current.status]}</b>{current.changes?.length ? `: ${current.changes.join(', ')}` : ''}{current.note ? ` · ${current.note}` : ''}</span>
            <button
              className="btn ghost sm"
              onClick={() => {
                updateToday((d) => clearPlanMeal(d, ref));
                toast(`${meal.label}: marcação desfeita.`);
                onClose();
              }}
            >
              Desfazer
            </button>
          </div>
        )}

        {meal.options.length > 1 && (
          <div className="chips" style={{ margin: '12px 0' }} role="group" aria-label="Opção">
            {meal.options.map((o, i) => (
              <button key={i} className={`chip ${opt === i ? 'on' : ''}`} aria-pressed={opt === i} onClick={() => setOpt(i)}>{o.name}</button>
            ))}
          </div>
        )}

        {!edit ? (
          <>
            <ul className="small plan-list">
              {option.items.map((it, k) => <li key={k}>{it.name}{it.quantity ? ` — ${it.quantity}` : ''}</li>)}
            </ul>
            {!hide && <p className="small mute" style={{ margin: '0 0 12px' }}>Cerca de {kcalOf(option.items)} kcal · vai para o {targetLabel.toLowerCase()} do diário</p>}
            <div className="plan-actions">
              <button className="btn full" onClick={followAsIs}>✓ Segui tal como está</button>
              <button className="btn ghost full" onClick={() => setEdit(true)}>✎ Fiz alterações</button>
              <button className="btn ghost full" onClick={() => save('saltado', [])}>Não fiz esta refeição</button>
            </div>
          </>
        ) : (
          <>
            <p className="small mute" style={{ margin: '10px 0' }}>Desmarque o que não comeu e ajuste as quantidades.</p>
            <div className="exlist">
              {option.items.map((it, i) => (
                <div key={i} className={`ex ${items[i]?.eaten ? '' : 'done'}`}>
                  <label className="row" style={{ flexWrap: 'nowrap', gap: 10, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!items[i]?.eaten} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, eaten: e.target.checked } : x)))} />
                    <span style={{ flex: 1 }}><b>{it.name}</b> <span className="small mute">{it.quantity}</span></span>
                  </label>
                  {items[i]?.eaten && (
                    <div className="chips" style={{ marginTop: 8 }} role="group" aria-label={`Quantidade de ${it.name}`}>
                      {FACTORS.map((f) => (
                        <button key={f} className={`chip ${items[i].factor === f ? 'on' : ''}`} aria-pressed={items[i].factor === f} onClick={() => setItems(items.map((x, j) => (j === i ? { ...x, factor: f } : x)))}>
                          {f === 0.5 ? '½' : f === 1.5 ? '1½' : f}×
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <h3 style={{ marginTop: 14 }}>Comi também</h3>
            {extras.length > 0 && (
              <ul className="small plan-list">
                {extras.map((x, i) => (
                  <li key={i}>
                    {x.name}{!hide && x.kcal ? ` · ${x.kcal} kcal` : ''}{' '}
                    <button className="link small inline" onClick={() => setExtras(extras.filter((_, j) => j !== i))}>remover</button>
                  </li>
                ))}
              </ul>
            )}
            <div className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
              <input className="field sm" list="nefesh-foods" value={extraName} onChange={(e) => setExtraName(e.target.value)} placeholder="Ex.: Batata cozida" aria-label="Alimento extra" />
              {!hide && (
                <span className="measure-in" style={{ flex: 'none' }}>
                  <DecimalInput decimals={false} value={extraKcal} onValue={setExtraKcal} placeholder="kcal" aria-label="Calorias do alimento extra" />
                </span>
              )}
              <button
                className="btn ghost sm"
                disabled={!extraName.trim()}
                onClick={() => {
                  setExtras([...extras, { name: extraName.trim(), kcal: extraKcal }]);
                  setExtraName('');
                  setExtraKcal(undefined);
                }}
              >
                +
              </button>
            </div>
            <datalist id="nefesh-foods">{FOODS.map((f) => <option key={f.id} value={f.name} />)}</datalist>
            <p className="small mute" style={{ margin: '6px 0 0' }}>Se escolher um alimento da lista, a app usa a porção habitual dele.</p>

            <input className="field sm" style={{ width: '100%', margin: '14px 0 10px' }} value={note} maxLength={140} onChange={(e) => setNote(e.target.value)} placeholder="Nota para o nutricionista (opcional, ex.: jantar fora)" aria-label="Nota" />
            <button className="btn full" onClick={saveEdited}>Guardar com alterações</button>
            <p />
            <button className="btn ghost full" onClick={() => setEdit(false)}>Voltar</button>
          </>
        )}
        {!hide && edit && option.items.some((it) => it.kcal) && (
          <p className="small mute" style={{ margin: '10px 0 0' }}>
            Plano: {kcalOf(option.items)} kcal · com as suas alterações: {editedKcal} kcal
          </p>
        )}
      </div>
    </div>
  );
}
