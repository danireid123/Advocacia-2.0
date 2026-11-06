const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

const mockConfig = {
  versao_config: "2.4.0",
  iniciar_com_windows: true,
  fluxo: {
    raiz: {
      titulo: "Menu Principal",
      mensagem: "Olá {nome}! Seja muito bem-vindo ao nosso escritório.",
      opcoes: [
        { gatilho: "1", rotulo: "Consultar Processo", tipo: "processo", destino: "" },
        { gatilho: "2", rotulo: "Falar com Advogado", tipo: "humano", destino: "", acoes: { encaminharFilaHumana: true, motivoFila: "Advogado" } }
      ]
    },
    etapas: {
      trabalhista: {
        titulo: "Submenu: Trabalhista",
        mensagem: "Área Trabalhista",
        opcoes: [
          { gatilho: "0", rotulo: "Voltar", tipo: "submenu", destino: "raiz" }
        ]
      }
    }
  },
  processos: {
    lista: [
      { id: "proc-1", nome: "Carlos Eduardo", cpf: "123.456.789-00", numero: "5001234-88.2024.8.26.0100", resumo: "Despacho proferido.", consultasPorContato: {} }
    ],
    mensagens: {
      msg_com_atualizacao: "Novidade no processo: {resumo}",
      msg_ja_visto: "Processo segue igual.",
      msg_sem_atualizacao: "Aguardando andamento.",
      msg_nao_encontrado: "Processo não localizado.",
      msg_encerrar_conversa: "Atendimento concluído.",
      msg_chamar_advogado_pos_proc: "Advogado avisado."
    }
  },
  dossiesClientes: {},
  financeiro: {
    contratos: [],
    parcelas: [
      { id: "parc_1", cliente: "Maria Souza", whatsapp: "5511999998888", valor: 500, vencimento: "2026-11-20", status: "PENDENTE", contratoId: "cnt_1", numeroParcela: 1, totalParcelas: 1 }
    ],
    frequenciaSemanal: "2",
    diasPermitidos: ["SEGUNDA", "QUINTA"],
    chavePix: "advogado@pix.com"
  },
  contatosIgnorados: [],
  pausados: {}
};

ipcMain.handle('obter-config', async () => mockConfig);
ipcMain.handle('salvar-config', async (e, cfg) => { Object.assign(mockConfig, cfg); return { success: true }; });
ipcMain.handle('obter-pausados', async () => ({}));
ipcMain.handle('obter-ignorados', async () => ([]));
ipcMain.handle('adicionar-ignorado', async (e, item) => [item]);
ipcMain.handle('remover-ignorado', async (e, num) => []);
ipcMain.handle('obter-dossies', async () => ({ lista: [], mapa: {} }));
ipcMain.handle('obter-financeiro', async () => mockConfig.financeiro);
ipcMain.handle('salvar-config-cobranca', async (e, dados) => ({ success: true }));
ipcMain.handle('financeiro-adicionar-parcela', async (e, dados) => ({ success: true, parcelas: [] }));
ipcMain.handle('obter-estado-conexao', async () => ({ status: 'ready', qr: null, subStatus: 'Sessão ativa' }));
ipcMain.handle('simulador-enviar-mensagem', async (e, dados) => ({ resposta: 'Olá! Como posso ajudar?', pausar: false }));
ipcMain.handle('ia-testar-conexao', async (e, chave) => ({ success: true, mensagem: 'Conectado', texto: 'Olá' }));

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1366,
    height: 900,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  const rendererErrors = [];
  win.webContents.on('console-message', (event, level, message, line) => {
    if (level === 3 || message.includes('Error') || message.includes('Uncaught') || message.includes('TypeError')) {
      rendererErrors.push({ level, message, line });
      console.log(`[Renderer Console L${line}]: ${message}`);
    }
  });

  await win.loadFile('index.html');
  await new Promise(r => setTimeout(r, 1000));

  const results = await win.webContents.executeJavaScript(`
    (async () => {
      const logs = [];
      function test(desc, fn) {
        try {
          fn();
          logs.push({ desc, ok: true });
        } catch (err) {
          logs.push({ desc, ok: false, error: err.message, stack: err.stack });
        }
      }

      // Test all abas in ativarAba
      const abas = ['inicio', 'processos', 'fluxo', 'agenda', 'pausados', 'ignorados', 'simulador', 'dossie-clientes', 'financeiro', 'terminal', 'backup', 'configuracoes'];
      abas.forEach(aba => {
        test('ativarAba("' + aba + '")', () => {
          ativarAba(aba);
          const pane = document.getElementById(aba === 'dossie-clientes' ? 'detalhe-pane-dossie' : 'aba-' + aba);
          if (!pane) throw new Error('Painel para aba ' + aba + ' não existe!');
          if (pane.classList.contains('hidden')) throw new Error('Painel aba-' + aba + ' permaneceu oculto!');
        });
      });

      // Test all sidebar navigation buttons
      abas.forEach(aba => {
        if (aba === 'dossie-clientes') return; // hidden alias
        const btnId = 'nav-btn-' + aba;
        test('Click sidebar ' + btnId, () => {
          const btn = document.getElementById(btnId);
          if (!btn) throw new Error('Botão ' + btnId + ' não existe no DOM!');
          btn.click();
        });
      });

      // Test top bar buttons
      test('Top Bar btn-top-configuracoes', () => {
        const btn = document.getElementById('btn-top-configuracoes');
        if (!btn) throw new Error('btn-top-configuracoes não existe');
        btn.click();
      });

      test('Top Bar btn-top-spotlight', () => {
        const btn = document.getElementById('btn-top-spotlight');
        if (!btn) throw new Error('btn-top-spotlight não existe');
        btn.click();
        toggleSpotlight(false);
      });

      // Test Subtabs in Fluxo
      ativarAba('fluxo');
      ['mensagens', 'editor', 'acoes'].forEach(st => {
        test('alternarSubAbaFluxo("' + st + '")', () => {
          alternarSubAbaFluxo(st);
          const p = document.getElementById('painel-fluxo-' + st);
          if (!p || p.classList.contains('hidden')) throw new Error('Painel ' + st + ' não está visível');
        });
      });

      // Test Subtabs in Processos
      ativarAba('processos');
      ['processo', 'dossie'].forEach(st => {
        test('alternarDetalheProcAba("' + st + '")', () => {
          alternarDetalheProcAba(st);
          const p = document.getElementById('detalhe-pane-' + st);
          if (!p || p.classList.contains('hidden')) throw new Error('Painel ' + st + ' não está visível');
        });
      });

      // Test Modal Novo Submenu and auto switch to editor
      ativarAba('fluxo');
      test('Abrir Modal Submenu, preencher nome e criar submenu', () => {
        const btnNovoSub = document.getElementById('btn-nova-etapa');
        if (!btnNovoSub) throw new Error('btn-nova-etapa não encontrado');
        btnNovoSub.click();
        const modal = document.getElementById('modal-submenu');
        if (!modal || modal.classList.contains('hidden')) throw new Error('Modal submenu não abriu');
        const inputNome = document.getElementById('input-nome-submenu');
        inputNome.value = 'Direito Imobiliário';
        const btnConfirmar = document.getElementById('btn-confirmar-modal');
        btnConfirmar.click();
        if (!modal.classList.contains('hidden')) throw new Error('Modal submenu não fechou ao confirmar');
        const painelEd = document.getElementById('painel-fluxo-editor');
        if (!painelEd || painelEd.classList.contains('hidden')) throw new Error('Editor não ficou visível após criar submenu');
      });

      // Test Spotlight Modal
      test('toggleSpotlight open and close', () => {
        if (typeof toggleSpotlight !== 'function') throw new Error('toggleSpotlight não é função');
        toggleSpotlight(true);
        const modal = document.getElementById('modal-spotlight');
        if (!modal || modal.classList.contains('hidden')) throw new Error('Modal spotlight não abriu');
        toggleSpotlight(false);
        if (!modal.classList.contains('hidden')) throw new Error('Modal spotlight não fechou');
      });

      // Test Auto-Save and Manual Save in Fluxo & Agenda
      ativarAba('fluxo');
      test('salvarConfiguracaoCompleta manual', async () => {
        const btnSalvar = document.getElementById('btn-salvar-fluxo');
        if (!btnSalvar) throw new Error('btn-salvar-fluxo não encontrado');
        btnSalvar.click();
      });

      ativarAba('agenda');
      test('salvarAgenda UI', () => {
        const btnSalvar = document.getElementById('btn-salvar-agenda');
        if (!btnSalvar) throw new Error('btn-salvar-agenda não encontrado');
        btnSalvar.click();
      });

      // Test Financeiro add parcela & save pix
      ativarAba('financeiro');
      test('salvarConfigCobrancaUI', () => {
        salvarConfigCobrancaUI();
      });

      test('adicionarParcelaFinanceiroUI validação e registro', () => {
        adicionarParcelaFinanceiroUI();
      });

      // Test Simulator buttons
      ativarAba('simulador');
      ['btn-cenario-ola', 'btn-cenario-proc', 'btn-cenario-cpf', 'btn-cenario-adv', 'btn-cenario-solicitar-docs', 'btn-simulador-limpar'].forEach(bId => {
        test('Simulador click ' + bId, () => {
          const b = document.getElementById(bId);
          if (!b) throw new Error(bId + ' não encontrado');
          b.click();
          if (bId === 'btn-cenario-solicitar-docs') {
            const modal = document.getElementById('modal-solicitar-documentos');
            if (modal && !modal.classList.contains('hidden')) {
              window.fecharModalSolicitarDocumentos && window.fecharModalSolicitarDocumentos();
            }
          }
        });
      });

      // Test Ignorados
      ativarAba('ignorados');
      test('adicionar contato ignorado e desbloquear', () => {
        const inputNum = document.getElementById('input-ignorado-numero');
        const inputNome = document.getElementById('input-ignorado-nome');
        const btnAdd = document.getElementById('btn-add-ignorado');
        if (inputNum && btnAdd) {
          inputNum.value = '11988887777';
          if (inputNome) inputNome.value = 'Teste Bloqueio';
          btnAdd.click();
        }
      });

      // Test Backup tab and buttons
      ativarAba('backup');
      test('aba-backup visível e funcional', () => {
        const exp = document.getElementById('btn-exportar-dados');
        const imp = document.getElementById('btn-importar-dados');
        const sync = document.getElementById('btn-cloud-sync');
        if (!exp) throw new Error('btn-exportar-dados não encontrado');
        if (!imp) throw new Error('btn-importar-dados não encontrado');
        if (!sync) throw new Error('btn-cloud-sync não encontrado');
      });

      // Test Sidebar Collapse
      test('alternarSidebar expand and collapse', () => {
        if (typeof alternarSidebar !== 'function') throw new Error('alternarSidebar não é função');
        alternarSidebar(true);
        alternarSidebar(false);
      });

      // Test Theme Toggle
      test('alternarTema toggle', () => {
        const btn = document.getElementById('btn-toggle-theme');
        if (!btn) throw new Error('btn-toggle-theme não encontrado');
        btn.click();
        btn.click();
      });

      return logs;
    })()
  `);

  console.log('\n============================================================');
  console.log('🧪 RESULTADOS DOS TESTES DE TODAS AS TELAS E MENUS');
  console.log('============================================================');
  let passCount = 0;
  let failCount = 0;
  results.forEach((r, i) => {
    if (r.ok) {
      passCount++;
      console.log(`  ✅ #${i+1}: ${r.desc}`);
    } else {
      failCount++;
      console.log(`  ❌ #${i+1}: ${r.desc} -> ${r.error}`);
    }
  });

  console.log('============================================================');
  console.log(`TOTAL: ${results.length} | PASSOU: ${passCount} | FALHOU: ${failCount}`);
  console.log(`ERROS NO CONSOLE: ${rendererErrors.length}`);
  console.log('============================================================\n');

  if (failCount > 0 || rendererErrors.length > 0) {
    app.exit(1);
  } else {
    app.exit(0);
  }
});
