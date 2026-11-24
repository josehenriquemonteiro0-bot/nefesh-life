import { FIRST_STEPS, firstSteps, type FirstStep } from '../domain/firstSteps';
import { requestListen } from '../domain/voice';
import { useStore } from '../state/store';
import type { Nav } from '../App';

/** Início, dias 1 a 3: só 3 coisas para aprender o essencial, cada uma com o seu botão. */
export function FirstStepsCard({ go }: { go: Nav }) {
  const { S, update } = useStore();
  const st = firstSteps(S);
  if (!st) return null;
  const close = () => update((d) => { d.firstStepsDone = true; });
  const act = (id: FirstStep) => {
    if (id === 'assistente') { requestListen(); go('coach'); }
    else if (id === 'checkin') go('check');
    else document.querySelector('[data-tour="proxima"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  if (st.all)
    return (
      <section className="card first-steps done">
        <p className="small gold" style={{ margin: 0, fontWeight: 700 }}>Primeiros passos · 3 de 3 🎉</p>
        <h2 style={{ margin: '4px 0 6px' }}>Já sabe o essencial</h2>
        <p className="small" style={{ margin: '0 0 10px' }}>Repita isto todos os dias e, numa semana, a app mostra-lhe o efeito do ritual na sua energia. O resto da app está aqui em baixo, para quando quiser explorar.</p>
        <button className="btn ghost sm" onClick={close}>Fechar</button>
      </section>
    );
  return (
    <section className="card first-steps" aria-label="Primeiros passos">
      <div className="row">
        <p className="small gold" style={{ margin: 0, fontWeight: 700 }}>Primeiros passos · {st.n} de 3</p>
        <button className="link small inline" onClick={close}>Esconder</button>
      </div>
      <p className="small mute" style={{ margin: '2px 0 8px' }}>Comece só por isto. O resto pode esperar.</p>
      <ol className="fs-list">
        {FIRST_STEPS.map((s) => (
          <li key={s.id} className={st.done[s.id] ? 'ok' : ''}>
            <span className="fs-check" aria-hidden>{st.done[s.id] ? '✓' : ''}</span>
            <span className="fs-text"><b>{s.title}</b><small>{st.done[s.id] ? 'Feito' : s.how}</small></span>
            {!st.done[s.id] && <button className="btn sm" onClick={() => act(s.id)}>{s.id === 'ritual' ? 'Ver' : 'Fazer'}</button>}
          </li>
        ))}
      </ol>
    </section>
  );
}
