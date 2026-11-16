
// utils/ficha.js
function fmtDate(d) {
  if (!d) return null;
  const s = String(d).trim();
  if (!/^\d{8}$/.test(s)) return null;

  const dd = parseInt(s.slice(0, 2));
  const mm = parseInt(s.slice(2, 4));
  const yyyy1 = parseInt(s.slice(4, 8));

  const year2 = parseInt(s.slice(0, 4));
  const mon2 = parseInt(s.slice(4, 6));
  const day2 = parseInt(s.slice(6, 8));

  const validDDMM = dd >= 1 && dd <= 31 && mm >= 1 && mm <= 12 && yyyy1 >= 1900 && yyyy1 <= 2100;
  const validYYYY = day2 >= 1 && day2 <= 31 && mon2 >= 1 && mon2 <= 12 && year2 >= 1900 && year2 <= 2100;

  // Sempre retorna ddmmaaaa (sem barras)
  if (validDDMM && !validYYYY) return s; // já é ddmmaaaa
  if (!validDDMM && validYYYY) return `${s.slice(6, 8)}${s.slice(4, 6)}${s.slice(0, 4)}`; // aaaammdd -> ddmmaaaa
  if (validDDMM && validYYYY) {
    const cur = new Date().getFullYear();
    const d1 = Math.abs(yyyy1 - cur);
    const d2 = Math.abs(year2 - cur);
    return d1 <= d2 ? s : `${s.slice(6, 8)}${s.slice(4, 6)}${s.slice(0, 4)}`;
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