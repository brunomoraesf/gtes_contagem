// utils/terminal.js
const readline = require('readline');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function desenharBarra(percent, texto) {
  const size = 11;
  const percentVal = Math.min(Math.max(percent, 0), 100);
  const preenchido = Math.round((percentVal / 100) * size);
  const vazio = size - preenchido;
  const barra = '█'.repeat(preenchido) + '░'.repeat(vazio);
  
  readline.cursorTo(process.stdout, 0);
  process.stdout.write(`\x1b[36m[${barra}] ${percentVal}% - ${texto}\x1b[0m`);
  readline.clearLine(process.stdout, 1);
}

async function exibirInicializacao(porta) {
  console.clear();
  console.log(`\x1b[34m======================================================\x1b[0m`);
  console.log(`\x1b[1m\x1b[36m           AUTOMAÇÃO TEMPO DE SERVIÇO\x1b[0m`);
  console.log(`\x1b[34m======================================================\x1b[0m`);
  console.log(`\x1b[32m  ✔ Servidor ativo em:\x1b[0m \x1b[1mhttp://localhost:${porta}\x1b[0m`);
  console.log(`\x1b[34m------------------------------------------------------\x1b[0m`);
  console.log(`  Desenvolvido por: \x1b[1mBruno Moraes\x1b[0m`);
  console.log(`  Link: \x1b[36mhttps://bmfolio.web.app/\x1b[0m`);
  console.log(`\x1b[34m======================================================\x1b[0m\n`);
}

module.exports = { sleep, desenharBarra, exibirInicializacao };