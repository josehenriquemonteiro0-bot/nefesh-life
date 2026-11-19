import { PROS, WHATSAPP_URL } from '../domain/content';
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
              <a className="btn sm" href={WHATSAPP_URL} target="_blank" rel="noopener" onClick={() => toast('A abrir o WhatsApp da NEFESH…')}>Pedir contacto</a>
              <button className="btn ghost sm" onClick={openReport}>Enviar relatório</button>
            </div>
          </div>
        </section>
      ))}
      <p className="small mute">O pedido de contacto abre o WhatsApp da NEFESH, que o encaminha para o profissional certo. Para enviar o relatório, use "Enviar relatório" e partilhe-o na conversa.</p>
    </>
  );
}
