// server.js
const express = require('express');
const path = require('path');
const fs = require('fs');
const {
  setCancelRequested, getCancelRequested, log,
  normalizarMatricula, fecharTodosBrowsers, garantirChromium
} = require('./utils/helpers');

// IMPORTS DOS ROBÔS REAIS
const { executarRobo1 } = require('./robos/robo1-ficha');
const { executarRobo2 } = require('./robos/robo2-inc-averbacoes');
const { executarRobo3 } = require('./robos/robo3-exc-averbacoes');
const { executarRobo4 } = require('./robos/robo4-afastamentos');
const { executarRobo5 } = require('./robos/robo5-reversao-aposentadoria');
const { executarRobo6 } = require('./robos/robo6-lotacoes');

const {
  ROBOS, CHAVES_BLOCO, lerJSON, criarSeNaoExistir,
  atualizarBloco, podeExibirJSON, caminhoJSON
} = require('./utils/jsonFicha');
const { sleep, desenharBarra, exibirInicializacao } = require('./utils/terminal');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const PASTA_RAIZ = process.cwd();
const PASTA_RELATORIOS = path.join(PASTA_RAIZ, 'relatorios');
const SUBPASTAS = {
  cadastro: path.join(PASTA_RELATORIOS, 'cadastro'),
  servidor: path.join(PASTA_RELATORIOS, 'servidor'),
  inclui_averbacoes: path.join(PASTA_RELATORIOS, 'inclui_averbacoes'),
  exclui_averbacoes: path.join(PASTA_RELATORIOS, 'exclui_averbacoes'),
  afastamentos: path.join(PASTA_RELATORIOS, 'afastamentos'),
  reversao_aposentadoria: path.join(PASTA_RELATORIOS, 'reversao_aposentadoria'),
  lotacoes: path.join(PASTA_RELATORIOS, 'lotacoes'),
  descricao_lotacoes: path.join(PASTA_RELATORIOS, 'descricao_lotacoes')
};

Object.values(SUBPASTAS).forEach(p => { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); });

app.use('/relatorios/cadastro', express.static(SUBPASTAS.cadastro));
app.use('/relatorios/inclui_averbacoes', express.static(SUBPASTAS.inclui_averbacoes));
app.use('/relatorios/exclui_averbacoes', express.static(SUBPASTAS.exclui_averbacoes));
app.use('/relatorios/afastamentos', express.static(SUBPASTAS.afastamentos));
app.use('/relatorios/reversao_aposentadoria', express.static(SUBPASTAS.reversao_aposentadoria));
app.use('/relatorios/lotacoes', express.static(SUBPASTAS.lotacoes));
app.use('/relatorios/descricao_lotacoes', express.static(SUBPASTAS.descricao_lotacoes));

app.get('/relatorios/servidor/:arquivo', (req, res, next) => {
  const m = /^servidor-(.+)\.json$/.exec(req.params.arquivo);
  if (!m) return next();
  if (!podeExibirJSON(SUBPASTAS.servidor, m[1])) {
    return res.status(403).json({ erro: 'JSON indisponível: nem todos os robôs concluíram.' });
  }
  res.sendFile(path.join(SUBPASTAS.servidor, req.params.arquivo));
});

function setCancel(v) { setCancelRequested(v); }

const EXECUTORES = {
  robo1: async (orgao, matricula, senha, pesquisa, onProgress) =>
    executarRobo1(orgao, matricula, senha, pesquisa, null, onProgress, PASTA_RELATORIOS, SUBPASTAS),
  robo2: async (orgao, matricula, senha, pesquisa, onProgress) =>
    executarRobo2(orgao, matricula, senha, pesquisa, onProgress, PASTA_RELATORIOS, SUBPASTAS),
  robo3: async (orgao, matricula, senha, pesquisa, onProgress) =>
    executarRobo3(orgao, matricula, senha, pesquisa, onProgress, PASTA_RELATORIOS, SUBPASTAS),
  robo4: async (orgao, matricula, senha, pesquisa, onProgress) =>
    executarRobo4(orgao, matricula, senha, pesquisa, onProgress, PASTA_RELATORIOS, SUBPASTAS),
  robo5: async (orgao, matricula, senha, pesquisa, onProgress) =>
    executarRobo5(orgao, matricula, senha, pesquisa, onProgress, PASTA_RELATORIOS, SUBPASTAS),
  robo6: async (orgao, matricula, senha, pesquisa, onProgress) =>
    executarRobo6(orgao, matricula, senha, pesquisa, onProgress, PASTA_RELATORIOS, SUBPASTAS)
};

async function executarUmRobo(robo, ctx, onProgress) {
  const { orgao, matricula, senha, pesquisa, alvo } = ctx;
  const exec = EXECUTORES[robo];
  if (!exec) throw new Error(`Sem executor para ${robo}`);

  // PULO DO ROBO 6 SE FOR CARREIRA DE ASSISTENCIA
  if (robo === 'robo6') {
    const jsonAtual = lerJSON(SUBPASTAS.servidor, alvo);
    const cargo = String(jsonAtual?.cadastro?.cargo || '').toUpperCase();
    const isProfessor = /PROFESSOR|MAGIST|MAGISTERIO|DOCENTE|PROF\./i.test(cargo);

    if (!isProfessor) {
      onProgress(100, 'ℹ️ Cargo de assistência (sem lotações de magistério).');
      const resultado = {
        estado: 'vazio',
        dados: [],
        mensagem: 'Cargo não é de magistério. Lotações ignoradas.',
        arquivo: null
      };
      const json = atualizarBloco(SUBPASTAS.servidor, alvo, 'robo6', resultado);
      return { robo, ...resultado, json }; // Retorna o json atualizado
    }
  }

  let resultado;
  try {
    const r = await exec(orgao, matricula, senha, pesquisa, onProgress);
    resultado = {
      estado: r.estado || (r.sucesso ? 'ok' : 'erro'),
      dados: r.dados,
      mensagem: r.mensagem || r.erro || '',
      arquivo: r.arquivo
    };
  } catch (err) {
    resultado = { estado: 'erro', dados: null, mensagem: err.message, arquivo: null };
  }

  try {
    const json = atualizarBloco(SUBPASTAS.servidor, alvo, robo, {
      estado: resultado.estado,
      dados: resultado.dados,
      mensagem: resultado.mensagem
    });
    return { robo, ...resultado, json };
  } catch (err) {
    log(`[${robo}] Erro ao atualizar JSON: ${err.message}`);
    return { robo, ...resultado, json: lerJSON(SUBPASTAS.servidor, alvo) };
  }
}

let executandoNoServidor = false;

app.post('/executar', async (req, res) => {
  if (executandoNoServidor) {
    return res.status(429).json({ erro: 'Já existe uma execução em andamento no servidor.' });
  }
  const { orgao, matricula, senha, pesquisa, robos } = req.body || {};
  if (!orgao || !matricula || !senha || !pesquisa) {
    return res.status(400).json({ erro: 'Preencha todos os campos.' });
  }
  const lista = Array.isArray(robos) && robos.length ? robos.filter(r => ROBOS.includes(r)) : ROBOS;
  if (!lista.length) return res.status(400).json({ erro: 'Nenhum robô selecionado.' });

  setCancel(false);
  await fecharTodosBrowsers();

  executandoNoServidor = true;

  const alvo = normalizarMatricula(pesquisa);

  const caminhoJSONAlvo = caminhoJSON(SUBPASTAS.servidor, alvo);
  if (fs.existsSync(caminhoJSONAlvo)) {
    try { fs.unlinkSync(caminhoJSONAlvo); } catch (_) { }
  }
  criarSeNaoExistir(SUBPASTAS.servidor, alvo);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const enviar = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);
  const ctx = { orgao, matricula, senha, pesquisa, alvo };
  const resultados = {};

  try {
    ROBOS.forEach(r => {
      enviar({
        tipo: 'progresso', robo: r, status: lista.includes(r) ? 'iniciando' : 'pendente',
        mensagem: lista.includes(r) ? '⏳ Na fila...' : '⏸ Não selecionado', progresso: 0
      });
    });

    for (const robo of ROBOS) {
      if (!lista.includes(robo)) continue;
      if (getCancelRequested()) throw new Error('EXECUCAO_CANCELADA');

      enviar({ tipo: 'progresso', robo, status: 'processando', mensagem: '▶ Executando...', progresso: 0 });

      const onProgress = (pct, msg) => {
        enviar({ tipo: 'progresso', robo, status: 'processando', mensagem: msg, progresso: pct });
        desenharBarra(pct, `[${robo}] ${msg}`);
      };

      const r = await executarUmRobo(robo, ctx, onProgress);
      resultados[robo] = r;

      const statusSSE = r.estado === 'erro' ? 'erro' : 'concluido';
      const msgSSE = r.estado === 'ok' ? '✅ Sucesso' :
        r.estado === 'vazio' ? 'ℹ️ Sem registros' :
          `❌ ${r.mensagem}`;
      enviar({
        tipo: 'progresso', robo, status: statusSSE,
        mensagem: msgSSE,
        progresso: 100,
        dados: { estado: r.estado, mensagem: r.mensagem, arquivo: r.arquivo, json: r.json }
      });
    }

    const jsonFinal = lerJSON(SUBPASTAS.servidor, alvo);
    enviar({
      tipo: 'final',
      mensagem: jsonFinal.completo ? '✅ Ficha completa!' : '⚠ Ficha incompleta (alguns robôs pendentes/erro).',
      resultados: { jsonUnificado: jsonFinal, porRobo: resultados }
    });
  } catch (err) {
    if (err.message === 'EXECUCAO_CANCELADA') {
      enviar({ tipo: 'final', mensagem: '⛔ Execução cancelada.', resultados: {} });
    } else {
      enviar({ tipo: 'erro', mensagem: err.message });
    }
  } finally {
    setCancel(false);
    await fecharTodosBrowsers();
    executandoNoServidor = false;
    res.end();
  }
});

app.post('/executar-robo', async (req, res) => {
  if (executandoNoServidor) {
    return res.status(429).json({ erro: 'Já existe uma execução em andamento no servidor.' });
  }
  const { robo, orgao, matricula, senha, pesquisa } = req.body || {};
  if (!robo || !ROBOS.includes(robo)) return res.status(400).json({ erro: 'Robô inválido.' });
  if (!orgao || !matricula || !senha || !pesquisa) {
    return res.status(400).json({ erro: 'Preencha todos os campos.' });
  }

  setCancel(false);
  await fecharTodosBrowsers();
  executandoNoServidor = true;

  const alvo = normalizarMatricula(pesquisa);
  criarSeNaoExistir(SUBPASTAS.servidor, alvo);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const enviar = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);
  const ctx = { orgao, matricula, senha, pesquisa, alvo };

  try {
    enviar({ tipo: 'progresso', robo, status: 'processando', mensagem: '▶ Executando...', progresso: 0 });
    const onProgress = (pct, msg) => {
      enviar({ tipo: 'progresso', robo, status: 'processando', mensagem: msg, progresso: pct });
      desenharBarra(pct, `[${robo}] ${msg}`);
    };
    const r = await executarUmRobo(robo, ctx, onProgress);
    const statusSSE = r.estado === 'erro' ? 'erro' : 'concluido';
    const msgSSE = r.estado === 'ok' ? '✅ Sucesso' :
      r.estado === 'vazio' ? 'ℹ️ Sem dados (confirmado)' :
        `❌ ${r.mensagem}`;
    enviar({
      tipo: 'progresso', robo, status: statusSSE,
      mensagem: msgSSE,
      progresso: 100,
      dados: { estado: r.estado, mensagem: r.mensagem, arquivo: r.arquivo, json: r.json }
    });
    enviar({ tipo: 'final', sucesso: r.estado !== 'erro', resultados: { jsonUnificado: r.json } });
  } catch (err) {
    enviar({ tipo: 'erro', mensagem: err.message });
  } finally {
    setCancel(false);
    await fecharTodosBrowsers();
    executandoNoServidor = false;
    res.end();
  }
});

app.post('/salvar-calculos', (req, res) => {
  const { matricula, calculos } = req.body;
  if (!matricula || !calculos) return res.status(400).json({ erro: 'Dados incompletos.' });
  const alvo = normalizarMatricula(matricula);
  const caminho = caminhoJSON(SUBPASTAS.servidor, alvo);
  if (!fs.existsSync(caminho)) return res.status(404).json({ erro: 'JSON base não encontrado.' });
  try {
    const json = JSON.parse(fs.readFileSync(caminho, 'utf8'));
    json.calculos = calculos;
    json.atualizado_em = new Date().toISOString();
    fs.writeFileSync(caminho, JSON.stringify(json, null, 2), 'utf8');
    res.json({ sucesso: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.post('/carregar', (req, res) => {
  const { matricula } = req.body || {};
  if (!matricula) return res.status(400).json({ erro: 'Matrícula não informada.' });
  const alvo = normalizarMatricula(matricula);
  const json = lerJSON(SUBPASTAS.servidor, alvo);

  if (!json || !json.cadastro || !json.cadastro.nome) {
    return res.json({ sucesso: false, inexistente: true, mensagem: 'Matrícula inexistente (sem relatório de cadastro).' });
  }

  const RELATORIOS = {
    robo1: { nome: 'Cadastro', chave: 'cadastro', obrigatorio: true },
    robo2: { nome: 'Inc. Averbações', chave: 'inc_averbacoes', obrigatorio: false, lista: true },
    robo3: { nome: 'Exc. Averbações', chave: 'exc_averbacoes', obrigatorio: false, lista: true },
    robo4: { nome: 'Afastamentos', chave: 'afastamentos', obrigatorio: false, lista: true },
    robo5: { nome: 'Rev. Aposentadoria', chave: 'reversao_aposentadoria', obrigatorio: false, lista: true },
    robo6: { nome: 'Lotações', chave: 'lotacoes', obrigatorio: false, lista: true }
  };

  const status = {};
  let todosOk = true;
  let temCampoFaltando = false;

  for (const [robo, meta] of Object.entries(RELATORIOS)) {
    const bloco = json[meta.chave];
    if (meta.obrigatorio) {
      const CAMPOS_CADASTRO = [
        'orgao', 'matricula', 'nome', 'sexo', 'cpf', 'data_nascimento', 'email',
        'carga_horaria_principal', 'carga_horaria_secundaria', 'status',
        'data_admissao', 'data_aposentadoria', 'data_desligamento', 'dt_ref',
        'cargo', 'lotacao_principal_descricao'
      ];
      const faltando = CAMPOS_CADASTRO.filter(c => !(c in (bloco || {})));
      if (faltando.length) temCampoFaltando = true;
    }

    const stRobo = json.status_robos?.[robo] || 'pendente';
    const existe = meta.lista ? Array.isArray(bloco) && bloco.length > 0 : !!bloco;

    if (meta.obrigatorio) {
      status[robo] = { estado: 'ok', mensagem: 'Sucesso' };
    } else if (stRobo === 'ok' && existe) {
      status[robo] = { estado: 'ok', mensagem: 'Sucesso' };
    } else if (stRobo === 'vazio') {
      status[robo] = { estado: 'ok', mensagem: 'Sucesso (sem dados)' };
    } else {
      status[robo] = { estado: 'inexistente', mensagem: 'Relatório inexistente' };
      todosOk = false;
    }
  }

  return res.json({
    sucesso: todosOk,
    temCampoFaltando,
    divergente: temCampoFaltando,
    mensagem: temCampoFaltando ? 'Há campos inexistentes no cadastro.' : (todosOk ? 'Todos os relatórios carregados.' : 'Alguns relatórios inexistentes.'),
    json,
    status,
    exibivel: json.completo === true
  });
});

app.post('/cancelar', async (_req, res) => {
  setCancel(true);
  await fecharTodosBrowsers();
  res.json({ sucesso: true });
});

(async function iniciar() {
  try {
    console.log('🔍 Verificando Chromium...');
    for (let i = 0; i <= 100; i += 10) {
      desenharBarra(i, i === 100 ? '✔ Chromium verificado' : `Verificando... ${i}%`);
      await sleep(150);
    }
    console.log('');
    await garantirChromium(PASTA_RAIZ);
    await exibirInicializacao(PORT);
    app.listen(PORT, () => {
      console.log('📡 Aguardando requisições...\n');
      if (process.platform === 'win32') {
        require('child_process').exec(`start http://localhost:${PORT}`);
      }
    });
  } catch (err) {
    console.error('\x1b[31m❌ Erro ao iniciar:\x1b[0m', err.message);
    process.exit(1);
  }
})();