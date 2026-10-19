# Project: Advocacia 2.0 - Blindagem Sandbox Simulator, Templates Customizáveis IA e Anti-Alucinação PIX

## Architecture
- **Camada de Apresentação (Renderer / DOM):**
  - Sandbox do Simulador WhatsApp (`#simulador-mensagens-box`, `#simulador-tel`, `#simulador-nome-contato`).
  - Modal de Solicitação de Documentos (`#modal-solicitar-documentos`) com editor de template (`#onboarding-modal-mensagem`), seletor de preset e botão `✨ Melhorar com IA`.
  - Configuração permanente de template padrão na aba Dossiê (`#aba-dossie-clientes`) e atalhos de disparo em cards de contato (`#aba-processos`, `#aba-dossie-clientes`).
- **Camada de Comunicação & Orquestração (IPC / Main Process):**
  - Alinhamento de canal IPC: `main.js:2613` e `preload.js:87` unificados em `simulador-resposta-advogado`.
  - Handler IPC `iniciar-onboarding`: aceita `mensagemPersonalizada` e persiste na sessão.
  - Handler IPC `ia-melhorar-mensagem`: integrado via `window.api.melhorarMensagemIA` e `window.executarMelhoriaMensagemGenerica`.
- **Camada de Negócio & Onboarding:**
  - `src/onboarding/onboardingController.js`: suporta modelo customizado de `config.modeloMensagemSolicitacaoDocs`, interpolando `{nome}`, `{preset}`, `{documentos}`.
  - `migracao.js`: persistência e integridade em `criarConfigPadraoV2` e `migrarConfigV1ParaV2`.
- **Camada Financeira & Visão Computacional Anti-Alucinação:**
  - `src/financeiro/validadorComprovantePix.js`: eliminação absoluta de fallback fictício (`valorPago = esp > 0 ? esp : 150`, banco fictício e id aleatório); detecção de documentos civis (RG, CNH, Residência, CTPS) por buffer/heurística; diretivas estritas de exclusão no prompt Gemini Vision; trava determinística em `validarDivergenciaPix`.
  - `src/financeiro/gestaoFinanceira.js`: suporte polimórfico na assinatura de `processarComprovanteRecebido`, isolamento estrito de telefone de clientes, bloqueio absoluto de baixa de parcela se documento civil.
  - Roteamento segregado: envio direto de documentos civis para Dossiê (`processarMidiaOnboarding` / `config.dossiesClientes`), sem escrita no financeiro.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| F1 | Correção Canal IPC Simulador | Alinhar evento em `main.js:2613` para `simulador-resposta-advogado` | M1 | ORIGINAL_REQUEST § R1 |
| F2 | Exibição Imediata no Sandbox | Injeção imediata do balão em `#simulador-mensagens-box` sem reload | M1 | ORIGINAL_REQUEST § R1 |
| F3 | Sincronização de Contato & Sessão | Atualizar `#simulador-tel`, `#simulador-nome-contato` e registrar sessão | M1 | ORIGINAL_REQUEST § R1 |
| F4 | Fallback Web/Headless no Disparo | Garantir injeção no simulador mesmo em ambiente sem IPC/Electron | M1 | ORIGINAL_REQUEST § R1 |
| F5 | Atalhos em Cards de Contato | Botão de solicitar docs em Dossiê, Processos e barra rápida do simulador | M1 | ORIGINAL_REQUEST § R1 |
| F6 | Modelo Customizável em config.json | Adicionar `modeloMensagemSolicitacaoDocs` com suporte a tags `{nome}`, etc. | M2 | ORIGINAL_REQUEST § R2 |
| F7 | Editor de Mensagem no Modal | Textarea `#onboarding-modal-mensagem` com sincronização dinâmica ao preset | M2 | ORIGINAL_REQUEST § R2 |
| F8 | Integração "✨ Melhorar com IA" | Conectar botão do modal a `window.executarMelhoriaMensagemGenerica` | M2 | ORIGINAL_REQUEST § R2 |
| F9 | Card de Configuração Permanente | Editor do modelo padrão na aba Dossiê com salvamento em disco | M2 | ORIGINAL_REQUEST § R2 |
| F10 | Interpolação no Onboarding Controller | `iniciarSessaoOnboarding` usar template customizado ou mensagem passada | M2 | ORIGINAL_REQUEST § R2 |
| F11 | Eliminação de Fallback Fictício | Remover geração de PIX fake em `extrairDadosPixLocal` (`validadorComprovantePix.js`) | M3 | ORIGINAL_REQUEST § R3 |
| F12 | Trava Determinística Anti-Alucinação | `validarDivergenciaPix` exigir id transação real, banco e zero doc civil | M3 | ORIGINAL_REQUEST § R3 |
| F13 | Hardening Prompt Gemini Vision | Prompt com diretiva negativa estrita para faturas e documentos pessoais | M3 | ORIGINAL_REQUEST § R3 |
| F14 | Blindagem de Baixa Financeira | `gestaoFinanceira.js` impedir baixa de parcela para documento civil | M3 | ORIGINAL_REQUEST § R3 |
| F15 | Roteamento Automático para Dossiê | Documentos civis roteados exclusivamente para Dossiê do cliente | M3 | ORIGINAL_REQUEST § R3 |
| F16 | Suíte de Estresse Anti-Alucinação | Nova suíte `test_stress_anti_alucinacao_pix_dossie.js` com matriz 8 cenários | M4 | ORIGINAL_REQUEST § Verif |
| F17 | Verificação Regressiva 100% | Garantir 100% de sucesso em todas as suítes existentes e novas | M5 | ORIGINAL_REQUEST § Verif |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | R1: Simulador Sandbox & Entrega de Mensagens | F1, F2, F3, F4, F5 | none | DONE |
| M2 | R2: Template Customizável & IA Gemini | F6, F7, F8, F9, F10 | none | DONE |
| M3 | R3: Blindagem Anti-Alucinação PIX & Dossiê | F11, F12, F13, F14, F15 | none | DONE |
| M4 | E2E Testing Track: Suíte de Estresse & Testes Opaque-Box | F16 | none | DONE |
| M5 | Final Milestone: Integração E2E 100% & Auditoria Forense | F17 | M1, M2, M3, M4 | DONE |

## Interface Contracts
### Renderer ↔ Main (IPC Onboarding & Simulador)
- Canal de Envio: `iniciar-onboarding`
  - Payload: `{ clienteTelefone: string, clienteNome: string, preset: string, mensagemPersonalizada?: string, enviarWhatsApp: boolean }`
  - Resposta: `{ sucesso: boolean, mensagemId?: string, erro?: string }`
- Canal de Evento Simulador: `simulador-resposta-advogado`
  - Payload: `{ telefone: string, chave: string, texto: string, tipo: string, timestamp: number }`

### Onboarding Controller ↔ Config
- Função: `iniciarSessaoOnboarding(clienteTelefone, clienteNome, presetTipo, config, mensagemCustomizada)`
  - Retorno: `{ sucesso: boolean, sessao: object, mensagemEnviada: string }`
  - Se `mensagemCustomizada` estiver presente, utiliza-a; caso contrário, busca `config.modeloMensagemSolicitacaoDocs` interpolando tags; se ausente, usa preset default.

### Validador PIX ↔ Gestão Financeira
- Função: `validarComprovantePix(imagemBuffer, valorEsperado, clienteNome, config)`
  - Retorno: `{ dadosLidos: { ehComprovantePix: boolean, ehDocumentoCivil: boolean, tipoDocumentoCivil?: string, valorPago: number, idTransacao: string, bancoOrigem: string }, comprovanteValido: boolean, divergencia: string | null }`
- Regra de Negócio: Se `ehComprovantePix === false` ou `ehDocumentoCivil === true`, `comprovanteValido` é OBRIGATORIAMENTE `false`.

### Roteamento Dossiê ↔ Financeiro
- Se `ehDocumentoCivil === true`:
  - `darBaixaParcela` NUNCA é invocado.
  - O arquivo é persistido em `config.dossiesClientes[telefone].documentos`.
  - Retorno ao usuário informa recebimento de documento civil para a pasta processual.

## Code Layout
- `src/onboarding/onboardingController.js` (Lógica de onboarding, templates e sessões)
- `src/financeiro/validadorComprovantePix.js` (Visão computacional, IA Gemini Vision e validação determinística)
- `src/financeiro/gestaoFinanceira.js` (Gestão de cobrança, conciliação e baixa de parcelas)
- `src/ia/tradutorJuridico.js` (Aprimoramento de texto com IA Gemini e fallback offline)
- `main.js` (Processo Electron principal, IPC handlers e despacho de eventos)
- `preload.js` (Context bridge seguro do Electron)
- `index.html` (Interface do usuário, modais, sandbox do simulador, listeners)
- `migracao.js` (Esquema de configuração padrão e migração de versões)
- `config.json` (Arquivo de configuração persistente)
- `test_stress_anti_alucinacao_pix_dossie.js` (Nova suíte E2E de estresse e blindagem)
- Testes existentes: `test_onboarding_e_cobranca_multimodal.js`, `test_dashboard_financeiro_e_simulador.js`, `test_varredura_e_simulador.js`, `test_blindagem_v2_cloud_desktop.js`, `test_melhorar_mensagem_ia.js`, `test_deduplicacao_e_dossie.js`
