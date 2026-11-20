---
name: Advocacia Studio Pro — Executive Legal Design System
version: 2.1
references:
  - DESIGN_COHERE.md (Enterprise AI Sobriety & Editorial Restraint)
  - DESIGN_LINEAR.md (Tactile 1px Hairlines, Density Control & Semantic Precision)
  - DESIGN_ORACLE.md (Warm Paper Light Mode & Documentary Serif Authority)
---

# 🏛️ DESIGN.md — Advocacia Studio Pro (Executive Suite)

Sistema de design consolidado para o **Advocacia Studio Pro**, unindo o DNA jurídico clássico do escritório (**Grafite Profundo + Ouro Champagne**) com os melhores padrões modernos de **Cohere**, **Linear** e **Oracle**.

---

## 1. Regras e Travas Inegociáveis

1. **Barra Lateral Esquerda (`#main-sidebar`) — Trava Visual Absoluta:**
   - O visual da barra lateral esquerda (`#icon-rail-nav-styles` e `#main-sidebar`) permanece **estritamente preservado** em cores, fundo, texturas e acabamento.
2. **DNA Visual Jurídico Preservado:**
   - **Tipografia Oficial:** `Playfair Display` (títulos institucionais e cabeçalhos jurídicos) + `Plus Jakarta Sans` (interface operacional, chats e dados técnicos).
   - **Paleta Nobre:** Grafite profundo (`#09090b` / `#0f1011` / `#121215`) + Ouro Champagne (`#d4af37` / `#b8860b`). Sem estética genérica azul/roxo SaaS.
3. **Integridade de IDs e IPC:**
   - Todos os IDs HTML (`#simulador-mensagens-box`, `#lista-pausados`, `#proc-resumo`, `#dossie-preview-cpc`, botões e inputs) são preservados para manter 100% de compatibilidade com `main.js`, `preload.js` e módulos em `src/`.

---

## 2. Os 3 Pilares de Referência Integrados

### 🔹 Pilar 1: Cohere (`DESIGN_COHERE.md`) — Áreas de IA Corporativa & Sobriedade OAB
- **Superfícies de IA Planas e Controladas (`.ai-console-panel`):**
  - Transcrição de áudios do WhatsApp, Resumo Executivo (IA), Cronologia dos Fatos e Respostas Rápidas em 1 clique utilizam superfícies planas (`#0f1011` no escuro; `#f5f4f2` no claro) com bordas finas (`1px`), sem gradientes decorativos ou excessos visuais.
- **Hierarquia Editorial e Ética (Provimento 205/2021 OAB):**
  - Micro-labels discretos em caixa alta com tracking limpo (`letter-spacing: 0.06em`), espaçamento confortável (`line-height: 1.6`) para leitura jurídica sem fadiga.
- **Botão de Aprimoramento IA (`.btn-ai-enhance`):**
  - Ações como **"✨ Melhorar com IA"**, **"✨ Humanizar com IA"** e **"✨ Sugerir Resposta com IA"** usam acabamento sóbrio em champanhe translúcido com borda 1px precisa e micro-elevação tátil.

### 🔹 Pilar 2: Linear (`DESIGN_LINEAR.md`) — Precisão Tátil, Bordas 1px e Urgência Escaneável
- **Bordas Hairline de 1px & Profundidade:**
  - Cards (`.exec-card`) com borda `1px solid rgba(255, 255, 255, 0.08)`, highlight superior interno (`inset 0 1px 0 rgba(255, 255, 255, 0.05)`) e sombras em camadas que definem hierarquia sem poluição.
- **Badges de Urgência Processual (`.urgency-badge`):**
  - Escaneabilidade instantânea na Fila de Atendimento com cores semânticas contidas, borda 1px e contraste nítido:
    - **`CRÍTICA`** (Peso 4): Vermelho rubi contido (`rose-500/15`, borda `rose-500/40`, texto `rose-300` / `#991b1b` no claro).
    - **`ALTA`** (Peso 3): Âmbar ouro (`amber-500/15`, borda `amber-500/40`, texto `amber-300` / `#92400e` no claro).
    - **`MÉDIA`** (Peso 2): Champanhe sóbrio (`amber-500/10`, borda `amber-500/30`, texto `amber-200` / `#854d0e` no claro).
    - **`BAIXA`** (Peso 1): Neutro grafite (`zinc-800/80`, borda `zinc-700/80`, texto `zinc-300` / `#524c46` no claro).
- **Ritmo de Espaçamento (Grid 4px / 8px):**
  - Paddings, gaps e raios concêntricos padronizados (`8px`, `12px`, `16px`, `24px`), reduzindo fadiga em telas de alta densidade.

### 🔹 Pilar 3: Oracle (`DESIGN_ORACLE.md`) — Modo Claro em Papel Timbrado Nobre
- **Escala Neutra Quente (`body.theme-light`):**
  - Eliminação de brancos estourados (`#ffffff`) e cinzas azulados frios (`#e2e8f0` / `#f1f5f9`).
  - **Fundo Base (`canvas-warm`):** `#f1efed`
  - **Superfícies de Leitura e Cards (`canvas-soft`):** `#fbf9f8`
  - **Caixas Internas, Inputs e Consoles IA (`canvas-tint`):** `#f5f4f2`
  - **Bordas Hairline (`hairline` / `field-border`):** `#e4e1dd` e `#d4cfca`
  - **Tinta Tipográfica (`ink` / `ink-deep`):** `#161513` e `#211e1c` (secundário `#524c46`, sutil `#78716c`)
  - **Acento Dourado Editorial:** `#b8860b` com realce suave `#f7e0a1`
- **Áreas Documentais (`.editorial-paper-pane`):**
  - Ficha do Processo e Dossiê Civil (Art. 319 CPC) oferecem conforto visual semelhante a papel timbrado de alta gramatura no tema claro.

---

## 3. Tokens CSS Oficiais

| Token | Dark Mode (Linear + Grafite) | Light Mode (Oracle Warm Paper) |
| :--- | :--- | :--- |
| `--bg-deep` | `#09090b` | `#f1efed` |
| `--bg-surface` | `#121215` | `#fbf9f8` |
| `--bg-elevated` | `#18181b` | `#f5f4f2` |
| `--card-bg` | `rgba(18, 18, 22, 0.82)` | `#fbf9f8` |
| `--border-color` | `rgba(255, 255, 255, 0.08)` | `#e4e1dd` |
| `--input-bg` | `rgba(9, 9, 11, 0.88)` | `#f5f4f2` |
| `--inner-box-bg` | `#0f1011` | `#f5f4f2` |
| `--gold-champagne` | `#d4af37` | `#b8860b` |
| `--text-main` | `#f4f4f5` | `#161513` |
| `--text-muted` | `#a1a1aa` | `#524c46` |
