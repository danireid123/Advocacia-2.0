/**
 * Advocacia Studio Pro v2.0 - Gerador de Kit Inicial do Cliente (1 Clique)
 * Arquivo: src/onboarding/geradorKitInicial.js
 *
 * Módulo 100% determinístico em Node.js puro (sem chamadas à API Gemini).
 * Gera os documentos iniciais padrão (.docx) a partir da qualificação formal
 * do Art. 319 do CPC quando um dossiê atinge o status CONSOLIDADO.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { Document, Packer, Paragraph, TextRun, AlignmentType } = require('docx');
const { gerarQualificacaoCPC, formatarCPF } = require('./formatadorCPC');
const { gerarBrCodePix } = require('../financeiro/gestaoFinanceira');

const MESES_PT = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
];

/**
 * Sanitiza o identificador da pasta do cliente (CPF preferencial) contra Path Traversal.
 * @param {string|number} cpf
 * @param {string|number} [fallbackId]
 * @returns {string}
 */
function sanitizarPastaCpf(cpf, fallbackId = 'cliente') {
    const digitosCpf = String(cpf || '').replace(/\D/g, '');
    if (digitosCpf.length >= 11) {
        return digitosCpf;
    }
    const bruto = String(fallbackId || 'cliente')
        .replace(/\0/g, '')
        .replace(/\.{2,}/g, '')
        .replace(/[^a-zA-Z0-9_-]/g, '');
    return bruto || 'cliente';
}

/**
 * Formata valor numérico para moeda BRL legível.
 * @param {number|string} valor
 * @returns {string}
 */
function formatarBRL(valor) {
    const num = typeof valor === 'number'
        ? valor
        : parseFloat(String(valor || '0').replace(',', '.'));
    if (!Number.isFinite(num)) return '0,00';
    return num.toFixed(2).replace('.', ',');
}

/**
 * Formata a data por extenso em português jurídico.
 * @param {Date} [data]
 * @returns {string}
 */
function formatarDataPorExtenso(data = new Date()) {
    const d = data instanceof Date && !isNaN(data.getTime()) ? data : new Date();
    const dia = String(d.getDate()).padStart(2, '0');
    const mes = MESES_PT[d.getMonth()] || 'janeiro';
    const ano = d.getFullYear();
    return `${dia} de ${mes} de ${ano}`;
}

/**
 * Constrói e empacota um arquivo .docx com tipografia jurídica sóbria (Times New Roman 12pt).
 * @param {Object} opts
 * @returns {Promise<Buffer>}
 */
async function construirDocumentoDocx({ titulo, subtitulo = '', paragrafos = [], localData = '', assinaturas = [] }) {
    const children = [];

    children.push(
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 120, after: subtitulo ? 80 : 280 },
            children: [
                new TextRun({
                    text: titulo,
                    bold: true,
                    size: 28,
                    font: 'Times New Roman'
                })
            ]
        })
    );

    if (subtitulo) {
        children.push(
            new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 280 },
                children: [
                    new TextRun({
                        text: subtitulo,
                        italics: true,
                        size: 22,
                        font: 'Times New Roman'
                    })
                ]
            })
        );
    }

    for (const item of paragrafos) {
        if (!item) continue;
        const isObj = typeof item === 'object' && !Array.isArray(item);
        const prefixoNegrito = isObj && item.rotulo ? String(item.rotulo) : '';
        const texto = isObj ? String(item.texto || '') : String(item);
        const heading = Boolean(isObj && item.destaque);

        const runs = [];
        if (prefixoNegrito) {
            runs.push(
                new TextRun({
                    text: prefixoNegrito,
                    bold: true,
                    size: 24,
                    font: 'Times New Roman'
                })
            );
        }
        if (texto) {
            runs.push(
                new TextRun({
                    text: texto,
                    bold: heading,
                    size: 24,
                    font: 'Times New Roman'
                })
            );
        }

        children.push(
            new Paragraph({
                alignment: heading ? AlignmentType.LEFT : AlignmentType.JUSTIFIED,
                spacing: { before: heading ? 180 : 60, after: 140, line: 276 },
                children: runs
            })
        );
    }

    if (localData) {
        children.push(
            new Paragraph({
                alignment: AlignmentType.RIGHT,
                spacing: { before: 280, after: 360 },
                children: [
                    new TextRun({
                        text: localData,
                        size: 24,
                        font: 'Times New Roman'
                    })
                ]
            })
        );
    }

    for (const ass of assinaturas) {
        children.push(
            new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 320, after: 40 },
                children: [
                    new TextRun({
                        text: '__________________________________________________',
                        size: 24,
                        font: 'Times New Roman'
                    })
                ]
            })
        );
        children.push(
            new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 40 },
                children: [
                    new TextRun({
                        text: String(ass.nome || '').toUpperCase(),
                        bold: true,
                        size: 22,
                        font: 'Times New Roman'
                    })
                ]
            })
        );
        if (ass.legenda) {
            children.push(
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 0, after: 160 },
                    children: [
                        new TextRun({
                            text: String(ass.legenda),
                            size: 20,
                            font: 'Times New Roman'
                        })
                    ]
                })
            );
        }
    }

    const doc = new Document({
        sections: [
            {
                properties: {},
                children
            }
        ]
    });

    return Packer.toBuffer(doc);
}

/**
 * Monta os textos dos 3 documentos do Kit Inicial e grava os arquivos `.docx` na
 * pasta `documentos_clientes/<cpf>/kit_inicial/`.
 *
 * @param {Object} params
 * @returns {Promise<Object>}
 */
async function gerarKitInicial({
    dossie = {},
    qualificacao = null,
    escritorio = {},
    contrato = {},
    incluirHipossuficiencia = true,
    diretorioBase = null
} = {}) {
    const civilBase = (dossie && typeof dossie.civil === 'object' && dossie.civil) ? dossie.civil : {};
    const dadosCivis = {
        ...civilBase,
        nomeCompleto: qualificacao?.nomeCompleto || qualificacao?.nome || civilBase.nomeCompleto || dossie.clienteNome || '',
        cpf: qualificacao?.cpf || civilBase.cpf || dossie.cpf || '',
        rg: qualificacao?.rg || civilBase.rg || '',
        rgOrgaoEmissor: qualificacao?.rgOrgaoEmissor || civilBase.rgOrgaoEmissor || '',
        nacionalidade: qualificacao?.nacionalidade || civilBase.nacionalidade || 'brasileiro(a)',
        estadoCivil: qualificacao?.estadoCivil || civilBase.estadoCivil || '',
        profissao: qualificacao?.profissao || civilBase.profissao || '',
        email: qualificacao?.email || civilBase.email || civilBase.enderecoEletronico || '',
        endereco: qualificacao?.endereco || civilBase.endereco || ''
    };

    const qualificacaoCPC = gerarQualificacaoCPC(dadosCivis);
    const nomeCliente = (dadosCivis.nomeCompleto || dossie.clienteNome || 'Cliente').toString().trim();
    const cpfFormatado = formatarCPF(dadosCivis.cpf) || '[CPF não informado]';
    const pastaCpf = sanitizarPastaCpf(dadosCivis.cpf, dossie.clienteId || dossie.clienteTelefone);

    const baseDir = diretorioBase
        ? path.resolve(diretorioBase)
        : path.resolve(process.cwd(), 'documentos_clientes');
    const pastaKit = path.resolve(baseDir, pastaCpf, 'kit_inicial');

    if (!pastaKit.startsWith(baseDir)) {
        throw new Error('Caminho de destino inválido para geração do Kit Inicial.');
    }

    fs.mkdirSync(pastaKit, { recursive: true });

    const nomeEscritorio = (escritorio?.nomeEscritorio || escritorio?.beneficiario || 'Escritório de Advocacia').toString().trim();
    const nomeAdvogado = (escritorio?.nomeAdvogado || nomeEscritorio).toString().trim();
    const oab = (escritorio?.oab || 'OAB/UF [Registro]').toString().trim();
    const cnpjEsc = (escritorio?.cnpj || '').toString().trim();
    const enderecoEsc = (escritorio?.enderecoEscritorio || '[Endereço completo do escritório]').toString().trim();
    const cidade = (escritorio?.cidade || 'Brasília/DF').toString().trim();
    const localData = `${cidade}, ${formatarDataPorExtenso(new Date())}.`;

    const descricaoOutorgado = cnpjEsc
        ? `${nomeAdvogado}, advogado(a), inscrito(a) na ${oab}, integrante da sociedade ${nomeEscritorio} (CNPJ ${cnpjEsc}), com escritório profissional situado em ${enderecoEsc}.`
        : `${nomeAdvogado}, advogado(a), inscrito(a) na ${oab}, integrante de ${nomeEscritorio}, com escritório profissional situado em ${enderecoEsc}.`;

    // 1. Procuração Ad Judicia
    const bufferProcuracao = await construirDocumentoDocx({
        titulo: 'PROCURAÇÃO AD JUDICIA ET EXTRA',
        subtitulo: 'Instrumento Particular de Mandato Judicial e Extrajudicial (Art. 105 do CPC)',
        paragrafos: [
            { rotulo: 'OUTORGANTE: ', texto: `${qualificacaoCPC}.` },
            { rotulo: 'OUTORGADO(A): ', texto: descricaoOutorgado },
            {
                rotulo: 'PODERES: ',
                texto: 'Pelo presente instrumento particular de procuração, o(a) OUTORGANTE nomeia e constitui seu(sua) bastante procurador(a) o(a) OUTORGADO(A) acima qualificado(a), conferindo-lhe amplos poderes da cláusula "ad judicia et extra" para o foro em geral, em qualquer Juízo, Instância ou Tribunal, bem como perante órgãos públicos e repartições administrativas, podendo propor ações, apresentar defesas, acompanhar procedimentos e recursos.'
            },
            {
                rotulo: 'PODERES ESPECIAIS: ',
                texto: 'Concede ainda, nos termos do artigo 105 do Código de Processo Civil, os poderes especiais para confessar, reconhecer a procedência do pedido, transigir, desistir, renunciar ao direito sobre o qual se funda a ação, receber e dar quitação, firmar compromisso, requerer justiça gratuita, assinar declaração de hipossuficiência econômica, levantar alvarás judiciais ou RPV/precatórios em nome próprio ou da sociedade de advogados e substabelecer, com ou sem reserva de iguais poderes.'
            }
        ],
        localData,
        assinaturas: [
            { nome: nomeCliente, legenda: `Outorgante — CPF ${cpfFormatado}` }
        ]
    });

    const arqProcuracao = {
        nome: 'Procuracao_Ad_Judicia.docx',
        tipo: 'PROCURACAO',
        caminho: path.join(pastaKit, 'Procuracao_Ad_Judicia.docx')
    };
    fs.writeFileSync(arqProcuracao.caminho, bufferProcuracao);
    arqProcuracao.tamanhoBytes = fs.statSync(arqProcuracao.caminho).size;

    // 2. Contrato de Honorários Advocatícios
    const objetoContrato = (contrato?.objeto || 'Patrocínio dos interesses do(a) CONTRATANTE na demanda judicial e/ou administrativa pertinente ao seu caso jurídico').toString().trim();
    const valorTotalNum = Number(String(contrato?.valorTotal || 0).replace(',', '.')) || 0;
    const valorEntradaNum = Number(String(contrato?.valorEntrada || 0).replace(',', '.')) || 0;
    const numParcelas = Math.max(1, parseInt(contrato?.numeroParcelas || 1, 10) || 1);
    const percentualExito = Number(String(contrato?.percentualExito || 0).replace(',', '.')) || 0;

    const partesHonorarios = [];
    if (valorTotalNum > 0) {
        let trechoValor = `valor fixo de R$ ${formatarBRL(valorTotalNum)}`;
        if (valorEntradaNum > 0) {
            const saldo = Math.max(0, valorTotalNum - valorEntradaNum);
            if (saldo > 0 && numParcelas > 1) {
                const valorParc = saldo / numParcelas;
                trechoValor += `, sendo R$ ${formatarBRL(valorEntradaNum)} a título de entrada via PIX na assinatura e o saldo remanescente em ${numParcelas} parcela(s) mensais de R$ ${formatarBRL(valorParc)}`;
            } else {
                trechoValor += `, sendo R$ ${formatarBRL(valorEntradaNum)} a título de entrada na assinatura`;
            }
        } else if (numParcelas > 1) {
            const valorParc = valorTotalNum / numParcelas;
            trechoValor += `, divididos em ${numParcelas} parcela(s) mensais e consecutivas de R$ ${formatarBRL(valorParc)}`;
        }
        partesHonorarios.push(trechoValor);
    }
    if (percentualExito > 0) {
        partesHonorarios.push(`honorários de êxito ("ad exitum") correspondentes a ${percentualExito}% (por cento) sobre o proveito econômico bruto obtido ao final da demanda ou acordo`);
    }
    const clausulaHonorariosTexto = partesHonorarios.length > 0
        ? `Pelos serviços profissionais contratados, o(a) CONTRATANTE pagará ao(à) CONTRATADO(A) ${partesHonorarios.join(', acrescidos de ')}. Os pagamentos não quitados na data aprazada sujeitar-se-ão à multa moratória e juros legais nos termos do Art. 395 do Código Civil.`
        : 'Pelos serviços profissionais contratados, o(a) CONTRATANTE pagará ao(à) CONTRATADO(A) os honorários ajustados conforme tabela vigente da seccional da OAB ou pactuação específica anexa, mediante quitação via transferência/PIX do escritório.';

    const bufferContrato = await construirDocumentoDocx({
        titulo: 'CONTRATO DE PRESTAÇÃO DE SERVIÇOS ADVOCATÍCIOS E HONORÁRIOS',
        subtitulo: 'Instrumento Particular regido pelo Estatuto da Advocacia (Lei nº 8.906/94) e Código Civil',
        paragrafos: [
            { rotulo: 'CONTRATANTE: ', texto: `${qualificacaoCPC}.` },
            { rotulo: 'CONTRATADO(A): ', texto: descricaoOutorgado },
            { texto: 'CLÁUSULA 1ª — DO OBJETO', destaque: true },
            { texto: `O presente contrato tem por objeto a prestação de serviços advocatícios pelo(a) CONTRATADO(A) ao(à) CONTRATANTE consistentes em: ${objetoContrato}, em obrigação de meio, com atuação técnica diligente perante os órgãos competentes.` },
            { texto: 'CLÁUSULA 2ª — DOS HONORÁRIOS ADVOCATÍCIOS', destaque: true },
            { texto: clausulaHonorariosTexto },
            { texto: 'CLÁUSULA 3ª — DAS CUSTAS E DESPESAS PROCESSUAIS', destaque: true },
            { texto: 'Eventuais custas judiciais, taxas, emolumentos cartorários, honorários periciais e despesas de deslocamento correrão por conta exclusiva do(a) CONTRATANTE, salvo concessão expressa dos benefícios da Justiça Gratuita.' },
            { texto: 'CLÁUSULA 4ª — DO DEVER DE INFORMAÇÃO E DO FORO', destaque: true },
            { texto: `As partes elegem o foro da comarca de ${cidade} para dirimir eventuais dúvidas oriundas deste instrumento, comprometendo-se o(a) CONTRATANTE a manter seus dados cadastrais e número de WhatsApp atualizados durante todo o trâmite.` }
        ],
        localData,
        assinaturas: [
            { nome: nomeCliente, legenda: `Contratante — CPF ${cpfFormatado}` },
            { nome: nomeAdvogado, legenda: `Contratado(a) — ${oab}` }
        ]
    });

    const arqContrato = {
        nome: 'Contrato_de_Honorarios.docx',
        tipo: 'CONTRATO',
        caminho: path.join(pastaKit, 'Contrato_de_Honorarios.docx')
    };
    fs.writeFileSync(arqContrato.caminho, bufferContrato);
    arqContrato.tamanhoBytes = fs.statSync(arqContrato.caminho).size;

    const arquivos = [arqProcuracao, arqContrato];

    // 3. Declaração de Hipossuficiência Econômica (Opcional via checkbox)
    if (incluirHipossuficiencia !== false) {
        const bufferHipo = await construirDocumentoDocx({
            titulo: 'DECLARAÇÃO DE HIPOSSUFICIÊNCIA ECONÔMICA',
            subtitulo: 'Requerimento de Gratuidade da Justiça (Art. 98 e seguintes do CPC • Art. 5º, LXXIV da CF/88)',
            paragrafos: [
                {
                    texto: `${qualificacaoCPC}, vem, respeitosamente, declarar para todos os fins de direito, sob as penas da lei civil e criminal (Art. 299 do Código Penal e Art. 99, § 3º do Código de Processo Civil), que não possui condições financeiras de arcar com o pagamento das custas processuais, taxas judiciárias, despesas periciais e honorários sucumbenciais sem grave prejuízo ao seu próprio sustento e de sua família.`
                },
                {
                    texto: 'Por tal razão, requer a Vossa Excelência a concessão integral dos benefícios da Assistência Judiciária Gratuita, nos exatos termos do artigo 5º, inciso LXXIV da Constituição Federal e dos artigos 98 e seguintes do Código de Processo Civil (Lei nº 13.105/2015), firmando a presente declaração como expressão da verdade.'
                }
            ],
            localData,
            assinaturas: [
                { nome: nomeCliente, legenda: `Declarante — CPF ${cpfFormatado}` }
            ]
        });

        const arqHipo = {
            nome: 'Declaracao_Hipossuficiencia.docx',
            tipo: 'HIPOSSUFICIENCIA',
            caminho: path.join(pastaKit, 'Declaracao_Hipossuficiencia.docx')
        };
        fs.writeFileSync(arqHipo.caminho, bufferHipo);
        arqHipo.tamanhoBytes = fs.statSync(arqHipo.caminho).size;
        arquivos.push(arqHipo);
    }

    return {
        sucesso: true,
        pastaKit,
        pastaCpf,
        nomeCliente,
        cpfFormatado,
        qualificacaoCPC,
        arquivos
    };
}

/**
 * Monta a mensagem humanizada de envio do Kit Inicial pelo WhatsApp contendo
 * o guia de assinatura digital gratuita Gov.br (assinador.iti.br) e o BR Code PIX da entrada.
 *
 * @param {Object} params
 * @returns {string}
 */
function montarMensagemKitWhatsapp({
    clienteNome = 'Cliente',
    beneficiario = '',
    arquivos = [],
    valorEntrada = 0,
    txid = 'KITINICIAL',
    config = {}
} = {}) {
    const cfgCob = (config && config.configuracaoCobranca) ? config.configuracaoCobranca : {};
    const nomeBenef = (beneficiario || cfgCob.beneficiario || config?.nomeEscritorio || 'Escritório de Advocacia').toString().trim();
    const primeiroNome = String(clienteNome || 'Cliente').trim().split(/\s+/)[0] || 'Cliente';

    const listaArqs = (Array.isArray(arquivos) && arquivos.length > 0)
        ? arquivos.map(a => `• 📄 ${a.nome}`).join('\n')
        : '• 📄 Procuracao_Ad_Judicia.docx\n• 📄 Contrato_de_Honorarios.docx';

    let blocoPix = '';
    const entradaNum = typeof valorEntrada === 'number'
        ? valorEntrada
        : parseFloat(String(valorEntrada || '0').replace(',', '.'));
    const chavePixCrua = String(cfgCob.chavePix || '').trim();

    if (Number.isFinite(entradaNum) && entradaNum > 0 && chavePixCrua) {
        const cidade = (cfgCob.cidade || config?.cidadeEscritorio || 'BRASILIA').toString().trim();
        const tipoChave = (cfgCob.tipoChave || 'PIX').toString().trim();
        const brCode = gerarBrCodePix({
            chavePix: chavePixCrua,
            tipoChave,
            beneficiario: nomeBenef,
            cidade,
            valor: entradaNum,
            txid
        });
        blocoPix =
            `\n\n💳 *PIX da Entrada de Honorários (R$ ${formatarBRL(entradaNum)}):*\n` +
            `📋 *PIX Copia-e-Cola Oficial (Banco Central):*\n${brCode}\n` +
            `🔑 *Chave Direta (${tipoChave}):* ${chavePixCrua}\n` +
            `_Assim que efetuar o pagamento, envie o comprovante por aqui._`;
    }

    return (
        `⚖️ *${nomeBenef} — Kit Inicial do seu Processo*\n\n` +
        `Olá, *${primeiroNome}*! Seu dossiê cadastral foi conferido e aprovado com sucesso. Seguem os documentos iniciais já preenchidos com os seus dados:\n\n` +
        `${listaArqs}\n\n` +
        `✍️ *Como assinar digitalmente pelo celular (100% gratuito e oficial Gov.br):*\n` +
        `1️⃣ Salve os documentos enviados nesta conversa (ou converta para PDF).\n` +
        `2️⃣ Acesse o assinador oficial do Governo Federal: https://assinador.iti.br\n` +
        `3️⃣ Entre com sua conta *Gov.br* (nível Prata ou Ouro), envie o documento, clique em *Assinar* e reenvie os arquivos assinados aqui no WhatsApp.${blocoPix}\n\n` +
        `Qualquer dúvida, nossa equipe está à disposição!`
    );
}

module.exports = {
    gerarKitInicial,
    montarMensagemKitWhatsapp,
    sanitizarPastaCpf
};
