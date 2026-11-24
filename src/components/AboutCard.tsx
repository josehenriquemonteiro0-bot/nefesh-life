import { legalUrl } from '../domain/platform';

/** Perfil → Sobre: quem é responsável pela app, contactos, textos legais e créditos (Decreto 7.962/2013; licenças). */
export function AboutCard() {
  const support = legalUrl('privacidade').replace('privacidade.html', 'suporte.html');
  return (
    <section className="card">
      <h2 style={{ marginTop: 0 }}>Sobre a NEFESH Life</h2>
      <p className="small" style={{ margin: 0 }} data-raw>
        <b>NEFESH BEM-ESTAR LTDA</b> · CNPJ 61.855.385/0001-63 · Cuiabá – MT, Brasil
        <br />
        <a href="mailto:contato@nefeshglobal.com">contato@nefeshglobal.com</a>
      </p>
      <p className="small" style={{ margin: '8px 0 0' }}>
        <a href={legalUrl('privacidade')} target="_blank" rel="noreferrer">Política de Privacidade</a> · <a href={legalUrl('termos')} target="_blank" rel="noreferrer">Termos de Uso</a> · <a href={support} target="_blank" rel="noreferrer">Suporte</a>
      </p>
      <details className="small" style={{ marginTop: 10 }}>
        <summary>Fontes de dados e licenças</summary>
        <ul className="mute" style={{ margin: '6px 0 0', paddingLeft: 18 }}>
          <li>Tabela Brasileira de Composição de Alimentos (TACO), NEPA/UNICAMP.</li>
          <li>Produtos pelo código de barras: Open Food Facts, base de dados aberta (licença ODbL).</li>
          <li>Letras Sora e Manrope (SIL Open Font License), incluídas na app.</li>
          <li>Bibliotecas de código aberto: React, Capacitor e ZXing (MIT), jsQR (Apache 2.0), mammoth (BSD-2), read-excel-file (MIT), Capgo Health (MPL 2.0, código disponível no npm).</li>
          <li>Inteligência artificial: Anthropic (Claude). Servidor: Cloudflare.</li>
        </ul>
      </details>
      <p className="small mute" style={{ margin: '8px 0 0' }}>A NEFESH Life é uma app de bem-estar: não faz diagnósticos nem substitui um profissional de saúde.</p>
    </section>
  );
}
