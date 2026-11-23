/**
 * Aplica o idioma escolhido a todo o texto visível da app (incluindo janelas, avisos e respostas da IA),
 * à medida que o React o vai pondo no ecrã. Não mexe no que a pessoa escreve (campos de texto),
 * nem em elementos marcados com data-raw (por exemplo, nomes próprios).
 */
import { convertText, type Locale } from './locale';

const ATTRS = ['placeholder', 'aria-label', 'title', 'alt'];
const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'CODE', 'PRE']);

export function startLocale(locale: Locale, root: Node = document.body) {
  document.documentElement.lang = locale;
  if (locale === 'pt-PT') return () => {};
  // texto que nós próprios escrevemos: evita voltar a converter (e ciclos com o observador)
  const done = new WeakMap<Node, string>();
  const skip = (el: Element | null) => !!el && (SKIP.has(el.tagName) || !!el.closest('[data-raw],[contenteditable="true"]'));

  const text = (n: Text) => {
    const v = n.nodeValue ?? '';
    if (done.get(n) === v || skip(n.parentElement)) return;
    const c = convertText(v, locale);
    done.set(n, c);
    if (c !== v) n.nodeValue = c;
  };
  const attrs = (el: Element) => {
    if (skip(el) && el.tagName !== 'TEXTAREA') return;
    for (const a of ATTRS) {
      const v = el.getAttribute(a);
      if (!v) continue;
      const c = convertText(v, locale);
      if (c !== v) el.setAttribute(a, c);
    }
  };
  const walk = (n: Node) => {
    if (n.nodeType === Node.TEXT_NODE) return text(n as Text);
    if (n.nodeType !== Node.ELEMENT_NODE) return;
    const el = n as Element;
    if (SKIP.has(el.tagName) && el.tagName !== 'TEXTAREA') return;
    attrs(el);
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    for (let c = w.nextNode(); c; c = w.nextNode()) {
      if (c.nodeType === Node.TEXT_NODE) text(c as Text);
      else attrs(c as Element);
    }
  };

  walk(root);
  const obs = new MutationObserver((list) => {
    for (const m of list) {
      if (m.type === 'characterData') text(m.target as Text);
      else if (m.type === 'attributes') attrs(m.target as Element);
      else m.addedNodes.forEach(walk);
    }
  });
  obs.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  // título da página
  const t = document.title;
  document.title = convertText(t, locale);
  return () => obs.disconnect();
}
