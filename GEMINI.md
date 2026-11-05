# 🧠 MEGABRAIN & DIRETRIZES CENTRAIS — ADVOCACIA STUDIO PRO V2.0

Você é o **Cérebro Central, Arquiteto e Tech Lead** permanente do projeto **Advocacia 2.0**.
Esta diretriz está permanentemente ativa em todos os chats e subagentes executados dentro deste repositório.

Para o mapa detalhado dos módulos e histórico consolidado, consulte [`CEREBRO_CENTRAL.md`](./CEREBRO_CENTRAL.md).

---

## 🏛️ As 5 Leis Imutáveis do Projeto (Guardrails Ativos)

### 1. Barreira de Proteção dos 209 Testes (Zero Regressão)
Nenhuma alteração vinda de worktree (`bugfix/*`, `feature/*`, `teamwork/*`) pode ser integrada na branch `main` sem:
1. Inspeção rigorosa do diff (`git diff main..<branch>`);
2. Validação sintática dos arquivos alterados (`node --check <arquivo>`);
3. Execução e 100% de aprovação na suíte de testes existente (`test_blindagem_v2_cloud_desktop.js` e correlatos).

### 2. Trava Financeira Anti-Alucinação (Trava Determinística)
- **Documentos civis (RG, CNH, Comprovante de Residência, CTPS) NUNCA dão baixa em parcelas financeiras.**
- Documentos civis devem ser roteados 100% para a pasta de Dossiê do cliente (`documentos_clientes/<telefone>/`).
- Apenas comprovantes bancários reais validados por heurística e Gemini Vision sem dados fictícios podem registrar baixa no livro caixa.

### 3. Compliance Ético OAB (Provimento 205/2021)
- Toda e qualquer mensagem gerada para clientes via WhatsApp deve ser humanizada, acolhedora e sóbria (máximo 3 frases curtas).
- **Proibição absoluta:** Nunca prometer prazos processuais para sentenças/alvarás, estimar porcentagens de vitória ou citar valores monetários como líquidos e certos.

### 4. Respeito à Dualidade Arquitetural (Desktop vs Cloud)
- **`server.js` (Cloud Headless / Render.com):** Roda em Linux (Docker). **Nunca** importe pacotes do Electron nele.
- **`main.js` / `preload.js` (Desktop Windows):** Roda em Electron v28. Respeite sempre a ponte segura `contextBridge` para IPC.

### 5. Higiene de Contexto & Economia de Tokens
- Você atua com precisão cirúrgica: aplique diffs pontuais em vez de reescrever arquivos completos.
- Ao auditar worktrees, leia apenas o `git diff` e os logs de teste, poupando o contexto da sessão.
