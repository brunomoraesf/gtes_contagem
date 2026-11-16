// utils/jsonFicha.js
const fs = require('fs');
const path = require('path');

const ROBOS = ['robo1', 'robo2', 'robo3', 'robo4', 'robo5', 'robo6'];

function estruturaVazia(matricula) {
  const agora = new Date().toISOString();
  return {
    matricula,
    criado_em: agora,
    atualizado_em: agora,
    status_robos: ROBOS.reduce((acc, r) => ({ ...acc, [r]: 'pendente' }), {}),
    completo: false,
    mensagens: ROBOS.reduce((acc, r) => ({ ...acc, [r]: '' }), {}),
    cadastro: null,
    inc_averbacoes: null,
    exc_averbacoes: null,
    afastamentos: null,
    reversao_aposentadoria: null,
    lotacoes: null
  };
}

function caminhoJSON(pastaServidor, matricula) {
  return path.join(pastaServidor, `servidor-${matricula}.json`);
}

function lerJSON(pastaServidor, matricula) {
  const p = caminhoJSON(pastaServidor, matricula);
  if (!fs.existsSync(p)) return null;
  try {
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    // Formato antigo (flat) não tem status_robos → descarta
    if (!j || typeof j !== 'object' || !j.status_robos) return null;
    if (!j || typeof j !== 'object' || !j.status_robos) return null;  // ← AQUI

    return j;
  } catch {
    return null;
  }
}

function criarSeNaoExistir(pastaServidor, matricula) {
  if (!fs.existsSync(pastaServidor)) fs.mkdirSync(pastaServidor, { recursive: true });
  const existente = lerJSON(pastaServidor, matricula);
  if (existente) return existente;

  const novo = estruturaVazia(matricula);
  fs.writeFileSync(caminhoJSON(pastaServidor, matricula), JSON.stringify(novo, null, 2), 'utf8');
  return novo;
}

const CHAVES_BLOCO = {
  robo1: 'cadastro',
  robo2: 'inc_averbacoes',
  robo3: 'exc_averbacoes',
  robo4: 'afastamentos',
  robo5: 'reversao_aposentadoria',
  robo6: 'lotacoes'
};

function recalcularCompleto(json) {
  return ROBOS.every(r => json.status_robos[r] === 'ok' || json.status_robos[r] === 'vazio');
}

function atualizarBloco(pastaServidor, matricula, robo, resultado) {
  if (!CHAVES_BLOCO[robo]) throw new Error(`Robô inválido: ${robo}`);

  const json = criarSeNaoExistir(pastaServidor, matricula);
  const chave = CHAVES_BLOCO[robo];
  const { estado, dados, mensagem } = resultado || {};

  if (estado === 'ok') {
    if (robo === 'robo1') {
      // Merge: sobrescreve campos existentes, adiciona novos, preserva ausentes
      json[chave] = { ...(json[chave] || {}), ...(dados || {}) };
    } else {
      json[chave] = Array.isArray(dados) ? dados : (dados || null);
    }
    json.status_robos[robo] = 'ok';
    json.mensagens[robo] = mensagem || '';
  } else if (estado === 'vazio') {
    json[chave] = Array.isArray(dados) ? dados : [];
    json.status_robos[robo] = 'vazio';
    json.mensagens[robo] = mensagem || 'Sem dados para esta matrícula.';
  } else if (estado === 'erro') {
    json.status_robos[robo] = 'erro';
    json.mensagens[robo] = mensagem || 'Erro desconhecido.';
  } else {
    throw new Error(`Estado inválido: ${estado}`);
  }

  json.atualizado_em = new Date().toISOString();
  json.completo = recalcularCompleto(json);
  fs.writeFileSync(caminhoJSON(pastaServidor, matricula), JSON.stringify(json, null, 2), 'utf8');
  return json;
}

function podeExibirJSON(pastaServidor, matricula) {
  const json = lerJSON(pastaServidor, matricula);
  return !!(json && json.completo);
}

module.exports = {
  ROBOS,
  CHAVES_BLOCO,
  estruturaVazia,
  caminhoJSON,
  lerJSON,
  criarSeNaoExistir,
  atualizarBloco,
  podeExibirJSON,
  recalcularCompleto
};