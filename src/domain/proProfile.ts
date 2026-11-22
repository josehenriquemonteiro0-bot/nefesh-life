/** Perfil do aluno registado pelo profissional (sem dependências: a app e o servidor usam-no). */
export interface StudentProfile {
  sexo: '' | 'f' | 'm';
  idade: number | null;
  altura: number | null;
  peso: number | null;
  objetivo: string;
  nivel: '' | 'iniciante' | 'intermedio' | 'avancado';
  dias: number | null;
  lesoes: string;
  notas: string;
}

export const OBJETIVOS = ['Hipertrofia', 'Emagrecimento', 'Condicionamento', 'Força', 'Saúde e bem-estar', 'Reabilitação', 'Desempenho desportivo'];
export const NIVEL_NAME = { iniciante: 'iniciante', intermedio: 'intermédio', avancado: 'avançado' } as const;

const num = (v: unknown, min: number, max: number) => {
  const n = Math.round(Number(String(v ?? '').replace(',', '.')));
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
};
const txt = (v: unknown, max: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

export function cleanProfile(p: unknown): StudentProfile {
  const o = (p ?? {}) as Record<string, unknown>;
  return {
    sexo: o.sexo === 'f' || o.sexo === 'm' ? o.sexo : '',
    idade: num(o.idade, 8, 100),
    altura: num(o.altura, 100, 230),
    peso: num(o.peso, 25, 300),
    objetivo: txt(o.objetivo, 60),
    nivel: o.nivel === 'iniciante' || o.nivel === 'intermedio' || o.nivel === 'avancado' ? o.nivel : '',
    dias: num(o.dias, 1, 7),
    lesoes: txt(o.lesoes, 300),
    notas: txt(o.notas, 300),
  };
}

export const profileEmpty = (p: StudentProfile | null | undefined) => !p || Object.values(p).every((v) => v === '' || v === null);

/** Uma linha curta (cartão do aluno e pedidos à IA). */
export function profileText(p: StudentProfile | null | undefined): string {
  if (!p || profileEmpty(p)) return '';
  const a = [
    p.sexo === 'f' ? 'Mulher' : p.sexo === 'm' ? 'Homem' : '',
    p.idade ? `${p.idade} anos` : '',
    p.altura ? `${p.altura} cm` : '',
    p.peso ? `${p.peso} kg` : '',
    p.nivel ? NIVEL_NAME[p.nivel] : '',
    p.objetivo ? `objetivo: ${p.objetivo.toLowerCase()}` : '',
    p.dias ? `disponível ${p.dias}× por semana` : '',
    p.lesoes ? `lesões/limitações: ${p.lesoes}` : '',
    p.notas ? `notas: ${p.notas}` : '',
  ].filter(Boolean);
  return a.join(' · ');
}
