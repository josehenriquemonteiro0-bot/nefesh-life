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
export function customerMessage(name: string, product: string, codes: string[], appUrl = APP_URL) {
  const many = codes.length > 1;
  const lines = codes.map((c) => `• ${c}\n  ${appUrl}?frasco=${c}`).join('\n');
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
</form>
<form method="post" action="/admin/videos" class="card"><input type="hidden" name="key" value="${esc(key)}"><h2>Vídeos de demonstração</h2><p class="m">Um vídeo por exercício (YouTube, Instagram…). O aluno vê-o quando o personal não pôs um vídeo seu.</p><button>Abrir a biblioteca de vídeos</button></form>
<form method="post" action="/admin/profissionais" class="card"><input type="hidden" name="key" value="${esc(key)}"><h2>NEFESH Life Pro</h2><p class="m">Aprovar os profissionais (personal) que pedem acesso para montar treinos.</p><button>Ver profissionais</button></form>
<form method="post" action="/admin/marketing" class="card">
<input type="hidden" name="key" value="${esc(key)}">
<h2 style="margin-top:0">Contactos de marketing</h2>
<p class="m">Só as pessoas que aceitaram receber comunicações da NEFESH, com a data da autorização.</p>
<button>Ver contactos</button>
</form>
<form method="post" action="/admin/cortesia" class="card">
<input type="hidden" name="key" value="${esc(key)}">
<h2 style="margin-top:0">NEFESH Premium de cortesia</h2>
<p class="m">Para a família, parceiros e a conta de demonstração da revisão da Apple. A pessoa precisa de ter conta.</p>
<button>Abrir</button>
</form>
<form method="post" action="/admin/acessos" class="card">
<input type="hidden" name="key" value="${esc(key)}">
<h2 style="margin-top:0">Registos de acesso (Marco Civil)</h2>
<p class="m">IP e data/hora de quem usa a app com conta, guardados 6 meses. Consultar <b>só</b> para cumprir uma ordem judicial.</p>
<button>Abrir</button>
</form>`);
}

/** Registos de acesso de uma pessoa (Marco Civil, art. 15): só para responder a ordem judicial. */
export function accessPage(key: string, q?: { email: string; from: string; to: string; rows: { ip: string; at: string }[] | null }) {
  const v = (x?: string) => esc(x ?? '');
  const table = !q
    ? ''
    : !q.rows
      ? '<div class="card"><p style="margin:0">Não há conta com esse e-mail.</p></div>'
      : `<div class="card"><p style="margin:0 0 8px"><b>${q.rows.length}</b> registo(s) de ${v(q.email)} entre ${v(q.from)} e ${v(q.to)} (horas em UTC).</p><textarea readonly>${esc(['ip,data_hora_utc', ...q.rows.map((r) => `${r.ip},${r.at}`)].join('\n'))}</textarea></div>`;
  return page(`<h1>Registos de acesso</h1>
<p class="m">Marco Civil da Internet (Lei 12.965/2014, art. 15). Entregar estes dados <b>só</b> com ordem judicial, ao juízo que a emitiu. Guarde a ordem e a data da entrega.</p>
<form method="post" action="/admin/acessos" class="card"><input type="hidden" name="key" value="${esc(key)}">
<label>E-mail da conta<input name="email" type="email" required value="${v(q?.email)}"></label>
<label>De (AAAA-MM-DD)<input name="from" type="date" required value="${v(q?.from)}"></label>
<label>Até (AAAA-MM-DD)<input name="to" type="date" required value="${v(q?.to)}"></label>
<button>Consultar</button></form>
${table}
<form method="post" action="/admin"><input type="hidden" name="key" value="${esc(key)}"><button class="ghost">Voltar</button></form>`);
}

/** Contactos que aceitaram marketing (RGPD/LGPD: só estes podem receber comunicações). */
export function marketingPage(key: string, rows: { email: string; at: string }[]) {
  const csv = ['email,autorizado_em', ...rows.map((r) => `${r.email},${r.at.slice(0, 10)}`)].join('\n');
  return page(`<h1>Contactos de marketing</h1>
<div class="card"><p style="margin:0"><b>${rows.length}</b> ${rows.length === 1 ? 'pessoa aceitou' : 'pessoas aceitaram'} receber comunicações da NEFESH.</p>
<p class="m" style="margin:8px 0 0">Use só para comunicações de marketing. Quem retirar a autorização na app sai desta lista na hora. Inclua sempre a forma de deixar de receber.</p></div>
<div class="card"><textarea id="csv" readonly>${esc(csv)}</textarea>
<button class="ghost" onclick="navigator.clipboard.writeText(document.getElementById('csv').value).then(()=>this.textContent='Copiado ✓')">Copiar</button>
<a class="btn" download="nefesh-marketing.csv" href="data:text/csv;charset=utf-8,${encodeURIComponent(csv)}">Descarregar CSV</a></div>
<form method="post" action="/admin"><input type="hidden" name="key" value="${esc(key)}"><button class="ghost">Voltar</button></form>`);
}

export interface CouponRow { code: string; week: string; rank: number; points: number; status: string; expires: string; sent_at: string | null; used_at: string | null; nick: string | null; email: string | null }

/** Lista dos cupões NEFESH15: registar na loja, enviar por e-mail e marcar como enviado ou usado. */
export function prizesPage(key: string, rows: CouponRow[], mail: (r: CouponRow) => { subject: string; body: string }) {
  const fmt = (d: string) => d.slice(0, 10).split('-').reverse().join('/');
  const label: Record<string, string> = { atribuido: 'por enviar', enviado: 'enviado', usado: 'usado' };
  const btn = (code: string, status: string, text: string, ghost = true) =>
    `<form method="post" action="/admin/premio" style="display:inline"><input type="hidden" name="key" value="${esc(key)}"><input type="hidden" name="code" value="${esc(code)}"><input type="hidden" name="status" value="${status}"><button class="${ghost ? 'ghost' : ''}">${text}</button></form>`;
  const items = rows
    .map((r) => {
      const m = mail(r);
      const href = r.email ? `mailto:${encodeURIComponent(r.email)}?subject=${encodeURIComponent(m.subject)}&body=${encodeURIComponent(m.body)}` : '';
      return `<div class="card">
<p style="margin:0"><b>${r.rank}.º lugar</b> · semana de ${fmt(r.week)} · ${r.points} pontos · <span class="m">${label[r.status] ?? r.status}</span></p>
<p style="margin:6px 0"><code>${esc(r.code)}</code></p>
<p class="m" style="margin:0">${esc(r.nick ?? '—')} · ${r.email ? esc(r.email) : 'sem e-mail (a pessoa ainda não abriu a app desde a atualização)'} · válido até ${fmt(r.expires)}</p>
${r.status === 'atribuido' ? `${href ? `<a class="btn" href="${esc(href)}">Enviar por e-mail</a>` : ''}${btn(r.code, 'enviado', 'Marcar como enviado')}` : ''}
${r.status === 'enviado' ? `${btn(r.code, 'usado', 'Marcar como usado')}${btn(r.code, 'atribuido', 'Voltar a por enviar')}` : ''}
</div>`;
    })
    .join('');
  return page(`<h1>Prémios NEFESH15</h1>
<div class="card"><p style="margin:0">Todas as segundas-feiras às 9h, a app fecha o ranking da semana e gera um código para cada um dos 3 primeiros.</p>
<p class="m" style="margin:8px 0 0">Antes de enviar: registe o código na loja online como cupão de 15%, <b>uso único</b>, válido até à data indicada e não acumulável. Depois toque em "Enviar por e-mail" (a mensagem já vai escrita) e em "Marcar como enviado".</p></div>
${items || '<p class="m">Ainda não há vencedores. O primeiro ranking fecha na próxima segunda-feira.</p>'}
<form method="post" action="/admin"><input type="hidden" name="key" value="${esc(key)}"><button class="ghost">Voltar</button></form>`);
}

export function prosPage(key: string, rows: { uid: string; name: string; kind: string; reg: string; status: string; created: string; students: number }[], areas: { uid: string; kind: string; reg: string; created: string; name: string; main: string }[] = []) {
  const fmt = (d: string) => d.slice(0, 10).split('-').reverse().join('/');
  const btn = (uid: string, status: string, text: string, ghost = true) =>
    `<form method="post" action="/admin/profissional" style="display:inline"><input type="hidden" name="key" value="${esc(key)}"><input type="hidden" name="uid" value="${esc(uid)}"><input type="hidden" name="status" value="${status}"><button class="${ghost ? 'ghost' : ''}">${text}</button></form>`;
  const items = rows
    .map((r) => `<div class="card">
<p style="margin:0"><b>${esc(r.name)}</b> · ${esc(r.kind)} · <span class="m">${esc(r.status)}</span></p>
<p class="m" style="margin:6px 0">Registo: ${esc(r.reg)} · pedido a ${fmt(r.created)} · ${r.students} ${r.students === 1 ? 'aluno' : 'alunos'}</p>
${r.status !== 'aprovado' ? btn(r.uid, 'aprovado', 'Aprovar', false) : btn(r.uid, 'pendente', 'Suspender')}${r.status === 'pendente' ? btn(r.uid, 'recusado', 'Recusar') : ''}
</div>`)
    .join('');
  const areaBtn = (uid: string, kind: string, status: string, text: string, ghost = true) =>
    `<form method="post" action="/admin/profissional" style="display:inline"><input type="hidden" name="key" value="${esc(key)}"><input type="hidden" name="uid" value="${esc(uid)}"><input type="hidden" name="area" value="${esc(kind)}"><input type="hidden" name="status" value="${status}"><button class="${ghost ? 'ghost' : ''}">${text}</button></form>`;
  const areaItems = areas
    .map((a) => `<div class="card">
<p style="margin:0"><b>${esc(a.name)}</b> (${esc(a.main)}) pede a área <b>${esc(a.kind)}</b></p>
<p class="m" style="margin:6px 0">Registo: ${esc(a.reg)} · pedido a ${fmt(a.created)}</p>
${areaBtn(a.uid, a.kind, 'aprovado', 'Validar', false)}${areaBtn(a.uid, a.kind, 'recusado', 'Recusar')}
</div>`)
    .join('');
  return page(`<h1>NEFESH Life Pro</h1>
${areaItems ? `<h2>Pedidos de nova área (dupla formação)</h2>${areaItems}` : ''}
<div class="card"><p style="margin:0">Confirme o registo profissional (CREF no Brasil, título profissional em Portugal) antes de aprovar. Depois de aprovado, o profissional cria alunos e monta treinos na app.</p></div>
${items || '<p class="m">Ainda não há pedidos. O profissional pede acesso na app: Perfil → NEFESH Life Pro.</p>'}
<form method="post" action="/admin"><input type="hidden" name="key" value="${esc(key)}"><button class="ghost">Voltar</button></form>`);
}

export function adminResult(key: string, product: string, codes: string[], name: string, phone: string, email: string, appUrl = APP_URL) {
  const msg = customerMessage(name, product, codes, appUrl);
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

/** Biblioteca de vídeos: um campo por exercício, agrupados; "Procurar" abre a pesquisa no YouTube. */
export function videosPage(key: string, list: { name: string; group: string }[], map: Record<string, string>, keyOf: (n: string) => string, saved?: number) {
  const done = list.filter((e) => map[keyOf(e.name)]).length;
  const groups = [...new Set(list.map((e) => e.group))];
  const rows = groups.map((g) => `<div class="card"><h2>${esc(g)}</h2>${list.filter((e) => e.group === g).map((e) => {
    const v = map[keyOf(e.name)] ?? '';
    const q = encodeURIComponent(`${e.name} execução correta`);
    return `<label style="display:block;margin:10px 0 0">${v ? '✅' : '⬜'} <b>${esc(e.name)}</b> <a class="m" href="https://www.youtube.com/results?search_query=${q}" target="_blank" rel="noopener">procurar ↗</a>${v ? ` · <a class="m" href="${esc(v)}" target="_blank" rel="noopener">ver ↗</a>` : ''}
<input name="v:${esc(e.name)}" value="${esc(v)}" placeholder="https://www.youtube.com/watch?v=…" inputmode="url" style="width:100%"></label>`;
  }).join('')}</div>`).join('');
  return page(`<h1>Vídeos de demonstração</h1>
<div class="card"><p style="margin:0"><b>${done} de ${list.length}</b> exercícios com vídeo.${saved !== undefined ? ` <span style="color:#00fe8a">Guardado (${saved}).</span>` : ''}</p>
<p class="m">Cole o link de um vídeo com a técnica correta (YouTube, Shorts, Instagram, Vimeo). Apague o link para tirar. Mais tarde, os vídeos próprios da NEFESH substituem estes links aqui.</p></div>
<form method="post" action="/admin/video"><input type="hidden" name="key" value="${esc(key)}">${rows}
<button style="position:sticky;bottom:12px;width:100%">Guardar</button></form>
<form method="post" action="/admin"><input type="hidden" name="key" value="${esc(key)}"><button class="ghost">Voltar</button></form>`);
}

/** Premium de cortesia: dar a uma conta até uma data (ou tirar, com a data de hoje). */
export function courtesyPage(key: string, msg?: string) {
  return page(`<h1>Premium de cortesia</h1>
<p class="m">A conta fica com o NEFESH Premium até à data escolhida, sem pagamento. Para tirar, escolha a data de ontem.</p>
${msg ? `<div class="card"><p style="margin:0">${esc(msg)}</p></div>` : ''}
<form method="post" action="/admin/cortesia" class="card"><input type="hidden" name="key" value="${esc(key)}">
<label>E-mail da conta<input name="email" type="email" required></label>
<label>Premium até (AAAA-MM-DD)<input name="until" type="date" required></label>
<button>Guardar</button></form>
<form method="post" action="/admin"><input type="hidden" name="key" value="${esc(key)}"><button class="ghost">Voltar</button></form>`);
}
