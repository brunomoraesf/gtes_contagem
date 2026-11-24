/**
 * ============================================================================
 * ARQUIVO: calculadora.js
 * LOCALIZAÇÃO: public/assets/scripts/calculadora.js
 * ============================================================================
 * Cérebro matemático do sistema de aposentadoria do SIGRH/DF.
 * ============================================================================
 */

function parseDate(s) {
    if (!s) return null;
    const str = String(s).trim();
    if (str === '99999999' || str === '99/99/9999') return new Date(); 
    
    let m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(str);
    if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    
    m = /^(\d{2})(\d{2})(\d{4})$/.exec(str);
    if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    
    return null; 
}

function diffDias(d1, d2) {
    if (!d1 || !d2) return 0;
    const a = new Date(d1.getFullYear(), d1.getMonth(), d1.getDate());
    const b = new Date(d2.getFullYear(), d2.getMonth(), d2.getDate());
    return Math.round((b - a) / 86400000) + 1; 
}

function unirIntervalos(intervalos) {
    if (!intervalos.length) return [];
    intervalos.sort((a, b) => a.inicio - b.inicio);
    const res = [intervalos[0]]; 
    for (let i = 1; i < intervalos.length; i++) {
        const atual = intervalos[i];
        const ultimo = res[res.length - 1];
        if (atual.inicio <= ultimo.fim) {
            ultimo.fim = new Date(Math.max(ultimo.fim, atual.fim));
        } else {
            res.push(atual);
        }
    }
    return res;
}

function somarIntervalos(intervalos) {
    let total = 0;
    const unidos = unirIntervalos(intervalos); 
    for (const int of unidos) {
        total += diffDias(int.inicio, int.fim); 
    }
    return total;
}

function intersectarIntervalos(listaA, listaB) {
    if (!listaA.length || !listaB.length) return [];
    const intersecoes = [];
    for (const a of listaA) {
        for (const b of listaB) {
            const ini = new Date(Math.max(a.inicio, b.inicio));
            const fim = new Date(Math.min(a.fim, b.fim));
            if (ini <= fim) {
                intersecoes.push({ inicio: ini, fim });
            }
        }
    }
    return intersecoes;
}

function diasParaAMD(dias) {
    if (dias <= 0) return { anos: 0, meses: 0, dias: 0, texto: '0 anos, 0 meses e 0 dias' };
    const base = new Date(2000, 0, 1); 
    const fim = new Date(base);
    fim.setDate(fim.getDate() + dias);
    
    let anos = fim.getFullYear() - base.getFullYear();
    let meses = fim.getMonth() - base.getMonth();
    let d = fim.getDate() - base.getDate();
    
    if (d < 0) {
        meses--;
        const ultimoDiaMesAnterior = new Date(fim.getFullYear(), fim.getMonth(), 0).getDate();
        d += ultimoDiaMesAnterior;
    }
    if (meses < 0) {
        anos--;
        meses += 12;
    }
    return { anos, meses, dias: d, texto: `${anos} anos, ${meses} meses e ${d} dias` };
}

function calcularIdade(dataNasc, ref) {
    if (!dataNasc || !ref) return 0;
    let idade = ref.getFullYear() - dataNasc.getFullYear();
    const m = ref.getMonth() - dataNasc.getMonth();
    if (m < 0 || (m === 0 && ref.getDate() < dataNasc.getDate())) idade--;
    return idade;
}

function calcularTempos(dadosFicha, checkboxes) {
    const hoje = new Date();
    const dataNasc = parseDate(dadosFicha.cadastro?.data_nascimento);
    const dataAdm = parseDate(dadosFicha.cadastro?.data_admissao);
    const idade = calcularIdade(dataNasc, hoje);
    
    const rawSexo = String(dadosFicha.cadastro?.sexo || '').trim().toUpperCase();
    const sexo = (rawSexo === '2' || rawSexo === 'F' || rawSexo.includes('FEM')) ? 'F' : 'M';

    // 1. TEMPO DE SERVIÇO PÚBLICO
    let tempoServPubDias = 0;
    if (dataAdm) tempoServPubDias = diffDias(dataAdm, hoje);

    // 2. AVERBAÇÕES INCLUSAS
    const intervalosInc = [];
    const intervalosIncMag = [];
    const incs = dadosFicha.inc_averbacoes || [];
    
    incs.forEach((l, i) => {
        const checkAverb = checkboxes[`inc-${i}-averbado`];
        const checkMag = checkboxes[`inc-${i}-magisterio`];
        if (checkAverb || checkMag) {
            const ini = parseDate(l.data_inicio);
            const fim = parseDate(l.data_fim);
            if (ini && fim) {
                intervalosInc.push({ inicio: ini, fim });
                if (checkMag) intervalosIncMag.push({ inicio: ini, fim });
            }
        }
    });

    // 3. LOTAÇÕES DE MAGISTÉRIO
    const intervalosLotMag = [];
    const lots = dadosFicha.lotacoes || [];
    lots.forEach((l, i) => {
        if (checkboxes[`lot-${i}`]) {
            const ini = parseDate(l.inicio_escala);
            const fim = parseDate(l.fim_escala);
            if (ini && fim) intervalosLotMag.push({ inicio: ini, fim });
        }
    });

    // 4. EXCLUSÕES
    const intervalosExc = [];
    (dadosFicha.exc_averbacoes || []).forEach((l, i) => {
        if (checkboxes[`exc-${i}`]) {
            const ini = parseDate(l.data_inicio_exclusao);
            const fim = parseDate(l.data_fim_exclusao);
            if (ini && fim) intervalosExc.push({ inicio: ini, fim });
        }
    });

    // 5. AFASTAMENTOS
    const intervalosAfa = [];
    (dadosFicha.afastamentos || []).forEach((l, i) => {
        if (checkboxes[`afa-${i}`]) {
            const ini = parseDate(l.data_referencia);
            const fim = parseDate(l.data_fim_afastamento);
            if (ini && fim) intervalosAfa.push({ inicio: ini, fim });
        }
    });

    // 5.1 REVERSÃO DE APOSENTADORIA
    const intervalosRev = [];
    (dadosFicha.reversao_aposentadoria || []).forEach((l, i) => {
        if (checkboxes[`rev-${i}`]) {
            const ini = parseDate(l.data_inicio_aposentadoria);
            const fim = parseDate(l.data_termino_aposentadoria);
            if (ini && fim) intervalosRev.push({ inicio: ini, fim });
        }
    });

    // 5.2 CÁLCULO DO TEMPO ESPECIAL (MAGISTÉRIO COM DEDUÇÃO DE EXCLUSÕES)
    const intervalosMagUnificados = unirIntervalos([...intervalosIncMag, ...intervalosLotMag]);
    const totalMagBruto = somarIntervalos(intervalosMagUnificados);
    
    const intersecoesMagExc = intersectarIntervalos(intervalosMagUnificados, intervalosExc);
    const totalMagExc = somarIntervalos(intersecoesMagExc);
    
    let tempoMagisterioDias = totalMagBruto - totalMagExc;
    if (tempoMagisterioDias < 0) tempoMagisterioDias = 0;

    // 6. CÁLCULO DO TEMPO DE CONTRIBUIÇÃO TOTAL
    let temposContrib = [];
    if (dataAdm) temposContrib.push({ inicio: dataAdm, fim: hoje });
    temposContrib = temposContrib.concat(intervalosInc);
    
    const totalPositivo = somarIntervalos(temposContrib);
    
    const intervalosDesconto = unirIntervalos([...intervalosExc, ...intervalosAfa, ...intervalosRev]);
    const totalDesconto = somarIntervalos(intervalosDesconto);
    
    const intersecoes = intersectarIntervalos(intervalosDesconto, intervalosInc);
    const totalIntersecao = somarIntervalos(intersecoes);

    let tempoContribuicaoDias = totalPositivo - totalDesconto + totalIntersecao;
    if (tempoContribuicaoDias < 0) tempoContribuicaoDias = 0;

    // 7. TEMPO DE CARREIRA E CARGO
    const tempoCargoDias = tempoServPubDias; 
    const tempoCarreiraDias = tempoServPubDias;

    // 8. ENQUADRAMENTO NA FUNDAMENTAÇÃO LEGAL
    let regra = null;
    const anoAdm = dataAdm ? dataAdm.getFullYear() : 9999;

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
    
    } else if (anoAdm <= 2003) {
        const minContrib = sexo === 'F' ? 30 : 35;
        const minIdadeBase = sexo === 'F' ? 55 : 60;
        
        const anosContribuicao = Math.floor(tempoContribuicaoDias / 365);
        const anosExcedentes = Math.max(0, anosContribuicao - minContrib);
        const reducaoIdade = Math.min(anosExcedentes, 5);
        const idadeMinimaReduzida = minIdadeBase - reducaoIdade;
        
        regra = {
            id: 'art6',
            nome: 'Art. 6º EC 41/03 (Transição)',
            fundamentacao: 'Artigo 6º da EC Nº 41/2003, combinado com o art. 2º da EC Nº 47/2005.',
            detalhes: [
                { req: `Idade (${minIdadeBase} anos, reduzida p/ ${idadeMinimaReduzida})`, atual: idade, ok: idade >= idadeMinimaReduzida },
                { req: `Contribuição (${minContrib} anos)`, atual: anosContribuicao, ok: tempoContribuicaoDias >= minContrib * 365 },
                { req: 'Serviço Público (20 anos)', atual: Math.floor(tempoServPubDias / 365), ok: tempoServPubDias >= 20 * 365 },
                { req: 'Carreira (10 anos)', atual: Math.floor(tempoCarreiraDias / 365), ok: tempoCarreiraDias >= 10 * 365 },
                { req: 'Cargo (5 anos)', atual: Math.floor(tempoCargoDias / 365), ok: tempoCargoDias >= 5 * 365 }
            ]
        };
        
        if (tempoMagisterioDias >= (sexo === 'F' ? 25 : 30) * 365) {
            const minIdadeMag = sexo === 'F' ? 50 : 55;
            const idadeMinimaMagReduzida = minIdadeMag - reducaoIdade;
            
            if (idade >= idadeMinimaMagReduzida) {
                regra.nome = 'Art. 6º EC 41/03 (Especial Magistério)';
                regra.fundamentacao = 'Art. 6º EC 41/2003, art. 2º EC 47/2005 e art. 40, § 5º, CRFB.';
                regra.detalhes[0].req = `Idade (${minIdadeMag} anos, reduzida p/ ${idadeMinimaMagReduzida})`;
                regra.detalhes[1].req = `Magistério (${sexo === 'F' ? 25 : 30} anos)`;
                regra.detalhes[1].atual = Math.floor(tempoMagisterioDias / 365);
                regra.detalhes[1].ok = true;
            }
        }
    
    } else {
        const minIdade = sexo === 'F' ? 55 : 60;
        const minContrib = sexo === 'F' ? 30 : 35;
        const idadeIdadePura = sexo === 'F' ? 60 : 65;
        
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
        
        const temServPubl = tempoServPubDias >= 10 * 365;
        const temCargo = tempoCargoDias >= 5 * 365;
        if (idade >= idadeIdadePura && temServPubl && temCargo) {
            regra = {
                id: 'geral_idade',
                nome: 'Regra Geral por Idade',
                fundamentacao: 'Art. 40, §1º, III, "b", §§ 3º, 8º e 17 CRFB (EC 41/2003), e arts. 46 e 51 LC 769/2008.',
                detalhes: [
                    { req: `Idade (${idadeIdadePura})`, atual: idade, ok: idade >= idadeIdadePura },
                    { req: 'Serviço Público (10 anos)', atual: Math.floor(tempoServPubDias / 365), ok: temServPubl },
                    { req: 'Cargo (5 anos)', atual: Math.floor(tempoCargoDias / 365), ok: temCargo }
                ]
            };
        }
        
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

    // 9. VERIFICAÇÃO FINAL
    if (regra) {
        regra.elegivel = regra.detalhes.every(d => d.ok);
    }
    
    // ===== CÁLCULO DA DATA DE ELEGIBILIDADE (COM PRECISÃO DIÁRIA SE JÁ ELEGÍVEL) =====
    let dataElegibilidade = '';
    if (regra) {
        const hojeZero = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
        const nascZero = dataNasc ? new Date(dataNasc.getFullYear(), dataNasc.getMonth(), dataNasc.getDate()) : null;
        
        let dataRef = new Date(hojeZero);
        let achou = false;
        
        if (regra.elegivel) {
            // Se já é elegível, voltamos DIA A DIA para achar o marco exato sem erro de arredondamento de mês
            for (let i = 0; i < 18250; i++) {
                if (i > 0) dataRef.setDate(dataRef.getDate() - 1);
                
                const diasPassados = diffDias(hojeZero, dataRef) - 1;
                const tcFuturo = tempoContribuicaoDias + diasPassados;
                const spFuturo = tempoServPubDias + diasPassados;
                const carreiraFutura = tempoCarreiraDias + diasPassados;
                const cargoFuturo = tempoCargoDias + diasPassados;
                const magFuturo = tempoMagisterioDias + (regra.nome.includes('Magistério') ? diasPassados : 0);
                const idadeFutura = calcularIdade(nascZero, dataRef);
                
                let okIdade = true, okContrib = true, okSP = true, okCarreira = true, okCargo = true, okMag = true, okPontos = true;
                
                if (regra.id === 'art3') {
                    const pontosFuturos = idadeFutura + Math.floor(tcFuturo / 365);
                    okPontos = pontosFuturos >= (sexo === 'F' ? 85 : 95);
                    okContrib = tcFuturo >= (sexo === 'F' ? 30 : 35) * 365;
                    okSP = spFuturo >= 25 * 365;
                    okCarreira = carreiraFutura >= 15 * 365;
                    okCargo = cargoFuturo >= 5 * 365;
                } else if (regra.id === 'art6') {
                    const minContrib = sexo === 'F' ? 30 : 35;
                    const minIdadeBase = regra.nome.includes('Magistério') ? (sexo === 'F' ? 50 : 55) : (sexo === 'F' ? 55 : 60);
                    const minMag = sexo === 'F' ? 25 : 30;
                    const anosContrib = Math.floor(tcFuturo / 365);
                    const anosExcedentes = Math.max(0, anosContrib - minContrib);
                    const reducaoIdade = Math.min(anosExcedentes, 5);
                    const idadeMinima = minIdadeBase - reducaoIdade;
                    okIdade = idadeFutura >= idadeMinima;
                    okContrib = tcFuturo >= minContrib * 365;
                    okSP = spFuturo >= 20 * 365;
                    okCarreira = carreiraFutura >= 10 * 365;
                    okCargo = cargoFuturo >= 5 * 365;
                    okMag = regra.nome.includes('Magistério') ? (magFuturo >= minMag * 365) : true;
                } else if (regra.id === 'geral') {
                    okIdade = idadeFutura >= (sexo === 'F' ? 55 : 60);
                    okContrib = tcFuturo >= (sexo === 'F' ? 30 : 35) * 365;
                    okSP = spFuturo >= 10 * 365;
                    okCargo = cargoFuturo >= 5 * 365;
                } else if (regra.id === 'geral_idade') {
                    okIdade = idadeFutura >= (sexo === 'F' ? 60 : 65);
                    okSP = spFuturo >= 10 * 365;
                    okCargo = cargoFuturo >= 5 * 365;
                } else if (regra.id === 'magisterio') {
                    okIdade = idadeFutura >= (sexo === 'F' ? 50 : 55);
                    okMag = magFuturo >= (sexo === 'F' ? 25 : 30) * 365;
                    okSP = spFuturo >= 10 * 365;
                    okCargo = cargoFuturo >= 5 * 365;
                }
                
                const isElegivelNoDia = okIdade && okContrib && okSP && okCarreira && okCargo && okMag && okPontos;
                if (!isElegivelNoDia) {
                    dataRef.setDate(dataRef.getDate() + 1);
                    dataElegibilidade = `${String(dataRef.getDate()).padStart(2, '0')}/${String(dataRef.getMonth() + 1).padStart(2, '0')}/${dataRef.getFullYear()}`;
                    achou = true;
                    break;
                }
            }
        } else {
            // Se não é elegível, mantém exatamente a projeção futura por mês do código original
            for (let i = 0; i < 480; i++) {
                if (i > 0) dataRef.setMonth(dataRef.getMonth() + 1);
                
                const diasPassados = diffDias(hojeZero, dataRef) - 1;
                const tcFuturo = tempoContribuicaoDias + diasPassados;
                const spFuturo = tempoServPubDias + diasPassados;
                const carreiraFutura = tempoCarreiraDias + diasPassados;
                const cargoFuturo = tempoCargoDias + diasPassados;
                const magFuturo = tempoMagisterioDias + (regra.nome.includes('Magistério') ? diasPassados : 0);
                const idadeFutura = calcularIdade(nascZero, dataRef);
                
                let okIdade = true, okContrib = true, okSP = true, okCarreira = true, okCargo = true, okMag = true, okPontos = true;
                
                if (regra.id === 'art3') {
                    const pontosFuturos = idadeFutura + Math.floor(tcFuturo / 365);
                    okPontos = pontosFuturos >= (sexo === 'F' ? 85 : 95);
                    okContrib = tcFuturo >= (sexo === 'F' ? 30 : 35) * 365;
                    okSP = spFuturo >= 25 * 365;
                    okCarreira = carreiraFutura >= 15 * 365;
                    okCargo = cargoFuturo >= 5 * 365;
                } else if (regra.id === 'art6') {
                    const minContrib = sexo === 'F' ? 30 : 35;
                    const minIdadeBase = regra.nome.includes('Magistério') ? (sexo === 'F' ? 50 : 55) : (sexo === 'F' ? 55 : 60);
                    const minMag = sexo === 'F' ? 25 : 30;
                    const anosContrib = Math.floor(tcFuturo / 365);
                    const anosExcedentes = Math.max(0, anosContrib - minContrib);
                    const reducaoIdade = Math.min(anosExcedentes, 5);
                    const idadeMinima = minIdadeBase - reducaoIdade;
                    okIdade = idadeFutura >= idadeMinima;
                    okContrib = tcFuturo >= minContrib * 365;
                    okSP = spFuturo >= 20 * 365;
                    okCarreira = carreiraFutura >= 10 * 365;
                    okCargo = cargoFuturo >= 5 * 365;
                    okMag = regra.nome.includes('Magistério') ? (magFuturo >= minMag * 365) : true;
                } else if (regra.id === 'geral') {
                    okIdade = idadeFutura >= (sexo === 'F' ? 55 : 60);
                    okContrib = tcFuturo >= (sexo === 'F' ? 30 : 35) * 365;
                    okSP = spFuturo >= 10 * 365;
                    okCargo = cargoFuturo >= 5 * 365;
                } else if (regra.id === 'geral_idade') {
                    okIdade = idadeFutura >= (sexo === 'F' ? 60 : 65);
                    okSP = spFuturo >= 10 * 365;
                    okCargo = cargoFuturo >= 5 * 365;
                } else if (regra.id === 'magisterio') {
                    okIdade = idadeFutura >= (sexo === 'F' ? 50 : 55);
                    okMag = magFuturo >= (sexo === 'F' ? 25 : 30) * 365;
                    okSP = spFuturo >= 10 * 365;
                    okCargo = cargoFuturo >= 5 * 365;
                }
                
                const isElegivelNoMes = okIdade && okContrib && okSP && okCarreira && okCargo && okMag && okPontos;
                if (isElegivelNoMes) {
                    dataElegibilidade = `${String(dataRef.getDate()).padStart(2, '0')}/${String(dataRef.getMonth() + 1).padStart(2, '0')}/${dataRef.getFullYear()}`;
                    achou = true;
                    break;
                }
            }
        }
        
        if (!achou) {
            dataElegibilidade = regra.elegivel ? 'Data anterior não encontrada' : 'Não calculada';
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

window.Calculadora = { calcularTempos, diasParaAMD };