import { bodyOf } from '../domain/body';
import { fmtNum } from '../domain/dates';
import type { Answers } from '../domain/types';

const LEVEL_CLS = { baixo: 'pos-low', normal: 'pos-up', excesso: 'pos-low', obesidade: 'pos-low' } as const;

/** IMC, % de gordura, metabolismo e meta calórica. */
export function BodyCard({ a, onReassess }: { a: Answers; onReassess?: () => void }) {
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
      <div className="target">
        <div className="row">
          <span>Meta diária</span>
          <b className="neon">{b.target.toLocaleString('pt-PT')} kcal</b>
        </div>
        <p className="small mute" style={{ margin: '4px 0 8px' }}>{b.targetNote}</p>
        <div className="macros">
          <span><b>{b.protein} g</b> proteína</span>
          <span><b>{b.carbs} g</b> hidratos</span>
          <span><b>{b.fatG} g</b> gordura</span>
        </div>
      </div>
      <p className="small mute" style={{ margin: '10px 0 0' }}>
        {b.fatMethod === 'medidas'
          ? '% de gordura pelas suas medidas (fórmula da Marinha dos EUA, margem de cerca de ±3%).'
          : '% de gordura estimada pelo IMC, idade e sexo. Com medidas de cintura e pescoço fica mais rigorosa.'}{' '}
        Metabolismo pela fórmula de Mifflin-St Jeor. São estimativas, não um diagnóstico.
      </p>
    </section>
  );
}
