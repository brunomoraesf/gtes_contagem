// utils/ficha.js

function fmtDate(d) {
  if (!d) return null;
  const s = String(d).trim();
  
  if (!/^\d{8}$/.test(s)) return null;

  const isValidDate = (y, m, day) => {
    if (y < 1900 || y > 2100) return false;
    const date = new Date(y, m - 1, day);
    return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === day;
  };

  // Tenta DDMMAAAA
  const dd = parseInt(s.slice(0, 2), 10);
  const mm = parseInt(s.slice(2, 4), 10);
  const yyyy = parseInt(s.slice(4, 8), 10);

  if (isValidDate(yyyy, mm, dd)) {
    return s; // Já está ddmmaaaa
  }

  // Tenta YYYYMMDD
  const year2 = parseInt(s.slice(0, 4), 10);
  const mon2 = parseInt(s.slice(4, 6), 10);
  const day2 = parseInt(s.slice(6, 8), 10);

  if (isValidDate(year2, mon2, day2)) {
    return `${s.slice(6, 8)}${s.slice(4, 6)}${s.slice(0, 4)}`; // aaaammdd -> ddmmaaaa
  }

  return null;
}

function parseFichaTXT(conteudo) {
  if (!conteudo || typeof conteudo !== 'string') return null;
  const linhas = conteudo.split(/\r?\n/).filter(l => l.trim() !== '');
  if (linhas.length < 2) return null;

  // Pega apenas a linha de dados
  const values = linhas[1].split('|').map(v => v.trim());

  // Mapeamento pela posição das colunas do novo relatório (17 colunas)
  return {
    orgao: values[0] || '',
    matricula: values[1] || '',
    nome: values[2] || '',
    sexo: values[3] || '',
    cpf: values[4] || '',
    data_nascimento: fmtDate(values[5]),
    email: values[6] || '',
    carga_horaria_principal: values[7] || '',
    carga_horaria_secundaria: values[8] || '',
    status: values[9] || '',
    data_admissao: fmtDate(values[10]),
    data_aposentadoria: fmtDate(values[11]),
    data_desligamento: fmtDate(values[12]),
    dt_ref: values[13] || '',           
    cargo: values[14] || '',            
    // values[15] é a referência da lotação (ignoramos para não duplicar)
    lotacao_principal_descricao: values[16] || '' // DESCRICAO LOTACAO
  };
}

module.exports = { parseFichaTXT, fmtDate };