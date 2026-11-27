// utils/parsersRobos.js
// Parsers para os robôs 2-6.

// utils/parsersRobos.js

function formatarData(valor) {
  if (!valor) return '';
  const s = String(valor).trim();

  // Se já está no formato dd/mm/aaaa, tira as barras
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    return s.replace(/\//g, '');
  }

  if (/^\d{8}$/.test(s)) {
    // Função auxiliar para validar se a data realmente existe no calendário
    // (evita casos como 31/04 ou 29/02 em ano não bissexto)
    const isValidDate = (y, m, d) => {
      if (y < 1900 || y > 2100) return false;
      const date = new Date(y, m - 1, d);
      return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
    };

    // 1. Tenta interpretar como DDMMAAAA (Padrão do SIGRH)
    const d1 = parseInt(s.slice(0, 2), 10);
    const m1 = parseInt(s.slice(2, 4), 10);
    const y1 = parseInt(s.slice(4, 8), 10);

    if (isValidDate(y1, m1, d1)) {
      return s; // Retorna no formato ddmmaaaa (ex: "20041995")
    }

    // 2. Se não for DDMMAAAA, tenta YYYYMMDD (Invertido)
    const y2 = parseInt(s.slice(0, 4), 10);
    const m2 = parseInt(s.slice(4, 6), 10);
    const d2 = parseInt(s.slice(6, 8), 10);

    if (isValidDate(y2, m2, d2)) {
      return `${s.slice(6, 8)}${s.slice(4, 6)}${s.slice(0, 4)}`; // Retorna ddmmaaaa
    }
  }

  return s;
}

function splitLinhas(conteudo) {
  return String(conteudo || '')
    .split(/\r?\n/)
    .map(l => l.trimEnd())
    .filter(l => l.trim() !== '');
}

function splitCols(linha) {
  return linha.split('|').map(c => c.trim());
}

// ===== ROBO 2 — Inc. Averbações =====
// Títulos: MATRICULA|DATA INICIO|DATA FIM|CODIGO DA AVERBACAO|DENOMINACAO|
//          ORGAO DE AVERBACAO|CIDADE ORIGEM DA AVERBACAO|UF ORIGEM DA AVERBACAO|
//          NUMERO DO PROCESSO|NUMERO DO DODF|DATA DE PUBLICACAO DODF|PAGINA DO DODF
function parseIncAverbacoes(conteudo) {
  const linhas = splitLinhas(conteudo);
  if (linhas.length < 2) return [];
  return linhas.slice(1).map(l => {
    const v = splitCols(l);
    return {
      matricula: v[0] || '',
      data_inicio: formatarData(v[1]),
      data_fim: formatarData(v[2]),
      codigo_averbacao: v[3] || '',
      denominacao: v[4] || '',
      orgao_averbacao: v[5] || '',
      cidade_origem: v[6] || '',
      uf_origem: v[7] || '',
      numero_processo: v[8] || '',
      numero_dodf: v[9] || '',
      data_publicacao_dodf: formatarData(v[10]),
      pagina_dodf: v[11] || ''
    };
  });
}

// ===== ROBO 3 — Exc. Averbações =====
// Títulos: MATRICULA DO SERVIDOR|QUANTIDADE DE DIAS EXCLUIDOS|DATA INICIO DA AVERBACAO|
//          DATA INICIO DA EXCLUSAO|DATA FIM DA EXCLUSAO
function parseExcAverbacoes(conteudo) {
  const linhas = splitLinhas(conteudo);
  if (linhas.length < 2) return [];
  return linhas.slice(1).map(l => {
    const v = splitCols(l);
    return {
      matricula: v[0] || '',
      quantidade_dias_excluidos: v[1] || '',
      data_inicio_averbacao: formatarData(v[2]),
      data_inicio_exclusao: formatarData(v[3]),
      data_fim_exclusao: formatarData(v[4])
    };
  });
}

// ===== ROBO 4 — Afastamentos =====
// Títulos: MATRICULA|HIS 00 COD SUB-HISTORICO|HIS 00 DATA REFERENCIA|
//          HIS 05 DATA FIM DO AFASTAMENTO|HIS 05 DIAS DE AFASTAMENTO
function parseAfastamentos(conteudo) {
  const linhas = splitLinhas(conteudo);
  if (linhas.length < 2) return [];
  return linhas.slice(1).map(l => {
    const v = splitCols(l);
    return {
      matricula: v[0] || '',
      cod_sub_historico: v[1] || '',
      data_referencia: formatarData(v[2]),
      data_fim_afastamento: formatarData(v[3]),
      dias_afastamento: v[4] || ''
    };
  });
}

// ===== ROBO 5 — Rev. Aposentadoria =====
// Títulos: MATRICULA|DT INICIO APOSENTADORIA|DT TERMINO APOSENTADORIA|
//          DT REVISAO APOSENTADORIA|DIAS DE APOSENTADO
function parseRevAposentadoria(conteudo) {
  const linhas = splitLinhas(conteudo);
  if (linhas.length < 2) return [];
  return linhas.slice(1).map(l => {
    const v = splitCols(l);
    const iniFmt = formatarData(v[1]);
    const fimFmt = formatarData(v[2]);
    let dias = v[4] || '';

    // Fallback: se SIGRH mandar 0/vazio mas tiver datas válidas, calcular do intervalo
    const nDias = parseInt(dias, 10);
    if ((!nDias || nDias <= 0) && /^\d{8}$/.test(iniFmt) && /^\d{8}$/.test(fimFmt)) {
      const d1 = new Date(+iniFmt.slice(4, 8), +iniFmt.slice(2, 4) - 1, +iniFmt.slice(0, 2));
      const d2 = new Date(+fimFmt.slice(4, 8), +fimFmt.slice(2, 4) - 1, +fimFmt.slice(0, 2));
      if (!isNaN(d1) && !isNaN(d2) && d2 >= d1) {
        dias = String(Math.round((d2 - d1) / 86400000) + 1);
      }
    }

    return {
      matricula: v[0] || '',
      data_inicio_aposentadoria: iniFmt,
      data_termino_aposentadoria: fimFmt,
      data_revisao_aposentadoria: formatarData(v[3]),
      dias_aposentado: dias
    };
  });
}

// ===== ROBO 6 — Lotações (sw_lotacoes) =====
function parseLotacoes(conteudo) {
  const linhas = splitLinhas(conteudo);
  if (linhas.length < 2) return [];

  const hoje = new Date();
  const d = String(hoje.getDate()).padStart(2, '0');
  const m = String(hoje.getMonth() + 1).padStart(2, '0');
  const y = hoje.getFullYear();
  const hojeFmt = `${d}${m}${y}`;

  return linhas.slice(1).map(l => {
    const v = splitCols(l);
    let fim = formatarData(v[5]);
    if (fim === '99999999' || fim === '99/99/9999') {
      fim = hojeFmt;
    }

    return {
      matricula: v[0] || '',
      cargo: v[1] || '',
      unidade_administrativa: v[2] || '',
      lotacao: v[3] || '',
      inicio_escala: formatarData(v[4]),
      fim_escala: fim
    };
  });
}

// ===== ROBO 6 (extra) — Descrição de Lotações =====
function parseDescricaoLotacoes(conteudo) {
  const linhas = splitLinhas(conteudo);
  if (linhas.length < 2) return [];

  const headers = splitCols(linhas[0]).map(h => h.toUpperCase().trim());
  const find = (re) => headers.findIndex(h => re.test(h));

  const norm = (s) => String(s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // remove acentos
    .toUpperCase();

  const H = headers.map(norm);

  // índices de "descrição/denominação"
  const idxDen = H.map((h, i) => /DENOMINACAO|DESCRICAO|DESC LOTA|NOME/.test(h) ? i : -1).filter(i => i >= 0);
  // índices de "código"
  const idxCod = H.map((h, i) => /CODIGO|COD\.?|C[OÓ]D/.test(h) ? i : -1).filter(i => i >= 0);

  let codLot = -1, denLot = -1, codUA = -1, denUA = -1;

  // Tenta identificar UA (cabeçalho contendo UA ou UNIDADE)
  const idxUA = H.findIndex(h => /\bUA\b|UNIDADE|UNID\.?ADM/.test(h));
  const idxLot = H.findIndex(h => /LOTACAO|LOTA[CÇ][AÃ]O/.test(h));

  if (idxLot >= 0) {
    // pega o código imediatamente antes do cabeçalho de lotação, se houver
    for (const i of idxCod) if (i < idxLot) codLot = i;
    // denominação é o índice de descrição mais próximo depois do idxLot
    for (const i of idxDen) if (i > idxLot) { denLot = i; break; }
  }

  if (idxUA >= 0) {
    for (const i of idxCod) if (i < idxUA) codUA = i;
    for (const i of idxDen) if (i > idxUA) { denUA = i; break; }
  }

  // Fallback posicional: 4 colunas → (codLot, denLot, codUA, denUA)
  if (codLot < 0 || denLot < 0) { codLot = 0; denLot = 1; }
  if (codUA < 0 || denUA < 0) { codUA = 2; denUA = 3; }

  console.log('[parser-desc-lot] headers=', headers);
  console.log('[parser-desc-lot] índices → codLot:', codLot, 'denLot:', denLot, 'codUA:', codUA, 'denUA:', denUA);

  return linhas.slice(1).map(l => {
    const v = splitCols(l);
    const pick = (i) => (i >= 0 && v[i] !== undefined) ? String(v[i]).trim() : '';
    return {
      codigo_lotacao: pick(codLot),
      denominacao_lotacao: pick(denLot),
      codigo_ua: pick(codUA),
      denominacao_ua: pick(denUA)
    };
  }).filter(x => x.codigo_lotacao || x.codigo_ua);
}

module.exports = {
  parseIncAverbacoes,
  parseExcAverbacoes,
  parseAfastamentos,
  parseRevAposentadoria,
  parseLotacoes,
  parseDescricaoLotacoes
};