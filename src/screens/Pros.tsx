import { PARTNERS, PROS, whatsappLink } from '../domain/content';
import { useStore } from '../state/store';
import { DirectoryList } from '../components/ProDirectory';

export function Pros({ openReport }: { openReport: () => void }) {
  const { S, toast } = useStore();
  return (
    <>
      <h1>Profissionais NEFESH</h1>
      <p className="mute">A rede de profissionais parceiros que podem acompanhar a sua alimentação, o seu treino e a sua saúde.</p>
      {PARTNERS.length > 0 && <h2 style={{ margin: '8px 0 0' }}>Parceiros</h2>}
      {PARTNERS.map((p) => (
        <section className="card pro partner" key={p.id}>
          <div className="av">{p.i}</div>
          <div>
            <h2 style={{ margin: '0 0 2px' }} data-raw>{p.n}</h2>
            <p className="small" style={{ margin: '0 0 2px', fontWeight: 700 }} data-raw>{p.a}</p>
            <p className="small mute" style={{ margin: '0 0 8px' }} data-raw>{p.who}</p>
            <p className="small" style={{ margin: '0 0 6px' }}>{p.d}</p>
            <p className="small mute">{p.m}</p>
            <div className="row" style={{ justifyContent: 'flex-start' }}>
              <a
                className="btn sm"
                href={p.whatsapp
                  ? whatsappLink(`Olá ${p.first ?? p.who}! Encontrei a ${p.n} na NEFESH Life e gostaria de solicitar um atendimento${S.ans?.name ? `. O meu nome é ${S.ans.name}` : ''}.`, p.whatsapp)
                  : whatsappLink(`Olá NEFESH! Gostava de solicitar atendimento com ${p.n} (${p.who})${S.ans?.name ? `. O meu nome é ${S.ans.name}` : ''}.`)}
                target="_blank"
                rel="noopener"
                onClick={() => toast(p.whatsapp ? `A abrir o WhatsApp de ${p.first ?? p.n}…` : 'A abrir o WhatsApp da NEFESH…')}
              >
                Solicitar atendimento
              </a>
              <button className="btn ghost sm" onClick={openReport}>Enviar relatório</button>
            </div>
            {p.instagram && <a className="link small" href={p.instagram} target="_blank" rel="noopener">Ver no Instagram ↗</a>}
            {p.area === 'integrativa' && <p className="small mute" style={{ margin: '8px 0 0' }}>Prática integrativa: complementa o acompanhamento médico, não o substitui.</p>}
          </div>
        </section>
      ))}
      {PARTNERS.length > 0 && <h2 style={{ margin: '8px 0 0' }}>Áreas de acompanhamento</h2>}
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
