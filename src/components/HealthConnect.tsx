import { useEffect, useState } from 'react';
import { healthKey, syncedLabel, useAuth } from '../domain/account';
import { HEALTH_SHORTCUT_URL } from '../domain/healthSync';
import { PHOTO_API } from '../domain/photo';
import { todayKey } from '../domain/dates';
import { useStore } from '../state/store';

const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent);

/** Passos para criar o atalho à mão (enquanto não houver o atalho oficial partilhado pelo iCloud). */
function BuildSteps({ endpoint }: { endpoint: string }) {
  return (
    <ol className="steps small">
      <li>Abra a app <b>Atalhos</b>, toque em <b>+</b> e dê ao atalho o nome <b>NEFESH Saúde</b>.</li>
      <li>Adicione <b>Encontrar amostras de saúde</b>: tipo <b>Passos</b>, data de início <b>hoje</b>. A seguir, <b>Calcular estatísticas</b> → <b>Soma</b>.</li>
      <li>Adicione <b>Encontrar amostras de saúde</b>: tipo <b>Análise do sono</b>, data de início <b>nas últimas 24 horas</b>, valor <b>não é Acordado</b> e <b>não é Na cama</b>. A seguir, <b>Calcular estatísticas</b> → <b>Soma</b>.</li>
      <li>Adicione <b>Encontrar amostras de saúde</b>: tipo <b>Minutos de exercício</b>, data de início <b>hoje</b>. A seguir, <b>Calcular estatísticas</b> → <b>Soma</b>.</li>
      <li>Adicione <b>Obter conteúdo do URL</b> com o endereço <code>{endpoint}</code>, método <b>POST</b>, corpo do pedido <b>JSON</b> com 4 campos: <code>chave</code> (a sua chave, em texto), <code>passos</code>, <code>sono</code> e <code>exercicio</code> (cada um com o resultado da soma respetiva).</li>
      <li>Toque em ▶ para experimentar e, na primeira vez, autorize o acesso ao app Saúde.</li>
    </ol>
  );
}

/** Ligar a NEFESH Life ao app Saúde do iPhone (e ao Apple Watch e outros relógios, através dele). */
export function HealthConnectSheet({ onClose, openAccount, refresh }: { onClose: () => void; openAccount: () => void; refresh: () => Promise<void> }) {
  const auth = useAuth();
  const { S, update, toast } = useStore();
  const [key, setKey] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [manual, setManual] = useState(!HEALTH_SHORTCUT_URL);
  const endpoint = `${PHOTO_API}/saude`;

  useEffect(() => {
    if (!auth) return;
    healthKey().then(setKey).catch((e) => setError((e as Error).message));
  }, [auth]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const copy = async (text: string, msg: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast(msg);
    } catch {
      toast('Selecione o texto e copie.');
    }
  };

  return (
    <div className="modal show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Ligar ao app Saúde">
        <h2>Ligar ao app Saúde e ao relógio</h2>
        <p className="small mute" style={{ marginTop: 0 }}>
          Configura uma vez e o iPhone passa a enviar sozinho os <b>passos</b>, o <b>sono</b> e os <b>minutos de exercício</b>. Vale para o iPhone, o <b>Apple Watch</b> e os relógios cuja app escreve no app Saúde (Garmin, Samsung, Xiaomi, Fitbit, Polar, entre outros).
        </p>

        {S.health2 && (
          <div className="ok-box small">
            Ligado desde {S.health2.since.split('-').reverse().join('/')}. Últimos dados recebidos: {syncedLabel(S.health2.lastAt)}.
            <button className="link small inline" style={{ marginLeft: 8 }} onClick={() => refresh().then(() => toast('Dados atualizados.'))}>atualizar agora</button>
          </div>
        )}

        {!isIOS() && (
          <p className="small">Esta ligação é para iPhone. No Android, a ligação ao Health Connect (Samsung Health, Google Fit, Garmin…) chega com a versão da Play Store. Até lá, escreva os passos no Início.</p>
        )}

        {!auth ? (
          <>
            <p className="small">Para o iPhone conseguir enviar os dados para a NEFESH Life, precisa de uma conta (é grátis e leva 30 segundos).</p>
            <button className="btn" onClick={openAccount}>Criar conta ou entrar</button>
          </>
        ) : (
          <>
            <h3>1. Copie a sua chave</h3>
            {error ? (
              <p className="small err">{error}</p>
            ) : (
              <div className="row" style={{ gap: 8 }}>
                <code className="key">{key ?? 'a carregar…'}</code>
                <button className="btn sm" disabled={!key} onClick={() => key && copy(key, 'Chave copiada.')}>Copiar</button>
              </div>
            )}
            <p className="small mute">
              A chave só serve para enviar passos, sono e exercício para a sua conta. Não dá acesso aos seus dados. Não a partilhe.{' '}
              <button
                className="link small inline"
                onClick={async () => {
                  if (!confirm('Gerar uma chave nova? A antiga deixa de funcionar e terá de pôr a nova no atalho (editar o atalho e trocar o texto da chave).')) return;
                  try {
                    setKey(await healthKey(true));
                    toast('Chave nova criada.');
                  } catch (e) {
                    toast((e as Error).message);
                  }
                }}
              >
                gerar chave nova
              </button>
            </p>

            <h3>2. Instale o atalho NEFESH Saúde</h3>
            {HEALTH_SHORTCUT_URL && (
              <>
                <a className="btn" href={HEALTH_SHORTCUT_URL} target="_blank" rel="noopener">Instalar o atalho</a>
                <p className="small mute">Toque em <b>Configurar atalho</b> (ou Adicionar atalho) e, quando pedir a chave, cole-a. Depois toque no atalho uma vez e autorize o acesso ao app Saúde: deve aparecer a mensagem "NEFESH Life: … enviados".</p>
                <button className="link small inline" onClick={() => setManual((v) => !v)}>{manual ? 'esconder' : 'prefiro criar o atalho à mão'}</button>
              </>
            )}
            {manual && (
              <>
                <BuildSteps endpoint={endpoint} />
                <button className="btn ghost sm" onClick={() => copy(endpoint, 'Endereço copiado.')}>Copiar o endereço</button>
              </>
            )}

            <h3>3. Deixe-o correr sozinho</h3>
            <ol className="steps small">
              <li>Na app Atalhos, abra <b>Automação</b> e toque em <b>+</b>.</li>
              <li>Escolha <b>Hora do dia</b>, por exemplo <b>21:00</b>, <b>Diariamente</b>, e marque <b>Executar imediatamente</b>.</li>
              <li>Escolha o atalho <b>NEFESH Saúde</b>. Se quiser os dados mais frescos, crie outra automação de manhã.</li>
            </ol>
            <p className="small mute">Também pode correr o atalho quando quiser, por exemplo com um widget no ecrã principal.</p>

            {!S.health2 && (
              <button
                className="btn full"
                style={{ marginTop: 8 }}
                onClick={async () => {
                  update((d) => { d.health2 = { since: todayKey() }; });
                  await refresh();
                  toast('Ligado ao app Saúde. Os dados chegam sempre que o atalho correr.');
                }}
              >
                Já configurei
              </button>
            )}
            {S.health2 && (
              <button className="link small inline" style={{ marginTop: 8, color: 'var(--warn)' }} onClick={() => { update((d) => { delete d.health2; }); toast('Ligação ao app Saúde desligada nesta app.'); }}>
                desligar
              </button>
            )}
          </>
        )}

        <p className="small mute" style={{ marginTop: 14 }}>
          Na versão da App Store, a NEFESH Life vai ler o app Saúde diretamente, sem atalho.
        </p>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn ghost" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  );
}
