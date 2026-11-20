# 🔬 Relatório da Rodada 2 — 5 Novos Clientes (Objetivos Específicos) & Auditoria do Designer Rígido
**Advocacia Studio Pro v2.0 (Build `85c3329`)**  
**Data:** 20 de Novembro de 2026 | **Histórico Preservado:** O relatório anterior permanece intacto em `RELATORIO_BATERIA_15_PERSONAS_E_DESIGN.md`.

> [!NOTE]
> **Critério desta Rodada:** Auditoria estritamente baseada em **inspeção real do código-fonte** (`index.html`, `main.js`, `server.js`, `src/`), com foco em casos de borda, uso corporativo avançado e revisão visual implacável de CSS/Design.

---

## 📊 1. Resumo Executivo da Rodada 2

| Indicador | Resultado | Diagnóstico Técnico |
| :--- | :---: | :--- |
| **Aprovação dos 5 Novos Clientes (< 120 min)** | **60% (3 Aprovados / 2 Reembolsos)** | Cenários avançados (multi-processo por CNPJ e restauração de backup em nova máquina) revelaram bugs reais |
| **Nota Média — 5 Novos Clientes** | **6,96 / 10** | Faixa entre `5,2` (reembolso) e `8,8` (aprovado) |
| **Nota do Designer Rígido (Visual QA)** | **5,8 / 10** | **Reprovado no Tema Claro:** 37 elementos críticos ficam invisíveis (`#f7f8f8` em fundo `#fbf9f8`) + 172 `!important` + 7 tons de dourado misturados |

---

## 👥 2. Avaliação Individual — 5 Novos Clientes (Objetivos Específicos)

| # | Cliente / Área | Objetivo Testado | Tempo | Nota | Decisão | Evidência Real no Código |
| :---: | :--- | :--- | :---: | :---: | :---: | :--- |
| **C#01** | **Dr. Henrique Saldanha**<br>*(Tributário Corporativo)* | Cadastrar sócios, juízes e contadores em **Contatos Ignorados** (local + nuvem 24/7) | 42 min | **6,8** | ✅ **Aprovado com ressalvas** | No app local (`main.js`), funciona bem para texto, **mas falha em 2 pontos:**<br>1. Em `main.js:949-982`, áudios de contatos ignorados são baixados e enviados para a IA Gemini **antes** de checar `isContactIgnored()` (gasta cota à toa).<br>2. Em `server.js:183-192` (Nuvem 24/7), `itemDig === digitos` exige match exato: se salvar sem `55` ou sem 9º dígito, o robô **responde o contato ignorado**. |
| **C#02** | **Dra. Patrícia Alvim**<br>*(Trabalhista Patronal / Empresas)* | Cadastrar **4 processos da mesma empresa (mesmo CNPJ/CPF)** e consultar pelo WhatsApp | 55 min | **5,2** | ❌ **REEMBOLSO** | Em `main.js:buscarProcessoPorNumero`, a busca usa **`lista.find(...)`** — retorna **apenas o 1º processo encontrado** e ignora silenciosamente os outros 3 processos da mesma empresa/cliente. Para escritórios empresariais ou clientes com mais de uma ação, é bloqueante. |
| **C#03** | **Dr. Eduardo Nóbrega**<br>*(Cível / Cobrança em Escala)* | Configurar **Régua PIX**, cadastrar parcelas, dar baixa manual e conferir métricas financeiras | 34 min | **8,5** | ✅ **Aprovado** | `src/financeiro/gestaoFinanceira.js` executou com solidez todas as operações (`adicionarParcela`, `darBaixaParcela`, `excluirContratoFinanceiro`, `dispararReguaCobranca`, `obterMetricasFinanceiras`). Única ressalva: falta cálculo automático de multa/juros por atraso. |
| **C#04** | **Dra. Simone Bastos**<br>*(Previdenciário — Clientes Idosos)* | Simular clientes idosos que **só mandam áudios** (sem digitar números de menu) | 38 min | **8,1** | ✅ **Aprovado** | No WhatsApp local (`main.js:949-977`), o áudio é transcrito via Gemini Multimodal e, por cair na regra de relato livre, vai para a Fila com áudio + resumo Copilot. **Ressalvas:** no modo Nuvem (`server.js`), não há transcrição de áudio; no Simulador, o envio de áudio bypassa a checagem de horário de almoço. |
| **C#05** | **Dr. Lucas Peixoto**<br>*(Autônomo — Nuvem + Backup + Tema Claro)* | Exportar **Backup `.json`**, restaurar em outra máquina e trabalhar no **Modo Claro** | 49 min | **6,2** | ❌ **REEMBOLSO** | **2 falhas graves encontradas:**<br>1. **Restauração incompleta (`index.html:9715` + `main.js:1820-1828`):** Ao restaurar backup, `salvar-config` sobrescreve `financeiro`, `configuracaoCobranca`, `onboardingSessoes` e `metricasReais` com os dados antigos/vazios da memória — **o Financeiro não é restaurado**!<br>2. **Modo Claro quebrado:** Ao ativar o tema claro, o título da Home e os números dos cards ficaram **invisíveis** (branco sobre creme). |

---

## 🎯 3. Auditoria Implacável do Designer Rígido (Visual QA Critic)

**Avaliador:** Staff Design Systems & Visual QA Critic  
**Veredito:** **`5,8 / 10` — Requer Correção Estrutural Antes de Escalar**

> *"O conceito visual no Dark Mode é excelente — a direção de arte Grafite + Ouro Champagne tem personalidade rara no mercado jurídico. Porém, sob a lupa técnica de um engenheiro de Design Systems, o CSS atual acumula dívida técnica severa que **quebrou completamente o Modo Claro** na última atualização."*

### 🚨 Erro Crítico #1 (Bloqueante): Modo Claro Invisível em 37 Pontos da Interface
Na migração para o Design System v2.1, foram inseridas **90 ocorrências de classes arbitrárias escuras** no HTML (`text-[#f7f8f8]`, `text-[#f3dc8a]`, `bg-[#0b0c0e]`, `bg-[#0f1012]`, `border-[#23252a]`), mas o bloco `body.theme-light` só possui override para `text-[#f3e5ab]` e `text-[#e5c158]`.
* **Impacto real no Modo Claro (`#fbf9f8`):**
  * `index.html:2081` (`#home-welcome-title`), `2121` (`#home-card-processos`), `2140` (`#metric-fila-humana-home`), `2162` (`Robô Ativo`), `2181` (`#home-card-expediente`), `2197` (`Configure seu escritório em 4 passos`) e `2210` (`Conectar WhatsApp`) exibem **texto branco `#f7f8f8` em fundo creme `#fbf9f8` (contraste 1.02:1 — ilegível)**.
  * Caixas com `bg-[#0b0c0e]` e `bg-[#0f1012]` aparecem como **blocos pretos recortados** no meio da tela clara.

### ⚠️ Erro Grave #2: Fragmentação de Paleta (7 Tons de Dourado/Âmbar Misturados)
O sistema promete "Ouro Champagne unificado", mas o `index.html` mistura **7 códigos diferentes de amarelo/dourado** sem critério semântico:
* `amber-400` (**215x**) e `amber-500` (**210x**)
* `#d4af37` (**72x**), `#e5c158` (**43x**), `#f3dc8a` (**17x**), `#b8860b` (**7x**), `#fbbf24` (**2x**)
* **Diagnóstico:** Lado a lado na mesma tela, botões, bordas e ícones ficam com "amarelos brigando entre si" (ora laranja-âmbar do Tailwind, ora ouro-envelhecido, ora amarelo-manteiga).

### ⚠️ Erro Grave #3: Guerra de Especificidade (`172 !important` no CSS)
O `<style>` tem **828 linhas** contendo **172 declarações `!important`** e **78 seletores de remendo `body.theme-light`** tentando sobrescrever **233 classes `bg-zinc-900/950`** e **52 `text-white`** espalhadas no HTML.
* **Diagnóstico:** Qualquer nova tela ou componente adicionado (como ocorreu com os novos tokens `#f7f8f8` e `#0b0c0e`) nasce automaticamente quebrado no Light Mode.
* **Solução correta:** Migrar fundos e textos para classes semânticas baseadas em variáveis CSS (`var(--bg-surface)`, `var(--text-main)`, `var(--border-color)`) e adicionar overrides completos para as classes arbitrárias existentes enquanto a migração ocorre.

### ⚠️ Erro Médio #4: Modais sem Tratamento para Tema Claro
Não existe nenhuma regra `body.theme-light` dedicada para os modais (`.modal` / overlays de QR Code, Dossiê e Importação), fazendo com que modais abram escuros ou com contraste invertido quando o usuário está no tema claro.

---

## 📋 4. Backlog Priorizado (Consolidando Rodada 1 + Rodada 2)

Para seguirmos na próxima etapa de correções, este é o ranking exato por impacto real:

1. **[P0 — Crítico / Design]** Corrigir imediatamente o **Modo Claro** (adicionar overrides/tokens para `text-[#f7f8f8]`, `text-[#f3dc8a]`, `text-[#8a8f98]`, `text-[#62666d]`, `bg-[#0b0c0e]`, `bg-[#0f1012]`, `bg-[#141518]`, `border-[#23252a]` e modais).
2. **[P0 — Crítico / Funcional]** Corrigir **Restauração de Backup** (`index.html:9715` / `main.js:1820`) criando um canal IPC dedicado `restaurar-backup-completo` que restaura também `financeiro`, `configuracaoCobranca`, `onboardingSessoes` e `mapaNomes`.
3. **[P0 — Crítico / Funcional]** Suportar **Múltiplos Processos por CPF/CNPJ** em `buscarProcessoPorNumero` (`main.js` e `server.js`) retornando todos os processos vinculados àquele documento (ou menu numerado de escolha quando houver mais de 1).
4. **[P1 — Alto / Custo & Privacidade]** Corrigir **Contatos Ignorados**:
   * Mover `isContactIgnored` para **antes** do download/transcrição de áudio no `main.js:949`.
   * Normalizar DDI `55` e 9º dígito no `isContactIgnored` do `server.js:183`.
5. **[P2 — Médio / Design Polish]** Unificar os tons de dourado (reduzir de 7 para 2 tokens oficiais: `--gold-primary` e `--gold-soft`) e aplicar os micro-polimentos da Rodada 1 (contraste terciário `#7c828d` no Dark Mode e `pointer-events: none` nos tooltips da sidebar).
