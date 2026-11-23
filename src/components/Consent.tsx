import { legalUrl } from '../domain/platform';
import { useState } from 'react';
import { todayKey } from '../domain/dates';
import { useStore } from '../state/store';
import { CONSENT_TEXT } from '../domain/consents';

/** Texto de privacidade (rascunho a validar pelo responsável de proteção de dados). */
export function PrivacyText() {
  return (
    <div className="small privacy">
      <p><b>O que guardamos:</b> as suas respostas à avaliação (incluindo informação de saúde como sono, peso ou gravidez), as tomas, a água, os check-ins e os passos e o sono que registar.</p>
      <p><b>Onde:</b> neste telemóvel. Se criar uma conta, também numa base de dados na Cloudflare (Europa e outras regiões), ligada ao seu e-mail, para não perder nada ao trocar de telemóvel. As fotos de refeições e os planos que enviar para leitura são analisados e não ficam guardados.</p>
      <p><b>Notificações:</b> se as ativar, guardamos o endereço de notificações do telemóvel, a hora do lembrete e se já fez o ritual nesse dia, só para lhe enviar o lembrete, as mensagens dos amigos e o aviso da liga. Pode desligá-las no Perfil.</p>
      <p><b>Comunidade:</b> se entrar, os outros membros veem a sua alcunha, foto de perfil, pontos, sequência e conquistas. As fotos que partilhar nos Momentos ficam visíveis para toda a comunidade durante 24 horas e depois são apagadas; antes de serem publicadas, são revistas por IA.</p>
      <p><b>Estatísticas anónimas:</b> uma vez por dia contamos que partes da app foram usadas, sem cookies, sem nome, sem e-mail e sem dados de saúde. Pode desligar em Perfil.</p>
      <p><b>Investigação e desenvolvimento (opcional):</b> se autorizar, enviamos uma vez por dia médias anonimizadas (objetivo, energia, sono, Índice NEFESH e regularidade da Spirulina), sem nome, e-mail ou datas, que a NEFESH só analisa em totais de grupo para desenvolver novas fórmulas. Desligado por omissão.</p>
      <p><b>Marketing (opcional):</b> se autorizar, guardamos o e-mail da sua conta para lhe enviar novidades e ofertas. Desligado por omissão; pode retirar a qualquer momento.</p>
      <p><b>Partilha:</b> só quando escolher enviar o relatório ou falar connosco pelo WhatsApp.</p>
      <p><b>Os seus direitos (RGPD e LGPD):</b> pode ver, corrigir, exportar ou apagar os seus dados, e mudar as autorizações, a qualquer momento no Perfil (botão redondo no topo), em "Privacidade e consentimentos" e "Os meus dados".</p>
      <p><b>Importante:</b> a NEFESH Life é uma ferramenta de bem-estar. Não faz diagnósticos nem substitui um profissional de saúde.</p>
    </div>
  );
}

/** Aceitação do aviso de privacidade antes da primeira avaliação. */
export function Consent({ onAccept, onCancel, onLogin }: { onAccept: () => void; onCancel: () => void; onLogin?: () => void }) {
  const { update } = useStore();
  const [ok, setOk] = useState(false);
  const [rd, setRd] = useState(false);
  const [mk, setMk] = useState(false);
  return (
    <>
      <h1>Antes de começar</h1>
      <section className="card consent-short">
        <p className="small" style={{ margin: 0 }}>
          A avaliação pede alguma informação de saúde. Fica guardada neste telemóvel (e na sua conta, se criar uma), só é partilhada quando escolher, e pode ver, exportar ou apagar tudo no Perfil.
        </p>
        <details className="consent-more">
          <summary>Ler o aviso completo</summary>
          <PrivacyText />
        </details>
      </section>
      <label className="check">
        <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} />
        <span>Li e aceito que a NEFESH Life guarde estes dados para criar e personalizar o meu plano, os <a href={legalUrl('termos')} target="_blank" rel="noreferrer">Termos de Uso</a> e a <a href={legalUrl('privacidade')} target="_blank" rel="noreferrer">Política de Privacidade</a>. <span className="mute">(necessário)</span></span>
      </label>
      <p className="small mute" style={{ margin: '14px 0 4px' }}>Opcional — pode mudar quando quiser no Perfil:</p>
      <label className="check">
        <input type="checkbox" checked={rd} onChange={(e) => setRd(e.target.checked)} />
        <span className="small">{CONSENT_TEXT.rd}</span>
      </label>
      <label className="check">
        <input type="checkbox" checked={mk} onChange={(e) => setMk(e.target.checked)} />
        <span className="small">{CONSENT_TEXT.marketing} <span className="mute">(com conta)</span></span>
      </label>
      <div className="row" style={{ marginTop: 18 }}>
        <button className="btn ghost" onClick={onCancel}>Agora não</button>
        <button
          className="btn"
          disabled={!ok}
          onClick={() => {
            const at = new Date().toISOString();
            update((d) => {
              d.consent = todayKey();
              d.consents = { rd: { on: rd, at }, marketing: { on: mk, at } };
            });
            onAccept();
          }}
        >
          Continuar
        </button>
      </div>
      {onLogin && <p className="small mute" style={{ textAlign: 'center', marginTop: 14 }}>Já usava a NEFESH Life? <button className="link small inline" onClick={onLogin}>Entrar na minha conta</button></p>}
    </>
  );
}
