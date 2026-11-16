// robos/robo6-lotacoes.js
const fs = require('fs');
const path = require('path');
const { checkCancel, log, normalizarMatricula, clicarNoFrame, abrirBrowser } = require('../utils/helpers');
const { loginSIGRH } = require('../utils/login');
const { parseLotacoes, parseDescricaoLotacoes } = require('../utils/parsersRobos');

// Período MMAAAA MMAAAA: da inicio_escala mais antiga até a fim_escala mais recente
// (ignora 99999999 = em aberto).
function calcularPeriodoReferencia(linhas) {
  const validas = [];
  for (const l of linhas) {
    for (const campo of ['inicio_escala', 'fim_escala']) {
      const s = String(l[campo] || '').trim();
      if (!/^\d{8}$/.test(s) || s === '99999999') continue;
      const ano = parseInt(s.slice(4, 8));
      const mes = parseInt(s.slice(2, 4));
      if (ano < 1990 || ano > 2100 || mes < 1 || mes > 12) continue;
      validas.push({ ano, mes });
    }
  }
  if (!validas.length) return null;
  validas.sort((a, b) => (a.ano - b.ano) || (a.mes - b.mes));
  const fmt = o => String(o.mes).padStart(2, '0') + String(o.ano);
  return `${fmt(validas[0])} ${fmt(validas[validas.length - 1])}`;
}

async function executarRobo6(orgao, matricula, senha, pesquisa, onProgress, PASTA_RELATORIOS, SUBPASTAS) {
  const alvo = normalizarMatricula(pesquisa);
  const nomeArquivo = `lotacoes-${alvo}.txt`;
  const caminhoArquivo = path.join(SUBPASTAS.lotacoes, nomeArquivo);
  const nomeArquivoDesc = `descricao-lotacoes-${alvo}.txt`;
  const caminhoArquivoDesc = path.join(SUBPASTAS.descricao_lotacoes, nomeArquivoDesc);
  let browserInstance = null;

  if (!fs.existsSync(SUBPASTAS.lotacoes)) fs.mkdirSync(SUBPASTAS.lotacoes, { recursive: true });
  if (!fs.existsSync(SUBPASTAS.descricao_lotacoes)) fs.mkdirSync(SUBPASTAS.descricao_lotacoes, { recursive: true });

  let _prog = 0;
  let _hb = null;
  const stopHB = () => { if (_hb) { clearInterval(_hb); _hb = null; } };
  const setProg = (pct, msg) => { stopHB(); _prog = Math.max(_prog, pct); onProgress(_prog, msg); };
  const startHB = (target, msg) => {
    stopHB();
    _hb = setInterval(() => {
      if (_prog < target) { _prog = Math.min(target, _prog + 0.4); onProgress(Math.floor(_prog), msg); }
      else stopHB();
    }, 300);
  };

  // Abre Consulta → Modelos, busca o modelo e aplica filtros. NÃO executa.
  async function abrirConsultaModelo(page, context, nomeModelo, preencherFiltros) {
    setProg(28, `🔎 Procurando o modelo "${nomeModelo}"...`);
    let achou = false;
    for (const frame of page.frames()) {
      const inputBusca = await frame.$('#ctl00_ConteudoCamposConsultar_txtDescricao');
      if (inputBusca) {
        await inputBusca.fill(nomeModelo);
        await page.waitForTimeout(800);
        await frame.click('#ctl00_ConteudoCamposConsultar_btnConsultar');
        achou = true;
        break;
      }
    }
    if (!achou) throw new Error('Campo de busca não encontrado');

    startHB(34, '⏳ Aguardando resultado da busca...');
    await page.waitForTimeout(2000);
    stopHB();

    setProg(38, `🖱️ Selecionando o modelo ${nomeModelo}...`);
    await clicarNoFrame(page, nomeModelo, true);
    checkCancel();

    setProg(42, '🔧 Abrindo filtros...');
    await clicarNoFrame(page, 'Filtros', true);
    await page.waitForTimeout(1500);

    setProg(46, '🔧 Preenchendo filtros...');
    const ok = await preencherFiltros(page);
    if (!ok) throw new Error(`Campos de filtro não encontrados para ${nomeModelo}`);
    checkCancel();

    // AGRUPAMENTO SEMPRE
    setProg(50, '⚙️ Agrupando valores...');
    await clicarNoFrame(page, '#ctl00_ConteudoCampos_lnkAgrupamentos');
    await page.waitForTimeout(1200);
    setProg(52, '⚙️ Adicionando filtro à consulta...');
    await clicarNoFrame(page, '#ctl00_ConteudoCampos_btnAddTodos');
    await page.waitForTimeout(1200);
    checkCancel();
  }

  // Executa a consulta e devolve a janela com #btnTXT pronta.
  async function executarEGerar(page, context, rotuloHB) {
    setProg(54, '📊 Executando a consulta...');
    await clicarNoFrame(page, 'Execução', true);
    await page.waitForTimeout(1500);

    startHB(64, rotuloHB || '🔄 Gerando relatório no SIGRH...');
    const [novaJanela] = await Promise.all([
      context.waitForEvent('page', { timeout: 120000 }),
      clicarNoFrame(page, '#ctl00_ConteudoCampos_btnConfirmar')
    ]);
    await novaJanela.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    stopHB();
    checkCancel();

    await novaJanela.waitForSelector('#btnTXT');
    await page.waitForTimeout(500);
    return novaJanela;
  }

  async function baixar(novaJanela, page, destino) {
    const [download] = await Promise.all([
      novaJanela.waitForEvent('download'),
      novaJanela.click('#btnTXT')
    ]);
    await download.saveAs(destino);
    await page.waitForTimeout(500);
  }

  // Reabre o menu Consulta → Consulta Modelos (a page principal continua válida)
  async function reabrirConsultaModelos(page) {
    setProg(78, '📂 Reabrindo Consulta Modelos...');
    await clicarNoFrame(page, 'input[name="EXT"]').catch(() => { });
    await page.waitForTimeout(1500);
    await clicarNoFrame(page, 'Consulta', true).catch(() => { });
    await page.waitForTimeout(800);
    await clicarNoFrame(page, 'Consulta Modelos', true).catch(() => { });
    await page.waitForTimeout(1800);
    checkCancel();
  }

  try {
    const { browser, context, page } = await abrirBrowser(process.cwd());
    browserInstance = browser;

    checkCancel();
    await loginSIGRH(page, orgao, matricula, senha, onProgress);
    _prog = 20;
    checkCancel();

    setProg(22, '📂 Abrindo o menu de consulta...');
    await clicarNoFrame(page, 'input[name="EXT"]');
    await page.waitForTimeout(2000);
    await clicarNoFrame(page, 'Consulta', true);
    await page.waitForTimeout(1000);
    await clicarNoFrame(page, 'Consulta Modelos', true);
    await page.waitForTimeout(2000);
    checkCancel();

    // ===== FASE A: sw_lotacoes =====
    await abrirConsultaModelo(page, context, 'sw_lotacoes', async (p) => {
      for (const frame of p.frames()) {
        const inputMatr = await frame.$('#ctl00_ConteudoCampos_grdFiltro_ctl02_txtValor');
        if (inputMatr) {
          await inputMatr.click({ clickCount: 3 });
          await inputMatr.fill(alvo);
          await p.waitForTimeout(300);
          return true;
        }
      }
      return false;
    });

    let janelaLot = await executarEGerar(page, context, '🔄 Gerando relatório de lotações...');

    setProg(66, '📥 Baixando o arquivo de lotações...');
    await baixar(janelaLot, page, caminhoArquivo);
    try { await janelaLot.close(); } catch (_) { }

    let dadosJson = [];
    if (fs.existsSync(caminhoArquivo)) {
      dadosJson = parseLotacoes(fs.readFileSync(caminhoArquivo, 'utf8'));
    }

    // ===== FASE B: sw_descricao_lotacoes_testes =====
    if (dadosJson.length > 0) {
      const codigos = Array.from(new Set(
        dadosJson.map(l => String(l.lotacao || '').trim()).filter(Boolean)
      ));
      const periodo = calcularPeriodoReferencia(dadosJson);

      if (codigos.length > 0 && periodo) {
        await reabrirConsultaModelos(page);

        await abrirConsultaModelo(page, context, 'sw_descricao_lotacoes_testes', async (p) => {
          const codigosStr = codigos.join(' ');
          for (const frame of p.frames()) {
            const ctl03 = await frame.$('#ctl00_ConteudoCampos_grdFiltro_ctl03_txtValor');
            if (!ctl03) continue;

            await ctl03.click({ clickCount: 3 });
            await ctl03.fill(periodo);
            await p.waitForTimeout(200);

            const ctl07 = await frame.$('#ctl00_ConteudoCampos_grdFiltro_ctl07_txtValor');
            if (ctl07) {
              await ctl07.click({ clickCount: 3 });
              await ctl07.fill(periodo);
              await p.waitForTimeout(200);
            }

            const ctl04 = await frame.$('#ctl00_ConteudoCampos_grdFiltro_ctl04_txtValor');
            if (ctl04) {
              await ctl04.click({ clickCount: 3 });
              await ctl04.fill(codigosStr);
              await p.waitForTimeout(200);
            }
            return true;
          }
          return false;
        });

        const janelaDesc = await executarEGerar(page, context, '🔄 Gerando relatório de descrições...');

        setProg(84, '📥 Baixando o arquivo de descrições...');
        await baixar(janelaDesc, page, caminhoArquivoDesc);
        try { await janelaDesc.close(); } catch (_) { }

        if (fs.existsSync(caminhoArquivoDesc)) {
          const descricoes = parseDescricaoLotacoes(fs.readFileSync(caminhoArquivoDesc, 'utf8'));
          log(`[robo6] descrições recebidas: ${descricoes.length} linhas`);

          const mapaLot = new Map();
          for (const d of descricoes) {
            if (d.codigo_lotacao && d.denominacao_lotacao) {
              mapaLot.set(d.codigo_lotacao, d.denominacao_lotacao);
            }
          }

          const resolverLot = (codLot) => {
            const s = String(codLot || '').trim();
            if (!s) return '';
            if (mapaLot.has(s)) return mapaLot.get(s);
            for (const [k, v] of mapaLot.entries()) {
              if (k.endsWith(s) || s.endsWith(k)) return v;
            }
            return '';
          };

          dadosJson = dadosJson.map(l => {
            const codLot = String(l.lotacao || '').trim();
            const denLot = resolverLot(codLot);
            return {
              ...l,
              lotacao_codigo: codLot,
              lotacao: denLot || codLot
            };
          });

          log(`[robo6] merge → ${mapaLot.size} lotações`);
        }
      }
    }

    await browser.close();
    browserInstance = null;
    checkCancel();

    // ===== FASE C: atualizar JSON =====
    setProg(92, '📝 Atualizando JSON unificado...');
    let estadoFinal = 'vazio';
    let mensagemFinal = 'TXT sem linha de dados.';

    try {
      const { atualizarBloco } = require('../utils/jsonFicha');
      if (fs.existsSync(caminhoArquivo) && dadosJson && dadosJson.length > 0) {
        await atualizarBloco(SUBPASTAS.servidor, alvo, 'robo6', {
          estado: 'ok', dados: dadosJson, mensagem: 'Lotações obtidas.'
        });
        estadoFinal = 'ok';
        mensagemFinal = 'Lotações obtidas.';
        log(`JSON unificado atualizado (robo6 ok).`);
      } else if (fs.existsSync(caminhoArquivo)) {
        await atualizarBloco(SUBPASTAS.servidor, alvo, 'robo6', {
          estado: 'vazio', dados: [], mensagem: 'Sem lotações para esta matrícula.'
        });
        estadoFinal = 'vazio';
        mensagemFinal = 'Sem lotações.';
        log(`JSON unificado atualizado (robo6 vazio).`);
      } else {
        await atualizarBloco(SUBPASTAS.servidor, alvo, 'robo6', {
          estado: 'erro', mensagem: 'Arquivo TXT de lotações não foi baixado.'
        });
        estadoFinal = 'erro';
        mensagemFinal = 'Arquivo TXT de lotações não foi baixado.';
      }
    } catch (e) {
      log(`Erro ao atualizar JSON: ${e.message}`);
      estadoFinal = 'erro';
      mensagemFinal = e.message;
    }

    setProg(100, estadoFinal === 'ok' ? '✅ Lotações + descrições baixadas!' : '⚠ Finalizado.');
    return { estado: estadoFinal, arquivo: nomeArquivo, mensagem: mensagemFinal, dados: dadosJson };

  } catch (error) {
    stopHB();
    log(`Erro no Robô 6: ${error.message}`);
    if (browserInstance) await browserInstance.close().catch(() => { });
    try {
      const { atualizarBloco } = require('../utils/jsonFicha');
      await atualizarBloco(SUBPASTAS.servidor, alvo, 'robo6', { estado: 'erro', mensagem: error.message });
    } catch (_) { }
    return { estado: 'erro', erro: error.message, arquivo: nomeArquivo, mensagem: error.message, dados: null };
  }
}

module.exports = { executarRobo6 };