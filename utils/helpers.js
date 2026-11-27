// utils/helpers.js
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

// Variáveis globais de controle
let cancelRequested = false;
let activeBrowsers = [];
// Controle de visualização do navegador (headless vs visível)
// Default: false → headless (oculto). Alterado via POST /config
let showBrowser = false;

function setShowBrowser(v) { showBrowser = !!v; }
function getShowBrowser() { return showBrowser; }

function setCancelRequested(value) {
  cancelRequested = value;
}

function getCancelRequested() {
  return cancelRequested;
}

function checkCancel() {
  if (cancelRequested) {
    throw new Error('EXECUCAO_CANCELADA');
  }
}

function log(msg) {
  console.log(`[SERVER] ${new Date().toISOString()} - ${msg}`);
}

function normalizarMatricula(v) {
  return String(v || '').trim().toUpperCase().replace(/[^0-9A-Z]/g, '').padStart(8, '0');
}

async function clicarNoFrame(page, selector, porTexto = false, timeout = 8000) {
  const inicio = Date.now();
  while (Date.now() - inicio < timeout) {
    const frames = page.frames();
    for (const frame of frames) {
      try {
        const elemento = porTexto ? frame.locator(`text="${selector}"`) : frame.locator(selector);
        if (await elemento.count() > 0) {
          await elemento.first().scrollIntoViewIfNeeded().catch(() => { });
          await page.waitForTimeout(300);
          await elemento.first().dispatchEvent('click');
          return true;
        }
      } catch (e) { }
    }
    await page.waitForTimeout(300);
  }
  return false;
}

async function abrirBrowser(PASTA_RAIZ) {
  const chromePath = path.join(PASTA_RAIZ, 'chrome-win', 'chrome.exe');
  const options = {
    headless: !showBrowser,  // true = oculto, false = visível
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--window-size=1920,1080'
    ]
  };
  if (fs.existsSync(chromePath)) {
    options.executablePath = chromePath;
  } else {
    // fallback para o Chromium padrão do Playwright
    options.channel = 'chrome';
  }
  const browser = await chromium.launch(options);
  activeBrowsers.push(browser);
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    acceptDownloads: true
  });
  const page = await context.newPage();
  await page.setExtraHTTPHeaders({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  return { browser, context, page };
}

async function fecharTodosBrowsers() {
  for (const b of activeBrowsers) {
    try { await b.close(); } catch (_) { }
  }
  activeBrowsers = [];
}

// Função auxiliar para copiar recursivamente
async function copiarPasta(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copiarPasta(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

async function garantirChromium(PASTA_RAIZ) {
  const chromePath = path.join(PASTA_RAIZ, 'chrome-win', 'chrome.exe');
  if (fs.existsSync(chromePath)) {
    console.log('[Chromium] Executável encontrado em chrome-win.');
    return true;
  }

  console.log('[Chromium] Executável não encontrado. Baixando Chromium via Playwright...');

  try {
    // Instala o Chromium no cache padrão do Playwright
    await execAsync('npx playwright install chromium', { cwd: PASTA_RAIZ });

    // Localiza o diretório de cache do Playwright
    const home = process.env.USERPROFILE || process.env.HOME;
    const cacheDir = path.join(home, 'AppData', 'Local', 'ms-playwright');
    if (!fs.existsSync(cacheDir)) {
      throw new Error('Não foi possível localizar o cache do Playwright.');
    }

    // Encontra a pasta do Chromium (ex: chromium-1234)
    const folders = fs.readdirSync(cacheDir).filter(f => f.startsWith('chromium-'));
    if (folders.length === 0) throw new Error('Pasta do Chromium não encontrada no cache.');
    const chromiumFolder = path.join(cacheDir, folders[0]);
    console.log(`[Chromium] Pasta encontrada: ${chromiumFolder}`);

    // Procura o chrome.exe dentro da pasta (pode estar em subpastas como chrome-win/)
    let chromeExePath = null;
    function procurarArquivo(dir, nomeArquivo) {
      const files = fs.readdirSync(dir, { withFileTypes: true });
      for (const file of files) {
        const fullPath = path.join(dir, file.name);
        if (file.isDirectory()) {
          const encontrado = procurarArquivo(fullPath, nomeArquivo);
          if (encontrado) return encontrado;
        } else if (file.name === nomeArquivo) {
          return fullPath;
        }
      }
      return null;
    }
    chromeExePath = procurarArquivo(chromiumFolder, 'chrome.exe');
    if (!chromeExePath) {
      throw new Error('Arquivo chrome.exe não encontrado dentro da pasta do Chromium.');
    }

    // Cria a pasta chrome-win na raiz e copia todo o conteúdo da pasta pai do chrome.exe
    const srcChromeDir = path.dirname(chromeExePath);
    const destDir = path.join(PASTA_RAIZ, 'chrome-win');
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

    // Copia recursivamente a pasta chrome-win do cache para a raiz
    await copiarPasta(srcChromeDir, destDir);

    console.log('[Chromium] Copiado com sucesso para chrome-win/chrome.exe');
    return true;
  } catch (error) {
    console.error('[Chromium] Erro ao baixar/copiar:', error.message);
    throw new Error('Falha ao configurar o Chromium. Verifique sua conexão e tente novamente.');
  }
}

module.exports = {
  setCancelRequested,
  getCancelRequested,
  checkCancel,
  log,
  normalizarMatricula,
  clicarNoFrame,
  abrirBrowser,
  fecharTodosBrowsers,
  garantirChromium,
  setShowBrowser,
  getShowBrowser
};