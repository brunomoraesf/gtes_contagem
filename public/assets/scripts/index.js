// ===== HELPERS DE DATA =====
function parseDataBR(s) {
    if (!s || typeof s !== 'string') return null;
    const str = s.trim();
    if (str === '99999999' || str === '99/99/9999') return new Date();
    let m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(str);
    if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    m = /^(\d{2})(\d{2})(\d{4})$/.exec(str);
    if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    m = /^(\d{4})(\d{2})(\d{2})$/.exec(str);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return null;
}

function diasInclusivos(dataIni, dataFim) {
    const a = parseDataBR(dataIni);
    const b = parseDataBR(dataFim);
    if (!a || !b) return null;
    const aZero = new Date(a.getFullYear(), a.getMonth(), a.getDate());
    const bZero = new Date(b.getFullYear(), b.getMonth(), b.getDate());
    const ms = bZero - aZero;
    if (ms < 0) return 0;
    return Math.round(ms / 86400000) + 1;
}

function mostrarModal(titulo, mensagem, callback) {
    document.getElementById('modalTitulo').textContent = titulo;
    document.getElementById('modalMensagem').innerHTML = mensagem;
    document.getElementById('modalErro').classList.add('active');
    document.getElementById('modalBtnFechar').onclick = function () {
        document.getElementById('modalErro').classList.remove('active');
        if (callback) callback();
    };
}

document.getElementById('senhaToggle').addEventListener('click', function () {
    const senha = document.getElementById('senha');
    if (senha.type === 'password') {
        senha.type = 'text';
        this.textContent = '🐵';
    } else {
        senha.type = 'password';
        this.textContent = '🙈';
    }
});

let estado = 'idle';
let abortController = null;
let dadosFicha = null;
let calculosGlobais = null;

const statusRobos = {
    robo1: 'pendente', robo2: 'pendente', robo3: 'pendente',
    robo4: 'pendente', robo5: 'pendente', robo6: 'pendente'
};

function fmtCPF(c) {
    const s = String(c || '').replace(/\D/g, '').padStart(11, '0');
    if (s === '00000000000') return '-----';
    return `${s.slice(0, 3)}.${s.slice(3, 6)}.${s.slice(6, 9)}-${s.slice(9)}`;
}

function fmtSexo(s) {
    const v = String(s || '').trim().toUpperCase();
    if (v === '1' || v === 'M' || /^MASC/.test(v)) return 'Masculino';
    if (v === '2' || v === 'F' || /^FEM/.test(v)) return 'Feminino';
    return v || '-----';
}

function fmtMatricula(m) {
    const s = String(m || '').replace(/[^\dX]/gi, '').toUpperCase();
    if (s.length === 8) return `${s.slice(0, 4)}.${s.slice(4, 7)}-${s.slice(7)}`;
    if (s.length === 7) return `${s.slice(0, 4)}.${s.slice(4, 7)}-X`;
    return s || '-----';
}

function fmtCH(d) {
    const n1 = parseInt(d.carga_horaria_principal) || 0;
    const n2 = parseInt(d.carga_horaria_secundaria) || 0;
    return (n1 + n2) > 0 ? `${n1 + n2}H` : '-----';
}

function fmtRef(dtRef) {
    if (!dtRef || String(dtRef).length !== 6) return dtRef || '-----';
    const s = String(dtRef);
    return `${s.slice(4, 6)}/${s.slice(0, 4)}`;
}
function fmtDataBR(valor) {
    if (!valor) return '-----';
    const s = String(valor).trim();
    if (s === '99999999' || s === '99/99/9999') {
        const hoje = new Date();
        return `${String(hoje.getDate()).padStart(2, '0')}/${String(hoje.getMonth() + 1).padStart(2, '0')}/${hoje.getFullYear()}`;
    }
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;
    if (/^\d{8}$/.test(s)) return `${s.slice(0, 2)}/${s.slice(2, 4)}/${s.slice(4, 8)}`;
    return s;
}

function v(x) { return (x === null || x === undefined || x === '') ? '-----' : x; }

// ===== TOTAIS E ELEGIBILIDADE =====
function atualizarLinhaTotal(elId, marcadas, total, textoDias) {
    const el = document.getElementById(elId);
    if (!el) return;
    el.style.display = 'flex';
    el.style.justifyContent = 'space-between';
    el.innerHTML = `<span>Marcadas: <strong>${marcadas}/${total}</strong></span><span>${textoDias}</span>`;
}

function recalcularTotaisInc() {
    if (!dadosFicha?.inc_averbacoes) return;
    const arr = dadosFicha.inc_averbacoes;
    let somaAverb = 0, somaMag = 0, linhasAverb = 0, linhasMag = 0, totalAverb = 0, totalMag = 0;
    document.querySelectorAll('.linha-check-inc').forEach(ch => {
        const tipo = ch.dataset.tipo;
        if (tipo === 'averbado') totalAverb++;
        else totalMag++;
        if (!ch.checked) return;
        const l = arr[Number(ch.dataset.idx)];
        const d = diasInclusivos(l.data_inicio, l.data_fim) || 0;
        if (tipo === 'averbado') { somaAverb += d; linhasAverb++; }
        else { somaMag += d; linhasMag++; }
    });
    atualizarLinhaTotal('total-inc-averbado', linhasAverb, totalAverb, `Total Averbado: <strong>${somaAverb}</strong> dias`);
    atualizarLinhaTotal('total-inc-magisterio', linhasMag, totalMag, `Total Magistério: <strong>${somaMag}</strong> dias`);
}

function recalcularTotais() {
    if (!dadosFicha) return;

    const grupos = [
        { id: 'exc', arr: dadosFicha.exc_averbacoes, calc: l => diasInclusivos(l.data_inicio_exclusao, l.data_fim_exclusao) },
        { id: 'afa', arr: dadosFicha.afastamentos, calc: l => Number(l.dias_afastamento) || diasInclusivos(l.data_referencia, l.data_fim_afastamento) },
        { id: 'rev', arr: dadosFicha.reversao_aposentadoria, calc: l => Number(l.dias_aposentado) || diasInclusivos(l.data_inicio_aposentadoria, l.data_termino_aposentadoria) },
        { id: 'lot', arr: dadosFicha.lotacoes, calc: l => diasInclusivos(l.inicio_escala, l.fim_escala) }
    ];

    const checkboxes = {};
    document.querySelectorAll('.linha-check').forEach(ch => {
        checkboxes[`${ch.dataset.grupo}-${ch.dataset.idx}`] = ch.checked;
    });
    document.querySelectorAll('.linha-check-inc').forEach(ch => {
        checkboxes[`inc-${ch.dataset.idx}-${ch.dataset.tipo}`] = ch.checked;
    });

    grupos.forEach(g => {
        if (!g.arr) return;
        const checks = document.querySelectorAll(`.linha-check[data-grupo="${g.id}"]`);
        let soma = 0, linhas = 0;
        checks.forEach(ch => {
            if (ch.checked) {
                soma += g.calc(g.arr[Number(ch.dataset.idx)]) || 0;
                linhas++;
            }
        });
        atualizarLinhaTotal(`total-${g.id}`, linhas, checks.length, `Total: <strong>${soma}</strong> dias`);
    });

    recalcularTotaisInc();

    if (window.Calculadora) {
        calculosGlobais = window.Calculadora.calcularTempos(dadosFicha, checkboxes);
        atualizarCardElegibilidade(calculosGlobais);
    }
}

function atualizarCardElegibilidade(result) {
    const el = document.getElementById('cardElegibilidade');
    if (!el) return;

    const regra = result.regra;
    if (!regra) {
        el.innerHTML = '<p>Não foi possível determinar a regra.</p>';
        return;
    }

    const elegivel = regra.elegivel;
    const cor = elegivel ? '#16a34a' : '#dc2626';
    const bg = elegivel ? '#f0fdf4' : '#fef2f2';
    const borda = elegivel ? '#bbf7d0' : '#fecaca';

    const htmlRequisitos = regra.detalhes.map(d => `
        <div style="display:flex; justify-content:space-between; border-bottom:1px solid #e2e8f0; padding:4px 0; font-size:0.85rem;">
            <span>${d.req}</span>
            <span style="font-weight:600; color:${d.ok ? '#16a34a' : '#dc2626'}">${d.ok ? '✅' : '❌'} ${d.atual}</span>
        </div>
    `).join('');

    el.innerHTML = `
        <div style="background: ${bg}; border: 1.5px solid ${borda}; border-radius: 12px; padding: 16px; margin-bottom: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <h3 style="margin: 0; color: ${cor}; font-size: 1.1rem;">
                    ${elegivel ? '🎯 Elegível' : '⚠️ Em análise'} — ${regra.nome}
                </h3>
                <button class="btn btn-primary" onclick="abrirVisualizador()" style="padding: 8px 16px; font-size: 0.9rem;">📄 Gerar e Visualizar Documento</button>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                <div>
                    <p style="margin: 4px 0; font-size: 0.95rem;"><strong>Idade:</strong> ${result.idade} anos</p>
                    <p style="margin: 4px 0; font-size: 0.95rem;"><strong>Tempo de Contribuição:</strong> ${result.tempoContribuicaoDias} dias (${result.tempoContribuicaoAMD.texto})</p>
                    ${result.tempoMagisterioDias > 0 ? `
                    <p style="margin: 4px 0; font-size: 0.95rem;"><strong>Tempo Especial (Magistério):</strong> ${result.tempoMagisterioDias} dias (${result.tempoMagisterioAMD.texto})</p>
                    ` : ''}
                    <p style="margin: 4px 0; font-size: 0.95rem; color: #2563eb;"><strong>Previsão de Elegibilidade:</strong> ${result.dataElegibilidade || '---'}</p>
                </div>
                <div style="background: #fff; border-radius: 8px; padding: 10px; border: 1px solid #e2e8f0;">
                    <div style="font-weight: bold; margin-bottom: 6px; font-size: 0.85rem; text-transform: uppercase; color: #64748b;">Requisitos</div>
                    ${htmlRequisitos}
                </div>
            </div>
            <div style="margin-top: 12px; font-size: 0.75rem; color: #64748b; text-align: justify;">
                <strong>Fundamentação:</strong> ${regra.fundamentacao}
            </div>
        </div>
    `;
}

async function gerarDocumento() {
    if (!dadosFicha || !calculosGlobais) return;

    if (dadosFicha.lotacoes) {
        const hoje = new Date();
        const d = String(hoje.getDate()).padStart(2, '0');
        const m = String(hoje.getMonth() + 1).padStart(2, '0');
        const y = hoje.getFullYear();
        const hojeFmt = `${d}${m}${y}`;
        dadosFicha.lotacoes.forEach(l => {
            if (l.fim_escala === '99999999' || l.fim_escala === '99/99/9999') {
                l.fim_escala = hojeFmt;
            }
        });
    }

    try {
        await fetch('/salvar-calculos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ matricula: dadosFicha.matricula, calculos: calculosGlobais })
        });
        window.open(`/visualizador-aposentadoria.html?matricula=${dadosFicha.matricula}`, '_blank');
    } catch (err) {
        mostrarModal('Erro', 'Não foi possível salvar os cálculos no servidor.');
    }
}

function abrirVisualizador() {
    if (estado === 'running') return;
    if (!dadosFicha) {
        mostrarModal('Aviso', 'Carregue os dados primeiro.');
        return;
    }
    gerarDocumento();
}

document.addEventListener('change', (e) => {
    if (e.target.classList.contains('linha-check') || e.target.classList.contains('linha-check-inc')) {
        recalcularTotais();
    }
});

// ===== RENDER DA FICHA =====
function renderizarFicha() {
    const container = document.getElementById('formDados');
    if (!dadosFicha) {
        container.innerHTML = `<h2>📝 Dados</h2>
            <div class="placeholder">Formulário que será preenchido com os dados.</div>`;
        return;
    }

    const d = dadosFicha.cadastro || {};
    const inc = dadosFicha.inc_averbacoes || [];
    const exc = dadosFicha.exc_averbacoes || [];
    const afa = dadosFicha.afastamentos || [];
    const rev = dadosFicha.reversao_aposentadoria || [];
    const lot = dadosFicha.lotacoes || [];

    // Regex sem acentos, com MAGISTERIO e PROF. (apenas uma declaração!)
    const isProfessor = /PROFESSOR|MAGIST|MAGISTERIO|DOCENTE|PROF\./i.test(d.cargo || '') || (Array.isArray(lot) && lot.some(l => /PROFESSOR|MAGIST|MAGISTERIO|DOCENTE|PROF\./i.test(l.cargo || '')));

    const completo = dadosFicha.completo === true;
    const arquivoJson = `servidor-${dadosFicha.matricula}.json`;
    const matDisplay = fmtMatricula(d.matricula || dadosFicha.matricula);
    const refDisplay = fmtRef(d.dt_ref);

    const fmtMat = (val) => {
        if (!val) return '-----';
        const s = String(val).replace(/[^\dX]/gi, '').toUpperCase();
        if (s.length === 8) return `${s.slice(0, 4)}.${s.slice(4, 7)}-${s.slice(7)}`;
        return val;
    };

    const renderTabela = (dados, colunas, opts = {}) => {
        const { vaziaMsg = 'Nenhum registro encontrado.', grupoId = '', camposData = null, duploCheck = false } = opts;
        if (!dados || dados.length === 0) return `<div class="tabela-vazia">${vaziaMsg}</div>`;

        const colunasDeslizantes = colunas.slice(0, -1);
        const colunaTotal = colunas[colunas.length - 1];

        let html = '<div class="tabela-scroll"><table class="tabela-relatorio"><thead><tr>';

        if (duploCheck) {
            html += '<th class="col-fixa-esq-1">☑</th><th class="col-fixa-esq-2" title="Magistério">🎓</th>';
        } else {
            html += '<th class="col-fixa-esq-1">☑</th>';
        }

        colunasDeslizantes.forEach(c => {
            const style = c.width ? `style="width: ${c.width}"` : '';
            html += `<th ${style}>${c.label}</th>`;
        });

        const styleTotal = colunaTotal.width ? `style="width: ${colunaTotal.width}"` : '';
        html += `<th class="col-fixa-dir" ${styleTotal}>${colunaTotal.label}</th>`;
        html += '</tr></thead><tbody>';

        dados.forEach((linha, idx) => {
            const originalIdx = linha.__idxOriginal !== undefined ? linha.__idxOriginal : idx;

            html += '<tr>';

            if (duploCheck) {
                html += `<td class="col-fixa-esq-1"><input type="checkbox" class="linha-check-inc" data-tipo="averbado" data-idx="${originalIdx}" checked disabled></td>`;

                const cod = String(linha.codigo_averbacao || '').trim();
                const codigosMagisterio = ['02', '10', '20', '52', '104'];
                const isMagCode = codigosMagisterio.includes(cod);

                let magChecked = '';
                if (isProfessor && isMagCode) {
                    magChecked = 'checked';
                }
                html += `<td class="col-fixa-esq-2"><input type="checkbox" class="linha-check-inc" data-tipo="magisterio" data-idx="${originalIdx}" ${magChecked} disabled></td>`;
            } else {
                let chkAttr = 'checked';
                if (grupoId === 'lot') {
                    const ua = String(linha.unidade_administrativa || '').trim();
                    const validUAs = ['001', '002', '003', '004', '005', '006', '007', '008', '009', '010', '011', '012', '013', '014', '015'];
                    const isValida = validUAs.includes(ua.padStart(3, '0'));
                    chkAttr = isValida ? 'checked' : '';
                }
                html += `<td class="col-fixa-esq-1"><input type="checkbox" class="linha-check" data-grupo="${grupoId}" data-idx="${originalIdx}" ${chkAttr} disabled></td>`;
            }

            colunasDeslizantes.forEach(c => {
                let val = linha[c.key];
                if (c.key === 'matricula') {
                    val = fmtMat(val);
                } else if (c.key === 'cod_sub_historico') {
                    const cod = String(val || '').trim().padStart(3, '0');
                    const desc = window.DICIONARIO_AFASTAMENTOS ? (window.DICIONARIO_AFASTAMENTOS[cod] || 'AFASTAMENTO') : 'AFASTAMENTO';
                    val = `${cod} - ${desc}`;
                } else if (c.key === '__dias') {
                    if (c.keyDias && linha[c.keyDias]) {
                        val = linha[c.keyDias];
                    } else {
                        val = camposData ? (diasInclusivos(linha[camposData.ini], linha[camposData.fim]) ?? '-----') : '-----';
                    }
                } else if (c.isDate) {
                    val = fmtDataBR(val);
                } else if (val === null || val === undefined || val === '') {
                    val = '-----';
                }

                if (c.tooltipKey || c.copyPrefixKey) {
                    const codigo = String(linha[c.tooltipKey] || linha[c.copyPrefixKey] || '').trim();
                    const texto = String(val);
                    const titleAttr = (codigo && codigo !== texto) ? ` title="${codigo.replace(/"/g, '&quot;')}"` : '';
                    const payload = (codigo && codigo !== texto) ? `${codigo} - ${texto}` : texto;
                    const payloadEsc = payload.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
                    html += `<td class="celula-copiavel"${titleAttr} data-copy="${payloadEsc}" onclick="copiarCelula(this)">${texto}</td>`;
                } else {
                    html += `<td>${val}</td>`;
                }
            });

            let valTotal = linha[colunaTotal.key];
            if (colunaTotal.key === '__dias') {
                if (colunaTotal.keyDias && linha[colunaTotal.keyDias]) {
                    valTotal = linha[colunaTotal.keyDias];
                } else {
                    valTotal = camposData ? (diasInclusivos(linha[camposData.ini], linha[camposData.fim]) ?? '-----') : '-----';
                }
            } else if (colunaTotal.isDate) {
                valTotal = fmtDataBR(valTotal);
            } else if (valTotal === null || valTotal === undefined || valTotal === '') {
                valTotal = '-----';
            }
            html += `<td class="col-fixa-dir">${valTotal}</td>`;
            html += '</tr>';
        });

        html += '</tbody></table></div>';
        return html;
    };

    const incOrdenado = [...inc].map((l, i) => ({ ...l, __idxOriginal: i })).sort((a, b) => {
        const da = a.data_inicio ? new Date(a.data_inicio.split('/').reverse().join('-')) : new Date(0);
        const db = b.data_inicio ? new Date(b.data_inicio.split('/').reverse().join('-')) : new Date(0);
        return da - db;
    });
    const excOrdenado = [...exc].map((l, i) => ({ ...l, __idxOriginal: i })).sort((a, b) => {
        const da = a.data_inicio_exclusao ? new Date(a.data_inicio_exclusao.split('/').reverse().join('-')) : new Date(0);
        const db = b.data_inicio_exclusao ? new Date(b.data_inicio_exclusao.split('/').reverse().join('-')) : new Date(0);
        return da - db;
    });
    const afaOrdenado = [...afa].map((l, i) => ({ ...l, __idxOriginal: i })).sort((a, b) => {
        const da = a.data_referencia ? new Date(a.data_referencia.split('/').reverse().join('-')) : new Date(0);
        const db = b.data_referencia ? new Date(b.data_referencia.split('/').reverse().join('-')) : new Date(0);
        return da - db;
    });
    const revOrdenado = [...rev].map((l, i) => ({ ...l, __idxOriginal: i })).sort((a, b) => {
        const da = a.data_inicio_aposentadoria ? new Date(a.data_inicio_aposentadoria.split('/').reverse().join('-')) : new Date(0);
        const db = b.data_inicio_aposentadoria ? new Date(b.data_inicio_aposentadoria.split('/').reverse().join('-')) : new Date(0);
        return da - db;
    });
    const lotOrdenado = [...lot].map((l, i) => ({ ...l, __idxOriginal: i })).sort((a, b) => {
        const da = a.inicio_escala ? new Date(a.inicio_escala.split('/').reverse().join('-')) : new Date(0);
        const db = b.inicio_escala ? new Date(b.inicio_escala.split('/').reverse().join('-')) : new Date(0);
        return da - db;
    });

    const colunasInc = [
        { key: 'matricula', label: 'Matrícula', width: '100px' },
        { key: 'data_inicio', label: 'Data Início', isDate: true },
        { key: 'data_fim', label: 'Data Fim', isDate: true },
        { key: 'codigo_averbacao', label: 'Cód.' },
        { key: 'denominacao', label: 'Denominação' },
        { key: 'orgao_averbacao', label: 'Órgão' },
        { key: 'cidade_origem', label: 'Cidade' },
        { key: 'uf_origem', label: 'UF' },
        { key: 'numero_processo', label: 'Processo' },
        { key: 'numero_dodf', label: 'DODF' },
        { key: 'data_publicacao_dodf', label: 'Pub. DODF', isDate: true },
        { key: 'pagina_dodf', label: 'Pág. DODF' },
        { key: '__dias', label: 'Total Dias', width: '90px' }
    ];

    const colunasExc = [
        { key: 'matricula', label: 'Matrícula', width: '100px' },
        { key: 'quantidade_dias_excluidos', label: 'Dias Excluídos' },
        { key: 'data_inicio_averbacao', label: 'Início Averbação', isDate: true },
        { key: 'data_inicio_exclusao', label: 'Início Exclusão', isDate: true },
        { key: 'data_fim_exclusao', label: 'Fim Exclusão', isDate: true },
        { key: '__dias', label: 'Total Dias', width: '90px' }
    ];

    const colunasAfa = [
        { key: 'matricula', label: 'Matrícula', width: '100px' },
        { key: 'cod_sub_historico', label: 'Cód. Sub-Histórico' },
        { key: 'data_referencia', label: 'Data Referência', isDate: true },
        { key: 'data_fim_afastamento', label: 'Fim Afastamento', isDate: true },
        { key: 'dias_afastamento', label: 'Dias Afastado' },
        { key: '__dias', label: 'Total Dias', width: '90px', keyDias: 'dias_afastamento' }
    ];

    const colunasRev = [
        { key: 'matricula', label: 'Matrícula', width: '100px' },
        { key: 'data_inicio_aposentadoria', label: 'Início Aposentadoria', isDate: true },
        { key: 'data_termino_aposentadoria', label: 'Término Aposentadoria', isDate: true },
        { key: 'data_revisao_aposentadoria', label: 'Revisão Aposentadoria', isDate: true },
        { key: 'dias_aposentado', label: 'Dias Aposentado' },
        { key: '__dias', label: 'Total Dias', width: '90px', keyDias: 'dias_aposentado' }
    ];

    const colunasLot = [
        { key: 'matricula', label: 'Matrícula', width: '100px' },
        { key: 'cargo', label: 'Cargo', width: '150px' },
        { key: 'unidade_administrativa', label: 'COD U.A.', width: '160px' },
        { key: 'lotacao', label: 'Lotação', width: '320px', tooltipKey: 'lotacao_codigo', copyPrefixKey: 'lotacao_codigo' },
        { key: 'inicio_escala', label: 'Início Escala', isDate: true, width: '90px' },
        { key: 'fim_escala', label: 'Fim Escala', isDate: true, width: '90px' },
        { key: '__dias', label: 'Total Dias', width: '90px' }
    ];

    const soma = (arr, calc) => (arr || []).reduce((a, l) => a + (calc(l) || 0), 0);
    const estiloLinhaTotal = 'display:flex; justify-content:space-between;';

    container.innerHTML = `
        <div id="cardElegibilidade" style="margin-bottom: 20px;"></div>

        <div class="ficha-header">
            <h2>📋 Ficha Cadastral</h2>
            <span class="ficha-mat">Referência: <strong>${refDisplay}</strong></span>
        </div>

        <div class="ficha-secao">
            <h3>Dados Pessoais</h3>
            <div class="ficha-grid" style="grid-template-columns: 5fr 1fr;">
                <div class="ficha-campo"><span class="label">Nome Completo</span><span class="valor">${v(d.nome)}</span></div>
                <div class="ficha-campo"><span class="label">Matrícula</span><span class="valor">${matDisplay}</span></div>
            </div>
            <div class="ficha-grid-4" style="grid-template-columns: 1fr 1fr 1fr 3fr;">
                <div class="ficha-campo"><span class="label">CPF</span><span class="valor">${fmtCPF(d.cpf)}</span></div>
                <div class="ficha-campo"><span class="label">Nascimento</span><span class="valor">${fmtDataBR(d.data_nascimento)}</span></div>
                <div class="ficha-campo"><span class="label">Sexo</span><span class="valor">${fmtSexo(d.sexo)}</span></div>
                <div class="ficha-campo"><span class="label">E-mail</span><span class="valor">${v((d.email || '').toLowerCase())}</span></div>
            </div>
        </div>

        <div class="ficha-secao">
            <h3>Dados Funcionais</h3>
            <div class="ficha-grid-4" style="grid-template-columns: 3fr 1fr 1fr 1fr;">
                <div class="ficha-campo"><span class="label">Cargo</span><span class="valor">${v(d.cargo)}</span></div>
                <div class="ficha-campo"><span class="label">Data de Admissão</span><span class="valor">${fmtDataBR(d.data_admissao)}</span></div>
                <div class="ficha-campo"><span class="label">Carga Horária</span><span class="valor">${fmtCH(d)}</span></div>
                <div class="ficha-campo"><span class="label">Status</span><span class="valor">${v(d.status)}</span></div>
            </div>
        </div>

        <div class="ficha-secao">
            <h3>Inclusão de Averbações</h3>
            ${renderTabela(incOrdenado, colunasInc, { vaziaMsg: 'Nenhum registro encontrado.', grupoId: 'inc', camposData: { ini: 'data_inicio', fim: 'data_fim' }, duploCheck: true })}
            <div class="grupo-total" id="total-inc-averbado" style="${estiloLinhaTotal}"><span>Marcadas: <strong>0/0</strong></span><span>Total Averbado: <strong>0</strong> dias</span></div>
            <div class="grupo-total" id="total-inc-magisterio" style="${estiloLinhaTotal}"><span>Marcadas: <strong>0/0</strong></span><span>Total Magistério: <strong>0</strong> dias</span></div>
        </div>

        <div class="ficha-secao">
            <h3>Exclusão de Averbações</h3>
            ${renderTabela(excOrdenado, colunasExc, { vaziaMsg: 'Nenhum registro encontrado.', grupoId: 'exc', camposData: { ini: 'data_inicio_exclusao', fim: 'data_fim_exclusao' } })}
            <div class="grupo-total" id="total-exc" style="${estiloLinhaTotal}"><span>Marcadas: <strong>0/0</strong></span><span>Total: <strong>${soma(exc, l => diasInclusivos(l.data_inicio_exclusao, l.data_fim_exclusao))}</strong> dias</span></div>
        </div>

        <div class="ficha-secao">
            <h3>Afastamentos</h3>
            ${renderTabela(afaOrdenado, colunasAfa, { vaziaMsg: 'Nenhum registro encontrado.', grupoId: 'afa', camposData: { ini: 'data_referencia', fim: 'data_fim_afastamento' } })}
            <div class="grupo-total" id="total-afa" style="${estiloLinhaTotal}"><span>Marcadas: <strong>0/0</strong></span><span>Total: <strong>${soma(afa, l => Number(l.dias_afastamento) || diasInclusivos(l.data_referencia, l.data_fim_afastamento))}</strong> dias</span></div>
        </div>

        <div class="ficha-secao">
            <h3>Reversão de Aposentadoria</h3>
            ${renderTabela(revOrdenado, colunasRev, { vaziaMsg: 'Nenhum registro encontrado.', grupoId: 'rev', camposData: { ini: 'data_inicio_aposentadoria', fim: 'data_termino_aposentadoria' } })}
            <div class="grupo-total" id="total-rev" style="${estiloLinhaTotal}"><span>Marcadas: <strong>0/0</strong></span><span>Total: <strong>${soma(rev, l => Number(l.dias_aposentado) || diasInclusivos(l.data_inicio_aposentadoria, l.data_termino_aposentadoria))}</strong> dias</span></div>
        </div>

        ${isProfessor ? `
        <div class="ficha-secao">
            <h3>Lotações</h3>
            ${renderTabela(lotOrdenado, colunasLot, { vaziaMsg: 'Nenhum registro encontrado.', grupoId: 'lot', camposData: { ini: 'inicio_escala', fim: 'fim_escala' } })}
            <div class="grupo-total" id="total-lot" style="${estiloLinhaTotal}"><span>Marcadas: <strong>0/0</strong></span><span>Total: <strong>${soma(lot, l => diasInclusivos(l.inicio_escala, l.fim_escala))}</strong> dias</span></div>
        </div>
        ` : ''}

        <div class="ficha-acoes">
            ${completo ? `<a href="/relatorios/servidor/${arquivoJson}" target="_blank" class="btn-acao">🗂️ Ver JSON</a>` : `<button class="btn-acao" disabled title="Disponível quando todos os robôs concluírem">🔒 JSON bloqueado</button>`}
            <button type="button" class="btn-acao primary" onclick="abrirVisualizador()">📋 Abrir Documento</button>
        </div>
    `;

    setTimeout(() => recalcularTotais(), 0);
}

function verJSON() {
    if (estado === 'running') return;
    if (!dadosFicha || !dadosFicha.matricula) {
        mostrarModal('Aviso', 'Nenhum JSON carregado. Execute os robôs ou carregue uma matrícula.');
        return;
    }
    if (!dadosFicha.completo) {
        mostrarModal('Aviso', 'O JSON ainda não está completo. Execute todos os robôs para liberar.');
        return;
    }
    const mat = String(dadosFicha.matricula).replace(/[^\dX]/gi, '').toUpperCase();
    window.open(`/relatorios/servidor/servidor-${mat}.json`, '_blank');
}

document.getElementById('btnVerJSON').addEventListener('click', verJSON);

const ROBOS_META = {
    robo1: { nome: 'Cadastro', pasta: 'cadastro', prefixo: 'cadastro' },
    robo2: { nome: 'Inc. Averbações', pasta: 'inclui_averbacoes', prefixo: 'inc-averbacoes' },
    robo3: { nome: 'Exc. Averbações', pasta: 'exclui_averbacoes', prefixo: 'exc-averbacoes' },
    robo4: { nome: 'Afastamentos', pasta: 'afastamentos', prefixo: 'afastamentos' },
    robo5: { nome: 'Rev. Aposentadoria', pasta: 'reversao_aposentadoria', prefixo: 'rev-aposentadoria' },
    robo6: { nome: 'Lotações', pasta: 'lotacoes', prefixo: 'lotacoes' }
};

function aplicarRegrasBotoesIndividuais() {
    const algumRodando = Object.values(statusRobos).some(s => s === 'executando');

    Object.keys(ROBOS_META).forEach(robo => {
        const btn = document.querySelector(`.robo-btn-exec[data-robo="${robo}"]`);
        if (!btn) return;

        const st = statusRobos[robo];

        if (algumRodando) {
            btn.disabled = true;
            btn.textContent = st === 'executando' ? '⏳ Executando...' : '▶ Executar';
        } else if (st === 'erro') {
            btn.disabled = false;
            btn.textContent = '▶ Tentar de novo';
        } else if (st === 'ok') {
            btn.disabled = true;
            btn.textContent = '✅ Concluído';
        } else if (st === 'vazio') {
            btn.disabled = true;
            btn.textContent = 'ℹ️ Sem registros';
        } else {
            btn.disabled = true;
            btn.textContent = '▶ Executar';
        }
    });
}

document.querySelectorAll('.robo-btn-exec').forEach(btn => {
    btn.addEventListener('click', async function () {
        const robo = this.dataset.robo;
        const st = statusRobos[robo];
        if (st !== 'pendente' && st !== 'erro') return;
        await executarRoboIndividual(robo);
    });
});

function atualizarCardRobo(robo, { progresso, mensagem, classe }) {
    const bar = document.getElementById(`${robo}Bar`);
    const statusEl = document.getElementById(`${robo}Status`);
    const card = document.querySelector(`.robo-card[data-robo="${robo}"]`);
    if (!bar || !statusEl || !card) return;

    if (progresso !== undefined) bar.style.width = Math.min(100, Math.max(0, progresso)) + '%';
    if (mensagem !== undefined) statusEl.textContent = mensagem;

    statusEl.classList.remove('sucesso', 'erro', 'vazio');
    card.classList.remove('executando', 'sucesso', 'erro', 'vazio');

    if (classe) {
        card.classList.add(classe);
        if (classe === 'sucesso' || classe === 'erro' || classe === 'vazio') {
            statusEl.classList.add(classe);
        }
    }
}

function atualizarLinkArquivo(robo, nomeArquivo) {
    const el = document.getElementById(`${robo}Arquivo`);
    if (!el) return;
    if (!nomeArquivo) { el.innerHTML = ''; return; }

    const pasta = ROBOS_META[robo].pasta;
    const url = `/relatorios/${pasta}/${nomeArquivo}`;

    el.innerHTML = `📄 <a href="#" onclick="abrirModalRelatorio(event, '${url}', '${ROBOS_META[robo].nome}')">Relatório</a>`;
}

function resetarRobos() {
    Object.keys(ROBOS_META).forEach(robo => {
        statusRobos[robo] = 'pendente';
        atualizarCardRobo(robo, { progresso: 0, mensagem: 'Aguardando...', classe: null });
        atualizarLinkArquivo(robo, null);
    });
    aplicarRegrasBotoesIndividuais();
}

async function executarRoboIndividual(robo) {
    if (estado === 'running') return;
    const orgao = document.getElementById('orgao').value;
    const matricula = document.getElementById('matricula').value.trim();
    const senha = document.getElementById('senha').value;
    const pesquisa = document.getElementById('pesquisa').value.trim();

    if (!matricula || !senha || !pesquisa) {
        mostrarModal('Aviso', 'Preencha todos os campos de acesso e matrícula alvo.');
        return;
    }

    estado = 'running';
    statusRobos[robo] = 'executando';
    atualizarCardRobo(robo, { progresso: 0, mensagem: '▶ Iniciando...', classe: 'executando' });
    aplicarRegrasBotoesIndividuais();

    ['matricula', 'senha', 'pesquisa'].forEach(id => document.getElementById(id).disabled = true);
    document.getElementById('btnExecutar').disabled = true;
    document.getElementById('btnCarregar').disabled = true;
    document.getElementById('btnLimpar').disabled = true;
    document.getElementById('btnVisualizador').disabled = true;
    document.getElementById('btnCancelar').disabled = false;

    try {
        const resp = await fetch('/executar-robo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ robo, orgao, matricula, senha, pesquisa })
        });

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            const lines = buf.split('\n');
            buf = lines.pop() || '';
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const data = JSON.parse(line.slice(6));
                        processarEventoIndividual(robo, data);
                    } catch (_) { }
                }
            }
        }
    } catch (err) {
        statusRobos[robo] = 'erro';
        atualizarCardRobo(robo, { mensagem: `❌ ${err.message}`, classe: 'erro' });
    } finally {
        estado = 'idle';
        ['matricula', 'senha', 'pesquisa'].forEach(id => document.getElementById(id).disabled = false);
        document.getElementById('btnExecutar').disabled = false;
        document.getElementById('btnCarregar').disabled = false;
        document.getElementById('btnLimpar').disabled = false;
        document.getElementById('btnVisualizador').disabled = false;
        document.getElementById('btnCancelar').disabled = true;
        aplicarRegrasBotoesIndividuais();
    }
}

function processarEventoIndividual(robo, data) {
    if (data.tipo === 'progresso' && data.robo === robo) {
        const st = data.status === 'erro' ? 'erro' : 'executando';
        statusRobos[robo] = st;
        atualizarCardRobo(robo, {
            progresso: data.progresso,
            mensagem: data.mensagem,
            classe: st
        });
        if (data.dados?.arquivo) {
            atualizarLinkArquivo(robo, data.dados.arquivo);
        }
        if (data.dados?.json) {
            dadosFicha = data.dados.json;
            renderizarFicha();
        }
    } else if (data.tipo === 'final') {
        if (data.resultados?.jsonUnificado) {
            dadosFicha = data.resultados.jsonUnificado;
            renderizarFicha();
        }
        if (data.sucesso) {
            if (statusRobos[robo] !== 'ok' && statusRobos[robo] !== 'vazio') {
                statusRobos[robo] = 'ok';
            }
        } else {
            statusRobos[robo] = 'erro';
        }
        aplicarRegrasBotoesIndividuais();
    }
}

window.onload = function () {
    const m = localStorage.getItem('unificado_matricula') || '';
    const s = localStorage.getItem('unificado_senha') || '';
    if (m) document.getElementById('matricula').value = m;
    if (s) document.getElementById('senha').value = s;
    document.querySelector('.ano-atual').textContent = new Date().getFullYear();

    isLimpo = true;
    setEstado('idle');
    renderizarFicha();
};

let isLimpo = true;

function setEstado(novo) {
    estado = novo;
    const ids = ['matricula', 'senha', 'pesquisa'];
    const btnExecutar = document.getElementById('btnExecutar');
    const btnCancelar = document.getElementById('btnCancelar');
    const btnCarregar = document.getElementById('btnCarregar');
    const btnLimpar = document.getElementById('btnLimpar');
    const btnVerJSON = document.getElementById('btnVerJSON');

    if (novo === 'idle') {
        ids.forEach(id => document.getElementById(id).disabled = false);
        btnExecutar.disabled = !isLimpo;
        btnCarregar.disabled = !isLimpo;
        btnCancelar.disabled = true;
        btnLimpar.disabled = !isLimpo ? false : true;
        btnVerJSON.disabled = false;
        btnExecutar.textContent = '▶ Executar Todos';
    } else if (novo === 'running') {
        ids.forEach(id => document.getElementById(id).disabled = true);
        btnExecutar.disabled = true;
        btnCancelar.disabled = false;
        btnCarregar.disabled = true;
        btnLimpar.disabled = true;
        btnVerJSON.disabled = true;
        btnExecutar.textContent = '⏳ Executando...';
    } else if (novo === 'loaded') {
        ids.forEach(id => document.getElementById(id).disabled = true);
        btnExecutar.disabled = true;
        btnCancelar.disabled = true;
        btnCarregar.disabled = true;
        btnLimpar.disabled = false;
        btnVerJSON.disabled = false;
        btnExecutar.textContent = '✅ Concluído';
    }
}

let ultimoLog = '';
function adicionarLog(msg, cor = 'cinza') {
    if (msg === ultimoLog) return;
    ultimoLog = msg;

    const area = document.getElementById('logArea');
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    const t = new Date().toLocaleTimeString();
    entry.innerHTML = `<span class="time">[${t}]</span><span class="msg ${cor}">${msg}</span>`;
    area.appendChild(entry);
    area.scrollTop = area.scrollHeight;
}

function atualizarProgressoGeral(pct) {
    const p = Math.max(0, Math.min(100, Math.round(pct)));
    document.getElementById('progressGeralBar').style.width = p + '%';
    document.getElementById('progressGeralLabel').textContent = p + '%';
}

document.getElementById('btnLimpar').addEventListener('click', function () {
    if (estado === 'running') return;
    document.getElementById('pesquisa').value = '';
    dadosFicha = null;
    ultimoLog = '';
    renderizarFicha();
    resetarRobos();
    atualizarProgressoGeral(0);
    document.getElementById('logArea').innerHTML = '';
    adicionarLog('🧹 Interface limpa.', 'cinza');

    isLimpo = true;
    setEstado('idle');
    if (abortController) { abortController.abort(); abortController = null; }
});

document.getElementById('btnCancelar').addEventListener('click', function () {
    if (abortController) { abortController.abort(); abortController = null; }
    fetch('/cancelar', { method: 'POST' })
        .then(r => r.json())
        .then(() => adicionarLog('⛔ Cancelamento enviado ao servidor.', 'amarelo'))
        .catch(() => { });
    adicionarLog('⛔ Cancelamento solicitado. Aguarde...', 'amarelo');
    setEstado('idle');
});

document.getElementById('btnCarregar').addEventListener('click', async function () {
    if (estado === 'running') return;
    if (!isLimpo) return;
    const matricula = document.getElementById('pesquisa').value.trim();
    if (!matricula) { mostrarModal('Aviso', 'Informe a matrícula alvo.'); return; }

    isLimpo = false;
    dadosFicha = null;
    ultimoLog = '';
    renderizarFicha();
    resetarRobos();
    atualizarProgressoGeral(0);
    document.getElementById('logArea').innerHTML = '';
    adicionarLog('📂 Carregando arquivo salvo...', 'amarelo');

    setEstado('running');

    try {
        const resp = await fetch('/carregar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ matricula })
        });
        const data = await resp.json();

        if (data.inexistente) {
            mostrarModal('Matrícula inexistente', data.mensagem);
            adicionarLog(`⚠ ${data.mensagem}`, 'amarelo');
            adicionarLog('💡 Para executar a pesquisa desta matrícula, clique em "Limpar" e depois em "Executar Todos".', 'amarelo');

            isLimpo = false;
            setEstado('idle');
            document.getElementById('btnLimpar').disabled = false;
            return;
        }

        if (data.divergente) {
            mostrarModal('Divergências Detectadas', 'O arquivo salvo possui campos faltando ou diferentes do esperado. É provável que o layout tenha sido atualizado. Não é possível carregar este arquivo. Por favor, execute os robôs novamente para gerar um novo JSON.');
            adicionarLog('⚠ Carregamento bloqueado: divergências no arquivo JSON. Execute os robôs novamente.', 'amarelo');
            isLimpo = false;
            setEstado('idle');
            return;
        }

        dadosFicha = data.json;
        renderizarFicha();

        let algumInexistente = false;
        let algumOk = false;

        Object.entries(data.status || {}).forEach(([robo, info]) => {
            if (info.estado === 'ok') {
                statusRobos[robo] = 'ok';
                algumOk = true;
                const stRoboJson = data.json.status_robos?.[robo];
                const msg = stRoboJson === 'vazio' ? 'ℹ️ Sem registros' : '✅ Sucesso';
                const classe = stRoboJson === 'vazio' ? 'vazio' : 'sucesso';
                atualizarCardRobo(robo, { progresso: 100, mensagem: msg, classe: classe });
                const nomeArquivo = `${ROBOS_META[robo].prefixo}-${data.json.matricula}.txt`;
                atualizarLinkArquivo(robo, nomeArquivo);
            } else {
                statusRobos[robo] = 'pendente';
                algumInexistente = true;
                atualizarCardRobo(robo, { progresso: 0, mensagem: 'ℹ️ Relatório inexistente', classe: 'vazio' });
                atualizarLinkArquivo(robo, null);
            }
        });

        if (data.temCampoFaltando) {
            adicionarLog('⚠ Há campos inexistentes no JSON. Execute os robôs para completar.', 'amarelo');
        }

        const tudoOk = !algumInexistente && !data.temCampoFaltando;
        if (tudoOk) {
            atualizarProgressoGeral(100);
            adicionarLog('✅ JSON completo carregado.', 'verde');
            setEstado('loaded');
        } else {
            atualizarProgressoGeral(algumOk ? 50 : 0);
            adicionarLog('⚠ Carregamento parcial: execute os robôs pendentes.', 'amarelo');
            setEstado('idle');
            document.getElementById('btnExecutar').disabled = false;
        }
        aplicarRegrasBotoesIndividuais();
    } catch (err) {
        adicionarLog(`❌ Erro ao carregar: ${err.message}`, 'vermelho');
        setEstado('idle');
    }
});

document.getElementById('btnExecutar').addEventListener('click', async function () {
    if (estado === 'running') return;
    if (!isLimpo) return;
    const orgao = document.getElementById('orgao').value;
    const matricula = document.getElementById('matricula').value.trim();
    const senha = document.getElementById('senha').value;
    const pesquisa = document.getElementById('pesquisa').value.trim();

    if (!matricula || !senha || !pesquisa) {
        mostrarModal('Aviso', 'Preencha todos os campos de acesso e matrícula alvo.');
        return;
    }

    isLimpo = false;
    localStorage.setItem('unificado_matricula', matricula);
    localStorage.setItem('unificado_senha', senha);

    dadosFicha = null;
    ultimoLog = '';
    renderizarFicha();
    atualizarProgressoGeral(0);
    resetarRobos();
    document.getElementById('logArea').innerHTML = '';
    adicionarLog('🚀 Iniciando execução de TODOS os robôs...', 'amarelo');

    setEstado('running');
    Object.keys(ROBOS_META).forEach(r => statusRobos[r] = 'executando');
    aplicarRegrasBotoesIndividuais();
    abortController = new AbortController();

    try {
        const resp = await fetch('/executar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                orgao, matricula, senha, pesquisa,
                robos: Object.keys(ROBOS_META)
            }),
            signal: abortController.signal
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            const lines = buf.split('\n');
            buf = lines.pop() || '';
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try { processarEvento(JSON.parse(line.slice(6))); } catch (_) { }
                }
            }
        }
        setEstado('loaded');
        adicionarLog('🏁 Execução finalizada.', 'verde');
    } catch (err) {
        if (err.name === 'AbortError') {
            adicionarLog('⛔ Execução cancelada.', 'amarelo');
        } else {
            adicionarLog(`❌ Erro: ${err.message}`, 'vermelho');
        }
        setEstado('idle');
    } finally {
        abortController = null;
        Object.keys(ROBOS_META).forEach(r => {
            if (statusRobos[r] === 'executando') {
                statusRobos[r] = 'erro';
                atualizarCardRobo(r, {
                    progresso: 100,
                    mensagem: '❌ Conexão encerrada antes da confirmação.',
                    classe: 'erro'
                });
            }
        });
        aplicarRegrasBotoesIndividuais();
        if (estado !== 'loaded') setEstado('idle');
    }
});

function processarEvento(data) {
    if (data.tipo === 'progresso') {
        const { robo, status, mensagem, dados, progresso } = data;
        if (!ROBOS_META[robo]) return;

        let mensagemTratada = mensagem;
        if (mensagem === 'ℹ️ Sem dados (confirmado)' || mensagem === 'ℹ️ Sem dados') {
            mensagemTratada = 'ℹ️ Sem registros';
        }

        let cor = 'cinza';
        if (status === 'concluido') {
            if (dados?.estado === 'vazio') cor = 'azul';
            else if (mensagemTratada && mensagemTratada.startsWith('⏭')) cor = 'laranja';
            else cor = 'verde';
        } else if (status === 'erro') {
            cor = 'vermelho';
        }
        if (mensagemTratada) adicionarLog(`[${ROBOS_META[robo].nome}] ${mensagemTratada}`, cor);

        let stCard = 'executando';
        let classe = 'executando';
        if (status === 'concluido') {
            stCard = (dados?.estado === 'vazio') ? 'vazio' : 'ok';
            classe = (dados?.estado === 'vazio') ? 'vazio' : 'sucesso';
        } else if (status === 'erro') {
            stCard = 'erro';
            classe = 'erro';
        }

        statusRobos[robo] = stCard;
        atualizarCardRobo(robo, {
            progresso: progresso !== undefined ? progresso : (status === 'concluido' || status === 'erro' ? 100 : undefined),
            mensagem: mensagemTratada,
            classe
        });

        if (status === 'concluido' && dados) {
            if (dados.arquivo) atualizarLinkArquivo(robo, dados.arquivo);
            if (dados.json) {
                dadosFicha = dados.json;
                renderizarFicha();
            }
        }

        let soma = 0;
        Object.keys(ROBOS_META).forEach(r => {
            const bar = document.getElementById(`${r}Bar`);
            soma += bar ? parseFloat(bar.style.width) || 0 : 0;
        });
        atualizarProgressoGeral(Math.round(soma / Object.keys(ROBOS_META).length));
        aplicarRegrasBotoesIndividuais();

    } else if (data.tipo === 'final') {
        adicionarLog('✅ Processamento concluído!', 'verde');
        atualizarProgressoGeral(100);

        Object.keys(ROBOS_META).forEach(r => {
            if (statusRobos[r] === 'executando') {
                statusRobos[r] = 'erro';
                atualizarCardRobo(r, {
                    progresso: 100,
                    mensagem: '❌ Sem confirmação final do servidor.',
                    classe: 'erro'
                });
            }
        });

        if (data.resultados && data.resultados.jsonUnificado) {
            dadosFicha = data.resultados.jsonUnificado;
            renderizarFicha();
        }
        setEstado('loaded');
        aplicarRegrasBotoesIndividuais();
    } else if (data.tipo === 'erro') {
        adicionarLog(`❌ Erro geral: ${data.mensagem}`, 'vermelho');
        atualizarProgressoGeral(100);

        Object.keys(ROBOS_META).forEach(r => {
            if (statusRobos[r] === 'executando') {
                statusRobos[r] = 'erro';
                atualizarCardRobo(r, {
                    progresso: 100,
                    mensagem: `❌ ${data.mensagem}`,
                    classe: 'erro'
                });
            }
        });

        setEstado('idle');
        aplicarRegrasBotoesIndividuais();
    }
}

function abrirModalInfo() { document.getElementById('modalInfoOverlay').style.display = 'flex'; }
function fecharModalInfo() { document.getElementById('modalInfoOverlay').style.display = 'none'; }

async function abrirModalRelatorio(event, url, titulo) {
    event.preventDefault();
    const modal = document.getElementById('modalRelatorio');
    const tituloEl = document.getElementById('modalRelatorioTitulo');
    const conteudoEl = document.getElementById('modalRelatorioConteudo');

    tituloEl.textContent = `Relatório: ${titulo}`;
    conteudoEl.innerHTML = '<p style="text-align:center; padding: 20px;">⏳ Carregando dados...</p>';
    modal.style.display = 'flex';

    try {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error('Falha ao carregar o arquivo.');
        const texto = await resp.text();

        if (!texto || texto.trim() === '') {
            conteudoEl.innerHTML = '<p style="text-align:center; padding: 20px;">Arquivo vazio.</p>';
            return;
        }

        const linhas = texto.split(/\r?\n/).filter(l => l.trim() !== '');
        if (linhas.length === 0) {
            conteudoEl.innerHTML = '<p style="text-align:center; padding: 20px;">Arquivo sem dados.</p>';
            return;
        }

        const headers = linhas[0].split('|').map(h => h.trim());
        let html = '<table class="tabela-relatorio"><thead><tr>';
        headers.forEach(h => { html += `<th>${h || '-'}</th>`; });
        html += '</tr></thead><tbody>';

        for (let i = 1; i < linhas.length; i++) {
            const cols = linhas[i].split('|').map(c => c.trim());
            html += '<tr>';
            for (let j = 0; j < headers.length; j++) {
                html += `<td>${cols[j] !== undefined ? cols[j] : ''}</td>`;
            }
            html += '</tr>';
        }
        html += '</tbody></table>';

        conteudoEl.innerHTML = html;
    } catch (err) {
        conteudoEl.innerHTML = `<p style="text-align:center; color:#dc2626; padding: 20px;">❌ Erro ao carregar: ${err.message}</p>`;
    }
}

function fecharModalRelatorio() {
    document.getElementById('modalRelatorio').style.display = 'none';
}