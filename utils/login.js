// utils/login.js
async function loginSIGRH(page, orgao, matricula, senha, onProgress) {
  onProgress(5, '🌐 Acessando o sistema SIGRH...');
  await page.goto('https://sigrh.df.gov.br/login/Log.aspx', { waitUntil: 'networkidle', timeout: 120000 });
  onProgress(8, '🔐 Preenchendo dados de acesso...');
  await page.fill('#TxtCd_Empresa', String(orgao));
  await page.fill('#TxtNu_Matricula', String(matricula));
  await page.fill('#TxtTe_Senha', String(senha));
  onProgress(10, '📨 Enviando credenciais...');
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle', timeout: 120000 }).catch(() => {}),
    page.click('#BtOk')
  ]);
  if (page.url().includes('Log.aspx')) {
    throw new Error('Login falhou.');
  }
  onProgress(15, '✅ Login realizado com sucesso!');
  await page.waitForTimeout(3000);
}

module.exports = { loginSIGRH };