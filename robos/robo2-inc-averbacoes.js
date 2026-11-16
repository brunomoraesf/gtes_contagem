// robos/robo2-inc-averbacoes.js
const fs = require('fs');
const path = require('path');
const { checkCancel, log, normalizarMatricula, clicarNoFrame, abrirBrowser } = require('../utils/helpers');
const { loginSIGRH } = require('../utils/login');
const { parseIncAverbacoes } = require('../utils/parsersRobos');

async function executarRobo2(orgao, matricula, senha, pesquisa, onProgress, PASTA_RELATORIOS, SUBPASTAS) {
  const alvo = normalizarMatricula(pesquisa);
  const nomeArquivo = `inc-averbacoes-${alvo}.txt`;
  const caminhoArquivo = path.join(SUBPASTAS.inclui_averbacoes, nomeArquivo);
  let browserInstance = null;

  if (!fs.existsSync(SUBPASTAS.inclui_averbacoes)) fs.mkdirSync(SUBPASTAS.inclui_averbacoes, { recursive: true });

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

    setProg(25, '📂 Abrindo Consulta → Consulta Modelos...');
    await clicarNoFrame(page, 'Consulta', true);
    await page.waitForTimeout(1000);
    await clicarNoFrame(page, 'Consulta Modelos', true);
    await page.waitForTimeout(2000);
    checkCancel();

    setProg(30, '🔎 Procurando o modelo "sw_inclui_averbacoes"...');
    let achou = false;
    for (const frame of page.frames()) {
      const inputBusca = await frame.$('#ctl00_ConteudoCamposConsultar_txtDescricao');
      if (inputBusca) {
        await inputBusca.fill('sw_inclui_averbacoes');
        await page.waitForTimeout(1000);
        await frame.click('#ctl00_ConteudoCamposConsultar_btnConsultar');
        achou = true;
        break;
      }
    }
    if (!achou) throw new Error('Campo de busca não encontrado');

    setProg(34, '⏳ Aguardando resultado da busca...');
    startHB(38, '⏳ Aguardando resultado da busca...');
    await page.waitForTimeout(2000);
    stopHB();

    setProg(40, '🖱️ Selecionando o modelo sw_inclui_averbacoes...');
    await clicarNoFrame(page, 'sw_inclui_averbacoes', true);
    checkCancel();

    setProg(44, '🔧 Abrindo filtros...');
    await clicarNoFrame(page, 'Filtros', true);
    await page.waitForTimeout(1500);

    setProg(48, '🔧 Preenchendo filtros (matrícula)...');
    let filtrosOk = false;
    for (const frame of page.frames()) {
      const inputMatr = await frame.$('#ctl00_ConteudoCampos_grdFiltro_ctl03_txtValor');
      if (inputMatr) {
        await inputMatr.click({ clickCount: 3 });
        await inputMatr.fill(alvo);
        await page.waitForTimeout(400);
        filtrosOk = true;
        break;
      }
    }
    if (!filtrosOk) throw new Error('Campos de filtro não encontrados (ctl03)');
    
    // NOVOS PASSOS: Agrupamentos e AddTodos
    setProg(50, '⚙️ Agrupando valores...');
    await clicarNoFrame(page, '#ctl00_ConteudoCampos_lnkAgrupamentos');
    await page.waitForTimeout(1500);
    
    setProg(51, '⚙️ Adicionando filtro à consulta...');
    await clicarNoFrame(page, '#ctl00_ConteudoCampos_btnAddTodos');
    await page.waitForTimeout(1500);
    
    checkCancel();

    setProg(52, '📊 Executando a consulta...');
    await clicarNoFrame(page, 'Execução', true);
    await page.waitForTimeout(1500);

    setProg(56, '🔄 Gerando relatório no SIGRH (pode levar alguns segundos)...');
    startHB(69, '🔄 Gerando relatório no SIGRH...');
    const [novaJanela] = await Promise.all([
      context.waitForEvent('page', { timeout: 120000 }),
      clicarNoFrame(page, '#ctl00_ConteudoCampos_btnConfirmar')
    ]);
    await novaJanela.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    stopHB();
    checkCancel();

    setProg(72, '📥 Baixando o arquivo TXT...');
    await novaJanela.waitForSelector('#btnTXT');
    await page.waitForTimeout(800);
    const [download] = await Promise.all([
      novaJanela.waitForEvent('download'),
      novaJanela.click('#btnTXT')
    ]);
    await download.saveAs(caminhoArquivo);
    await page.waitForTimeout(800);
    await browser.close();
    browserInstance = null;
    checkCancel();

    setProg(92, '📝 Atualizando JSON unificado...');
    let estadoFinal = 'vazio';
    let mensagemFinal = 'TXT sem linha de dados.';
    let dadosJson = null;

    try {
      const { atualizarBloco } = require('../utils/jsonFicha');
      if (fs.existsSync(caminhoArquivo)) {
        const conteudoFinal = fs.readFileSync(caminhoArquivo, 'utf8');
        dadosJson = parseIncAverbacoes(conteudoFinal);

        if (dadosJson && dadosJson.length > 0) {
          await atualizarBloco(SUBPASTAS.servidor, alvo, 'robo2', {
            estado: 'ok', dados: dadosJson, mensagem: 'Averbações obtidas.'
          });
          estadoFinal = 'ok';
          mensagemFinal = 'Averbações obtidas.';
          log(`JSON unificado atualizado (robo2 ok).`);
        } else {
          await atualizarBloco(SUBPASTAS.servidor, alvo, 'robo2', {
            estado: 'vazio', dados: [], mensagem: 'Sem averbações para esta matrícula.'
          });
          estadoFinal = 'vazio';
          mensagemFinal = 'Sem averbações.';
          log(`JSON unificado atualizado (robo2 vazio).`);
        }
      } else {
        await atualizarBloco(SUBPASTAS.servidor, alvo, 'robo2', {
          estado: 'erro', mensagem: 'Arquivo TXT não foi baixado.'
        });
        estadoFinal = 'erro';
        mensagemFinal = 'Arquivo TXT não foi baixado.';
      }
    } catch (e) {
      log(`Erro ao atualizar JSON: ${e.message}`);
      estadoFinal = 'erro';
      mensagemFinal = e.message;
    }

    setProg(100, estadoFinal === 'ok' ? '✅ Averbações baixadas!' : '⚠ Finalizado.');
    return { estado: estadoFinal, arquivo: nomeArquivo, mensagem: mensagemFinal, dados: dadosJson };

  } catch (error) {
    stopHB();
    log(`Erro no Robô 2: ${error.message}`);
    if (browserInstance) await browserInstance.close().catch(() => { });
    try {
      const { atualizarBloco } = require('../utils/jsonFicha');
      await atualizarBloco(SUBPASTAS.servidor, alvo, 'robo2', { estado: 'erro', mensagem: error.message });
    } catch (_) { }
    return { estado: 'erro', erro: error.message, arquivo: nomeArquivo, mensagem: error.message, dados: null };
  }
}
module.exports = { executarRobo2 };