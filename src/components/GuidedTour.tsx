import { useEffect, useLayoutEffect, useState } from 'react';
import type { Nav, Tab } from '../App';

/**
 * Tutorial guiado da primeira utilização: escurece o ecrã e destaca, um a um, os
 * elementos reais da app (marcados com data-tour), com uma explicação curta.
 */
interface Step {
  tab: Tab;
  target: string;
  title: string;
  text: string;
}

export const TOUR: Step[] = [
  { tab: 'home', target: 'proxima', title: 'A seguir', text: 'A app diz-lhe a coisa mais útil a fazer agora, com a hora: a toma, a água, o desafio, a refeição ou o check-in. Um toque e está feito.' },
  { tab: 'home', target: 'tomas', title: 'A sua toma de Spirulina', text: 'Os anéis do dia: Spirulina, água e o desafio da semana, com o seu Índice ao centro. Cada toma entra sozinha no diário e conta para a sua sequência.' },
  { tab: 'home', target: 'strip', title: 'Sequência, pontos e liga', text: '🔥 dias seguidos de ritual, ⭐ pontos de hoje e 🏆 o seu lugar na liga. Toque para abrir a Comunidade.' },
  { tab: 'home', target: 'agua', title: 'Água', text: 'Um toque em "+ 1 copo" sempre que beber. A meta é calculada para o seu peso.' },
  { tab: 'home', target: 'checkin', title: 'Check-in de 30 segundos', text: 'Diga como se sente: energia, sono e disposição. Com isto, a app mostra-lhe o efeito do ritual em si.' },
  { tab: 'home', target: 'passos', title: 'Passos e relógio', text: 'Escreva os passos ou envie uma captura do app Saúde. Também pode ligar o iPhone e o Apple Watch.' },
  { tab: 'quiz', target: 'saude-tabs', title: 'Saúde', text: 'Toda a sua saúde num só separador: Plano, Nutrição, Treino, Sono, Mente, Corpo, Cuidados (medicação, prevenção e análises) e Ciclo. Toque nos ícones de cima para mudar.' },
  { tab: 'nutri', target: 'foto-prato', title: 'Fotografe o prato', text: 'A IA estima os alimentos e as calorias. Aqui também carrega o plano do seu nutricionista e encontra as receitas.' },
  { tab: 'treino', target: 'treino-onde', title: 'Treine onde quiser', text: 'Com o plano do seu personal, no ginásio ou em casa, com exercícios animados. Escolha o nível: iniciante ou intermediário.' },
  { tab: 'home', target: 'nav-coach', title: 'NEFESH Voice Assistant', text: 'O botão do centro: toque e fale (ou escreva) como falaria com um amigo ("bebi 2 copos", "almocei frango com arroz"). O assistente regista por si e responde com uma sugestão.' },
  { tab: 'evo', target: 'spirulina-voce', title: 'A sua evolução', text: 'Aqui vê como se sente nos dias com e sem ritual, o antes e depois das reavaliações e o relatório em PDF.' },
  { tab: 'social', target: 'comunidade', title: 'Comunidade', text: 'Pontos, ligas semanais, o NEFESH 21 Day Reset, Circles com a família e os amigos, parceiro de ritual e momentos com foto. Juntos é mais fácil.' },
  { tab: 'home', target: 'perfil', title: 'O seu perfil', text: 'Conta, notificações, lembrete da toma, frascos, reavaliação e o tutorial outra vez, se precisar. Bom ritual! 🌿' },
];

/** Tutorial curto da primeira utilização: só o essencial (o completo fica no Perfil). */
export const SHORT_TOUR: Step[] = [
  { tab: 'home', target: 'proxima', title: 'Tomei', text: 'O "A seguir" mostra uma só coisa a fazer, com a hora. Quando tomar a Spirulina, toque em "Tomei": os anéis de cima enchem-se.' },
  { tab: 'home', target: 'nav-coach', title: 'Toca para falar', text: 'O botão do centro: diga o que fez, como falaria com um amigo ("bebi 2 copos", "almocei frango com arroz"). O assistente regista por si.' },
  { tab: 'home', target: 'checkin', title: 'Check-in de 30 segundos', text: 'Como se sente hoje: a energia de cada dia aparece aqui. É assim que a app lhe mostra o efeito do ritual. O tutorial completo está no Perfil.' },
];

const PAD = 8;

export function GuidedTour({ go, onClose, steps = TOUR }: { go: Nav; onClose: () => void; steps?: Step[] }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const step = steps[i];

  // abre o separador do passo e procura o elemento (passos sem elemento são saltados)
  useEffect(() => {
    go(step.tab);
    let tries = 0;
    let raf = 0;
    const find = () => {
      const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
      if (el) {
        el.scrollIntoView({ block: 'center', behavior: 'auto' });
        setTimeout(() => setRect(el.getBoundingClientRect()), 120);
        return;
      }
      if (++tries < 15) raf = window.setTimeout(find, 60);
      else setI((x) => (x < steps.length - 1 ? x + 1 : x));
    };
    setRect(null);
    find();
    return () => window.clearTimeout(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);

  // acompanha mudanças de tamanho e de deslocação
  useLayoutEffect(() => {
    const update = () => {
      const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
      if (el) setRect(el.getBoundingClientRect());
    };
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [step.target]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') setI((x) => Math.max(0, x - 1));
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  const next = () => (i < steps.length - 1 ? setI(i + 1) : onClose());
  const vh = window.innerHeight;
  const below = rect ? rect.top + rect.height / 2 < vh / 2 : true;
  const hole = rect && {
    top: Math.max(4, rect.top - PAD),
    left: Math.max(4, rect.left - PAD),
    width: Math.min(window.innerWidth - 8, rect.width + PAD * 2),
    height: Math.min(vh - 8, rect.height + PAD * 2),
  };

  return (
    <div className="tour" role="dialog" aria-modal="true" aria-label="Tutorial da NEFESH Life">
      {hole ? <div className="tour-hole" style={hole} /> : <div className="tour-dim" />}
      <div
        className="tour-card"
        style={
          hole
            ? below
              ? { top: Math.min(vh - 230, hole.top + hole.height + 12) }
              : { bottom: Math.min(vh - 230, vh - hole.top + 12) }
            : { top: '35%' }
        }
      >
        <p className="small tour-count">{i + 1} de {steps.length}</p>
        <h2>{step.title}</h2>
        <p className="small">{step.text}</p>
        <div className="tour-dots" aria-hidden="true">
          {steps.map((_, k) => <i key={k} className={k === i ? 'on' : k < i ? 'done' : ''} />)}
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button className="skip" onClick={onClose}>Saltar</button>
          <div className="row" style={{ gap: 8 }}>
            {i > 0 && <button className="btn ghost sm" onClick={() => setI(i - 1)}>Anterior</button>}
            <button className="btn sm" onClick={next}>{i < steps.length - 1 ? 'Seguinte' : 'Começar'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Dica curta na primeira visita a cada separador (fecha-se com um toque e não volta). */
export const TAB_TIPS: Partial<Record<Tab, string>> = {
  mente: 'Como está o humor e o stress? Uma pausa de respiração de 2 a 5 minutos e três coisas boas do dia fazem diferença. O NEFESH Voice Assistant também guia uma pausa.',
  corpo: 'Peso e medidas uma vez por semana: veja a tendência mês a mês. As fotos de progresso ficam só neste telemóvel.',
  cuidados: 'A sua medicação com lembretes, os check-ups e vacinas para a sua idade, as análises com a evolução e as consultas. Tudo vai no relatório para o médico.',
  ciclo: 'Ciclo menstrual, gravidez ou menopausa, ligados à sua energia e ao sono. Fica só no telemóvel e na sua conta.',
  sono: 'Registe as horas de cada noite: veja a média, a regularidade e como o sono mexe com a sua energia.',
  coach: 'Fale ou escreva: o assistente regista refeições, treinos (com cargas), água, sono e Spirulina; planeia o seu dia com lembretes, marca consultas e cria desafios com amigos (sempre com a sua confirmação). Experimente a conversa por voz e veja "O que sei sobre si".',
  quiz: 'O seu plano: a dose de Spirulina explicada passo a passo, o Índice NEFESH e as metas para o seu corpo. Em "Saber mais" está a ciência.',
  nutri: 'Diário de hoje, foto do prato com IA e o plano do seu nutricionista. Em "Receitas" há ideias com Spirulina para todos os dias.',
  treino: 'Escolha onde treina: com personal, no ginásio ou em casa. Toque num treino para ver os exercícios e registá-lo no fim.',
  evo: 'O relatório da semana (todos os domingos à noite) e a sua evolução: como se sente com e sem ritual, o antes e depois das reavaliações, a água, os passos e o sono.',
  social: 'Ganhe pontos com os hábitos (a Spirulina vale mais), suba de liga todas as semanas e faça o NEFESH 21 Day Reset com 2 amigos (em Desafios). Toque em "como ganho pontos?".',
  perfil: 'Aqui estão a sua conta, as notificações, os frascos e a reposição, a reavaliação e o relatório para o seu médico ou nutricionista.',
};
