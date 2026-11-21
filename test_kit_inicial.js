'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const mammoth = require('mammoth');

const {
    gerarKitInicial,
    montarMensagemKitWhatsapp,
    sanitizarPastaCpf
} = require('./src/onboarding/geradorKitInicial');
const { calcularCRC16Pix } = require('./src/financeiro/gestaoFinanceira');

async function executarTestesKitInicial() {
    console.log('🧪 Iniciando Bateria de Testes: Kit Inicial do Cliente em 1 Clique (.docx)...\n');

    const tempBase = fs.mkdtempSync(path.join(os.tmpdir(), 'adv-kit-inicial-test-'));

    try {
        const dossieTeste = {
            clienteId: '5511998765432',
            clienteTelefone: '5511998765432',
            clienteNome: 'Mariana Souza Oliveira',
            status: 'CONSOLIDADO',
            civil: {
                nomeCompleto: 'Mariana Souza Oliveira',
                cpf: '123.456.789-01',
                rg: '44.555.666-7',
                rgOrgaoEmissor: 'SSP/SP',
                nacionalidade: 'brasileira',
                estadoCivil: 'casada',
                profissao: 'comerciante',
                email: 'mariana.oliveira@exemplo.com.br',
                endereco: {
                    logradouro: 'Avenida Paulista',
                    numero: '1500',
                    complemento: 'Apto 82',
                    bairro: 'Bela Vista',
                    cidade: 'São Paulo',
                    uf: 'SP',
                    cep: '01310-100'
                }
            }
        };

        const escritorioTeste = {
            nomeEscritorio: 'Silva & Associados Advocacia',
            nomeAdvogado: 'Dr. Henrique Silva',
            oab: 'OAB/SP 123.456',
            cnpj: '12.345.678/0001-90',
            enderecoEscritorio: 'Rua Boa Vista, nº 254, Centro, São Paulo/SP',
            cidade: 'São Paulo/SP'
        };

        const contratoTeste = {
            objeto: 'Ação Trabalhista de Reconhecimento de Vínculo e Verbas Rescisórias',
            valorTotal: 4000.00,
            valorEntrada: 1000.00,
            numeroParcelas: 3,
            percentualExito: 30
        };

        // 1. Geração completa dos 3 arquivos .docx em pasta sanitizada pelo CPF
        const resCompleto = await gerarKitInicial({
            dossie: dossieTeste,
            escritorio: escritorioTeste,
            contrato: contratoTeste,
            incluirHipossuficiencia: true,
            diretorioBase: tempBase
        });

        assert.strictEqual(resCompleto.sucesso, true, 'gerarKitInicial deve retornar sucesso: true');
        assert.strictEqual(resCompleto.pastaCpf, '12345678901', 'Pasta deve usar dígitos limpos do CPF');
        assert.strictEqual(
            path.normalize(resCompleto.pastaKit),
            path.normalize(path.join(tempBase, '12345678901', 'kit_inicial')),
            'Pasta do kit deve ser <base>/<cpf>/kit_inicial'
        );
        assert.strictEqual(resCompleto.arquivos.length, 3, 'Deve gerar exatamente 3 arquivos .docx com hipossuficiência ativa');

        const nomesEsperados = [
            'Procuracao_Ad_Judicia.docx',
            'Contrato_de_Honorarios.docx',
            'Declaracao_Hipossuficiencia.docx'
        ];
        for (const nome of nomesEsperados) {
            const meta = resCompleto.arquivos.find(a => a.nome === nome);
            assert.ok(meta, `Metadado do arquivo ${nome} deve estar presente`);
            assert.ok(fs.existsSync(meta.caminho), `Arquivo ${nome} deve existir em disco`);
            const stat = fs.statSync(meta.caminho);
            assert.ok(stat.size > 1000, `Arquivo ${nome} deve ter tamanho válido (> 1 KB), obtido: ${stat.size}`);
        }
        console.log('  ✅ [PASSOU] 1. Geração determinística dos 3 arquivos .docx em <cpf>/kit_inicial/ (existência e tamanho > 0)');

        // 2. Extração de conteúdo real dos 3 arquivos .docx via mammoth e verificação CPC Art. 319
        const txtProcuracao = (await mammoth.extractRawText({ path: resCompleto.arquivos[0].caminho })).value;
        assert.ok(txtProcuracao.includes('PROCURAÇÃO AD JUDICIA'), 'Procuração deve conter título forense');
        assert.ok(txtProcuracao.includes('MARIANA SOUZA OLIVEIRA'), 'Procuração deve conter nome em maiúsculas');
        assert.ok(txtProcuracao.includes('123.456.789-01'), 'Procuração deve conter CPF formatado');
        assert.ok(txtProcuracao.includes('44.555.666-7 SSP/SP'), 'Procuração deve conter RG com órgão emissor');
        assert.ok(txtProcuracao.includes('Avenida Paulista, nº 1500'), 'Procuração deve conter endereço completo Art. 319 CPC');
        assert.ok(txtProcuracao.includes('OAB/SP 123.456'), 'Procuração deve qualificar o outorgado e OAB');

        const txtContrato = (await mammoth.extractRawText({ path: resCompleto.arquivos[1].caminho })).value;
        assert.ok(txtContrato.includes('CONTRATO DE PRESTAÇÃO DE SERVIÇOS ADVOCATÍCIOS'), 'Contrato deve conter título');
        assert.ok(txtContrato.includes('MARIANA SOUZA OLIVEIRA'), 'Contrato deve conter qualificação do contratante');
        assert.ok(txtContrato.includes('123.456.789-01'), 'Contrato deve conter CPF');
        assert.ok(txtContrato.includes('4000,00') && txtContrato.includes('1000,00'), 'Contrato deve conter valores de honorários e entrada');
        assert.ok(txtContrato.includes('3 parcela(s)') && txtContrato.includes('30%'), 'Contrato deve conter parcelamento e percentual de êxito');

        const txtHipo = (await mammoth.extractRawText({ path: resCompleto.arquivos[2].caminho })).value;
        assert.ok(txtHipo.includes('DECLARAÇÃO DE HIPOSSUFICIÊNCIA ECONÔMICA'), 'Declaração deve conter título');
        assert.ok(txtHipo.includes('MARIANA SOUZA OLIVEIRA'), 'Declaração deve conter nome');
        assert.ok(txtHipo.includes('123.456.789-01'), 'Declaração deve conter CPF');
        assert.ok(txtHipo.includes('artigo 5º, inciso LXXIV') || txtHipo.includes('98 e seguintes'), 'Declaração deve fundamentar Art. 98 CPC / CF');

        console.log('  ✅ [PASSOU] 2. Conteúdo real extraído dos 3 .docx validado (Nome, CPF, CPC Art. 319, Honorários e Justiça Gratuita)');

        // 3. Checkbox opcional de hipossuficiência desmarcado gera apenas 2 arquivos
        const tempSemHipo = path.join(tempBase, 'sem_hipo');
        const resSemHipo = await gerarKitInicial({
            dossie: dossieTeste,
            escritorio: escritorioTeste,
            contrato: contratoTeste,
            incluirHipossuficiencia: false,
            diretorioBase: tempSemHipo
        });
        assert.strictEqual(resSemHipo.arquivos.length, 2, 'Com incluirHipossuficiencia=false deve gerar apenas 2 arquivos');
        assert.ok(
            !fs.existsSync(path.join(resSemHipo.pastaKit, 'Declaracao_Hipossuficiencia.docx')),
            'Declaracao_Hipossuficiencia.docx NÃO deve existir quando checkbox está desmarcado'
        );
        console.log('  ✅ [PASSOU] 3. Opção incluirHipossuficiencia=false omite Declaracao_Hipossuficiencia.docx');

        // 4. Sanitização contra Path Traversal no nome da pasta
        assert.strictEqual(sanitizarPastaCpf('../../etc/passwd', 'fallback/..\\test'), 'fallbacktest');
        assert.strictEqual(sanitizarPastaCpf('12.345/../../678-901', 'fallback'), '12345678901');
        assert.strictEqual(sanitizarPastaCpf('', '../../Windows\\System32'), 'WindowsSystem32');
        console.log('  ✅ [PASSOU] 4. Sanitização contra Path Traversal validada');

        // 5. Mensagem WhatsApp inclui Gov.br (assinador.iti.br) e BR Code PIX oficial da entrada
        const msgWhatsapp = montarMensagemKitWhatsapp({
            clienteNome: 'Mariana Souza Oliveira',
            beneficiario: 'Silva & Associados',
            arquivos: resCompleto.arquivos,
            valorEntrada: 1000.00,
            txid: 'KIT202601',
            config: {
                configuracaoCobranca: {
                    chavePix: '12.345.678/0001-90',
                    tipoChave: 'CNPJ',
                    beneficiario: 'Silva & Associados',
                    cidade: 'Sao Paulo'
                }
            }
        });
        assert.ok(msgWhatsapp.includes('assinador.iti.br'), 'Mensagem deve instruir assinatura gratuita no Gov.br (assinador.iti.br)');
        assert.ok(msgWhatsapp.includes('Procuracao_Ad_Judicia.docx'), 'Mensagem deve listar documentos do Kit Inicial');
        const matchPix = msgWhatsapp.match(/000201[^\r\n]+6304[0-9A-F]{4}/);
        assert.ok(matchPix, 'Mensagem deve conter payload BR Code PIX oficial para entrada');
        assert.ok(matchPix[0].includes('54071000.00'), 'BR Code PIX da entrada deve embutir valor 1000.00');
        assert.strictEqual(calcularCRC16Pix(matchPix[0].slice(0, -4)), matchPix[0].slice(-4), 'CRC16 do BR Code da entrada deve ser válido');
        console.log('  ✅ [PASSOU] 5. Mensagem WhatsApp integra instruções Gov.br (assinador.iti.br) e BR Code PIX oficial (CRC16 válido)');

        // 6. Contratos IPC e UI presentes
        const mainSrc = fs.readFileSync(path.join(__dirname, 'main.js'), 'utf-8');
        const preloadSrc = fs.readFileSync(path.join(__dirname, 'preload.js'), 'utf-8');
        const htmlSrc = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf-8');
        assert.ok(mainSrc.includes("ipcMain.handle('onboarding-gerar-kit-inicial'"), 'main.js deve expor onboarding-gerar-kit-inicial');
        assert.ok(mainSrc.includes("ipcMain.handle('onboarding-enviar-kit-whatsapp'"), 'main.js deve expor onboarding-enviar-kit-whatsapp');
        assert.ok(preloadSrc.includes("ipcRenderer.invoke('onboarding-gerar-kit-inicial'"), 'preload.js deve expor gerarKitInicial');
        assert.ok(preloadSrc.includes("ipcRenderer.invoke('onboarding-enviar-kit-whatsapp'"), 'preload.js deve expor enviarKitInicialWhatsapp');
        assert.ok(htmlSrc.includes('btn-gerar-kit-inicial-dossie') && htmlSrc.includes('modal-kit-inicial'), 'index.html deve possuir botão dourado e modal do Kit Inicial');
        console.log('  ✅ [PASSOU] 6. Contratos IPC (main.js/preload.js) e UI em index.html verificados');

        console.log('\n🎉 TODOS OS TESTES DO KIT INICIAL (.DOCX + GOV.BR + PIX) PASSARAM COM 100% DE SUCESSO!');
    } finally {
        fs.rmSync(tempBase, { recursive: true, force: true });
    }
}

executarTestesKitInicial().catch(err => {
    console.error('❌ Falha nos testes do Kit Inicial:', err);
    process.exit(1);
});
