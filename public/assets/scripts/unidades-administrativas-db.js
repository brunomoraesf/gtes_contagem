// public/assets/scripts/unidades-administrativas-db.js

/**
 * Mapeamento das Unidades Administrativas (UA) da SEEDF.
 * Usado para exibir o "COD U.A." de forma legível na tabela de Lotações.
 *
 * Estrutura:
 *   sigla → texto curto exibido na tabela (ex.: "001 - PP/C")
 *   nome  → descrição completa exibida no tooltip ao passar o mouse
 *
 * Para editar/adicionar UAs: altere o objeto abaixo. Nada mais precisa mudar.
 */
window.UNIDADES_ADMINISTRATIVAS = {
    '001': { sigla: 'PP/C',  nome: 'PLANO PILOTO/CRUZEIRO' },
    '002': { sigla: 'BRZ',   nome: 'BRAZLANDIA' },
    '003': { sigla: 'CEI',   nome: 'CEILANDIA' },
    '004': { sigla: 'GAM',   nome: 'GAMA' },
    '005': { sigla: 'GUA',   nome: 'GUARA' },
    '006': { sigla: 'NB',    nome: 'NÚCLEO BANDEIRANTE/RIACHO FUNDO I E II' },
    '007': { sigla: 'PLA',   nome: 'PLANALTINA' },
    '008': { sigla: 'SOB',   nome: 'SOBRADINHO' },
    '009': { sigla: 'TAG',   nome: 'TAGUATINGA' },
    '010': { sigla: 'SAM',   nome: 'SAMAMBAIA' },
    '011': { sigla: 'PAR',   nome: 'PARANOA' },
    '012': { sigla: 'STM',   nome: 'SANTA MARIA' },
    '013': { sigla: 'SS',    nome: 'SAO SEBASTIAO' },
    '014': { sigla: 'RCE',   nome: 'RECANTO DAS EMAS' },
    '015': { sigla: 'FUNAB', nome: 'FUNDACAO UNIVERSIDADE ABERTA DO DF' },
    '095': { sigla: 'FUNAB', nome: 'FUNDACAO UNIVERSIDADE ABERTA DO DF' },
    '098': { sigla: 'SEE',   nome: 'SECRETARIA EXTRAORDINARIA PARA EDUCACAO INTEGRAL' },
    '099': { sigla: 'SEE',   nome: 'SEDE(S) DA SECRET. DE EDUCACAO' }
};