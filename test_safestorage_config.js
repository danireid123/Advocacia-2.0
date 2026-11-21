/**
 * Advocacia Studio Pro v2.0
 * Suíte de Testes: Criptografia em Repouso da API Key com safeStorage (Electron) e Fallback Node
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

async function executarTestesSafeStorage() {
    console.log('🧪 Iniciando Bateria de Testes: Criptografia em Repouso (safeStorage / config.json)...\n');

    const tmpUserData = fs.mkdtempSync(path.join(os.tmpdir(), 'adv2_safestorage_test_'));
    const configPath = path.join(tmpUserData, 'config.json');
    const configBackupPath = path.join(tmpUserData, 'config.backup.json');

    // Estado do mock safeStorage
    let safeStorageDisponivel = true;
    const prefixoHardwareMock = 'DPAPI_MOCK_V1:';

    const handlersIpc = {};
    const mockElectron = {
        app: {
            getPath: () => tmpUserData,
            setLoginItemSettings: () => {},
            whenReady: () => new Promise(() => {}),
            on: () => {},
            quit: () => {}
        },
        BrowserWindow: function () {},
        ipcMain: {
            handle: (canal, fn) => { handlersIpc[canal] = fn; },
            on: () => {}
        },
        nativeImage: { createFromPath: () => ({}) },
        dialog: {},
        Notification: function () {},
        Menu: { setApplicationMenu: () => {} },
        safeStorage: {
            isEncryptionAvailable: () => safeStorageDisponivel,
            encryptString: (textoPlano) => {
                const invertido = Buffer.from(textoPlano, 'utf8').toString('hex');
                return Buffer.from(`${prefixoHardwareMock}${invertido}`, 'utf8');
            },
            decryptString: (bufferCifrado) => {
                const str = Buffer.isBuffer(bufferCifrado) ? bufferCifrado.toString('utf8') : String(bufferCifrado);
                if (!str.startsWith(prefixoHardwareMock)) {
                    throw new Error('Buffer não reconhecido pelo mock safeStorage');
                }
                const hex = str.slice(prefixoHardwareMock.length);
                return Buffer.from(hex, 'hex').toString('utf8');
            }
        }
    };

    const electronPath = require.resolve('electron');
    require.cache[electronPath] = {
        id: electronPath,
        filename: electronPath,
        loaded: true,
        exports: mockElectron
    };

    const mainApp = require('./main.js');
    const CHAVE_SECRETA_TESTE = 'MOCK_SAFE_STORAGE_KEY_SUPER_SECRET_9876';

    // 1. Testar helpers cifrarChaveApi e decifrarChaveApi via safeStorage (Base64)
    const cifrada = mainApp.cifrarChaveApi(CHAVE_SECRETA_TESTE);
    assert.ok(cifrada && typeof cifrada === 'string', 'cifrarChaveApi deve retornar string Base64 não vazia');
    assert.ok(!cifrada.includes(CHAVE_SECRETA_TESTE), 'Valor cifrado nunca deve conter a chave em texto plano');
    const decifrada = mainApp.decifrarChaveApi(cifrada);
    assert.strictEqual(decifrada, CHAVE_SECRETA_TESTE, 'decifrarChaveApi deve restaurar exatamente a chave original');
    console.log('  ✅ [PASSOU] 1. Helpers cifrarChaveApi / decifrarChaveApi operam com safeStorage em Base64');

    // 2. Testar compatibilidade fora do Electron (isEncryptionAvailable() === false)
    safeStorageDisponivel = false;
    const cifradaFallback = mainApp.cifrarChaveApi(CHAVE_SECRETA_TESTE);
    assert.ok(cifradaFallback && !cifradaFallback.includes(CHAVE_SECRETA_TESTE), 'Fallback fora do Electron não deve expor texto plano');
    const decifradaFallback = mainApp.decifrarChaveApi(cifradaFallback);
    assert.strictEqual(decifradaFallback, CHAVE_SECRETA_TESTE, 'Fallback fora do Electron deve decifrar perfeitamente');
    safeStorageDisponivel = true;
    console.log('  ✅ [PASSOU] 2. Compatibilidade 100% garantida fora do Electron (fallback AES seguro)');

    // 3. Testar salvarConfigDisco: disco sem gemini_api_key plana e RAM com gemini_api_key descriptografada
    const cfgInicial = mainApp.carregarConfig();
    cfgInicial.gemini_api_key = CHAVE_SECRETA_TESTE;
    cfgInicial.geminiApiKey = CHAVE_SECRETA_TESTE;
    cfgInicial.ia = { apiKey: CHAVE_SECRETA_TESTE, gemini_api_key: CHAVE_SECRETA_TESTE };
    cfgInicial.processos = { ...(cfgInicial.processos || {}), gemini_api_key: CHAVE_SECRETA_TESTE };

    mainApp.salvarConfigDisco(cfgInicial, true);

    // Verifica memória RAM
    const cfgEmRam = mainApp.carregarConfig(false);
    assert.strictEqual(cfgEmRam.gemini_api_key, CHAVE_SECRETA_TESTE, 'configEmMemoria.gemini_api_key deve permanecer descriptografada na RAM');

    // Verifica arquivos físicos no disco (config.json e config.backup.json)
    assert.ok(fs.existsSync(configPath), 'config.json deve ter sido gravado no disco');
    assert.ok(fs.existsSync(configBackupPath), 'config.backup.json deve ter sido gravado no disco');

    const rawDisco = fs.readFileSync(configPath, 'utf8');
    const rawBackupDisco = fs.readFileSync(configBackupPath, 'utf8');
    assert.ok(!rawDisco.includes(CHAVE_SECRETA_TESTE), 'config.json no disco NUNCA deve conter a chave em texto plano');
    assert.ok(!rawBackupDisco.includes(CHAVE_SECRETA_TESTE), 'config.backup.json no disco NUNCA deve conter a chave em texto plano');

    const jsonDisco = JSON.parse(rawDisco);
    assert.strictEqual(jsonDisco.gemini_api_key, undefined, 'Campo gemini_api_key deve ser removido do disco');
    assert.strictEqual(jsonDisco.geminiApiKey, undefined, 'Campo geminiApiKey deve ser removido do disco');
    assert.strictEqual(jsonDisco.ia?.apiKey, undefined, 'Campo ia.apiKey deve ser removido do disco');
    assert.strictEqual(jsonDisco.processos?.gemini_api_key, undefined, 'Campo processos.gemini_api_key deve ser removido do disco');
    assert.ok(typeof jsonDisco.gemini_api_key_cifrada === 'string' && jsonDisco.gemini_api_key_cifrada.length > 10, 'gemini_api_key_cifrada deve estar presente no disco');
    console.log('  ✅ [PASSOU] 3. salvarConfigDisco grava apenas gemini_api_key_cifrada no disco e mantém chave plana na RAM');

    // 4. Testar leitura do disco com gemini_api_key_cifrada e migração automática de chave legada em texto plano
    const recarregadoCifrado = mainApp.carregarConfig(true);
    assert.strictEqual(recarregadoCifrado.gemini_api_key, CHAVE_SECRETA_TESTE, 'Ao carregar do disco, gemini_api_key_cifrada deve popular configEmMemoria.gemini_api_key');

    // Simula arquivo legado com gemini_api_key em texto plano no disco
    const CHAVE_LEGADA_PLANA = 'MOCK_LEGADA_TEXTO_PLANO_11223344';
    const jsonLegado = JSON.parse(rawDisco);
    delete jsonLegado.gemini_api_key_cifrada;
    jsonLegado.gemini_api_key = CHAVE_LEGADA_PLANA;
    fs.writeFileSync(configPath, JSON.stringify(jsonLegado, null, 2), 'utf8');

    const migradoAutomatico = mainApp.carregarConfig(true);
    assert.strictEqual(migradoAutomatico.gemini_api_key, CHAVE_LEGADA_PLANA, 'Chave legada deve ser carregada na memória');

    const rawDiscoPosMigracao = fs.readFileSync(configPath, 'utf8');
    const jsonDiscoPosMigracao = JSON.parse(rawDiscoPosMigracao);
    assert.ok(!rawDiscoPosMigracao.includes(CHAVE_LEGADA_PLANA), 'Migração automática deve apagar a chave em texto plano do arquivo config.json');
    assert.strictEqual(jsonDiscoPosMigracao.gemini_api_key, undefined, 'Campo gemini_api_key em texto plano deve ter sido removido do disco após migração');
    assert.ok(jsonDiscoPosMigracao.gemini_api_key_cifrada, 'Migração automática deve ter gravado gemini_api_key_cifrada no disco');
    console.log('  ✅ [PASSOU] 4. Inicialização decifra chave cifrada e migra automaticamente chaves legadas em texto plano');

    // 5. Testar handler restaurar-backup-completo (backup legado + backup cifrado + geminiApiKeyMascarada intacta)
    assert.ok(typeof handlersIpc['restaurar-backup-completo'] === 'function', 'Handler restaurar-backup-completo deve estar registrado');

    // 5.1 Backup legado com chave em texto plano
    const CHAVE_BACKUP_LEGADO = 'MOCK_BACKUP_LEGADO_RESTAURADO_5566';
    const resBackupLegado = await handlersIpc['restaurar-backup-completo']({}, {
        nomeEscritorio: 'Escritório Backup Legado',
        gemini_api_key: CHAVE_BACKUP_LEGADO
    });
    assert.strictEqual(resBackupLegado.sucesso, true, 'Restauração de backup legado deve ter sucesso');
    assert.strictEqual(resBackupLegado.config.gemini_api_key, undefined, 'Retorno para UI não deve conter chave plana');
    assert.strictEqual(resBackupLegado.config.geminiApiKeyMascarada, '••••••••••••5566', 'geminiApiKeyMascarada deve estar intacta para a UI');
    assert.ok(!fs.readFileSync(configPath, 'utf8').includes(CHAVE_BACKUP_LEGADO), 'Backup legado restaurado deve ser salvo cifrado no disco');

    // 5.2 Backup moderno com gemini_api_key_cifrada
    const CHAVE_BACKUP_CIFRADO = 'MOCK_BACKUP_MODERNO_CIFRADO_7788';
    const resBackupCifrado = await handlersIpc['restaurar-backup-completo']({}, {
        nomeEscritorio: 'Escritório Backup Cifrado',
        gemini_api_key_cifrada: mainApp.cifrarChaveApi(CHAVE_BACKUP_CIFRADO)
    });
    assert.strictEqual(resBackupCifrado.sucesso, true, 'Restauração de backup cifrado deve ter sucesso');
    assert.strictEqual(resBackupCifrado.config.geminiApiKeyMascarada, '••••••••••••7788', 'geminiApiKeyMascarada deve refletir os últimos 4 dígitos da chave decifrada');
    assert.strictEqual(mainApp.carregarConfig(false).gemini_api_key, CHAVE_BACKUP_CIFRADO, 'Memória RAM deve conter a chave do backup cifrado pronta para uso');
    assert.ok(!fs.readFileSync(configPath, 'utf8').includes(CHAVE_BACKUP_CIFRADO), 'Disco nunca deve conter a chave do backup em texto plano');
    console.log('  ✅ [PASSOU] 5. restaurar-backup-completo aceita backups cifrados e legados e mantém geminiApiKeyMascarada intacta');

    // Limpeza
    try {
        fs.rmSync(tmpUserData, { recursive: true, force: true });
    } catch (e) {}

    console.log('\n🎉 TODOS OS TESTES DE CRIPTOGRAFIA EM REPOUSO (SAFESTORAGE) PASSARAM COM 100% DE SUCESSO!');
    process.exit(0);
}

executarTestesSafeStorage().catch(err => {
    console.error('\n❌ FALHA NOS TESTES DE SAFESTORAGE:', err);
    process.exit(1);
});
