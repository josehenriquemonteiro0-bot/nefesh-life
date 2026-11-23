import { useState } from 'react';
import { todayKey } from '../domain/dates';
import { qty, shoppingList } from '../domain/foodSearch';
import type { NutriRx } from '../domain/proNutri';

const KEY = 'nefesh-life-compras';
const load = (): Record<string, boolean> => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } };

/** Lista de compras da semana a partir do plano do nutricionista (com o que já está no carrinho). */
export function ShoppingList({ rx, pro, onClose }: { rx: NutriRx; pro: string; onClose: () => void }) {
  const list = shoppingList(rx, new Date(), 7);
  const [done, setDone] = useState<Record<string, boolean>>(load);
  const toggle = (k: string) => { const n = { ...done, [k]: !done[k] }; setDone(n); try { localStorage.setItem(KEY, JSON.stringify(n)); } catch { /* sem armazenamento */ } };
  const text = `Lista de compras (${todayKey().split('-').reverse().join('/')}, 7 dias, plano de ${pro}):\n${list.map((g) => `\n${g.cat}\n${g.items.map((i) => `• ${i.food} — ${qty(i.grams)}`).join('\n')}`).join('\n')}`;
  const share = async () => {
    try { if (navigator.share) { await navigator.share({ text }); return; } } catch { return; }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  };
  return (
    <div className="modal show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Lista de compras">
        <div className="row"><h2 style={{ margin: 0 }}>🛒 Lista de compras</h2><button className="btn ghost sm" onClick={onClose}>Fechar</button></div>
        <p className="small mute" style={{ margin: '4px 0 10px' }}>Próximos 7 dias do plano de {pro} (opção A de cada refeição). Quantidades em cru ou cozido, como no plano.</p>
        {list.map((g) => (
          <div key={g.cat} style={{ marginBottom: 10 }}>
            <p className="small gold" style={{ margin: '0 0 4px', fontWeight: 700 }}>{g.cat}</p>
            {g.items.map((i) => (
              <label key={i.food} className="check" style={{ margin: '4px 0' }}>
                <input type="checkbox" checked={!!done[i.food]} onChange={() => toggle(i.food)} />
                <span className="small" style={{ textDecoration: done[i.food] ? 'line-through' : undefined }}>{i.food} <b>{qty(i.grams)}</b></span>
              </label>
            ))}
          </div>
        ))}
        <div className="row" style={{ gap: 8, justifyContent: 'flex-start' }}>
          <button className="btn sm" onClick={share}>Partilhar a lista</button>
          <button className="btn ghost sm" onClick={() => { setDone({}); try { localStorage.removeItem(KEY); } catch { /* */ } }}>Limpar marcas</button>
        </div>
      </div>
    </div>
  );
}
