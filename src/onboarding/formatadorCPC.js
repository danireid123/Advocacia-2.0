/**
 * Advocacia Studio Pro v2.0 - Formatador de Qualificação Civil (CPC Art. 319, II)
 * Arquivo: src/onboarding/formatadorCPC.js
 * 
 * Converte dados cadastrais coletados e extraídos via OCR/Visão Computacional na
 * qualificação formal brasileira padrão para petições iniciais (Cível, Trabalhista e Previdenciário).
 */

'use strict';

/**
 * Formata CPF de 11 dígitos no padrão clássico 000.000.000-00.
 * @param {string|number} cpf 
 * @returns {string}
 */
function formatarCPF(cpf) {
    if (!cpf && cpf !== 0) return '';
    const str = String(cpf).trim();
    const limpo = str.replace(/\D/g, '');
    if (limpo.length === 11) {
        return limpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }
    return str;
}

/**
 * Formata CNPJ de 14 dígitos no padrão clássico 00.000.000/0000-00.
 * @param {string|number} cnpj 
 * @returns {string}
 */
function formatarCNPJ(cnpj) {
    if (!cnpj && cnpj !== 0) return '';
    const str = String(cnpj).trim();
    const limpo = str.replace(/\D/g, '');
    if (limpo.length === 14) {
        return limpo.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }
    return str;
}

/**
 * Formata CEP de 8 dígitos no padrão clássico 00000-000.
 * @param {string|number} cep 
 * @returns {string}
 */
function formatarCEP(cep) {
    if (!cep && cep !== 0) return '';
    const str = String(cep).trim();
    const limpo = str.replace(/\D/g, '');
    if (limpo.length === 8) {
        return limpo.replace(/(\d{5})(\d{3})/, '$1-$2');
    }
    return str;
}

/**
 * Formata RG com órgão emissor.
 * @param {string|number} rg 
 * @param {string} [rgOrgaoEmissor] 
 * @returns {string}
 */
function formatarRG(rg, rgOrgaoEmissor) {
    if (!rg && rg !== 0) return '';
    const rglimpo = String(rg).trim();
    const orgaoLimpo = rgOrgaoEmissor ? String(rgOrgaoEmissor).trim().toUpperCase() : '';
    // Se o RG já contiver o órgão emissor no final, não duplica
    if (orgaoLimpo && !rglimpo.toUpperCase().includes(orgaoLimpo)) {
        return `${rglimpo} ${orgaoLimpo}`;
    }
    return rglimpo;
}

/**
 * Formata endereço completo a partir de objeto estruturado ou string simples.
 * @param {Object|string} endereco 
 * @returns {string}
 */
function formatarEnderecoCompleto(endereco) {
    if (!endereco) return '';
    if (typeof endereco === 'string') return endereco.trim();

    const partes = [];
    const logradouro = String(endereco.logradouro || endereco.rua || endereco.avenida || endereco.endereco || '').trim();
    const numero = String(endereco.numero || endereco.num || '').trim();
    const complemento = String(endereco.complemento || endereco.compl || '').trim();
    const bairro = String(endereco.bairro || '').trim();
    const cidade = String(endereco.cidade || endereco.municipio || '').trim();
    const uf = String(endereco.uf || endereco.estado || '').trim();
    const cep = formatarCEP(endereco.cep);

    if (logradouro) {
        let trechoRua = logradouro;
        if (numero) {
            trechoRua += `, nº ${numero}`;
        } else {
            trechoRua += ', s/n';
        }
        partes.push(trechoRua);
    }

    if (complemento) partes.push(complemento);
    if (bairro) partes.push(`Bairro ${bairro}`);
    
    if (cidade && uf) {
        partes.push(`${cidade}/${uf.toUpperCase()}`);
    } else if (cidade) {
        partes.push(cidade);
    } else if (uf) {
        partes.push(uf.toUpperCase());
    }

    if (cep) partes.push(`CEP ${cep}`);

    return partes.join(', ');
}

/**
 * Detecta concordância de gênero simples (feminino/masculino/neutro).
 * @param {Object} dados 
 * @returns {'F'|'M'|'NEUTRO'}
 */
function deduzirGenero(dados) {
    if (!dados) return 'NEUTRO';
    if (dados.genero === 'F' || dados.sexo === 'F') return 'F';
    if (dados.genero === 'M' || dados.sexo === 'M') return 'M';

    const nac = String(dados.nacionalidade || '').toLowerCase();
    const est = String(dados.estadoCivil || '').toLowerCase();

    if (nac.endsWith('a') || est.endsWith('a')) return 'F';
    if (nac.endsWith('o') || est.endsWith('o')) return 'M';

    return 'NEUTRO';
}

/**
 * Gera a string de Qualificação Civil formal conforme o CPC Art. 319, II.
 * Suporta Pessoa Física e Pessoa Jurídica, além de preencher defaults elegantes
 * para campos não fornecidos.
 * 
 * @param {Object} qualificacao - Objeto com os dados civis do cliente
 * @returns {string} String formatada pronta para colagem em petição inicial
 */
function gerarQualificacaoCPC(qualificacao) {
    if (!qualificacao || typeof qualificacao !== 'object') {
        qualificacao = {};
    }

    // Normalização de chaves flexíveis
    const nome = (qualificacao.nomeCompleto || qualificacao.nome || qualificacao.nomeCliente || qualificacao.razaoSocial || '').toString().trim();
    const cpf = qualificacao.cpf || qualificacao.cpfCliente || qualificacao.documento || '';
    const cnpj = qualificacao.cnpj || '';
    const rg = qualificacao.rg || qualificacao.identidade || '';
    const rgOrgaoEmissor = qualificacao.rgOrgaoEmissor || qualificacao.orgaoEmissor || qualificacao.orgaoExpedidor || '';
    const nacionalidade = (qualificacao.nacionalidade || '').toString().trim();
    const estadoCivil = (qualificacao.estadoCivil || '').toString().trim();
    const profissao = (qualificacao.profissao || qualificacao.ocupacao || '').toString().trim();
    const email = (qualificacao.email || qualificacao.enderecoEletronico || qualificacao.emailCliente || '').toString().trim();

    // Resolução de endereço (aninhado ou campos planos no topo)
    let enderecoObj = qualificacao.endereco;
    if (!enderecoObj && (qualificacao.logradouro || qualificacao.rua || qualificacao.cidade || qualificacao.cep)) {
        enderecoObj = {
            logradouro: qualificacao.logradouro || qualificacao.rua,
            numero: qualificacao.numero,
            complemento: qualificacao.complemento,
            bairro: qualificacao.bairro,
            cidade: qualificacao.cidade,
            uf: qualificacao.uf,
            cep: qualificacao.cep
        };
    }

    // -------------------------------------------------------------------------
    // 1. Ramo: Pessoa Jurídica (se CNPJ fornecido ou tipoPessoa === 'PJ')
    // -------------------------------------------------------------------------
    if (cnpj || qualificacao.tipoPessoa === 'PJ') {
        const nomePJ = nome.toUpperCase() || '[RAZÃO SOCIAL NÃO INFORMADA]';
        const cnpjFmt = formatarCNPJ(cnpj) || '[CNPJ NÃO INFORMADO]';
        const enderecoFmt = formatarEnderecoCompleto(enderecoObj) || '[Endereço da sede não informado]';
        const emailPJ = email || '[Endereço eletrônico não informado]';

        return `${nomePJ}, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº ${cnpjFmt}, com endereço eletrônico ${emailPJ}, com sede na ${enderecoFmt}`;
    }

    // -------------------------------------------------------------------------
    // 2. Ramo: Pessoa Física (Padrão CPC Art. 319, II)
    // -------------------------------------------------------------------------
    const nomeFormatado = nome ? nome.toUpperCase() : '[NOME NÃO INFORMADO]';
    const nacionalidadeFormatada = nacionalidade || '[Nacionalidade não informada]';
    const estadoCivilFormatado = estadoCivil || '[Estado civil não informado]';
    const profissaoFormatada = profissao || '[Profissão não informada]';

    const genero = deduzirGenero({ nacionalidade, estadoCivil, genero: qualificacao.genero });
    
    // Tratamento de concordância verbal/nominal forense
    let termoPortador = 'portador(a)';
    let termoInscrito = 'inscrito(a)';
    let termoResidente = 'residente e domiciliado(a)';

    if (genero === 'F') {
        termoPortador = 'portadora';
        termoInscrito = 'inscrita';
        termoResidente = 'residente e domiciliada';
    } else if (genero === 'M') {
        termoPortador = 'portador';
        termoInscrito = 'inscrito';
        termoResidente = 'residente e domiciliado';
    }

    // Identificação documental (RG e CPF)
    let textoRG = '';
    if (rg) {
        const rgFmt = formatarRG(rg, rgOrgaoEmissor);
        textoRG = `${termoPortador} do RG nº ${rgFmt}`;
    } else {
        textoRG = `${termoPortador} do RG nº [RG não informado]`;
    }

    let textoCPF = '';
    if (cpf) {
        const cpfFmt = formatarCPF(cpf);
        textoCPF = `${termoInscrito} no CPF sob o nº ${cpfFmt}`;
    } else {
        textoCPF = `${termoInscrito} no CPF sob o nº [CPF não informado]`;
    }

    const docsTexto = `${textoRG} e ${textoCPF}`;

    // Endereço Eletrônico
    let emailTexto = '';
    if (email) {
        emailTexto = `com endereço eletrônico ${email}`;
    } else {
        emailTexto = 'sem endereço eletrônico cadastrado';
    }

    // Residência e Domicílio
    const enderecoFmt = formatarEnderecoCompleto(enderecoObj);
    let enderecoTexto = '';
    if (enderecoFmt) {
        // Usa preposição 'na' se começar com Rua, Avenida, Travessa, Alameda; senão 'em'
        const primeiroTermo = enderecoFmt.split(' ')[0].toLowerCase().replace(/\./g, '');
        const preposicao = ['rua', 'avenida', 'av', 'travessa', 'alameda', 'estrada', 'rodovia', 'praca', 'praça'].includes(primeiroTermo) ? 'na' : 'em';
        enderecoTexto = `${termoResidente} ${preposicao} ${enderecoFmt}`;
    } else {
        enderecoTexto = `${termoResidente} em [Endereço não informado]`;
    }

    // Montagem final harmônica em conformidade estrita com o Art. 319, II do CPC
    const clausulas = [
        nomeFormatado,
        nacionalidadeFormatada,
        estadoCivilFormatado,
        profissaoFormatada,
        docsTexto,
        emailTexto,
        enderecoTexto
    ];

    return clausulas.join(', ');
}

/**
 * Função utilitária para converter saída do validadorDocumentos ou dossie direto para entrada do CPC.
 * @param {Object} dadosExtraidos - Objeto dadosExtraidos retornado pelo validadorDocumentos
 * @param {Object} [dadosComplementares] - Dados complementares (nacionalidade, profissão, etc.)
 * @returns {string} Qualificação formal gerada
 */
function qualificarDocumentoExtraido(dadosExtraidos, dadosComplementares = {}) {
    if (!dadosExtraidos) return gerarQualificacaoCPC(dadosComplementares);
    
    const mesclado = {
        ...dadosComplementares,
        nomeCompleto: dadosExtraidos.nomeCompleto || dadosComplementares.nomeCompleto,
        cpf: dadosExtraidos.cpf || dadosComplementares.cpf,
        rg: dadosExtraidos.rg || dadosComplementares.rg,
        rgOrgaoEmissor: dadosExtraidos.rgOrgaoEmissor || dadosComplementares.rgOrgaoEmissor,
        endereco: dadosExtraidos.endereco || dadosComplementares.endereco
    };
    return gerarQualificacaoCPC(mesclado);
}

module.exports = {
    gerarQualificacaoCPC,
    qualificarDocumentoExtraido,
    formatarCPF,
    formatarCNPJ,
    formatarCEP,
    formatarRG,
    formatarEnderecoCompleto
};
