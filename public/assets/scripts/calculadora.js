/**
 * ============================================================================
 * ARQUIVO: calculadora.js
 * LOCALIZAÇÃO: public/assets/scripts/calculadora.js
 * ============================================================================
 * Este arquivo é o "cérebro" matemático do sistema. Ele é 100% independente 
 * do HTML. Ele recebe o JSON do servidor e o estado dos checkboxes (marcado/
 * desmarcado) e devolve os tempos calculados, idades e a regra de aposentadoria.
 * 
 * A matemática aqui lida com:
 * - União de intervalos (para não contar o mesmo dia duas vezes).
 * - Regra inclusiva de datas (ex: dia 1 ao dia 1 = 2 dias).
 * - Tratamento de datas em aberto (99/99/9999 = hoje).
 * - Enquadramento legal conforme a apostila (EC 47/05, EC 41/03, etc.).
 * ============================================================================
 */

/**
 * Converte uma string de data para um objeto Date do JavaScript.
 * Aceita formatos: "DD/MM/AAAA" ou "DDMMAAAA" (8 dígitos).
 * Caso a data seja 99/99/9999 (em aberto), retorna a data de HOJE.
 * @param {string} s - String da data.
 * @returns {Date|null} Objeto Date ou null se for inválido.
 */
function parseDate(s) {
    if (!s) return null;
    const str = String(s).trim();
    
    // Tratamento especial para data em aberto (lotações sem fim)
    if (str === '99999999' || str === '99/99/9999') return new Date(); 
    
    // Tenta o formato com barras (dd/mm/aaaa)
    let m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(str);
    if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    
    // Tenta o formato sem barras (ddmmaaaa)
    m = /^(\d{2})(\d{2})(\d{4})$/.exec(str);
    if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    
    return null; // Retorna null se não reconhecer o formato
}

/**
 * Calcula a diferença em dias entre duas datas.
 * A contagem é INCLUSIVA, ou seja, se d1 = 01/01 e d2 = 02/01, o resultado é 2 dias.
 * @param {Date} d1 - Data de início.
 * @param {Date} d2 - Data de fim.
 * @returns {number} Quantidade de dias.
 */
function diffDias(d1, d2) {
    if (!d1 || !d2) return 0;
    // Zera horas para evitar o erro do Horário de Verão
    const a = new Date(d1.getFullYear(), d1.getMonth(), d1.getDate());
    const b = new Date(d2.getFullYear(), d2.getMonth(), d2.getDate());
    return Math.round((b - a) / 86400000) + 1; 
}

/**
 * Une intervalos de datas que se sobrepõem.
 * Exemplo: se o servidor foi admitido em 2000 e tem uma averbação de 1998 a 2005,
 * os períodos se sobrepõem. Se não unirmos, contaríamos os dias de 2000 a 2005 duas vezes.
 * @param {Array} intervalos - Array de objetos { inicio: Date, fim: Date }.
 * @returns {Array} Array de intervalos unificados e ordenados.
 */
function unirIntervalos(intervalos) {
    if (!intervalos.length) return [];
    
    // 1. Ordena os intervalos do mais antigo para o mais novo (baseado no início)
    intervalos.sort((a, b) => a.inicio - b.inicio);
    
    const res = [intervalos[0]]; // Começa com o primeiro intervalo
    
    // 2. Percorre os outros intervalos
    for (let i = 1; i < intervalos.length; i++) {
        const atual = intervalos[i];
        const ultimo = res[res.length - 1];
        
        // Se o início do intervalo atual for menor ou igual ao fim do último, eles se tocam/sobrepõem.
        if (atual.inicio <= ultimo.fim) {
            // Estende o fim do último para o maior fim possível (seja ele o atual ou o anterior)
            ultimo.fim = new Date(Math.max(ultimo.fim, atual.fim));
        } else {
            // Se não se tocam, é um novo período independente, adiciona na lista.
            res.push(atual);
        }
    }
    return res;
}

/**
 * Soma a quantidade total de dias de um array de intervalos.
 * Ele usa a função unirIntervalos para garantir que dias sobrepostos não sejam contados duas vezes.
 * @param {Array} intervalos - Array de objetos { inicio: Date, fim: Date }.
 * @returns {number} Total de dias somados.
 */
function somarIntervalos(intervalos) {
    let total = 0;
    const unidos = unirIntervalos(intervalos); // Une os períodos primeiro
    for (const int of unidos) {
        total += diffDias(int.inicio, int.fim); // Soma a diferença inclusiva de cada período único
    }
    return total;
}

/**
 * Converte uma quantidade de dias em formato de texto (Anos, Meses e Dias).
 * Nota: Usa a aproximação de mercado (1 ano = 365 dias, 1 mês = 30 dias).
 * @param {number} dias - Total de dias.
 * @returns {Object} Objeto com anos, meses, dias e o texto formatado.
 */
function diasParaAMD(dias) {
    if (dias <= 0) return { anos: 0, meses: 0, dias: 0, texto: '0 anos, 0 meses e 0 dias' };
    const anos = Math.floor(dias / 365); // Descobre quantos anos completos
    const restoAnos = dias % 365; // O que sobrar vira meses/dias
    const meses = Math.floor(restoAnos / 30); // Descobre quantos meses completos no resto
    const diasFinais = restoAnos % 30; // O que sobrar são os dias finais
    return { anos, meses, dias: diasFinais, texto: `${anos} anos, ${meses} meses e ${diasFinais} dias` };
}

/**
 * Calcula a idade exata em anos completos.
 * @param {Date} dataNasc - Data de nascimento.
 * @param {Date} ref - Data de referência (geralmente hoje).
 * @returns {number} Idade em anos.
 */
function calcularIdade(dataNasc, ref) {
    if (!dataNasc || !ref) return 0;
    let idade = ref.getFullYear() - dataNasc.getFullYear();
    const m = ref.getMonth() - dataNasc.getMonth();
    
    // Se ainda não chegou o mês de aniversário, ou se é o mês do aniversário mas o dia ainda não chegou, subtrai 1 ano.
    if (m < 0 || (m === 0 && ref.getDate() < dataNasc.getDate())) idade--;
    
    return idade;
}

/**
 * FUNÇÃO PRINCIPAL: Calcula todos os tempos e a regra de aposentadoria.
 * @param {Object} dadosFicha - O JSON completo do servidor (cadastro, averbações, etc).
 * @param {Object} checkboxes - Objeto com o estado dos checkboxes da tela (ex: {'inc-0-averbado': true, 'exc-2': false}).
 * @returns {Object} Objeto contendo idade, tempos e a regra legal aplicada.
 */
function calcularTempos(dadosFicha, checkboxes) {
    const hoje = new Date();
    
    // 1. Extrai dados básicos do cadastro
    const dataNasc = parseDate(dadosFicha.cadastro?.data_nascimento);
    const dataAdm = parseDate(dadosFicha.cadastro?.data_admissao);
    
    const idade = calcularIdade(dataNasc, hoje);
    // Verifica o sexo ('F' para Feminino, 'M' para Masculino)
    const sexo = String(dadosFicha.cadastro?.sexo).toUpperCase().includes('F') ? 'F' : 'M';

    // 2. TEMPO DE SERVIÇO PÚBLICO
    // Vai da data de admissão até hoje.
    let tempoServPubDias = 0;
    if (dataAdm) tempoServPubDias = diffDias(dataAdm, hoje);

    // 3. AVERBAÇÕES INCLUSAS (Tempo que conta a mais)
    const intervalosInc = [];
    let tempoMagisterioDias = 0;
    const incs = dadosFicha.inc_averbacoes || [];
    
    incs.forEach((l, i) => {
        // Verifica se o analista marcou o checkbox de averbado ou de magistério para esta linha
        const checkAverb = checkboxes[`inc-${i}-averbado`];
        const checkMag = checkboxes[`inc-${i}-magisterio`];
        
        // Se marcou qualquer um dos dois, o período entra na conta
        if (checkAverb || checkMag) {
            const ini = parseDate(l.data_inicio);
            const fim = parseDate(l.data_fim);
            if (ini && fim) {
                intervalosInc.push({ inicio: ini, fim });
                // Se marcou especificamente o checkbox de magistério (🎓), soma no tempo especial
                if (checkMag) tempoMagisterioDias += diffDias(ini, fim);
            }
        }
    });

    // 4. EXCLUSÕES (Tempo que é retirado)
    const intervalosExc = [];
    (dadosFicha.exc_averbacoes || []).forEach((l, i) => {
        if (checkboxes[`exc-${i}`]) { // Se o analista manteve marcado
            const ini = parseDate(l.data_inicio_exclusao);
            const fim = parseDate(l.data_fim_exclusao);
            if (ini && fim) intervalosExc.push({ inicio: ini, fim });
        }
    });

    // 5. AFASTAMENTOS (Tempo que é retirado)
    const intervalosAfa = [];
    (dadosFicha.afastamentos || []).forEach((l, i) => {
        if (checkboxes[`afa-${i}`]) { // Se o analista manteve marcado
            const ini = parseDate(l.data_referencia);
            const fim = parseDate(l.data_fim_afastamento);
            if (ini && fim) intervalosAfa.push({ inicio: ini, fim });
        }
    });

    // 6. CÁLCULO DO TEMPO DE CONTRIBUIÇÃO TOTAL
    let temposContrib = [];
    
    // Adiciona o tempo de serviço público (admissão até hoje)
    if (dataAdm) temposContrib.push({ inicio: dataAdm, fim: hoje });
    
    // Adiciona as averbações inclusas
    temposContrib = temposContrib.concat(intervalosInc);
    
    // Soma tudo (unindo sobreposições)
    let tempoContribuicaoDias = somarIntervalos(temposContrib);
    
    // Calcula os dias a descontar (exclusões + afastamentos)
    let diasDescontar = somarIntervalos(intervalosExc) + somarIntervalos(intervalosAfa);
    
    // Subtrai do total
    tempoContribuicaoDias -= diasDescontar;
    if (tempoContribuicaoDias < 0) tempoContribuicaoDias = 0; // Evita números negativos

    // 7. TEMPO DE CARREIRA E CARGO
    // Como o sistema não tem a data de posse no cargo separada, assume-se o tempo de serviço público
    const tempoCargoDias = tempoServPubDias; 
    const tempoCarreiraDias = tempoServPubDias;

    // 8. ENQUADRAMENTO NA FUNDAMENTAÇÃO LEGAL
    let regra = null;
    const anoAdm = dataAdm ? dataAdm.getFullYear() : 9999;

    // ==========================================
    // REGRA 1: Admissão até 31/12/1998
    // Ref: Art. 3º EC 47/05 (Sistema de Pontos 85/95)
    // ==========================================
    if (anoAdm <= 1998) {
        const pontos = idade + Math.floor(tempoContribuicaoDias / 365);
        const minPontos = sexo === 'F' ? 85 : 95;
        const minContrib = sexo === 'F' ? 30 : 35;
        
        regra = {
            id: 'art3',
            nome: 'Art. 3º EC 47/05 (Transição - Pontos)',
            fundamentacao: 'Art.3º, incisos I, II e III, e § único da EC 47/05.',
            detalhes: [
                { req: `Pontos (${minPontos})`, atual: pontos, ok: pontos >= minPontos },
                { req: `Contribuição (${minContrib} anos)`, atual: Math.floor(tempoContribuicaoDias / 365), ok: tempoContribuicaoDias >= minContrib * 365 },
                { req: 'Serviço Público (25 anos)', atual: Math.floor(tempoServPubDias / 365), ok: tempoServPubDias >= 25 * 365 },
                { req: 'Carreira (15 anos)', atual: Math.floor(tempoCarreiraDias / 365), ok: tempoCarreiraDias >= 15 * 365 },
                { req: 'Cargo (5 anos)', atual: Math.floor(tempoCargoDias / 365), ok: tempoCargoDias >= 5 * 365 }
            ]
        };
    
    // ==========================================
    // REGRA 2: Admissão entre 01/01/1999 e 31/12/2003
    // Ref: Art. 6º EC 41/03 (Transição por Idade e Tempo)
    // ==========================================
    } else if (anoAdm <= 2003) {
        const minIdade = sexo === 'F' ? 55 : 60;
        const minContrib = sexo === 'F' ? 30 : 35;
        
        regra = {
            id: 'art6',
            nome: 'Art. 6º EC 41/03 (Transição)',
            fundamentacao: 'Artigo 6º da EC Nº 41/2003, combinado com o art. 2º da EC Nº 47/2005.',
            detalhes: [
                { req: `Idade (${minIdade})`, atual: idade, ok: idade >= minIdade },
                { req: `Contribuição (${minContrib} anos)`, atual: Math.floor(tempoContribuicaoDias / 365), ok: tempoContribuicaoDias >= minContrib * 365 },
                { req: 'Serviço Público (20 anos)', atual: Math.floor(tempoServPubDias / 365), ok: tempoServPubDias >= 20 * 365 },
                { req: 'Carreira (10 anos)', atual: Math.floor(tempoCarreiraDias / 365), ok: tempoCarreiraDias >= 10 * 365 },
                { req: 'Cargo (5 anos)', atual: Math.floor(tempoCargoDias / 365), ok: tempoCargoDias >= 5 * 365 }
            ]
        };
        
        // Exceção: Se for Magistério, os requisitos de idade e contribuição caem.
        if (tempoMagisterioDias >= (sexo === 'F' ? 25 : 30) * 365) {
            const minIdadeMag = sexo === 'F' ? 50 : 55;
            if (idade >= minIdadeMag) {
                regra.nome = 'Art. 6º EC 41/03 (Especial Magistério)';
                regra.fundamentacao = 'Art. 6º EC 41/2003, art. 2º EC 47/2005 e art. 40, § 5º, CRFB.';
            }
        }
    
    // ==========================================
    // REGRA 3: Admissão após 31/12/2003 (Regra Geral)
    // Ref: Art. 40 CRFB (EC 41/2003 e LC 769/2008)
    // ==========================================
    } else {
        const minIdade = sexo === 'F' ? 55 : 60;
        const minContrib = sexo === 'F' ? 30 : 35;
        
        regra = {
            id: 'geral',
            nome: 'Regra Geral (Tempo de Contribuição e Idade)',
            fundamentacao: 'Art. 40, §1º, III, "a", §§ 3º, 8º e 17 CRFB (EC 41/2003), e arts. 46 e 51 LC 769/2008.',
            detalhes: [
                { req: `Idade (${minIdade})`, atual: idade, ok: idade >= minIdade },
                { req: `Contribuição (${minContrib} anos)`, atual: Math.floor(tempoContribuicaoDias / 365), ok: tempoContribuicaoDias >= minContrib * 365 },
                { req: 'Serviço Público (10 anos)', atual: Math.floor(tempoServPubDias / 365), ok: tempoServPubDias >= 10 * 365 },
                { req: 'Cargo (5 anos)', atual: Math.floor(tempoCargoDias / 365), ok: tempoCargoDias >= 5 * 365 }
            ]
        };
        
        // Exceção: Magistério após 2003
        if (tempoMagisterioDias >= (sexo === 'F' ? 25 : 30) * 365 && idade >= (sexo === 'F' ? 50 : 55)) {
            regra = {
                id: 'magisterio',
                nome: 'Especial de Magistério',
                fundamentacao: 'Art. 40, §1º, III, "a", e §§ 3º, 5º, 8º e 17 CRFB, e arts. 46 e 51 LC 769/2008.',
                detalhes: [
                    { req: `Idade (${sexo === 'F' ? 50 : 55})`, atual: idade, ok: true },
                    { req: `Magistério (${sexo === 'F' ? 25 : 30} anos)`, atual: Math.floor(tempoMagisterioDias / 365), ok: true },
                    { req: 'Serviço Público (10 anos)', atual: Math.floor(tempoServPubDias / 365), ok: tempoServPubDias >= 10 * 365 },
                    { req: 'Cargo (5 anos)', atual: Math.floor(tempoCargoDias / 365), ok: tempoCargoDias >= 5 * 365 }
                ]
            };
        }
    }

    // 9. VERIFICAÇÃO FINAL: O servidor cumpre TODOS os requisitos da regra?
    if (regra) {
        // O .every() percorre a lista de requisitos e retorna true apenas se TODOS os 'ok' forem true.
        regra.elegivel = regra.detalhes.every(d => d.ok);
    }
    // ===== CÁLCULO DA DATA DE ELEGIBILIDADE (PROJEÇÃO) =====
    let dataElegibilidade = '';
    if (regra) {
        const hojeZero = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
        const nascZero = dataNasc ? new Date(dataNasc.getFullYear(), dataNasc.getMonth(), dataNasc.getDate()) : null;
        
        let projecoes = [];
        const addDays = (date, days) => { const r = new Date(date); r.setDate(r.getDate() + days); return r; };
        const addYears = (date, years) => { const r = new Date(date); r.setFullYear(r.getFullYear() + years); return r; };
        const projDias = (atual, alvo) => addDays(hojeZero, alvo - atual);
        const projIdade = (alvo) => nascZero ? addYears(nascZero, alvo) : hojeZero;

        if (regra.id === 'art3') {
            const pontosAtuais = idade + Math.floor(tempoContribuicaoDias / 365);
            const deficitPontos = (sexo === 'F' ? 85 : 95) - pontosAtuais;
            projecoes.push(addYears(hojeZero, Math.ceil(deficitPontos / 2)));
            projecoes.push(projDias(tempoContribuicaoDias, (sexo === 'F' ? 30 : 35) * 365));
            projecoes.push(projDias(tempoServPubDias, 25 * 365));
            projecoes.push(projDias(tempoCarreiraDias, 15 * 365));
            projecoes.push(projDias(tempoCargoDias, 5 * 365));
        } else if (regra.id === 'art6') {
            if (regra.nome.includes('Magistério')) {
                projecoes.push(projIdade(sexo === 'F' ? 50 : 55));
                projecoes.push(projDias(tempoMagisterioDias, (sexo === 'F' ? 25 : 30) * 365));
                projecoes.push(projDias(tempoServPubDias, 20 * 365));
                projecoes.push(projDias(tempoCarreiraDias, 10 * 365));
                projecoes.push(projDias(tempoCargoDias, 5 * 365));
            } else {
                projecoes.push(projIdade(sexo === 'F' ? 55 : 60));
                projecoes.push(projDias(tempoContribuicaoDias, (sexo === 'F' ? 30 : 35) * 365));
                projecoes.push(projDias(tempoServPubDias, 20 * 365));
                projecoes.push(projDias(tempoCarreiraDias, 10 * 365));
                projecoes.push(projDias(tempoCargoDias, 5 * 365));
            }
        } else if (regra.id === 'geral' || regra.id === 'magisterio') {
            if (regra.id === 'magisterio') {
                projecoes.push(projIdade(sexo === 'F' ? 50 : 55));
                projecoes.push(projDias(tempoMagisterioDias, (sexo === 'F' ? 25 : 30) * 365));
                projecoes.push(projDias(tempoServPubDias, 10 * 365));
                projecoes.push(projDias(tempoCargoDias, 5 * 365));
            } else {
                projecoes.push(projIdade(sexo === 'F' ? 55 : 60));
                projecoes.push(projDias(tempoContribuicaoDias, (sexo === 'F' ? 30 : 35) * 365));
                projecoes.push(projDias(tempoServPubDias, 10 * 365));
                projecoes.push(projDias(tempoCargoDias, 5 * 365));
            }
        }

        if (projecoes.length > 0) {
            let maxDate = projecoes[0];
            for (let p of projecoes) {
                if (p > maxDate) maxDate = p;
            }
            dataElegibilidade = `${String(maxDate.getDate()).padStart(2, '0')}/${String(maxDate.getMonth() + 1).padStart(2, '0')}/${maxDate.getFullYear()}`;
        }
    }
    // 10. RETORNO DE TUDO PRONTO PARA A TELA
    return {
        idade, 
        sexo, 
        tempoContribuicaoDias, 
        dataElegibilidade,
        tempoContribuicaoAMD: diasParaAMD(tempoContribuicaoDias),
        tempoServPubDias, 
        tempoServPubAMD: diasParaAMD(tempoServPubDias),
        tempoMagisterioDias, 
        tempoMagisterioAMD: diasParaAMD(tempoMagisterioDias),
        tempoCarreiraDias, 
        tempoCargoDias, 
        regra
    };
}

// Exporta as funções para que o index.js consiga usá-las no navegador
window.Calculadora = { calcularTempos, diasParaAMD };