const { contextBridge, ipcRenderer, webUtils } = require('electron');

const apiBridge = {
    // Utilitário crítico para Drag & Drop no Electron moderno
    obterCaminhoArquivo: (file) => {
        try {
            if (webUtils && typeof webUtils.getPathForFile === 'function') {
                return webUtils.getPathForFile(file) || file.path || '';
            }
            return file.path || '';
        } catch (e) {
            return file.path || '';
        }
    },

    // Ingestão Multiformato (Clique, Drag-and-Drop, Buffer e Confirmação)
    selecionarArquivosIngestao: () => ipcRenderer.invoke('ingestao-selecionar-arquivos'),
    processarArquivosCaminhos: (caminhos) => ipcRenderer.invoke('ingestao-processar-caminhos', caminhos),
    processarArquivoBuffer: (dados) => ipcRenderer.invoke('ingestao-processar-buffer', dados),
    processarArquivoIngestao: (dados) => ipcRenderer.invoke('ingestao-processar-arquivo', dados),
    salvarProcessosIngeridos: (lista) => ipcRenderer.invoke('ingestao-salvar-processos', lista),
    confirmarIngestao: (registros) => ipcRenderer.invoke('ingestao-salvar-processos', registros),
    baixarPlanilhaModelo: () => ipcRenderer.invoke('ingestao-baixar-planilha-modelo'),

    // Config & Processos
    obterConfig: () => ipcRenderer.invoke('obter-config'),
    carregarConfig: () => ipcRenderer.invoke('obter-config'),
    salvarConfig: (cfg) => ipcRenderer.invoke('salvar-config', cfg),
    obterVersaoApp: () => ipcRenderer.invoke('obter-versao-app'),
    obterEstadoConexao: () => ipcRenderer.invoke('obter-estado-conexao'),
    reiniciarBot: () => ipcRenderer.invoke('reiniciar-bot'),
    obterStatusAutoStart: () => ipcRenderer.invoke('obter-status-autostart'),
    definirAutoStart: (ativo) => ipcRenderer.invoke('definir-autostart', ativo),
    verificarAtualizacaoManual: () => ipcRenderer.invoke('verificar-atualizacao-manual'),
    instalarAtualizacaoAgora: () => ipcRenderer.invoke('instalar-atualizacao-agora'),
    obterPausados: () => ipcRenderer.invoke('obter-pausados'),
    removerPausa: (num) => ipcRenderer.invoke('remover-pausa', num),
    despausarContato: (num) => ipcRenderer.invoke('remover-pausa', num),
    obterIgnorados: () => ipcRenderer.invoke('obter-ignorados'),
    adicionarIgnorado: (item) => ipcRenderer.invoke('adicionar-ignorado', item),
    removerIgnorado: (num) => ipcRenderer.invoke('remover-ignorado', num),

    // Transbordo Humano & IA
    notificarTransbordoHumano: (dados) => ipcRenderer.invoke('notify-transbordo-humano', dados),
    atenderClienteFila: (telefone) => ipcRenderer.invoke('remover-pausa', telefone),
    testarConexaoIA: (chave) => ipcRenderer.invoke('ia-testar-conexao', chave),

    // Listeners Específicos Legados
    aoReceberQR: (callback) => ipcRenderer.on('bot-qr', (_e, qr) => callback(qr)),
    aoMudarStatus: (callback) => ipcRenderer.on('bot-status', (_e, st) => callback(st)),
    aoReceberSubStatus: (callback) => ipcRenderer.on('bot-substatus', (_e, info) => callback(info)),
    aoReceberLog: (callback) => ipcRenderer.on('bot-log', (_e, log) => callback(log)),
    aoAtualizarPausados: (callback) => ipcRenderer.on('bot-pausados', (_e, mapa) => callback(mapa)),
    aoAtualizarProcessos: (callback) => ipcRenderer.on('bot-processos-sync', (_e, cfg) => callback(cfg)),
    aoAtualizarIgnorados: (callback) => ipcRenderer.on('bot-ignorados-sync', (_e, lista) => callback(lista)),
    aoReceberEventoUpdate: (callback) => ipcRenderer.on('bot-update-status', (_e, dados) => callback(dados)),
    aoReceberTransbordoHumano: (callback) => ipcRenderer.on('bot-transbordo-humano', (_e, dados) => callback(dados)),

    // Helper genérico para escuta de eventos
    on: (canal, callback) => {
        const fn = (_event, ...args) => callback(...args);
        ipcRenderer.on(canal, fn);
        return () => ipcRenderer.removeListener(canal, fn);
    },
    send: (canal, ...args) => ipcRenderer.send(canal, ...args),
    invoke: (canal, ...args) => ipcRenderer.invoke(canal, ...args)
};

// Expor em ambos os namespaces para evitar qualquer quebra na UI
contextBridge.exposeInMainWorld('api', apiBridge);
contextBridge.exposeInMainWorld('electronAPI', apiBridge);