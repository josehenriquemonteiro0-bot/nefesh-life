import { describe, expect, it } from 'vitest';
import { gerund, toBR } from './ptBR';

describe('português do Brasil', () => {
  it('vocabulário, com artigos e maiúsculas', () => {
    expect(toBR('Abra no telemóvel e veja no ecrã principal.')).toBe('Abra no celular e veja na tela de início.');
    expect(toBR('Mantenha o ecrã ligado.')).toBe('Mantenha a tela ligada.');
    expect(toBR('Ganhou um cupão de 15%: é um bónus. Os cupões ficam no Perfil.')).toBe('Ganhou um cupom de 15%: é um bônus. Os cupons ficam no Perfil.');
    expect(toBR('Cancele em Definições → [o seu nome] → Subscrições.')).toBe('Cancele em Ajustes → [o seu nome] → Assinaturas.');
    expect(toBR('Treino no ginásio ou em casa')).toBe('Treino na academia ou em casa');
    expect(toBR('Pequeno-almoço: sumo de laranja e bolachas')).toBe('Café da manhã: suco de laranja e biscoitos');
    expect(toBR('Esqueci a palavra-passe')).toBe('Esqueci a senha');
    expect(toBR('A sua equipa e a sua alcunha')).toBe('A sua equipe e o seu apelido');
    expect(toBR('Uma bolacha com natas')).toBe('Um biscoito com creme de leite');
  });
  it('registar, guardar e partilhar', () => {
    expect(toBR('Registe o peso. Registo guardado.')).toBe('Registre o peso. Registro salvo.');
    expect(toBR('Guardar')).toBe('Salvar');
    expect(toBR('Partilhar no WhatsApp')).toBe('Compartilhar no WhatsApp');
    expect(toBR('Os dados guardamos neste telemóvel')).toBe('Os dados guardamos neste celular');
  });
  it('estar a + infinitivo → gerúndio', () => {
    expect(toBR('Está a ouvir a meditação')).toBe('Está ouvindo a meditação');
    expect(toBR('enquanto estou a treinar')).toBe('enquanto estou treinando');
    expect(toBR('A ler o relatório…')).toBe('Lendo o relatório…');
    expect(toBR('A ouvir… 0:12')).toBe('Ouvindo… 0:12');
    expect(toBR('A dor de cabeça passou.')).toBe('A dor de cabeça passou.');
    expect(toBR('Começar a treinar')).toBe('Começar a treinar');
    expect(gerund('pôr')).toBe('pondo');
    expect(toBR('Proteína · Hidratos · Gordura')).toBe('Proteína · Carboidratos · Gordura');
    expect(toBR('Hoje para si · O que sei sobre si')).toBe('Hoje para você · O que sei sobre você');
    expect(toBR('Não partilha a conta; a partilha é controlada.')).toBe('Não compartilha a conta; o compartilhamento é controlada.'.replace('controlada.', 'controlada.'));
    expect(toBR('Partilha')).toBe('Compartilhamento');
    expect(toBR('no respetivo conselho')).toBe('no respectivo conselho');
    expect(toBR('Anca (cm) · Meça a anca na parte mais larga')).toBe('Quadril (cm) · Meça o quadril na parte mais larga');
    expect(toBR('Medir a tensão arterial; obstipação; manteiga de amendoim')).toBe('Medir a pressão arterial; prisão de ventre; pasta de amendoim');
    expect(toBR('Use auscultadores. Pausa a meio da tarde para apanhar ar.')).toBe('Use fones de ouvido. Pausa no meio da tarde para tomar um ar.');
  });
  it('ortografia e palavras que não mudam', () => {
    expect(toBR('Estatísticas anónimas, 5 quilómetros, Ómega 3')).toBe('Estatísticas anônimas, 5 quilômetros, Ômega 3');
    expect(toBR('Contacte-nos, de facto')).toBe('Contate-nos, de fato');
    expect(toBR('Spirulina, massa magra, carregar a bateria')).toBe('Spirulina, massa magra, carregar a bateria');
    expect(toBR('atalho do iPhone')).toBe('atalho do iPhone');
    expect(toBR('')).toBe('');
    expect(toBR('123')).toBe('123');
  });
});
