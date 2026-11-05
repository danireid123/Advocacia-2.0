# 🧠 CÉREBRO CENTRAL — ADVOCACIA STUDIO PRO V2.0

Este documento serve como diretriz mestra e ponto de ancoragem para agentes, subagentes e worktrees que operam no projeto **Advocacia 2.0**.

---

## 1. Identidade & Governança
- **Branch Principal:** `main` (rastreada com `origin/main` no GitHub `danireid123/Advocacia-2.0`).
- **Arquiteto Integrador:** O chat principal do Antigravity atua como **Cérebro Central**.
- **Regra de Integração:** Toda worktree (`bugfix/*`, `feature/*`, `teamwork/*`) deve ser submetida ao Cérebro Central para:
  1. Auditoria cirúrgica de diffs (`git diff main..<branch>`);
  2. Validação sintática (`node --check <arquivos>`);
  3. Execução das suítes de teste de regressão (209 testes existentes);
  4. Merge seguro e sem quebras visuais ou lógicas.

---

## 2. Mapa Rápido dos Módulos
- `server.js`: Servidor Headless Cloud 24/7 (Node.js nativo, endpoints REST `/status`, `/health`, `/qr`, `/qr-status`, `/pausados`, keep-alive anti-sleep para Render.com).
- `main.js`: Processo principal Electron (Desktop Windows, IPC, automações, sandbox WhatsApp).
- `preload.js`: Context bridge seguro IPC Renderer $\leftrightarrow$ Main.
- `index.html`: UI Dashboard em Tailwind CSS, modais de onboarding, simulador de WhatsApp, fila humana.
- `src/ia/tradutorJuridico.js`: Motor cognitivo Gemini REST, fallback heurístico offline, cache MD5, guardrails OAB (Provimento 205/2021), transcrição de áudios PTT, detector de urgência (4 níveis) e "✨ Melhorar com IA".
- `src/financeiro/validadorComprovantePix.js` & `gestaoFinanceira.js`: Anti-alucinação determinística, bloqueio de dados fictícios, roteamento de documentos civis (RG/CNH) para Dossiê com impedimento de baixa financeira.
- `src/onboarding/onboardingController.js`: Fluxo de solicitação de documentos, templates dinâmicos `{nome}`, `{preset}`, `{documentos}`.
- `src/ingestao/motorIngestao.js`: Ingestão XLSX, PDF, DOCX e TXT com sanitização de CPF e CNJ.
- `migracao.js`: Migração atômica de esquemas legados v1 $\rightarrow$ v2 com backup automático.
- `documentos_clientes/`: Armazenamento de documentos civis e peças dos clientes por telefone.

---

## 3. Roadmap Futuro Ativo
1. **Cobrança Ativa & PIX Dinâmico com QR Code:** Gateways bancários (Asaas, Efí, etc.), QR Code copia-e-cola gerado direto no chat e confirmação automática de baixa.
2. **Kanban Visual de Casos:** Pipeline de atendimento e fases processuais no estilo CRM.
3. **Lembretes Ativos & Confirmação de Presença:** Disparo 48h/24h antes de audiências com confirmação interativa.
4. **Painel Multi-Operador em Nuvem (RBAC & WebSockets):** Múltiplos advogados e estagiários no mesmo WhatsApp com níveis de permissão.
5. **Sincronização Desktop $\leftrightarrow$ Nuvem:** Comunicação bidirecional e reconciliação entre Electron e Headless Cloud.
