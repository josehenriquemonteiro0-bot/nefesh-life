# NEFESH Life no iPhone — do TestFlight à App Store

O envio é automático: o GitHub compila a app, assina-a e envia-a para a Apple
(`.github/workflows/ios-testflight.yml`). Só é preciso fazer uma vez os passos 1 a 4,
depois de a conta Apple Developer estar **ativa** (inscrição aprovada e paga).

> Nunca cole chaves, senhas ou o ficheiro `.p8` no chat. Vão só para os segredos do GitHub.

## 1. Registar o identificador da app (Bundle ID)

1. **developer.apple.com** → Account → **Certificates, Identifiers & Profiles** → **Identifiers** → **+**.
2. **App IDs** → **App** → Continue.
3. Description: `NEFESH Life` · Bundle ID **Explicit**: `com.nefesh.life`
4. Em **Capabilities**, marcar **HealthKit** (e, se aparecer, **Push Notifications**).
5. Continue → Register.

## 2. Criar a app no App Store Connect

1. **appstoreconnect.apple.com** → **Apps** → **+** → **New App**.
2. Platforms: **iOS** · Name: **NEFESH Life** · Primary Language: **Portuguese (Brazil)**
3. Bundle ID: escolher `com.nefesh.life` · SKU: `nefesh-life-ios` · User Access: Full Access.

## 3. Chave da API (para o GitHub enviar a app)

1. App Store Connect → **Users and Access** → **Integrations** → **App Store Connect API**.
   Na primeira vez, a titular da conta (Isabela) tem de carregar em **Request Access** e aceitar.
2. **Team Keys** → **+** → Name: `GitHub` · Access: **Admin** (precisa de Admin para a Apple
   criar sozinha o certificado de distribuição) → Generate.
3. **Download API Key**: descarrega o ficheiro `AuthKey_XXXXXXXXXX.p8`. **Só dá para descarregar uma vez.**
4. Anote o **Key ID** (coluna da chave) e o **Issuer ID** (no topo da página).
5. **Team ID**: developer.apple.com → Account → **Membership details** → Team ID.

## 4. Guardar nos segredos do GitHub

GitHub → repositório **nefesh-life** → **Settings** → **Secrets and variables** → **Actions** →
**New repository secret**, quatro vezes:

| Nome | Valor |
|---|---|
| `ASC_KEY_ID` | o Key ID |
| `ASC_ISSUER_ID` | o Issuer ID |
| `ASC_KEY_P8` | abrir o `.p8` num editor de texto e colar **todo** o conteúdo (com as linhas BEGIN/END) |
| `APPLE_TEAM_ID` | o Team ID |

Depois, guardar o `.p8` num sítio seguro (ou apagá-lo: pode criar-se outra chave quando for preciso).

## 5. Enviar uma versão

GitHub → **Actions** → **App iPhone → TestFlight** → **Run workflow** (versão: `1.0`).
Leva ~20–30 min no GitHub e mais 10–30 min de processamento na Apple.

## 6. TestFlight (testar no iPhone)

1. App Store Connect → a app → **TestFlight**.
2. **Testes internos** (até 100 pessoas da equipa da conta, sem revisão): Users and Access → convidar
   as pessoas com uma função (ex.: Developer/Marketing) → no TestFlight, criar um grupo interno e juntá-las.
3. **Testes externos** (a família e amigos, até 10 000, por e-mail ou link público): criar um grupo
   externo → a Apple faz uma revisão rápida da versão beta (normalmente 1 dia).
4. Cada pessoa instala a app **TestFlight** (App Store) e aceita o convite.

A pergunta sobre encriptação já está respondida no projeto (`ITSAppUsesNonExemptEncryption = NO`):
a app só usa HTTPS.

## 7. Publicar na App Store

Ficha da loja (textos em pt-BR e pt-PT), respostas de privacidade e notas para a revisão:
`docs/APP_STORE.md`. Capturas de ecrã (1320×2868, iPhone 6,9"): `docs/app-store/capturas/pt-BR` e `pt-PT`.
