import { useState } from 'react';
import { BODY_GOAL_LABEL, bodyOf } from '../domain/body';
import { todayKey } from '../domain/dates';
import { useStore } from '../state/store';
import { DecimalInput } from './DecimalInput';
import { fmtNum } from '../domain/dates';
import type { Answers } from '../domain/types';

const LEVEL_CLS = { baixo: 'pos-low', normal: 'pos-up', excesso: 'pos-low', obesidade: 'pos-low' } as const;

/** IMC, % de gordura, metabolismo e meta calórica. */
/** Metas definidas pelo nutricionista: substituem a referência da app no diário. */
function ProTargets() {
  const { S, update, toast } = useStore();
  const [open, setOpen] = useState(false);
  const [kcal, setKcal] = useState<number | undefined>(S.nutriPro?.kcal);
  const [protein, setProtein] = useState<number | undefined>(S.nutriPro?.protein);
  const [by, setBy] = useState(S.nutriPro?.by ?? S.plans?.nutri?.by ?? '');
  if (S.nutriPro)
    return (
      <button className="btn ghost sm" style={{ marginTop: 10 }} onClick={() => { update((d) => { d.nutriPro = null; }); toast('Voltou à referência geral da app.'); }}>
        Deixar de usar a meta do nutricionista
      </button>
    );
  if (!open) return <button className="btn ghost sm" style={{ marginTop: 10 }} onClick={() => setOpen(true)}>O meu nutricionista definiu outras metas</button>;
  return (
    <div className="card" style={{ marginTop: 10, background: 'var(--panel2)' }}>
      <h3>Metas do seu nutricionista</h3>
      <label className="measure" style={{ marginBottom: 8 }}>
        <span><b>Calorias por dia</b></span>
        <span className="measure-in"><DecimalInput decimals={false} value={kcal} onValue={setKcal} aria-label="Calorias por dia" placeholder="—" />kcal</span>
      </label>
      <label className="measure" style={{ marginBottom: 8 }}>
        <span><b>Proteína por dia</b><span className="small mute">opcional</span></span>
        <span className="measure-in"><DecimalInput decimals={false} value={protein} onValue={setProtein} aria-label="Proteína por dia" placeholder="—" />g</span>
      </label>
      <input className="field sm" style={{ width: '100%', marginBottom: 10 }} value={by} onChange={(e) => setBy(e.target.value)} placeholder="Nome do nutricionista" aria-label="Nome do nutricionista" />
      <div className="row">
        <button className="btn ghost sm" onClick={() => setOpen(false)}>Cancelar</button>
        <button
          className="btn sm"
          disabled={!by.trim() || (!kcal && !protein)}
          onClick={() => {
            update((d) => { d.nutriPro = { kcal: kcal ? Math.round(kcal) : undefined, protein: protein ? Math.round(protein) : undefined, by: by.trim(), at: todayKey() }; });
            toast('Metas do nutricionista guardadas.');
            setOpen(false);
          }}
        >
          Guardar
        </button>
      </div>
    </div>
  );
}

export function BodyCard({ a, onReassess }: { a: Answers; onReassess?: () => void }) {
  const { S } = useStore();
  const pro = S.nutriPro;
  const b = bodyOf(a);
  if (!b)
    return (
      <section className="card">
        <h2>A sua composição corporal</h2>
        <p className="small mute">Para calcular o IMC, a % de gordura e as calorias diárias precisamos da sua altura. Refaça a avaliação: são 2 minutos.</p>
        {onReassess && <button className="btn sm" onClick={onReassess}>Atualizar avaliação</button>}
      </section>
    );
  return (
    <section className="card">
      <h2>A sua composição corporal</h2>
      <div className="bodygrid">
        <div>
          <span className="small mute">IMC</span>
          <b>{fmtNum(b.bmi)}</b>
          <span className={`pos ${LEVEL_CLS[b.bmiLevel]}`}>{b.bmiLabel}</span>
        </div>
        <div>
          <span className="small mute">Gordura corporal</span>
          <b>{fmtNum(b.fat)}%</b>
          <span className="pos pos-base">{b.fatLabel}</span>
        </div>
        <div>
          <span className="small mute">Metabolismo basal</span>
          <b>{b.bmr.toLocaleString('pt-PT')}</b>
          <span className="small mute">kcal/dia em repouso</span>
        </div>
        <div>
          <span className="small mute">Gasto diário</span>
          <b>{b.tdee.toLocaleString('pt-PT')}</b>
          <span className="small mute">kcal/dia com atividade</span>
        </div>
      </div>
      {b.whtr !== undefined && (
        <p className="small" style={{ margin: '12px 0 0' }}>
          Relação cintura/altura: <b>{fmtNum(b.whtr)}</b>{' '}
          <span className={b.whtr < 0.5 ? 'neon' : 'warn-t'}>{b.whtr < 0.5 ? '(abaixo de 0,5: bom sinal)' : '(acima de 0,5: vale a pena reduzir a cintura)'}</span>
        </p>
      )}
      <p className="small" style={{ margin: '14px 0 0' }}>Objetivo: <b>{BODY_GOAL_LABEL[b.corpo]}</b></p>
      {b.safety && <p className="small warn-t" style={{ margin: '6px 0 0' }}>{b.safety}</p>}
      {pro ? (
        <div className="target pro">
          <div className="row">
            <span>Meta do seu nutricionista</span>
            {pro.kcal ? <b className="neon">{pro.kcal.toLocaleString('pt-PT')} kcal</b> : null}
          </div>
          <p className="small mute" style={{ margin: '4px 0 8px' }}>Definida por {pro.by}. É esta que a NEFESH Life usa no diário.</p>
          <div className="macros">{pro.protein ? <span><b>{pro.protein} g</b> proteína</span> : null}</div>
          <p className="small mute" style={{ margin: '8px 0 0' }}>Referência geral da app: {b.target.toLocaleString('pt-PT')} kcal · {b.protein} g de proteína.</p>
        </div>
      ) : (
        <div className="target">
          <div className="row">
            <span>Referência geral diária</span>
            <b className="neon">{b.target.toLocaleString('pt-PT')} kcal</b>
          </div>
          <p className="small mute" style={{ margin: '4px 0 8px' }}>{b.targetNote}</p>
          <div className="macros">
            <span><b>{b.protein} g</b> proteína</span>
            <span><b>{b.carbs} g</b> hidratos</span>
            <span><b>{b.fatG} g</b> gordura</span>
          </div>
        </div>
      )}
      <ProTargets />
      <p className="small" style={{ margin: '10px 0 0' }}>
        Esta é uma referência geral, calculada por fórmulas. Para um plano feito para si, fale com um nutricionista: em <b>Acompanhamento profissional</b>, no Início, encontra a rede NEFESH.
      </p>
      <p className="small mute" style={{ margin: '10px 0 0' }}>
        {b.fatMethod === 'medidas'
          ? '% de gordura pelas suas medidas (fórmula da Marinha dos EUA, margem de cerca de ±3%).'
          : '% de gordura estimada pelo IMC, idade e sexo. Com medidas de cintura e pescoço fica mais rigorosa.'}{' '}
        Metabolismo pela fórmula de Mifflin-St Jeor. São estimativas, não um diagnóstico.
      </p>
    </section>
  );
}
