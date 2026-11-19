import { PROS } from '../domain/content';
import { useStore } from '../state/store';

export function Pros({ openReport }: { openReport: () => void }) {
  const { toast } = useStore();
  return (
    <>
      <h1>Profissionais NEFESH</h1>
      <p className="mute">A rede de profissionais parceiros que acompanham o seu ritual e ajustam a dose ao seu caso.</p>
      {PROS.map((p) => (
        <section className="card pro" key={p.i}>
          <div className="av">{p.i}</div>
          <div>
            <h2 style={{ margin: '0 0 4px' }}>{p.n}</h2>
            <p className="small" style={{ margin: '0 0 4px' }}>{p.a}</p>
            <p className="small mute">{p.m}</p>
            <div className="row" style={{ justifyContent: 'flex-start' }}>
              <button className="btn sm" onClick={() => toast('Pedido de contacto registado. A equipa NEFESH vai responder-lhe.')}>Pedir contacto</button>
              <button className="btn ghost sm" onClick={openReport}>Enviar relatório</button>
            </div>
          </div>
        </section>
      ))}
      <p className="small mute">Perfis de exemplo. Na versão final, cada parceiro tem um painel para acompanhar os clientes que autorizarem a partilha.</p>
    </>
  );
}
