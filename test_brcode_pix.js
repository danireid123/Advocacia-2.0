'use strict';

const assert = require('assert');
const {
    gerarBrCodePix,
    calcularCRC16Pix,
    normalizarChavePixBacen,
    gerarMensagemCobrancaPix
} = require('./src/financeiro/gestaoFinanceira');

/**
 * Decodifica uma string EMV TLV em mapa de tags { id: valor } e valida que
 * todos os comprimentos declarados correspondem exatamente aos bytes reais.
 */
function decodificarTLV(payload) {
    const campos = {};
    let pos = 0;
    while (pos < payload.length) {
        assert.ok(pos + 4 <= payload.length, `Truncamento inesperado no índice ${pos}`);
        const tag = payload.slice(pos, pos + 2);
        const tamStr = payload.slice(pos + 2, pos + 4);
        assert.ok(/^\d{2}$/.test(tamStr), `Tamanho inválido "${tamStr}" na tag ${tag}`);
        const tam = parseInt(tamStr, 10);
        assert.ok(pos + 4 + tam <= payload.length, `Comprimento declarado (${tam}) na tag ${tag} excede o payload`);
        const valor = payload.slice(pos + 4, pos + 4 + tam);
        assert.strictEqual(valor.length, tam, `Tamanho real do campo ${tag} difere do declarado`);
        campos[tag] = valor;
        pos += 4 + tam;
    }
    assert.strictEqual(pos, payload.length, 'O payload TLV deve ser consumido integralmente sem bytes órfãos');
    return campos;
}

async function executarTestesBrCodePix() {
    console.log('🧪 Iniciando Bateria de Testes: BR Code PIX Oficial (EMV QRCPS-MPM BACEN)...\n');

    // 1. Vetor matemático padrão CRC16-CCITT (0x1021, init 0xFFFF): "123456789" -> "29B1"
    {
        const crcPadrao = calcularCRC16Pix('123456789');
        assert.strictEqual(crcPadrao, '29B1', 'Vetor clássico CRC16-CCITT de "123456789" deve ser 29B1');
        console.log('  ✅ [PASSOU] 1. Cálculo matemático CRC16-CCITT (polinômio 0x1021, init 0xFFFF) validado');
    }

    // 2. Normalização de chaves PIX segundo regras do DICT / BACEN
    {
        assert.strictEqual(normalizarChavePixBacen('123.456.789-01', 'CPF'), '12345678901');
        assert.strictEqual(normalizarChavePixBacen('12.345.678/0001-90', 'CNPJ'), '12345678000190');
        assert.strictEqual(normalizarChavePixBacen('(11) 99888-7766', 'TELEFONE'), '+5511998887766');
        assert.strictEqual(normalizarChavePixBacen('(21) 98765-4321'), '+5521987654321');
        assert.strictEqual(normalizarChavePixBacen('5511998887766'), '+5511998887766');
        assert.strictEqual(normalizarChavePixBacen('Financeiro@Escritorio.adv.br'), 'financeiro@escritorio.adv.br');
        assert.strictEqual(
            normalizarChavePixBacen('123E4567-E89B-12D3-A456-426614174000'),
            '123e4567-e89b-12d3-a456-426614174000'
        );
        console.log('  ✅ [PASSOU] 2. Normalização BACEN de chaves PIX (CPF, CNPJ, Telefone +55, E-mail e EVP)');
    }

    // 3. Estrutura TLV EMV completa, sanitização de acentos e limites de tamanho (25 / 15 / 25)
    {
        const brCode = gerarBrCodePix({
            chavePix: '12.345.678/0001-90',
            beneficiario: 'São Patrício & Associados Advocacia Especializada S/S',
            cidade: 'São José dos Campos',
            valor: 1545.5,
            txid: 'parc_teste-2026#001_extra_longo_demais'
        });

        assert.ok(brCode.startsWith('000201'), 'Deve iniciar com Payload Format Indicator 000201');
        assert.ok(/6304[0-9A-F]{4}$/.test(brCode), 'Deve finalizar com tag 6304 e 4 dígitos hexadecimais maiúsculos');

        // Valida CRC16 do payload real gerado
        const semCrc = brCode.slice(0, -4);
        const crcExtraido = brCode.slice(-4);
        assert.strictEqual(calcularCRC16Pix(semCrc), crcExtraido, 'CRC16 do BR Code gerado deve ser matematicamente válido');

        // Decodifica e audita todos os campos TLV
        const tlv = decodificarTLV(brCode);
        assert.strictEqual(tlv['00'], '01');
        assert.strictEqual(tlv['52'], '0000');
        assert.strictEqual(tlv['53'], '986');
        assert.strictEqual(tlv['54'], '1545.50', 'Valor deve ter exatamente 2 casas decimais com ponto');
        assert.strictEqual(tlv['58'], 'BR');

        // Beneficiário sem acentos e limitado a 25 caracteres
        assert.ok(tlv['59'].length <= 25, 'Beneficiário deve ter no máximo 25 caracteres');
        assert.strictEqual(tlv['59'], 'Sao Patricio & Associados');
        assert.ok(!/[ãáéíóúç]/i.test(tlv['59']), 'Beneficiário não deve conter acentos');

        // Cidade sem acentos e limitada a 15 caracteres
        assert.ok(tlv['60'].length <= 15, 'Cidade deve ter no máximo 15 caracteres');
        assert.strictEqual(tlv['60'], 'Sao Jose dos Ca');

        // Subcampos da tag 26 (GUI + Chave)
        const sub26 = decodificarTLV(tlv['26']);
        assert.strictEqual(sub26['00'], 'br.gov.bcb.pix');
        assert.strictEqual(sub26['01'], '12345678000190');

        // Subcampo da tag 62 (TXID alfanumérico até 25 chars)
        const sub62 = decodificarTLV(tlv['62']);
        assert.ok(sub62['05'].length <= 25, 'TXID deve ter no máximo 25 caracteres');
        assert.ok(/^[a-zA-Z0-9]+$/.test(sub62['05']), 'TXID deve conter apenas caracteres alfanuméricos');
        assert.strictEqual(sub62['05'], 'parcteste2026001extralong');

        console.log('  ✅ [PASSOU] 3. Estrutura TLV EMV, limites (25/15/25 chars), remoção de acentos e CRC16 validados');
    }

    // 4. Fallback de cidade padrão ("BRASILIA") e TXID padrão ("***")
    {
        const brCode = gerarBrCodePix({
            chavePix: '(11) 99999-8888',
            beneficiario: 'Dr. Henrique',
            valor: 500
        });

        const tlv = decodificarTLV(brCode);
        assert.strictEqual(tlv['60'], 'BRASILIA', 'Cidade padrão deve ser BRASILIA quando omitida');
        assert.strictEqual(tlv['54'], '500.00');
        const sub26 = decodificarTLV(tlv['26']);
        assert.strictEqual(sub26['01'], '+5511999998888');
        const sub62 = decodificarTLV(tlv['62']);
        assert.strictEqual(sub62['05'], '***', 'TXID padrão deve ser *** quando omitido');
        console.log('  ✅ [PASSOU] 4. Fallbacks padrão BACEN (cidade BRASILIA e TXID ***) validados');
    }

    // 5. Integração com gerarMensagemCobrancaPix e encargos Art. 395 CC (valorTotalAtualizado)
    {
        const config = {
            configuracaoCobranca: {
                chavePix: '12.345.678/0001-90',
                tipoChave: 'CNPJ',
                beneficiario: 'Advocacia Studio Pro',
                aplicarJurosMulta: true,
                percentualMulta: 2.0,
                percentualJurosMes: 1.0
            }
        };

        const parcela = {
            id: 'PARC_2026_09',
            clienteNome: 'Beatriz Ramos',
            valor: 1500.00,
            vencimento: '2026-01-01',
            status: 'PENDENTE'
        };

        // 30 dias de atraso -> R$ 1500 + R$ 30 (2% multa) + R$ 15 (1% juros) = R$ 1545.00
        const msg = gerarMensagemCobrancaPix(parcela, config, new Date('2026-01-31T12:00:00'));

        // Verifica presença da chave legível
        assert.ok(msg.includes('12.345.678/0001-90'), 'Deve exibir a chave PIX legível na mensagem');

        // Extrai a linha do BR Code da mensagem e valida seus campos TLV
        const matchBrCode = msg.match(/000201[^\r\n]+6304[0-9A-F]{4}/);
        assert.ok(matchBrCode, 'Mensagem deve conter o payload BR Code PIX oficial');

        const brCodeNaMensagem = matchBrCode[0];
        const tlvMsg = decodificarTLV(brCodeNaMensagem);
        assert.strictEqual(tlvMsg['54'], '1545.00', 'BR Code na mensagem deve embutir o valorTotalAtualizado (1545.00)');
        const sub62Msg = decodificarTLV(tlvMsg['62']);
        assert.strictEqual(sub62Msg['05'], 'PARC202609', 'BR Code na mensagem deve conter o TXID sanitizado da parcela');

        const crcCalculado = calcularCRC16Pix(brCodeNaMensagem.slice(0, -4));
        assert.strictEqual(crcCalculado, brCodeNaMensagem.slice(-4), 'CRC16 do BR Code na mensagem deve ser válido');

        console.log('  ✅ [PASSOU] 5. Integração com gerarMensagemCobrancaPix embute valorTotalAtualizado (Art. 395 CC) e chave legível');
    }

    console.log('\n🎉 TODOS OS TESTES DO BR CODE PIX OFICIAL (BACEN EMV) PASSARAM COM 100% DE SUCESSO!');
}

executarTestesBrCodePix().catch(err => {
    console.error('❌ Falha nos testes de BR Code PIX:', err);
    process.exit(1);
});
