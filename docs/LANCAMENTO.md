# NEFESH Life — lista para o lançamento

Nesta fase de testes, a app é usada só pelo José, a Isabela e a família, e os códigos de frasco
são gerados e enviados à mão (página da equipa: `…workers.dev/admin`).

Quando o José disser **"vamos lançar"** ou **"vamos transformar em aplicativo"**, rever esta lista com ele.

## Vendas e frascos
- [ ] Ligar a loja online (nefeshglobal.shop) para o código único do frasco ir **por e-mail
      automaticamente** a cada compra. Saber primeiro qual é a plataforma da loja (Shopify, WooCommerce…).
- [ ] Mais tarde: códigos únicos impressos no frasco (autocolante por dentro da tampa ou no rótulo),
      para vendas em loja física.
- [ ] Apagar os códigos e frascos de teste antes de abrir ao público.

## Gamificação
- [ ] Definir os **prémios** dos desafios e das ligas (desconto, amostra…) e as regras:
      só contas sem alertas e com uma parte mínima de pontos verificados.
- [ ] Página da equipa para rever as contas "em verificação" (alertas de fraude) e as fechar.

## App nativa (App Store e Play Store)
- [ ] Conta de programador Apple (99 USD/ano) e Google Play (25 USD, uma vez).
- [ ] Empacotar a app (Capacitor) e ler o **Apple Saúde / HealthKit** e o **Health Connect**
      diretamente (passos, sono, exercício, Apple Watch), sem atalho.
- [ ] Notificações nativas e verificação de que os pedidos vêm da app verdadeira
      (App Attest no iPhone, Play Integrity no Android).
- [ ] Separar a versão gratuita da Premium (hoje está tudo aberto: `PREMIUM_ENFORCED = false`).

## Infraestrutura e segurança
- [ ] **Trocar as chaves** da Anthropic e da Cloudflare que apareceram em capturas de ecrã
      durante a configuração, e guardar as novas só nos Secrets do GitHub.
- [ ] Manter a recarga automática da Anthropic desligada e definir um limite mensal.
- [ ] Domínio próprio (ex.: app.nefeshglobal.shop) em vez de github.io, e atualizar ALLOWED_ORIGIN.
- [ ] Com muitas pessoas: passar a sincronização da conta do KV para a D1 (limite de escritas do plano grátis).
- [ ] Rever o custo das fotos (modelo da IA) com o volume real.

## Conteúdos e legal
- [ ] Textos de privacidade e dos três consentimentos (personalização, I&D, marketing) revistos
      por um jurista: RGPD (Portugal/UE) e LGPD (Brasil).
- [ ] Confirmar as 5 referências científicas marcadas "a confirmar".
- [ ] Confirmar que o QR do Google Drive corresponde ao lote GCL_26_1372.
- [ ] Revisão por profissionais (nutricionista, médico) dos textos de dose e segurança.

## Versão 2 (branch nefesh-life-v2) — por fazer antes de passar para a versão em uso
- [ ] **Módulo 12, assinatura Premium** (adiado para o lançamento como app): sistema de pagamento
      (ex.: Stripe ou Mercado Pago), preços em BRL e EUR (referência R$ 29 / 39 / 49), Premium
      incluído para clientes da assinatura de Spirulina (`premium_source: nefesh_member`) e
      `TEST_MODE=false` (app e servidor) para ativar os limites do plano grátis.
- [ ] Passar a v2 para a versão em uso: juntar a branch `nefesh-life-v2` à branch publicada,
      depois do ok da NEFESH. As contas e dados da cópia de teste (nefesh-life-v2.pages.dev)
      são separados e não passam.
- [ ] Criar a tag `versao-atual-nov2026` no GitHub (Releases), se ainda não foi criada.
- [ ] Cupões NEFESH15: registar cada código na loja online à mão (uso único, 14 dias) e enviá-lo
      por e-mail a partir da página da equipa; mais tarde, ligar à loja por API.
- [ ] Regra dos 15 dias para o prémio: ninguém ganha nas primeiras 2 semanas depois do lançamento
      (decidir se se baixa no início).
- [ ] Voz no iPhone: confirmar com mais pessoas a gravação + Whisper (Workers AI da Cloudflare) e o
      custo com o volume real.

