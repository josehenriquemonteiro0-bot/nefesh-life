import { useState } from 'react';
import { todayKey } from '../domain/dates';
import { loadFile } from '../domain/files';
import type { PhotoError } from '../domain/photo';
import { readPlan } from '../domain/planRead';
import { STATUS_LABEL, dayAdherence } from '../domain/planAdherence';
import { Bar } from './Charts';
import { PlanMealSheet } from './PlanMealSheet';
import { useStore } from '../state/store';
import { PremiumTag } from './PremiumTag';

/** Plano do nutricionista lido pela IA: refeições, alternativas e registo com um toque. */
export function NutriPlanCard() {
  const { S, update, todayLog: l, toast } = useStore();
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
  const log = l.planLog ?? {};
  const adh = dayAdherence(S, todayKey());
  return (
    <section className="card">
      <div className="row">
        <h2 style={{ margin: 0 }}>Hoje no seu plano{(plan as { day?: string }).day && S.proNutriRx && S.proNutriRx.days.length > 1 ? <span className="small mute" style={{ fontWeight: 400 }}> · {(plan as { day?: string }).day}</span> : null}</h2>
        {meta.type !== 'nefesh-pro' && <PremiumTag f="lerPlano" />}
      </div>
      <p className="small mute" style={{ margin: '4px 0 10px' }}>
        {pro ? `Plano de ${pro}. ` : ''}Toque numa refeição para marcar o que fez.
      </p>
      <div className="row small" style={{ marginBottom: 2 }}>
        <span>{adh.done} de {adh.total} refeições marcadas</span>
        <span className="mute">adesão {adh.pct}%</span>
      </div>
      <Bar pct={adh.pct} />
      {plan.daily_kcal > 0 && !S.nutriPro && !hide && (
        <button
          className="btn ghost sm"
          style={{ margin: '6px 0 10px' }}
          onClick={() => {
            update((d) => { d.nutriPro = { kcal: Math.round(plan.daily_kcal), protein: plan.daily_protein_g ? Math.round(plan.daily_protein_g) : undefined, by: pro || 'o seu nutricionista', at: todayKey() }; });
            toast('A meta do plano passou a ser a do diário.');
          }}
        >
          Usar a meta do plano ({Math.round(plan.daily_kcal).toLocaleString('pt-PT')} kcal)
        </button>
      )}
      <div className="planmeals" style={{ marginTop: 10 }}>
        {plan.meals.map((m, i) => {
          const st = log[String(i)];
          return (
            <button key={i} className={`planrow ${st ? `st-${st.status}` : ''}`} onClick={() => setOpen(i)}>
              <span className="st-dot" aria-hidden="true">{st ? (st.status === 'seguido' ? '✓' : st.status === 'alterado' ? '✎' : '–') : ''}</span>
              <span style={{ flex: 1, display: 'grid' }}>
                <b>{m.label}{m.time ? ` · ${m.time}` : ''}</b>
                <span className="small mute">
                  {st ? `${STATUS_LABEL[st.status]}${st.changes?.length ? `: ${st.changes.join(', ')}` : ''}` : `${m.options.length} ${m.options.length === 1 ? 'opção' : 'opções'} · por fazer`}
                </span>
              </span>
              <span className="mute" aria-hidden="true">›</span>
            </button>
          );
        })}
      </div>
      {plan.notes && <p className="small" style={{ margin: '12px 0 0' }}><b>Recomendações do plano:</b> {plan.notes}</p>}
      {meta.type === 'nefesh-pro' ? (
        <p className="small mute" style={{ margin: '10px 0 0' }}>Plano montado por {pro || 'o seu nutricionista'} na NEFESH Life Pro. Quando o atualizar, chega aqui sozinho.</p>
      ) : (
        <p className="small mute" style={{ margin: '10px 0 0' }}>
          Transcrição feita por IA. Em caso de dúvida, vale sempre o documento original do seu nutricionista.{' '}
          <button className="link small inline" disabled={busy} onClick={read}>{busy ? 'A ler…' : 'Ler de novo'}</button>
        </p>
      )}
      {error && <p className="small warn-t" style={{ margin: '8px 0 0' }}>{error}</p>}
      {open !== null && plan.meals[open] && <PlanMealSheet idx={open} onClose={() => setOpen(null)} />}
    </section>
  );
}
