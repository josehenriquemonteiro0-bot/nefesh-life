# Avisos automáticos de falhas

## O que já funciona
- Quando algo corre mal na app (web ou iPhone), ela envia um relatório **anónimo** ao servidor: a mensagem do
  erro, o percurso no código, o ecrã, a versão e a plataforma. Nunca nome, e-mail, conta ou dados de saúde
  (e-mails e números longos que apareçam numa mensagem são apagados antes de guardar).
- Se um ecrã falhar, a pessoa vê "Algo correu mal neste ecrã" com o botão **Voltar a abrir**, em vez de um ecrã em branco.
- As falhas iguais juntam-se (com a contagem) e ficam 90 dias.
- **Página da equipa → Falhas da app**: lista com as mais recentes primeiro.

## Resumo diário por e-mail (contato@nefeshglobal.com), às 8h de Lisboa
Usa o envio de e-mail da Cloudflare, sem custos. Uma vez só:
1. Cloudflare → o domínio **nefeshglobal.com** → **Email** → **Email Routing** → ativar
   (o domínio tem de estar na Cloudflare; se estiver noutro fornecedor, avise para escolhermos outra via).
2. **Destination addresses** → acrescentar `contato@nefeshglobal.com` e confirmar o e-mail que chega lá.
3. Em `worker/wrangler.toml`, tirar o `#` das três linhas do `[[send_email]]` e publicar.
O remetente é `avisos@nefeshglobal.com` (não precisa de existir como caixa de correio).

## Falhas do próprio iPhone (fora da parte web)
A Apple recolhe-as sozinha: **App Store Connect → a app → TestFlight → Crashes** e, depois do lançamento,
**Xcode → Organizer → Crashes** (de quem aceitou partilhar dados de análise com os programadores).
