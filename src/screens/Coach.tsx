import { Icon } from '../components/Icon';
import { PremiumTag } from '../components/PremiumTag';

/** AI Coach: o ecrã fica pronto na navegação; a conversa por texto chega no módulo 5 e a voz no módulo 6. */
export function Coach() {
  return (
    <>
      <h1>Coach NEFESH</h1>
      <section className="card hero coach-hero">
        <div className="coach-mic" aria-hidden="true"><Icon name="mic" width={2} /></div>
        <h2 style={{ margin: '12px 0 6px' }}>Fale ou escreva como falaria com um amigo</h2>
        <p className="small" style={{ margin: 0, opacity: 0.9 }}>
          "Dormi mal, comi dois ovos e pão, vou treinar à tarde e estou cansado." O Coach regista o sono, a refeição e a energia, e devolve uma sugestão para o seu dia.
        </p>
        <button className="btn full" style={{ marginTop: 16 }} disabled>Toca para falar · em breve</button>
      </section>
      <section className="card">
        <div className="row"><h2 style={{ margin: 0 }}>O que vai poder fazer</h2><PremiumTag f="coach" /></div>
        <ul className="small plan-list" style={{ marginTop: 10 }}>
          <li>Registar refeições, treino, água, sono, Spirulina e energia por texto ou voz.</li>
          <li>Perguntar dúvidas sobre o seu plano e receber sugestões curtas para o dia.</li>
          <li>Corrigir um registo sem refazer tudo ("não, foram três ovos").</li>
        </ul>
        <p className="small mute" style={{ margin: '8px 0 0' }}>O Coach apoia, não substitui profissionais, e não faz diagnósticos.</p>
      </section>
    </>
  );
}
