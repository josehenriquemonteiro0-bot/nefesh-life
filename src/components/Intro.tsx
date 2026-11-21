import { useEffect, useState } from 'react';
import { SLIDES } from '../domain/content';
import { Icon } from './Icon';

export type IntroAction = 'continue' | 'reassess' | 'reset';

const Brand = () => (
  <>
    <div className="mark"><i /><i /><i /><img src={`${import.meta.env.BASE_URL}brand/mark.png`} alt="" /></div>
    <img className="word" src={`${import.meta.env.BASE_URL}brand/wordmark.png`} alt="nefesh" />
    <p className="rise d1 life">LIFE</p>
  </>
);

/**
 * Abertura da app.
 * - 'welcome': boas-vindas completas (primeira utilização ou "Rever as boas-vindas").
 * - 'return': abertura curta de cada vez que a app é aberta, com a escolha
 *   entre continuar, fazer nova avaliação ou começar do zero.
 */
export function Intro({ mode, hasPlan, name, day, onDone }: { mode: 'welcome' | 'return'; hasPlan: boolean; name?: string; day?: number; onDone: (a: IntroAction) => void }) {
  const [step, setStep] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  // a abertura fica parada: a página por baixo não rola enquanto está aberta
  useEffect(() => {
    document.documentElement.classList.add('no-scroll');
    return () => document.documentElement.classList.remove('no-scroll');
  }, []);
  const finish = (a: IntroAction) => {
    setLeaving(true);
    window.setTimeout(() => onDone(a), 450);
  };
  const close = () => finish('continue');
  const cls = `intro ${leaving ? 'out' : ''}`;

  if (mode === 'return') {
    const h = new Date().getHours();
    const hello = h < 12 ? 'Bom dia' : h < 20 ? 'Boa tarde' : 'Boa noite';
    return (
      <div className={cls} role="dialog" aria-label="Abertura">
        <div className="inner">
          <Brand />
          <h1 className="rise d1">{hello}{name ? `, ${name}` : ''}</h1>
          {day ? <p className="rise d2">Dia {day} do seu ritual. O que quer fazer hoje?</p> : <p className="rise d2">O que quer fazer hoje?</p>}
        </div>
        <div className="actions rise d2">
          <button className="btn full" onClick={() => finish('continue')}>Continuar com os meus dados</button>
          <button className="btn ghost full" onClick={() => finish('reassess')}>Fazer nova avaliação</button>
          {confirmReset ? (
            <div className="reset-confirm">
              <p className="small" style={{ margin: '0 0 8px' }}>Apagar todos os dados deste telemóvel e começar do zero? Não pode ser desfeito.</p>
              <div className="row" style={{ justifyContent: 'center' }}>
                <button className="btn ghost sm" onClick={() => setConfirmReset(false)}>Não</button>
                <button className="btn sm danger" onClick={() => finish('reset')}>Sim, apagar</button>
              </div>
            </div>
          ) : (
            <button className="skip" onClick={() => setConfirmReset(true)}>Começar do zero</button>
          )}
        </div>
      </div>
    );
  }

  if (step === 0)
    return (
      <div className={cls} role="dialog" aria-label="Boas-vindas">
        <div className="inner">
          <Brand />
          <h1 className="rise d1">Bem-vindo ao seu ritual de Spirulina</h1>
          <p className="rise d2">Nutrição inteligente, produzida em Portugal e feita à sua medida.</p>
        </div>
        <div className="actions rise d2"><button className="btn full" onClick={() => setStep(1)}>Começar</button></div>
      </div>
    );

  const [icon, title, text] = SLIDES[step - 1];
  const last = step === SLIDES.length;
  return (
    <div className={cls} role="dialog" aria-label="Boas-vindas">
      <div className="actions" style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="skip" onClick={close}>Saltar</button>
      </div>
      <div className="inner" key={step}>
        <div className="feat"><Icon name={icon} color="#00FE8A" width={1.4} /></div>
        <h1 className="rise">{title}</h1>
        <p className="rise">{text}</p>
      </div>
      <div className="actions">
        <div className="dotsx">{SLIDES.map((_, i) => <i key={i} className={i === step - 1 ? 'on' : ''} />)}</div>
        <button className="btn full" onClick={() => (last ? close() : setStep(step + 1))}>
          {last ? (hasPlan ? 'Entrar' : 'Fazer a minha avaliação') : 'Continuar'}
        </button>
      </div>
    </div>
  );
}
