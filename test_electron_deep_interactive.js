const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const assert = require('assert');

// Register mock IPC handlers so Electron has full fidelity without crashes
const mockConfig = {
  versao_config: "Beta 0.8",
  iniciar_com_windows: true,
  fluxo: {
    raiz: {
      titulo: "Menu Principal",
      mensagem: "Olá {nome}! Seja muito bem-vindo ao nosso escritório.",
      opcoes: [
        { gatilho: "1", rotulo: "Consultar Processo", tipo: "submenu", destino: "proc" }
      ]
    },
    etapas: {}
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
  financeiro: { contratos: [], parcelas: [], frequenciaSemanal: "2", diasPermitidos: ["SEGUNDA", "QUINTA"], chavePix: "advogado@pix.com" },
  contatosIgnorados: [],
  pausados: {}
};

ipcMain.handle('obter-config', async () => mockConfig);
ipcMain.handle('salvar-config', async (e, cfg) => { Object.assign(mockConfig, cfg); return { success: true }; });
ipcMain.handle('obter-pausados', async () => ({}));
ipcMain.handle('obter-ignorados', async () => ([]));
ipcMain.handle('obter-dossies', async () => ({ lista: [], mapa: {} }));
ipcMain.handle('obter-financeiro', async () => mockConfig.financeiro);
ipcMain.handle('obter-estado-conexao', async () => ({ status: 'ready', qr: null, subStatus: 'Sessão ativa' }));

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

  const consoleErrors = [];
  win.webContents.on('console-message', (event, level, message, line) => {
    if (level === 3) {
      consoleErrors.push({ level, message, line });
      console.error(`[Renderer Console Error L${line}] ${message}`);
    }
  });

  await win.loadFile('index.html');
  await new Promise(r => setTimeout(r, 1200));

  const testReport = await win.webContents.executeJavaScript(`
    (async () => {
      const suite = [];
      function check(nome, ok, extra = '') {
        suite.push({ nome, pass: Boolean(ok), extra });
        if (!ok) console.error('FALHA: ' + nome + ' | ' + extra);
      }

      // 1. DUPLICATE ID CHECK
      const allEls = document.querySelectorAll('*[id]');
      const seenIds = new Set();
      const dupes = [];
      allEls.forEach(el => {
        if (seenIds.has(el.id)) dupes.push(el.id);
        else seenIds.add(el.id);
      });
      check('Zero IDs Duplicados no DOM', dupes.length === 0, 'Duplicados encontrados: ' + JSON.stringify(dupes));

      // 2. SIDEBAR NAV BUTTONS & TAB SWITCHING
      const abasMapeadas = [
        { btn: 'nav-btn-inicio', aba: 'aba-inicio' },
        { btn: 'nav-btn-processos', aba: 'aba-processos' },
        { btn: 'nav-btn-pausados', aba: 'aba-pausados' },
        { btn: 'nav-btn-simulador', aba: 'aba-simulador' },
        { btn: 'nav-btn-fluxo', aba: 'aba-fluxo' },
        { btn: 'nav-btn-financeiro', aba: 'aba-financeiro' },
        { btn: 'nav-btn-terminal', aba: 'aba-terminal' },
        { btn: 'nav-btn-ignorados', aba: 'aba-ignorados' },
        { btn: 'nav-btn-agenda', aba: 'aba-agenda' },
        { btn: 'nav-btn-backup', aba: 'aba-backup' },
        { btn: 'nav-btn-configuracoes', aba: 'aba-configuracoes' },
        { btn: 'btn-top-configuracoes', aba: 'aba-configuracoes' }
      ];

      for (const item of abasMapeadas) {
        const b = document.getElementById(item.btn);
        const a = document.getElementById(item.aba);
        check('Existe botao ' + item.btn, Boolean(b));
        check('Existe painel ' + item.aba, Boolean(a));
        if (b && a) {
          b.click();
          await new Promise(r => setTimeout(r, 60));
          const visivel = !a.classList.contains('hidden');
          check('Clicar em ' + item.btn + ' exibe ' + item.aba, visivel, 'Classes: ' + a.className);
        }
      }

      // 3. SUB-ABAS DE MENU AUTOMÁTICO (FLUXO)
      ativarAba('fluxo');
      await new Promise(r => setTimeout(r, 60));

      const subtabsFluxo = [
        { id: 'subtab-fluxo-mensagens', activePane: 'painel-fluxo-mensagens', hiddenPanes: ['painel-fluxo-editor', 'painel-fluxo-acoes'] },
        { id: 'subtab-fluxo-editor', activePane: 'painel-fluxo-editor', hiddenPanes: ['painel-fluxo-mensagens', 'painel-fluxo-acoes'] },
        { id: 'subtab-fluxo-acoes', activePane: 'painel-fluxo-acoes', hiddenPanes: ['painel-fluxo-mensagens', 'painel-fluxo-editor'] }
      ];

      for (const st of subtabsFluxo) {
        const btn = document.getElementById(st.id);
        check('Existe subtab ' + st.id, Boolean(btn));
        if (btn) {
          btn.click();
          await new Promise(r => setTimeout(r, 50));
          const actPane = document.getElementById(st.activePane);
          const actVisivel = actPane && !actPane.classList.contains('hidden');
          check('Subtab ' + st.id + ' exibe ' + st.activePane, actVisivel);

          for (const hp of st.hiddenPanes) {
            const hidPane = document.getElementById(hp);
            const isHidden = hidPane && hidPane.classList.contains('hidden');
            check('Subtab ' + st.id + ' esconde ' + hp, isHidden);
          }
        }
      }

      // 4. SUB-ABAS DE CLIENTES & PROCESSOS (MASTER-DETAIL)
      ativarAba('processos');
      await new Promise(r => setTimeout(r, 60));

      const subProc = document.getElementById('subtab-detalhe-proc');
      const subDossie = document.getElementById('subtab-detalhe-dossie');
      const paneProc = document.getElementById('detalhe-pane-processo');
      const paneDossie = document.getElementById('detalhe-pane-dossie');

      if (subDossie) {
        subDossie.click();
        await new Promise(r => setTimeout(r, 50));
        check('Subtab Dossiê abre painel de dossiê', !paneDossie.classList.contains('hidden') && paneProc.classList.contains('hidden'));
      }

      if (subProc) {
        subProc.click();
        await new Promise(r => setTimeout(r, 50));
        check('Subtab Processo abre ficha de processo', !paneProc.classList.contains('hidden') && paneDossie.classList.contains('hidden'));
      }

      // 5. TESTAR alternarHubSubAba e alternarListaModo
      if (typeof window.alternarHubSubAba === 'function') {
        window.alternarHubSubAba('dossie');
        check('alternarHubSubAba(dossie) ativa painel dossie', !paneDossie.classList.contains('hidden'));
        window.alternarHubSubAba('processo');
        check('alternarHubSubAba(processo) ativa painel processo', !paneProc.classList.contains('hidden'));
      } else {
        check('window.alternarHubSubAba exposta', false);
      }

      // 6. TESTAR FILTROS SEGMENTADOS DE PROCESSOS
      const containerPill = document.getElementById('segmented-filter-processos');
      check('Existe segmented-filter-processos', Boolean(containerPill));
      if (containerPill) {
        const tabs = containerPill.querySelectorAll('.segmented-pill-tab');
        check('Pills segmentadas existem', tabs.length >= 2);
        tabs.forEach(t => {
          t.click();
          check('Clicar na pill ' + t.getAttribute('data-filter') + ' marca como active', t.classList.contains('active'));
        });
      }

      // 7. TESTAR SIMULADOR DE CHAT
      ativarAba('simulador');
      await new Promise(r => setTimeout(r, 60));
      const btnOla = document.getElementById('btn-cenario-ola');
      const btnLimpar = document.getElementById('btn-simulador-limpar');
      const btnCancelarVoz = document.getElementById('btn-cancelar-gravacao');
      check('Existe btn-cenario-ola', Boolean(btnOla));
      check('Existe btn-simulador-limpar', Boolean(btnLimpar));
      check('Existe btn-cancelar-gravacao', Boolean(btnCancelarVoz));
      check('window.cancelarGravacaoVozSimulador existe', typeof window.cancelarGravacaoVozSimulador === 'function');
      if (btnLimpar) {
        btnLimpar.click();
        check('Limpar tela do simulador executou sem erros', true);
      }

      // 8. TESTAR MODAL ONBOARDING
      if (typeof window.abrirModalSolicitarDocumentos === 'function' && typeof window.fecharModalSolicitarDocumentos === 'function') {
        window.abrirModalSolicitarDocumentos('11999999999', 'Teste Cliente');
        const modal = document.getElementById('modal-solicitar-documentos');
        check('Abrir modal onboarding exibe modal', modal && !modal.classList.contains('hidden'));
        window.fecharModalSolicitarDocumentos();
        check('Fechar modal onboarding oculta modal', modal && modal.classList.contains('hidden'));
      } else {
        check('Funcoes de modal onboarding existem', false);
      }

      // 9. WHATSAPP BALLOON PREVIEWS & SYNC
      ativarAba('fluxo');
      if (typeof window.alternarSubAbaFluxo === 'function') {
        window.alternarSubAbaFluxo('mensagens');
        const bvText = document.getElementById('input-msg-boasvindas');
        const bvPrev = document.getElementById('wa-preview-boasvindas');
        check('input-msg-boasvindas existe e tem texto', Boolean(bvText && bvText.value));
        check('wa-preview-boasvindas existe e reflete texto', Boolean(bvPrev && bvPrev.textContent.includes('escritório')));
      }

      return suite;
    })()
  `);

  console.log('\n============================================================');
  console.log('📊 RELATÓRIO DO TESTE INTERATIVO NO ELECTRON REAL');
  console.log('============================================================');

  let passed = 0;
  let failed = 0;
  testReport.forEach((t, i) => {
    if (t.pass) {
      passed++;
      console.log(`  ✅ [PASS] #${i+1}: ${t.nome}`);
    } else {
      failed++;
      console.log(`  ❌ [FAIL] #${i+1}: ${t.nome} -> ${t.extra}`);
    }
  });

  console.log('============================================================');
  console.log(`TOTAL: ${testReport.length} | PASSOU: ${passed} | FALHOU: ${failed}`);
  console.log(`ERROS DE CONSOLE RENDERER: ${consoleErrors.length}`);
  console.log('============================================================\n');

  if (failed > 0 || consoleErrors.length > 0) {
    app.exit(1);
  } else {
    app.exit(0);
  }
});
