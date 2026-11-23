import { useState } from 'react';
import { LOCALES, currentLocale, setLocale, storedLocale, type Locale } from '../i18n/locale';

/** Primeira abertura: a pessoa escolhe o país (português do Brasil ou de Portugal). */
export function LocalePicker() {
  const [open, setOpen] = useState(() => !storedLocale());
  if (!open) return null;
  const pick = (l: Locale) => {
    setOpen(false);
    setLocale(l);
  };
  return (
    <div className="locale-pick" role="dialog" aria-modal="true" aria-label="Escolha o idioma">
      <div className="inner" data-raw>
        <img className="word" src={`${import.meta.env.BASE_URL}brand/wordmark.png`} alt="nefesh" />
        <h1>Bem-vindo · Bem-vinda</h1>
        <p>Escolha o seu país para a app usar as palavras de onde vive.</p>
        {LOCALES.map((l) => (
          <button key={l.id} className={`btn full ${l.id === currentLocale() ? '' : 'ghost'}`} onClick={() => pick(l.id)}>
            <span aria-hidden="true">{l.flag}</span> {l.name}
          </button>
        ))}
        <p className="small mute">Pode mudar depois em Perfil → Idioma.</p>
      </div>
    </div>
  );
}

/** Perfil → Idioma. */
export function LocaleCard() {
  const cur = currentLocale();
  return (
    <section className="card">
      <h2 style={{ marginTop: 0 }}>Idioma</h2>
      <div className="chips" role="group" aria-label="Idioma" data-raw>
        {LOCALES.map((l) => (
          <button key={l.id} className={`chip ${cur === l.id ? 'on' : ''}`} aria-pressed={cur === l.id} onClick={() => cur !== l.id && setLocale(l.id)}>
            {l.flag} {l.name}
          </button>
        ))}
      </div>
      <p className="small mute" style={{ margin: '8px 0 0' }} data-raw>A app passa a usar o vocabulário do país escolhido (por exemplo, celular ou telemóvel). Outros idiomas chegam em breve.</p>
    </section>
  );
}
