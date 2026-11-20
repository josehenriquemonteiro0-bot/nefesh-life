/**
 * Página da equipa NEFESH para gerar códigos únicos de frasco e enviá-los ao cliente
 * por WhatsApp ou e-mail. Protegida pelo segredo STATS_KEY.
 */
import type { DB } from './social';

export const APP_URL = 'https://josehenriquemonteiro0-bot.github.io/nefesh-life/';
const PRODUCT_NAME: Record<string, string> = { caps: 'Spirulina em cápsulas', po: 'Spirulina em pó', nibs: 'Spirulina em palhinha (Nibs)' };

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function newCode() {
  const abc = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const s = [...crypto.getRandomValues(new Uint8Array(8))].map((x) => abc[x % abc.length]).join('');
  return `NEF-${s.slice(0, 4)}-${s.slice(4)}`;
}

export async function generateCodes(db: DB, product: string, n: number, now = new Date()) {
  const p = PRODUCT_NAME[product] ? product : 'caps';
  const codes: string[] = [];
  for (let i = 0; i < Math.max(1, Math.min(50, n)); i++) {
    let c = newCode();
    while (await db.prepare('SELECT 1 FROM bottle_codes WHERE code = ?').bind(c).first()) c = newCode();
    await db.prepare('INSERT INTO bottle_codes (code, product, created) VALUES (?, ?, ?)').bind(c, p, now.toISOString()).run();
    codes.push(c);
  }
  return { product: p, codes };
}

/** Mensagem para o cliente, com o código e o link que regista o frasco na app. */
export function customerMessage(name: string, product: string, codes: string[]) {
  const many = codes.length > 1;
  const lines = codes.map((c) => `• ${c}\n  ${APP_URL}?frasco=${c}`).join('\n');
  return `Olá${name ? ` ${name}` : ''}! Obrigado pela sua compra NEFESH 🌿

${many ? `Estes são os códigos dos seus ${codes.length} frascos` : 'Este é o código do seu frasco'} de ${PRODUCT_NAME[product]}:
${lines}

Para o registar na app NEFESH Life: toque no link, ou abra a app → Perfil → Spirulina e reposição → "Tenho um código de frasco".
Cada código só pode ser usado uma vez e conta para os pontos verificados da Spirulina.`;
}

const page = (body: string) => `<!doctype html><html lang="pt-PT"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>NEFESH · Códigos de frasco</title>
<style>
body{margin:0;background:#0b1410;color:#e8ede9;font:16px/1.45 system-ui,sans-serif;padding:16px;max-width:640px;margin:auto}
h1{font-size:22px}label{display:grid;gap:4px;margin:10px 0}input,select,textarea{font:inherit;padding:10px;border-radius:10px;border:1px solid #2b3a33;background:#14201a;color:#e8ede9;width:100%;box-sizing:border-box}
button,.btn{display:inline-block;background:#00FE8A;color:#00140d;border:0;border-radius:999px;padding:10px 16px;font-weight:700;text-decoration:none;cursor:pointer;margin:6px 6px 0 0}
.ghost{background:transparent;color:#e8ede9;border:1px solid #2b3a33}.card{background:#14201a;border-radius:14px;padding:14px;margin:14px 0}
code{color:#00FE8A;font-size:18px}.m{color:#97a69f;font-size:14px}textarea{min-height:220px}
</style></head><body>${body}</body></html>`;

/** Entrada da página da equipa: pede a palavra-passe (STATS_KEY). */
export function adminLogin(error = false) {
  return page(`<h1>Equipa NEFESH</h1>
<p class="m">Códigos de frasco para enviar aos clientes.</p>
<form method="post" action="/admin" class="card">
${error ? '<p style="color:#ffb37a">Palavra-passe errada. Use a mesma que guardou no GitHub como STATS_KEY.</p>' : ''}
<label>Palavra-passe<input name="key" type="password" autocomplete="current-password" required autofocus></label>
<button>Entrar</button>
</form>`);
}

export function adminForm(key: string) {
  return page(`<h1>Códigos de frasco</h1>
<p class="m">Gera códigos únicos e prepara a mensagem para enviar ao cliente por WhatsApp ou e-mail. Cada código só pode ser usado uma vez.</p>
<form method="post" action="/admin/gerar" class="card">
<input type="hidden" name="key" value="${esc(key)}">
<label>Produto<select name="produto"><option value="caps">Spirulina em cápsulas</option><option value="po">Spirulina em pó</option><option value="nibs">Spirulina em palhinha (Nibs)</option></select></label>
<label>Quantidade de frascos<input name="quantidade" type="number" min="1" max="50" value="1"></label>
<label>Nome do cliente (opcional)<input name="nome" maxlength="60"></label>
<label>Telemóvel com indicativo (opcional, para o WhatsApp)<input name="telefone" inputmode="tel" placeholder="351912345678"></label>
<label>E-mail (opcional)<input name="email" type="email"></label>
<button>Gerar códigos</button>
</form>`);
}

export function adminResult(key: string, product: string, codes: string[], name: string, phone: string, email: string) {
  const msg = customerMessage(name, product, codes);
  const digits = phone.replace(/\D/g, '');
  const wa = `https://wa.me/${digits}?text=${encodeURIComponent(msg)}`;
  const mail = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent('O código do seu frasco NEFESH')}&body=${encodeURIComponent(msg)}`;
  return page(`<h1>Códigos gerados</h1>
<div class="card">${codes.map((c) => `<p><code>${esc(c)}</code></p>`).join('')}<p class="m">${esc(PRODUCT_NAME[product])}</p></div>
<div class="card"><p class="m">Mensagem para o cliente</p><textarea id="msg" readonly>${esc(msg)}</textarea>
<a class="btn" href="${esc(wa)}" target="_blank" rel="noopener">${digits ? 'Enviar por WhatsApp' : 'Abrir no WhatsApp (escolher contacto)'}</a>
${email ? `<a class="btn" href="${esc(mail)}">Enviar por e-mail</a>` : ''}
<button class="ghost" onclick="navigator.clipboard.writeText(document.getElementById('msg').value).then(()=>this.textContent='Copiada ✓')">Copiar mensagem</button></div>
<form method="post" action="/admin"><input type="hidden" name="key" value="${esc(key)}"><button class="ghost">Gerar mais códigos</button></form>`);
}
