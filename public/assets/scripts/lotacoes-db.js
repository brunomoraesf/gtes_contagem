// public/assets/scripts/lotacoes-db.js

/**
 * ============================================================================
 * REGRAS DE CLASSIFICAÇÃO DE LOTAÇÃO COMO MAGISTÉRIO
 * ============================================================================
 * Aplicadas em ordem por lotacaoEhMagisterio() (em index.js):
 *
 *   1. Contém keyword EXCLUSAO  → DESMARCA  (mais específica, vence tudo)
 *   2. Contém keyword INCLUSAO  → MARCA     (vence UA bloqueada, inclui FUNDAP/099)
 *   3. UA na lista bloqueada    → DESMARCA  (fallback documentado: 099 = sede)
 *   4. Nenhuma das anteriores   → DESMARCA  (fail-safe conservador)
 *
 * Comparação ignora acentos e maiúsculas.
 * Para adicionar/remover palavras, edite os arrays abaixo. Nada mais precisa mudar.
 * ============================================================================
 */

window.LOTACOES_KEYWORDS = {

    // UAs que NUNCA são magistério (sede administrativa).
    // Inclusão na descrição vence esta regra (ex.: FUNDAP com UA 099).
    // UAs que NUNCA são magistério (sede administrativa).
    // Inclusão na descrição vence esta regra (ex.: FUNDAP com UA 099).
    UAS_DESMARCADAS: [
        '095',   // FUNAB 
        '098',   // SEE - Secretaria Extraordinaria para Educacao Integral
        '099'    // SEE - Sede
    ],

    // Palavras que INDICAM NÃO ser magistério — sempre vencem.
    EXCLUSAO: [
        // Gestão (qualquer unidade de gestão, pedagógica ou não)
        'GERENCIA', 'GER.DE', 'GER DE', 'GER.REG', 'GER REG',
        'DIRETORIA', 'COORDENACAO', 'COOR.DE', 'COOR DE',
        'NUCLEO', 'DEPARTAMENTO',
        'DP/', 'DP CONV', 'DP.CONV', 'DP.DEE', 'DP/DEF',

        // Jurídico / financeiro
        'CONTRATOS', 'PRESTACAO DE CONTAS',
        'FORMALIZACAO DE', 'ELABORACAO DE',

        // Escolas especiais administrativas
        'ESCOLA DE GOVERNO',

        // Licenças / afastamentos / cedências
        'AFASTAD', 'LICENCIAD', 'LIC.P/', 'LIC P/',
        'LIC ACOMP', 'LIC ACOM', 'A DISPOSICAO',

        // Genérico
        'TESTE', 'RH', 'RECURSOS HUMANOS', 'CADASTRO FUNCIONAL',
        'SECAO DE EXPEDIENTE', 'NUCLEO DE EXPEDIENTE',
        'ASSESSORIA', 'GABINETE', 'SUBSECRETARIA', 'SECRETARIA EXECUTIVA'
    ],

    // Palavras que INDICAM ser magistério — vencem o default e a UA bloqueada.
    INCLUSAO: [
        // Convênios e caixas escolares
        'CAJE', 'FUNAP', 'FUNDAP', 'CASEB', 'CESAS',
        'CONVENIO', 'CONV',
        'SOCIOEDUCATIV',

        // Escolas
        'ESCOLA', 'COLEGIO', 'CRECHE', 'CAIC', 'BIBLIOTECA',
        'CENTRO DE ENSINO', 'CENTRO EDUCACIONAL', 'CENTRO DE EDUCACAO',
        'CENT.ENS', 'CENT ENS', 'C.ENS', 'C. ENS',
        'JARDIM DE INFANCIA', 'JARDIM INFANTIL', 'EDUCACAO INFANTIL',
        'CEF', 'CED'
    ]
};