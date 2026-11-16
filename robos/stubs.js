// robos/stubs.js
// Stubs dos robôs 2-5 enquanto a navegação real não é plugada.
// Comportamento controlado por env STUB_ROBO2..STUB_ROBO5:
//   'vazio' (padrão) | 'erro' | 'ok'

function resultadoStub(robo) {
  const forcar = (process.env[`STUB_${robo.toUpperCase()}`] || 'vazio').toLowerCase();
  if (forcar === 'erro') {
    return { estado: 'erro', mensagem: `[STUB] ${robo} falhou (forçado por env).` };
  }
  if (forcar === 'ok') {
    return { estado: 'ok', dados: [], mensagem: `[STUB] ${robo} ok (forçado por env).` };
  }
  return { estado: 'vazio', dados: [], mensagem: `[STUB] ${robo} sem dados.` };
}

async function executarStub(robo, onProgress) {
  if (onProgress) {
    onProgress(0, `⏳ [STUB] ${robo} iniciando...`);
    await new Promise(r => setTimeout(r, 300));
    onProgress(50, `⏳ [STUB] ${robo} processando...`);
    await new Promise(r => setTimeout(r, 300));
    onProgress(100, `✅ [STUB] ${robo} concluído.`);
  }
  return resultadoStub(robo);
}

module.exports = { executarStub, resultadoStub };