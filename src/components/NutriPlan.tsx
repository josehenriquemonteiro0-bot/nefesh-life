import { useState } from 'react';
import { todayKey } from '../domain/dates';
import { loadFile } from '../domain/files';
import { MEALS } from '../domain/foods';
import type { PhotoError } from '../domain/photo';
import { diaryMeal, planEntries, readPlan } from '../domain/planRead';
import { useStore } from '../state/store';
import { PremiumTag } from './PremiumTag';

/** Plano do nutricionista lido pela IA: refeições, alternativas e registo com um toque. */
export function NutriPlanCard() {
  const { S, update, updateToday, toast } = useStore();
  const meta = S.plans?.nutri;
  const plan = S.nutriPlan && meta && S.nutriPlan.name === meta.name ? S.nutriPlan : null;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const hide = !!S.hideCalories;
  if (!meta) return null;

  const read = async () => {
    setBusy(true);
    setError(null);
    try {
      const file = await loadFile('nutri');
      if (!file) throw new Error('O ficheiro já não está neste telemóvel. Carregue-o de novo.');
      const r = await readPlan(file, meta.name);
      if (!r.is_plan) {
        setError('Não encontrei um plano alimentar neste ficheiro.');
        return;
      }
      update((d) => { d.nutriPlan = { ...r, at: todayKey(), name: meta.name }; });
      toast(`Plano lido: ${r.meals.length} ${r.meals.length === 1 ? 'refeição' : 'refeições'}.`);
    } catch (e) {
      setError((e as PhotoError).message);
    } finally {
      setBusy(false);
    }
  };

  if (!plan)
    return (
      <section className="card">
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <div style={{ flex: '1 1 200px' }}>
            <h3 style={{ margin: 0 }}>Transformar o plano em refeições <PremiumTag f="lerPlano" /></h3>
            <p className="small mute" style={{ margin: '4px 0 0' }}>A NEFESH Life lê o seu plano e mostra-o por refeição, para registar o que comeu com um toque. Nada do que o nutricionista escreveu é alterado.</p>
          </div>
        </div>
        <button className="btn sm" style={{ marginTop: 10 }} disabled={busy} onClick={read}>{busy ? 'A ler o plano… (até 1 minuto)' : 'Ler o meu plano'}</button>
        {busy && <div className="prog" style={{ margin: '12px 0 0' }}><i className="indeterminate" /></div>}
        {error && <p className="small warn-t" style={{ margin: '10px 0 0' }}>{error}</p>}
      </section>
    );

  const pro = plan.professional || meta.by;
  return (
    <section className="card">
      <div className="row">
        <h2 style={{ margin: 0 }}>O meu plano por refeição</h2>
        <PremiumTag f="lerPlano" />
      </div>
      <p className="small mute" style={{ margin: '4px 0 10px' }}>
        {pro ? `Plano de ${pro}. ` : ''}Toque numa refeição para ver as opções e registar.
      </p>
      {plan.daily_kcal > 0 && !S.nutriPro && !hide && (
        <button
          className="btn ghost sm"
          style={{ marginBottom: 10 }}
          onClick={() => {
            update((d) => { d.nutriPro = { kcal: Math.round(plan.daily_kcal), protein: plan.daily_protein_g ? Math.round(plan.daily_protein_g) : undefined, by: pro || 'o seu nutricionista', at: todayKey() }; });
            toast('A meta do plano passou a ser a do diário.');
          }}
        >
          Usar a meta do plano ({Math.round(plan.daily_kcal).toLocaleString('pt-PT')} kcal)
        </button>
      )}
      <div className="planmeals">
        {plan.meals.map((m, i) => {
          const isOpen = open === i;
          const target = diaryMeal(m.meal);
          const targetLabel = MEALS.find((x) => x[0] === target)![1];
          return (
            <div key={i} className="planmeal">
              <button className="ex-head" onClick={() => setOpen(isOpen ? null : i)} aria-expanded={isOpen}>
                <b>{m.label}{m.time ? ` · ${m.time}` : ''}</b>
                <span className="small mute">{m.options.length} {m.options.length === 1 ? 'opção' : 'opções'}</span>
              </button>
              {isOpen &&
                m.options.map((o, j) => {
                  const kcal = o.items.reduce((t, it) => t + (it.kcal || 0), 0);
                  return (
                    <div key={j} className="planopt">
                      {m.options.length > 1 && <p className="small" style={{ margin: '0 0 4px', fontWeight: 700 }}>{o.name}</p>}
                      <ul className="small">
                        {o.items.map((it, k) => (
                          <li key={k}>{it.name}{it.quantity ? ` — ${it.quantity}` : ''}</li>
                        ))}
                      </ul>
                      <button
                        className="btn sm"
                        onClick={() => {
                          const entries = planEntries(o.items);
                          updateToday((d) => {
                            d.meals = { ...(d.meals || {}) };
                            d.meals[target] = [...(d.meals[target] || []), ...entries];
                          });
                          toast(`Registado no diário: ${m.label}${m.label.toLowerCase() === targetLabel.toLowerCase() ? '' : ` (em ${targetLabel.toLowerCase()})`}${hide ? '' : `, ${Math.round(kcal)} kcal`}.`);
                        }}
                      >
                        Comi esta opção{hide ? '' : ` · ${Math.round(kcal)} kcal`}
                      </button>
                    </div>
                  );
                })}
            </div>
          );
        })}
      </div>
      {plan.notes && <p className="small" style={{ margin: '12px 0 0' }}><b>Recomendações do plano:</b> {plan.notes}</p>}
      <p className="small mute" style={{ margin: '10px 0 0' }}>
        Transcrição feita por IA. Em caso de dúvida, vale sempre o documento original do seu nutricionista.{' '}
        <button className="link small inline" disabled={busy} onClick={read}>{busy ? 'A ler…' : 'Ler de novo'}</button>
      </p>
      {error && <p className="small warn-t" style={{ margin: '8px 0 0' }}>{error}</p>}
    </section>
  );
}
