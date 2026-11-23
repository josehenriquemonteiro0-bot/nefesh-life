import { PROS, whatsappLink } from '../domain/content';
import { useStore } from '../state/store';
import { DirectoryList } from '../components/ProDirectory';

export function Pros({ openReport }: { openReport: () => void }) {
  const { S, toast } = useStore();
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
              <a className="btn sm" href={whatsappLink(`Olá NEFESH! Gostava de pedir contacto com um(a) ${p.n.toLowerCase()}${S.ans?.name ? `. O meu nome é ${S.ans.name}` : ''}.`)} target="_blank" rel="noopener" onClick={() => toast('A abrir o WhatsApp da NEFESH…')}>Pedir contacto</a>
              <button className="btn ghost sm" onClick={openReport}>Enviar relatório</button>
            </div>
          </div>
        </section>
      ))}
      <DirectoryList />
      <p className="small mute">O pedido de contacto abre o WhatsApp da NEFESH com a mensagem já escrita, e a equipa encaminha-o para o profissional certo. Em "Enviar relatório" pode mandar o seu relatório pelo WhatsApp.</p>
    </>
  );
}
