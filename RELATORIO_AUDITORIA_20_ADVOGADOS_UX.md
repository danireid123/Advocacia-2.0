# Relatório Consolidado — Auditoria UX/UI Read-Only com 20 Personas de Escritório

> **Status de Segurança:** Auditoria **100% READ-ONLY**. Nenhum arquivo de código da aplicação (`index.html`, `main.js`, `src/`, etc.) foi modificado durante a execução dos 20 subagentes nem na geração deste relatório. Nenhuma mudança será aplicada sem aprovação expressa do Daniel.

---

## 1. Resumo Executivo e Métricas Consolidadas

- **Escopo avaliado:** Aplicação desktop **Advocacia Studio Pro 2.0** (`index.html`) sob a perspectiva interna dos **usuários do escritório** (sócios, advogados júnior/sênior, controladoria, recepção/secretaria, Legal Ops, acessibilidade e onboarding) — não de clientes finais atendidos no WhatsApp.
- **Metodologia:** 20 subagentes independentes (`research`, modelo `flash`, sandbox `read-only`), cada um com perfil, contexto e trechos específicos do código-fonte real (`index.html`).
- **Escala utilizada pelos avaliadores:** Os 20 subagentes pontuaram o campo `nota_ux` na **escala de 0 a 10** *(observação transparente: embora o plano inicial mencionasse 1 a 5 como referência, o schema de saída deixou `nota_ux` aberto e todos os 20 subagentes avaliaram na escala 0–10; as notas abaixo preservam exatamente os valores originais retornados)*.
- **Total de personas avaliadas:** `20`
- **Soma das notas:** `103.70` | **Média aritmética:** **`5.19 / 10`** | **Mediana:** `5.25 / 10`
- **Menor nota:** `4 / 10` (#8 Dra. Patrícia — Advogada Cível Leiga em Tecnologia)
- **Maior nota:** `6.8 / 10` (#4 Carla — Secretária / Recepcionista Jurídica)

### Visão Geral das Notas por Persona

| # | Persona / Papel no Escritório | Nota UX (0–10) | Foco Principal da Avaliação |
|---:|---|:---:|---|
| #1 | Dr. Roberto (64 anos) — Sócio-Fundador Tradicional | **4.5** | Sidebar, Home, Configurações e vocabulário sênior |
| #2 | Dra. Mariana (29 anos) — Advogada Autônoma | **5.8** | Smart Import, Modal de Prévia e salvamento na Ficha de Processos |
| #3 | Dr. Henrique (45 anos) — Sócio-Diretor Focado em Gestão | **5.5** | Hierarquia executiva da Home e KPIs Financeiros |
| #4 | Carla (24 anos) — Secretária / Recepcionista Jurídica | **6.8** | Recepção, Fila do Advogado, Solicitar Documentos e Ignorados |
| #5 | Dr. Lucas — Advogado Júnior (Controlador de Andamentos) | **5.8** | Andamentos em Processos, tradução de juridiquês e Simulador |
| #6 | Dra. Fernanda (38 anos) — Advogada de Família (Foco em Dossiê e Documentos) | **4.5** | Dossiê Civil vs. Modal Dossiê e Galeria de Documentos |
| #7 | Dr. Gustavo (41 anos) — Gestor Financeiro do Escritório | **5** | Controladoria, Régua PIX, conciliação e vínculo Processo-Financeiro |
| #8 | Dra. Patrícia (52 anos) — Advogada Cível Leiga em Tecnologia | **4** | Editor de Fluxo/Mensagens, sub-abas e vazamento de seletores |
| #9 | Dr. Thiago (33 anos) — Advogado Legal Ops (Power User) | **6.5** | Atalhos (`Alt+Setas`, `Ctrl+K`), breadcrumbs e status no topo |
| #10 | Dra. Helena (59 anos) — Advogada em Notebook Pequeno (1366x768) | **5** | Ergonomia em notebook `1366x768`, dobras e rolagem aninhada |
| #11 | Dr. Rafael (36 anos) — Advogado Criminalista (Plantão e Horários) | **5.8** | Plantão criminal, virada noturna na Agenda e urgência crítica |
| #12 | Juliana (31 anos) — Coordenadora de Atendimento (Auditoria de Conversas) | **4.5** | Auditoria de conversas (`aba-terminal` / Ledger Forense) |
| #13 | Dr. Eduardo (48 anos) — Sócio Focado em Backup e Nuvem | **4.2** | Backup local (`.JSON`) vs. Sincronização Nuvem |
| #14 | Dra. Camila (27 anos) — Advogada Trabalhista em Audiência (Uso Rápido) | **4.5** | Uso rápido em audiência (CNJ, telefone e filtro Recentes/Audiência) |
| #15 | Dr. Sérgio (55 anos) — Sócio Tributarista (Avaliador de Estética e Poluição Visual) | **5.5** | Sobriedade visual, `animate-ping`, cores e hierarquia na Home |
| #16 | Dra. Beatriz (34 anos) — Advogada Consumidorista (Gestão de WhatsApp e Spam) | **5.5** | Escudo VIP vs. Blacklist/Spam e status do WhatsApp no topo |
| #17 | Dr. André (40 anos) — Advogado Imobiliário (Fluxo Processo <-> Financeiro) | **4.5** | Jornada ponta a ponta Processo <-> Honorários / Financeiro |
| #18 | Dra. Larissa (30 anos) — Advogada no Primeiro Dia de Uso (Onboarding) | **5.5** | Primeiro dia de uso (Login, Onboarding e Empty States) |
| #19 | Dr. Marcelo (44 anos) — Advogado com Baixa Visão e Daltonismo (Acessibilidade) | **4.5** | Acessibilidade (baixa visão, microfontes e daltonismo) |
| #20 | Dra. Vanessa (37 anos) — Sócia Full-Service (Revisão de IA e Copilot) | **5.8** | Revisão de sugestões Copilot, `<textarea>` e confirmação de envio |

---

## 2. Top 10 Gargalos Críticos de UX/UI e Compreensão (Consolidado)

### 1. Excesso massivo de jargões de TI, código exposto e termos assustadores na UI
- **Presente em:** Praticamente todas as 20 personas (`#1`, `#2`, `#3`, `#4`, `#5`, `#6`, `#7`, `#8`, `#9`, `#10`, `#11`, `#12`, `#13`, `#14`, `#15`, `#16`, `#17`, `#18`, `#19`, `#20`).
- **Evidências:** Termos de infraestrutura/desenvolvimento expostos diretamente ao advogado: `Chromium Engine v2`, `Baileys`, `Sandbox`, `.JSON`, `Token Seguro`, `delay anti-ban`, `Visão Computacional Gemini`, `Higienizar Base`, `Transbordo & Prioridade`, `Ledger Forense`, `Live Stream 24/7`, `Snapshot Instantâneo`, `Disaster Recovery`, `de forma atômica`, `API_SECRET_TOKEN`, `{preset}`, `{documentos}`, `Transcrição Fonética`, além de vazamentos literais de IDs CSS e caminhos de arquivo (`#input-msg-boasvindas`, `#dossie-template-mensagem-docs`, `Pasta: ./documentos_clientes/`, `RESETAR`).
- **Impacto:** Gera medo de quebrar o sistema, apagar processos (`Higienizar Base`), ser banido pelo WhatsApp (`delay anti-ban`) ou lidar com um painel técnico inacessível.

### 2. Ruptura de fluxo entre Processos, Dossiê e Financeiro (e "Auditoria PIX" fantasma)
- **Presente em:** `#3`, `#6`, `#7`, `#14`, `#17`, `#20`.
- **Evidências:**
  - Na aba `Financeiro`, lançar uma parcela exige digitar manualmente `Nome do Cliente *` (`fin-novo-nome`) e `WhatsApp *` (`fin-novo-tel`) sem autocomplete nem vínculo com Processo (CNJ) ou CPF; reciprocamente, a ficha do processo não exibe nenhum status ou aba de honorários.
  - O painel promete `Auditoria PIX` e `Recebido na Semana (IA)`, mas não existe tabela, feed ou visualizador de comprovantes PIX para conferência/baixa.
  - `Salvar PIX` (`#btn-salvar-config-cobranca`) salva na verdade toda a régua semanal e os dias; `Revisar e Disparar Régua` dispara imediatamente em vez de abrir conferência; faltam KPIs do **Mês Atual** e de **Inadimplência/Vencidas**.
  - No Dossiê, há conflito estrutural entre `subtab-detalhe-dossie` (CPC Art. 319) e `modal-dossie-processo`, além de handlers conflitantes em `#btn-ver-dossie-proc`, galeria (`#galeria-documentos-cliente`) sem miniaturas reais/zoom/rotação e bug visual com **dois ícones de clipe SVG lado a lado** em `#btn-dossie-anexar-mais` (linhas 1331-1333).

### 3. Inversão de hierarquia e risco operacional na Fila do Advogado (`aba-pausados`)
- **Presente em:** `#4`, `#11`, `#20`.
- **Evidências:** `Reativar Robô` tem o maior destaque visual do card (`champagne-gradient`) no topo direito, induzindo cliques acidentais que devolvem clientes urgentes à automação; em contraste, `Enviar Resposta` usa um `<input type="text">` de linha única (esmagando respostas jurídicas e sugestões do Copilot) e envia imediatamente removendo o card (`card.remove()`) sem confirmação nem prévia do balão WhatsApp. Além disso, em casos de `🚨 URGÊNCIA CRÍTICA`, o `#painel-resumo` (áudio, transcrição e resumo) nasce oculto com `hidden`.

### 4. Hierarquia invertida na Tela Inicial (`aba-inicio`) e falsos estados ativos/zero
- **Presente em:** `#1`, `#3`, `#15`, `#18`, `#19`.
- **Evidências:** As listas operacionais (`Processos Recentes` e `Mensagens do WhatsApp`) aparecem acima da barra de KPIs (`#tour-metrics-bar`), e o painel inicial não traz KPI financeiro. Pior: há **3 animações `animate-ping` piscando simultaneamente** nos cards + badges e textos enganosos em conta zerada (`WhatsApp Ativo`, `Assistente IA Operante`, `Robô Ativo`, `94% auto` estático, `Expediente Hoje: Verificando...` e sparkline estático fingindo atividade com `0 pastas`).

### 5. Microtipografia generalizada (`9px`–`11px`), baixo contraste e barreiras de acessibilidade
- **Presente em:** `#1`, `#4`, `#6`, `#7`, `#8`, `#10`, `#11`, `#12`, `#15`, `#17`, `#19`.
- **Evidências:** Uso generalizado de `text-[9px]`, `text-[10px]`, `text-[11px]` e `text-zinc-400`/`text-zinc-500` sobre fundos escuros; indicadores de status baseados apenas em bolinhas coloridas de `6px`–`8px` (`w-1.5 h-1.5` / `h-2 w-2` verde/âmbar/vermelho) sem ícones geométricos de diferenciação para daltônicos; rótulos coloridos sem critério semântico no Financeiro; e ausência de controle de zoom tipográfico / alto contraste.

### 6. Desperdício de dobra vertical em notebooks (`1366x768`), rolagem aninhada e erros na aba Processos
- **Presente em:** `#2`, `#5`, `#10`, `#14`.
- **Evidências:** O `#dropzone-processos` aberto no topo (~200–220px) empurra lista e ficha para baixo da primeira dobra; múltiplas caixas sofrem de rolagem interna confinada (`max-h-[calc(100vh-200px)]`, `#modal-preview-ingestao` em `max-w-2xl` / `max-h-60`, `#modal-dossie-processo` em `max-h-72`, `#tabela-parcelas` em `max-h-[360px]`); o cabeçalho da ficha aglomera 6 botões (vários ocultos com `hidden`); o grid `sm:col-span-4` esmaga o número CNJ de 25 dígitos sem botão de cópia 1-clique e sem mostrar o telefone na ficha; a pílula `Recentes` (`alternarFiltroProcessosPill`) injeta estaticamente `"2024"` em `#busca-processos`; falta filtro `Audiências`; há dois botões de salvar distintos na mesma ficha; e `Personalizar Mensagens do Bot` ejeta o usuário para `aba-fluxo`.

### 7. Fragmentação do Editor de Fluxo (`aba-fluxo`) e conflito de salvamento
- **Presente em:** `#8`, `#10`.
- **Evidências:** Configurar o atendimento exige pular entre 3 sub-abas desconectadas (`Central de Mensagens`, `Editor de Menus & Árvore`, `Central de Ações & Funções`), com duplicidade do campo de boas-vindas (`#input-msg-boasvindas` vs `#input-etapa-msg`), 4 botões manuais de salvar competindo com `✓ Auto-Save Ativo`, e `modal-submenu` sem vínculo claro ao menu principal.

### 8. Navegação inconsistente, atalhos quebrados e ausência de status global no topo
- **Presente em:** `#1`, `#9`, `#16`.
- **Evidências:** A sidebar inicia recolhida (`16x16px`, `sidebar-brand-text hidden`); `Dossiê de Clientes` está `hidden` na sidebar mesmo tendo atalho na Home e integrando `ORDEM_ABAS` (linha 10049), fazendo `Alt + Setas` saltar de `fluxo` de volta para `processos` em vez de avançar para `financeiro`; a barra superior (`h-11`) suprimiu `#status-pill` e acesso rápido ao QR Code; `#top-bar-page-name` não tem breadcrumbs; `#spotlight-input` promete `↑↓ Navegar` no rodapé sem implementar setas; e o ícone da Balança (`#icon-scales`) se repete na marca, no Financeiro e na versão do app.

### 9. Conflitos conceituais e risco em Ignorados, Terminal Forense e Nuvem/Backup
- **Presente em:** `#4`, `#12`, `#13`, `#16`.
- **Evidências:** `Escudo VIP & Blacklist` mistura Juiz/Sócio/Família com botão `Bloquear` (sem opção rápida para Spam/Telemarketing e fora de `Operação`); `aba-terminal` (`Ledger Forense`) exibe falas misturadas em estilo console monoespaçado com `Limpar Histórico` sem confirmação; e `aba-backup` gera falsa segurança com `Sincronização com Servidor Nuvem (24/7)` exibindo `Offline / Standby`, endereço do Render e `API_SECRET_TOKEN`.

### 10. Falta de Onboarding no Primeiro Acesso, lacunas de Plantão na Agenda e Simulador técnico
- **Presente em:** `#5`, `#11`, `#18`.
- **Evidências:** Falta checklist guiado de primeiro uso e opção explícita de cadastro de novo escritório no `#auth-screen`; `aba-agenda` não aceita plantão 24h nem turno noturno cruzando a meia-noite e mantém campos editáveis sem contraste claro quando o dia está desmarcado; `aba-simulador` expõe `#proc-gemini-api-key`, testa apenas dados mockados (`Carlos Eduardo Teste`) e tem botões sem hierarquia.

---

## 3. Checklist de Decisões para Aprovação (Daniel)

| # | Proposta de Melhoria (Resumo) | Personas Impactadas | Decisão (SIM / NÃO) | Observação / Prioridade |
|---:|---|---|:---:|---|
| 1 | **Tradução jurídica completa da interface** (remover termos de TI como `Chromium`, `Baileys`, `Sandbox`, `delay anti-ban`, `Higienizar Base`, `Ledger Forense`, `.JSON`, IDs `#...` e `./documentos_clientes/`) | Todas (`#1`–`#20`) | `[ ] SIM  [ ] NÃO` | |
| 2 | **Unificar Processo <-> Financeiro + Central de Auditoria PIX** (vincular parcelas por cliente/CNJ, aba Honorários na pasta, KPI mensal/inadimplência, prévia da régua, tabela real de comprovantes e renomear `Salvar PIX`) | `#3`, `#7`, `#17`, `#19` | `[ ] SIM  [ ] NÃO` | |
| 3 | **Reforma da Fila do Advogado (`aba-pausados`)** (`<textarea>` no lugar de `<input>`, prévia/confirmação de envio WhatsApp, rebaixar `Reativar Robô`, auto-abrir `URGÊNCIA CRÍTICA`, atalho `Ligar`) | `#4`, `#11`, `#20` | `[ ] SIM  [ ] NÃO` | |
| 4 | **Ergonomia em Processos e Dossiê** (dropzone recolhível, botão 1-clique Copiar CNJ, telefone na ficha, corrigir filtro `Recentes` `2024` + chip `Audiências`, unificar salvar/dossiê, miniaturas reais e corrigir clipe duplo) | `#2`, `#5`, `#6`, `#10`, `#14` | `[ ] SIM  [ ] NÃO` | |
| 5 | **Home Executiva & Fim de Falsos Alarmes** (subir Bento Grid acima das listas, remover `animate-ping` contínuo, zerar badges falsos de conta vazia e adicionar checklist de Onboarding) | `#1`, `#3`, `#15`, `#18` | `[ ] SIM  [ ] NÃO` | |
| 6 | **Acessibilidade Visual & Daltonismo** (piso mínimo de `12px–13px`, controle `A-/A/A+`, alto contraste e ícones geométricos nos indicadores de status) | `#1`, `#8`, `#10`, `#15`, `#17`, `#19` | `[ ] SIM  [ ] NÃO` | |
| 7 | **Correção de Navegação & Status Global** (sidebar expandida em desktop, restaurar `#status-pill` + QR Code no topo, breadcrumbs, corrigir `ORDEM_ABAS` e setas `↑↓` do `Ctrl+K`) | `#1`, `#9`, `#16` | `[ ] SIM  [ ] NÃO` | |
| 8 | **Simplificação de `aba-fluxo` + Ignorados + Terminal + Nuvem** (unificar fluxo/auto-save, separar `VIP Sem Robô` de `Spam`, transformar Terminal em chat por cliente e ocultar configs avançadas de servidor) | `#4`, `#8`, `#12`, `#13`, `#16` | `[ ] SIM  [ ] NÃO` | |
| 9 | **Agenda de Plantão & Simulador Integrado** (`Plantão 24h`, turno noturno virando meia-noite, ocultar chave Gemini no Simulador e testar com processo real cadastrado) | `#5`, `#11` | `[ ] SIM  [ ] NÃO` | |

---

## 4. Feedbacks Individuais Completos das 20 Personas (Verbatim)

### Persona #1 — Dr. Roberto (64 anos) — Sócio-Fundador Tradicional
- **Nota UX (escala 0–10):** `4.5 / 10`

#### O que está difícil de entender
O sistema está repleto de termos técnicos de informática e engenharia de software que não fazem o menor sentido na rotina forense de um sócio sênior: na aba de Configurações, deparo-me com 'Status em tempo real da sessão do Chromium', 'Aguardando Chromium...', 'Iniciando motor...' e 'Motor WhatsApp: Baileys / Chromium Engine v2' (linhas 3471, 3490-3492 e 3635). Não sei o que é Chromium nem Baileys; para mim, deveria apenas informar se o WhatsApp do escritório está conectado ou desconectado. Além disso, fala em 'Token Seguro de 30 Dias' (linha 3586), 'Cópia de Segurança (.JSON)' (linha 1593) e 'salve seus processos em JSON' (linha 3598), termo que um operador do Direito não compreende. Na barra lateral, o módulo de testes traz a etiqueta 'Sandbox' (linha 1530), gíria de TI incompreensível. Há também falha de fluxo: na tela inicial existe um botão de ação rápida 'Dossiê de Clientes' (linha 1690), mas na Sidebar o botão correspondente está totalmente invisível ('hidden' na linha 1540), deixando o usuário sem saber onde reencontrar essa tela. Por fim, o botão 'Trocar de Conta' está pintado de vermelho como se fosse deletar o sistema e com aviso confuso de 'Encerrar sessão de 30 dias' (linha 3589).

#### O que está ruim no design
A experiência visual é muito desgastante para quem tem mais de 60 anos e vista cansada. Primeiro, há um excesso gritante de fontes minúsculas de 9px a 11px ('text-[9px]', 'text-[10px]', 'text-[11px]') espalhadas nos cabeçalhos de grupos da sidebar ('Operação', 'Automação', 'Controladoria', 'Sistema'), nos chips informativos ('Escritório Aberto', 'WhatsApp Ativo') e nos dados dos cards de telemetria. Segundo, a Sidebar inicia recolhida em modo de trilho de ícones (com a marca oculta por 'sidebar-brand-text hidden' na linha 1474), apresentando apenas pequenos ícones de 16x16px sem rótulos legíveis, forçando a adivinhar as funções ou depender de atalhos como 'Ctrl+B' que não fazem parte do cotidiano de um jurista sênior. Terceiro, o ícone da Balança da Justiça ('#icon-scales') foi banalizado: ele é usado na logomarca do escritório (linha 1472), no botão de 'Financeiro & PIX' (linha 1557) e no card de 'Versão do Advocacia Pro' (linha 3612), desrespeitando o simbolismo jurídico e gerando confusão visual. Quarto, há poluição e ansiedade causadas por animações contínuas de alerta: três bolinhas piscando simultaneamente na tela inicial ('animate-ping' na Fila de Atendimento linha 1807, no Robô Ativo linha 1831 e no Expediente linha 1861), fazendo o escritório parecer uma central de alarmes de servidores. Quinto, o mini gráfico de 7 barrinhas no card de processos (linhas 1771-1779) é puro enfeite: sem números, sem eixos e ilegível.

#### Sugestões de melhoria
1. Acessibilidade e ergonomia visual sênior: Fixar a Sidebar expandida por padrão em computadores de mesa, mantendo os rótulos de texto sempre visíveis ao lado dos ícones com fontes confortáveis (mínimo 13px/14px); eliminar as microfontes de 9px a 11px dos cabeçalhos e instruções, garantindo alto contraste e leitura sem esforço. 2. Higienização da linguagem (tradução jurídica): Substituir todo jargão de programador por vocabulário corporativo e jurídico claro — trocar 'Chromium Engine v2 / Baileys' por 'Serviço de Comunicação do WhatsApp'; substituir 'Exportar em JSON' por 'Gerar Arquivo de Backup do Escritório'; trocar a etiqueta 'Sandbox' por 'Ambiente de Testes'; e substituir 'Token Seguro de 30 Dias' por 'Conexão Autorizada (válida por 30 dias)'. 3. Sobriedade e consistência funcional: Desativar os pontos piscantes contínuos ('animate-ping') na tela inicial, adotando indicadores visuais sóbrios e estáveis; atribuir um ícone exclusivo de cifrão/moeda para o módulo Financeiro e ícone informativo/escudo para a versão técnica, reservando a Balança exclusivamente para o logotipo e processos judiciais; e restaurar a visibilidade do botão 'Dossiê de Clientes' no menu lateral para manter a coerência de navegação.

---

### Persona #2 — Dra. Mariana (29 anos) — Advogada Autônoma
- **Nota UX (escala 0–10):** `5.8 / 10`

#### O que está difícil de entender
1. Termos técnicos de banco de dados e TI: o botão 'Confirmar e Gravar na Base' (no modal de importação) e o botão 'Higienizar Base' (ao lado do upload) utilizam jargão de programador que assusta advogados; não fica claro se 'Higienizar' vai apagar processos em andamento ou mesclar cadastros.
2. Botão descontextualizado 'Personalizar Mensagens do Bot' no topo da aba de processos: ao clicar nele, o sistema aciona 'ativarAba(fluxo)', arrancando a advogada da tela de processos e jogando-a em outra aba, quebrando completamente a linha de raciocínio.
3. Fluxo de importação sem botão explícito de conferência: na área de Smart Import há 'Planilha Modelo' e 'Selecionar Arquivo(s)', mas não existe um botão ou instrução clara de 'Conferir Prévia Antes de Importar'. O modal de prévia só abre como evento automático após carregar o arquivo, gerando insegurança sobre se os dados já foram salvos ou não.
4. Desconexão no salvamento da ficha: há dois botões de salvar distintos para o mesmo cliente/processo ('Salvar Pasta do Processo' na sub-aba de andamento e 'Salvar Alterações do Dossiê' na sub-aba do Art. 319 CPC). Como usuária solo, não sei se ao salvar um eu perco as edições feitas no outro.
5. Rótulo 'Liberar Reenvio' com tooltip 'Permite que o cliente consulte novamente no WhatsApp': termo ambíguo que não explica se o cliente estava travado por erro ou por limite do robô.

#### O que está ruim no design
1. Modal de Prévia de Importação claustrofóbico: o 'modal-preview-ingestao' possui largura limitada (max-w-2xl) e a tabela de dados tem altura máxima minúscula de apenas 240px (max-h-60), com fontes microscópicas (text-[9px] no cabeçalho e text-[11px] nas células). Para conferir uma planilha de clientes com CPFs e números CNJ de 20 dígitos, a visualização fica extremamente apertada e cansativa.
2. Poluição tipográfica e excesso de microfontes: uso recorrente de fontes de 9px a 11px em métricas, badges e legendas (ex.: 'preview-metric-total', badges de arquivos aceitos exibindo inclusive '.txt / .log'), dificultando a leitura rápida.
3. Exposição de detalhes técnicos na UI: no painel do dossiê, é exibido o caminho de sistema de arquivos 'Pasta: ./documentos_clientes/', o que polui o visual com resquícios de desenvolvimento/debug.
4. Cabeçalho da ficha sobrecarregado de botões ocultos: agrupamento de seis botões à direita (Copiar CPC, Ver Dossiê, Solicitar Docs, Anexar Peça, Liberar Reenvio, Excluir) em botões pequenos e misturados que aparecem condicionalmente (hidden), criando saltos visuais na barra superior.

#### Sugestões de melhoria
1. Reestruturar o Modal de Prévia: ampliar para 'max-w-5xl', aumentar a área visível da tabela para no mínimo 400px com paginação e badges legíveis de validação (ex: 'CPF válido', 'Processo já existente'), alterando o botão de ação de 'Confirmar e Gravar na Base' para 'Importar X Processos Selecionados'.
2. Humanizar a linguagem e remover o botão de fuga: substituir 'Higienizar Base' por 'Remover Processos Duplicados' (com aviso claro do que será mantido), trocar o texto de debug './documentos_clientes/' por um indicador amigável como 'Arquivos digitalizados', e transformar o botão 'Personalizar Mensagens do Bot' em um modal suspenso rápido ou movê-lo exclusivamente para as configurações, evitando ejetar o usuário para a aba de fluxo.
3. Unificar a ação de salvamento: fundir os botões 'Salvar Pasta do Processo' e 'Salvar Alterações do Dossiê' em uma barra de ações fixa e unificada no rodapé da ficha com o botão 'Salvar Caso / Processo', garantindo que tanto os dados do andamento quanto a qualificação do Art. 319 CPC sejam gravados em conjunto sem risco de perda de dados.

---

### Persona #3 — Dr. Henrique (45 anos) — Sócio-Diretor Focado em Gestão
- **Nota UX (escala 0–10):** `5.5 / 10`

#### O que está difícil de entender
Termos técnicos e jargões de TI inadequados para a diretoria de um escritório: o cabeçalho financeiro exibe 'Visão Computacional Gemini' e promete disparo com 'delay anti-ban', o que soa como vocabulário de desenvolvedor/hacker e robô de spam, gerando desconfiança jurídica. O KPI 'Recebido na Semana (IA)' gera dúvida imediata: contabiliza apenas o que o robô do WhatsApp auditou ou todos os honorários do escritório (TED, depósitos, boletos)? Além disso, o botão da régua semanal está rotulado como 'Salvar PIX' (linha 3328), embora salve toda a configuração semanal de disparos e dias permitidos. Por fim, o formulário de lançar honorários pede 'Nome do Cliente' e 'WhatsApp' digitados soltos em campos de texto, sem nenhum vínculo ou seleção de processos ou clientes já existentes no sistema.

#### O que está ruim no design
Inversão da hierarquia executiva na aba Início: as listas operacionais de 'Processos Recentes' e 'Mensagens do WhatsApp' foram posicionadas antes da barra de KPIs (linhas 1701-1753), empurrando os indicadores para baixo. O Bento Grid inicial não possui nenhuma métrica financeira do escritório e apresenta forte assimetria: os dois primeiros cards mostram números grandes em 'text-3xl' (processos e fila), enquanto os cards 3 e 4 trazem apenas textos de status ('Robô Ativo' e 'Verificando...'), acompanhados de barras de sparkline estáticas em HTML e badge estático de '94% auto'. Na aba Financeiro, os 4 KPIs sofrem de extrema miopia temporal: mostram apenas a 'Semana' ou o 'Total Geral' histórico acumulado, sem nenhuma métrica para o 'Mês Atual' (ciclo base de qualquer escritório) nem visão de inadimplência/parcelas vencidas, e não há qualquer filtro de data/período. Por fim, a tabela de parcelas fica confinada em um espaço apertado com 'max-h-[360px]' espremida sob o formulário de lançamento.

#### Sugestões de melhoria
1. No Painel Inicial (aba-inicio): Subir o grid de KPIs para logo abaixo do banner de boas-vindas, substituir cards puramente operacionais (como 'Expediente Hoje' e 'Mensagens do Robô') por indicadores executivos reais ('Faturamento Previsto no Mês' e 'Honorários em Atraso'), e trocar o atalho 'Simulador' por um acesso direto à 'Gestão Financeira'. 2. Na aba Financeiro: Adicionar um seletor de período (Mês Vigente, Trimestre, Ano, Personalizado) e remodelar os 4 KPIs executivos para refletir a saúde contábil da banca: (I) Faturamento Realizado no Mês, (II) A Receber no Mês, (III) Inadimplência / Parcelas Vencidas e (IV) Total Contratado sob Gestão. 3. Ajuste de vocabulário e coerência: Substituir 'delay anti-ban' por 'Intervalo Seguro de Disparo', 'Visão Computacional Gemini' por 'Auditoria Automática de Comprovantes', e renomear 'Salvar PIX' para 'Salvar Configurações da Régua'. 4. Integrar o lançamento de parcelas a um dropdown de clientes/pastas já cadastradas, eliminando a digitação manual redundante.

---

### Persona #4 — Carla (24 anos) — Secretária / Recepcionista Jurídica
- **Nota UX (escala 0–10):** `6.8 / 10`

#### O que está difícil de entender
1. Jargões de TI e telecomunicações distantes da rotina de uma recepção jurídica: termos como 'Transbordo & Prioridade' no topo da fila, 'Copilot 1-Clique Ativo', 'Escudo VIP & Blacklist' e aviso sobre 'Visão Computacional do Gemini' no modal geram estranheza para quem só precisa organizar recados e colher documentos.
2. O rótulo 'Bloquear' no botão principal da aba de ignorados gera medo real: a secretária teme estar bloqueando o número da Vara do Trabalho, Juiz ou Sócio no WhatsApp do escritório, quando a função real é apenas isentar o número dos disparos do robô e lembretes PIX.
3. Exibição de sintaxe de código no modal de documentos: o aviso 'Variáveis suportadas: {nome}, {preset}, {documentos}' parece coisa de programador e gera dúvida se é necessário digitar as chaves no texto ou se o sistema substitui sozinho.
4. Sinalização alarmista na Fila do Advogado: a tag com '🚨 URGÊNCIA CRÍTICA (URGÊNCIA MÁXIMA)' e bolinha piscando com 'animate-ping' causa pânico visual imediato na triagem, sem deixar evidente de imediato se é um prazo fatal do juiz ou se o cliente apenas mandou uma mensagem mais enfática.

#### O que está ruim no design
1. Na Fila do Advogado ('aba-pausados'), ao clicar em 'Ver Resumo do Cliente', o card expande verticalmente uma quantidade excessiva de blocos empilhados (áudios com player, histórico de mensagens, transcrição fonética, resumo executivo, cronologia dos fatos, sugestões copilot e caixa de resposta), tornando o card gigantesco e obrigando a rolar muito a página para triar múltiplos clientes na recepção.
2. Hierarquia visual perigosa no card da fila: o botão 'Reativar Robô' recebe o maior destaque visual com degradê dourado brilhante ('champagne-gradient'), enquanto os botões mais usados na rotina da recepção ('Ver Resumo do Cliente' e 'Solicitar Documentos') ficam apagados em segundo plano ('bg-amber-500/15' e 'bg-[#d4af37]/20'), induzindo a cliques acidentais que devolvem o cliente para a automação antes da hora.
3. No 'modal-solicitar-documentos', a mensagem é apresentada em um textarea fixo de 5 linhas sem lista de itens selecionáveis por checkbox. Caso o cliente precise apenas de RG e Comprovante de Residência (mas não de CTPS ou FGTS do preset Trabalhista), a secretária é obrigada a editar o texto manualmente apagando palavras no campo de texto.
4. Na 'aba-ignorados', o formulário de cadastro espreme o botão 'Bloquear' em uma coluna apertada ('col-span-12 sm:col-span-2'), com excesso de textos diminutos ('text-[10px]' e 'text-[11px]') e contrastes baixos em fundo escuro ('bg-zinc-950/70'), cansando a vista durante o atendimento dinâmico de balcão e telefone.

#### Sugestões de melhoria
1. Transformar a escolha de documentos no 'modal-solicitar-documentos' em um checklist visual interativo com caixas de marcação (checkboxes) para cada documento individual do preset selecionado, montando a mensagem automaticamente e eliminando a necessidade de a recepção editar tags como '{documentos}' no texto.
2. Substituir o termo e botão 'Bloquear' na 'aba-ignorados' por 'Isentar do Robô' ou 'Adicionar à Lista de Exceção VIP', com um aviso amigável destacando que 'O contato continuará conversando normalmente com a equipe humana pelo WhatsApp'.
3. Na Fila do Advogado ('aba-pausados'), organizar os dados do cliente expandido em abas internas ou sanfonas compactas (ex.: [Áudios/Histórico] | [Resumo e Fatos] | [Copilot Respostas]), além de inverter a proeminência dos botões: dar destaque primário a 'Ver Resumo' / 'Solicitar Documentos' e exigir uma confirmação rápida ao clicar em 'Reativar Robô' para evitar erros operacionais na triagem.

---

### Persona #5 — Dr. Lucas — Advogado Júnior (Controlador de Andamentos)
- **Nota UX (escala 0–10):** `5.8 / 10`

#### O que está difícil de entender
1. Ausência e ambiguidade da IA no resumo: Na ficha processual (linhas 2069-2078), o campo de resumo (#proc-resumo) não possui nenhum botão de IA visível para simplificar ou traduzir juridiquês, apesar de ser a maior necessidade de quem controla andamentos; já no simulador há um botão isolado '#btn-simulador-testar-ia' cujo tooltip diz apenas 'Testa a conexão com o assistente IA', sem explicar se dispara um teste no chat ou se valida credenciais.
2. Termos e parâmetros de TI na tela de operação: O simulador expõe ao advogado o campo '#proc-gemini-api-key' ('Chave Google Gemini' com badge '✓ IA Ativa' e placeholder '✓ Chave interna ativa'), gerando dúvida técnica sobre se o operador jurídico precisa configurar chave de API para o robô funcionar.
3. Desconexão no fluxo de validação: Os botões de cenários rápidos do simulador (#btn-cenario-ola, #btn-cenario-proc, #btn-cenario-cpf) operam com dados mockados ('Carlos Eduardo Teste'), não havendo ligação direta para testar a resposta do processo recém-cadastrado na aba anterior.
4. Rótulos e textos soltos: O texto 'Ao receber o resumo: 1 encerra • 2 chama o advogado.' (linha 2081) deixa em dúvida se o robô acrescenta isso sozinho ou se o advogado precisa redigir no texto, e o botão '#btn-resetar-visto-ficha' tem o nome ambíguo 'Liberar Reenvio', parecendo reenvio manual em vez de destravar a consulta do cliente.

#### O que está ruim no design
1. Campo de resumo apertado e desconfortável: A textarea #proc-resumo possui apenas 4 linhas ('rows=4') e tipografia miúda ('text-xs'), tornando a redação e revisão de andamentos processuais complexos desconfortável, sem contador de caracteres nem prévia do balão do WhatsApp.
2. Aglomeração de botões no cabeçalho da ficha: A barra de ferramentas (#btn-copiar-cpc, #btn-ver-dossie-proc, #btn-solicitar-docs-proc, #btn-anexar-peca-proc, #btn-resetar-visto-ficha, #btn-excluir-proc-ficha) reúne 6 botões com texto minúsculo ('text-[11px]'), a maioria oculta com classe 'hidden', gerando inconsistência visual e sensação de interface inacabada.
3. Layout desbalanceado no Simulador: A coluna esquerda de parâmetros e cenários ocupa 4 colunas ('col-span-12 lg:col-span-4') com caixas volumosas, enquanto o mockup do smartphone WhatsApp fica confinado em altura fixa de 590px ('h-[590px]'), limitando a visualização do histórico de mensagens durante testes longos.
4. Falta de hierarquia e contraste nos botões de ação: No simulador, botões com funções totalmente distintas (Testar IA, Resetar Conversa, Limpar Tela) compartilham estilos cinzas muito parecidos ('bg-zinc-900 border-zinc-800'), sem destaque claro para o fluxo principal de teste.

#### Sugestões de melhoria
1. Adicionar botão contextual de IA no resumo: Incluir diretamente na barra de título do campo #proc-resumo um botão '✨ Simplificar / Traduzir Juridiquês com IA', permitindo converter automaticamente despachos judiciais técnicos em linguagem clara e acessível para o cliente do WhatsApp antes do envio.
2. Prévia de balão e contador de caracteres: Expandir a textarea para no mínimo 6 linhas flexíveis com contador de caracteres (limite recomendado para WhatsApp) e um botão de 'Prévia no WhatsApp' mostrando exatamente como o cliente visualizará a mensagem com o rodapé '1 encerra • 2 chama advogado'.
3. Ocultar configurações de TI do Simulador: Remover o campo 'Chave Google Gemini' da tela do simulador (transferindo-o para a aba de Configurações restrita a administradores) e substituí-lo por um seletor 'Vincular Processo Cadastrado', permitindo que o Dr. Lucas selecione o processo recém-atualizado para simular a consulta real por CPF e validar a resposta do robô de ponta a ponta.

---

### Persona #6 — Dra. Fernanda (38 anos) — Advogada de Família (Foco em Dossiê e Documentos)
- **Nota UX (escala 0–10):** `4.5 / 10`

#### O que está difícil de entender
Existe uma duplicidade terminológica e conceitual profundamente confusa entre o 'modal-dossie-processo' (rotulado como 'Dossiê Processual Inteligente' com Peças Anexadas e Histórico) e a 'subtab-detalhe-dossie' (rotulada como 'Dossiê Civil & Documentos - CPC Art. 319'). Na rotina forense, o dossiê do cliente deveria conter tudo em um só lugar; dividir entre uma subaba interna de qualificação e um modal flutuante separado para peças confunde totalmente onde os documentos residem. Piora com o botão 'Ver Dossiê' (id='btn-ver-dossie-proc'), que possui ao mesmo tempo um 'onclick' para abrir a subaba civil e um 'addEventListener' no script para abrir o modal de processo. Além disso, o sistema expõe termos técnicos e caminhos de desenvolvedor sem sentido para o advogado, como o aviso de diretório 'Pasta: ./documentos_clientes/' estampado acima da galeria, placeholders técnicos como 'Extraído via OCR do RG/CNH' e jargões exagerados como 'laudos forenses da IA', quando tudo o que a advogada quer saber é se a certidão de casamento e o RG enviados pelo WhatsApp estão legíveis e válidos.

#### O que está ruim no design
A chamada 'Galeria de Documentos Auditados pela IA' (id='galeria-documentos-cliente') não é uma galeria visual real: ela não renderiza miniaturas (thumbnails) das imagens do RG, CNH ou comprovante de residência, exibindo apenas caixas de texto com o nome do arquivo (ex: 'arquivo.jpg') e badges, sem botão de zoom, rotação ou visualização ampliada (essencial na advocacia de família, pois clientes mandam fotos de documentos tortas ou cortadas pelo celular). No 'modal-dossie-processo', a área útil de rolagem é excessivamente apertada ('max-h-72', apenas 288px), deixando o modal com sensação claustrofóbica. Há ainda um bug visual evidente no botão 'btn-dossie-anexar-mais' (linhas 1332-1333), onde dois ícones de clipe SVG foram inseridos em sequência, renderizando dois clipes colados antes do texto. Na ficha de qualificação civil, o uso excessivo de rótulos minúsculos ('text-[10px]') em 7 campos espremidos cansa a vista e prejudica a conferência minuciosa dos dados.

#### Sugestões de melhoria
1. Unificar a gestão documental: extinguir o modal isolado e centralizar tudo na pasta do processo sob uma aba unificada 'Dossiê & Documentos', com filtros claros entre 'Documentos Pessoais do Cliente' (RG, CNH, Certidões) e 'Peças Processuais' (Petições, Decisões, Sentenças). 2. Transformar a galeria em um visualizador documental real: incluir miniaturas reais das fotos/PDFs recebidos no WhatsApp, com modal lightbox que permita zoom in/out, rotação da imagem (para fotos deitadas) e visualização lado a lado entre a imagem do documento e os campos de qualificação do Art. 319 do CPC. 3. Limpeza visual e de código: remover vazamentos técnicos de TI como 'Pasta: ./documentos_clientes/', corrigir o bug de ícone duplo de clipe no botão de anexar e unificar os disparos de clique do botão 'Ver Dossiê'.

---

### Persona #7 — Dr. Gustavo (41 anos) — Gestor Financeiro do Escritório
- **Nota UX (escala 0–10):** `5 / 10`

#### O que está difícil de entender
1. Desconexão total entre Processos e Financeiro: Na Ficha do Processo e Dossiê (linhas 2070-2140) não há qualquer campo ou menção a honorários ou contrato. Já na aba Financeiro (linhas 3388-3419), o formulário 'Lançar Nova Parcela de Honorários' exige digitar manualmente 'Nome do Cliente *' e 'WhatsApp *' como texto puro, sem vincular ao Nº do Processo (CNJ), CPF ou à pasta já existente. Não sei a qual processo aquela cobrança se refere.
2. Botão ambíguo 'Salvar PIX' (linha 3328): O cabeçalho do painel se chama 'Régua de Cobrança Semanal' e contém Frequência Semanal e Dias Permitidos (Seg a Sex), mas o botão de salvar foi rotulado apenas como 'Salvar PIX' (id 'btn-salvar-config-cobranca'). Dá a falsa impressão de que só grava a chave PIX, ignorando os dias da régua.
3. Botão 'Revisar e Disparar Régua' (linha 3255): O verbo 'Revisar' sugere que se abrirá uma tela de conferência para auditar quais clientes estão inadimplentes antes do envio. No entanto, o clique executa imediatamente a função de disparo via WhatsApp.
4. Jargões de TI desnecessários: Termos como 'Visão Computacional Gemini' e 'delay anti-ban' no cabeçalho executivo (linhas 3243 e 3251) geram estranheza para uma controladoria jurídica, que precisa de termos contábeis e de gestão (ex.: Conciliação Bancária, Cobrança Preventiva).
5. 'Auditoria PIX' fantasma: O título principal (linha 3248) e o card de KPI prometem 'Auditoria PIX' e 'Recebido na Semana (IA)', mas não existe na tela nenhum feed, galeria ou tabela de comprovantes auditados para conferência financeira.

#### O que está ruim no design
1. Layout assimétrico e tabela de parcelas sufocada: O painel financeiro divide-se em 5 colunas para a Régua e 7 colunas para Lançamento e Lista de Parcelas (linhas 3318-3430). O container '#tabela-parcelas' foi limitado a uma altura máxima minúscula de 'max-h-[360px]' com overflow vertical, espremido logo abaixo do formulário de cadastro. Em um escritório com dezenas de contratos ativos, essa caixinha de rolagem fica poluída e inviável para conciliação.
2. Poluição visual e inconsistência de cores nos rótulos: No formulário de parcelas (linhas 3392-3412), há uma mistura confusa de cores nos rótulos: 'Nome' e 'WhatsApp' em text-zinc-200, 'Valor Parcela' em verde esmeralda (text-emerald-400) e 'Qtd Parcelas' em dourado (text-amber-400), gerando ruído cognitivo.
3. Dias da semana apertados: Os seletores de disparo semanal (linhas 3344-3365) usam uma grade 'grid-cols-5 gap-1.5' com caixinhas pretas apertadas e texto 'text-[11px]', dificultando o clique rápido e a leitura ergonômica.
4. Excesso de brilhos e gradientes nos 4 KPIs: Os cards do topo (linhas 3263-3315) utilizam múltiplos traços decorativos luminosos ('h-[2px] bg-gradient-to-r'), ícones com múltiplos fundos e badges conflitantes, competindo com os números em si.
5. Falta total de interface para visualização do comprovante: Enquanto na aba do Dossiê Civil (linhas 2145-2159) existe uma 'Galeria de Documentos Auditados pela IA', no Financeiro inexiste qualquer componente visual para checar a imagem do comprovante PIX recebido.

#### Sugestões de melhoria
1. Integração Direta de Honorários com Clientes/Processos: Substituir os campos soltos de texto 'fin-novo-nome' e 'fin-novo-tel' por um campo com autocompletar que puxe os dados do cliente e permita vincular o contrato diretamente ao Número do Processo (CNJ). Além disso, adicionar uma sub-aba 'Honorários e Custas' dentro da pasta do processo (ao lado de 'Ficha do Processo' e 'Dossiê Civil') para que advogado e gestor visualizem o status financeiro sem sair do processo.
2. Correção dos Botões da Régua: Renomear o botão 'Salvar PIX' para 'Salvar Configuração da Régua' e ajustar 'Revisar e Disparar Régua' para abrir um modal de conferência prévia, listando: nome do cliente, telefone, valor devido, vencimento e texto da mensagem que será disparada, exigindo confirmação explícita antes de enviar.
3. Criação da Central de Auditoria e Conciliação PIX: Implementar um painel ou gaveta visual na aba financeira listando os comprovantes recebidos pelo robô, exibindo miniatura da imagem enviada pelo cliente no WhatsApp, valor detectado pela IA vs. valor da parcela, data/hora e botões de ação ('Confirmar Baixa' ou 'Recusar Comprovante').
4. Redesenho da Tabela de Contratos e Parcelas: Separar o formulário de cadastro da tabela de parcelas em seções bem distribuídas, removendo o limite de 360px e adicionando filtros rápidos por status ('Todas', 'Pendentes', 'Pagas/Auditadas', 'Em Atraso') com opção de exportação em planilha.

---

### Persona #8 — Dra. Patrícia (52 anos) — Advogada Cível Leiga em Tecnologia
- **Nota UX (escala 0–10):** `4 / 10`

#### O que está difícil de entender
1. Vazamento de jargão e código de programador nos rótulos: Etiquetas de tela exibem identificadores técnicos de programação diretamente para o usuário, como 'Mensagem de Boas-Vindas (#input-msg-boasvindas):' (linha 2280) e 'Modelo Padrão WhatsApp (#dossie-template-mensagem-docs):' (linha 2484). Para uma advogada leiga, esse prefixo com cerquilha parece comando quebrado de sistema ou erro de desenvolvimento.
2. Babel terminológica: A interface utiliza termos conflitantes para o mesmo conceito: o cabeçalho cita 'Árvore de Atendimento' e 'Menu Automático', o botão do topo chama de 'Novo Submenu' (com id 'btn-nova-etapa'), o modal pergunta por 'Novo Submenu de Atendimento', o dropdown chama de 'Menu em Edição' (id 'select-etapa') e as escolhas são chamadas de 'Opções de Escolha do Cliente'. A profissional não consegue discernir se está criando uma etapa, um menu, um submenu ou uma árvore.
3. Fragmentação confusa entre 3 sub-abas: Para estruturar um atendimento simples, a advogada precisa navegar por 3 abas desconectadas. Na 'Central de Mensagens' ela escreve o texto numerando opções (1, 2, 3), mas essas opções são puro texto sem inteligência; para torná-las interativas, precisa adivinhar que deve ir para a sub-aba 'Editor de Menus & Árvore' e clicar em 'Nova Opção'; e para configurar o que cada opção faz, precisa ir para uma terceira sub-aba 'Central de Ações & Funções'. Além disso, o texto de boas-vindas aparece duplicado para edição (no campo 'input-msg-boasvindas' da aba 1 e no 'input-etapa-msg' da aba 2), gerando dúvida sobre onde a alteração realmente tem efeito.
4. Variáveis obscuras e ausência de suporte no editor: A tag '{preset}' usada no Grupo C (linhas 2474 e 2497) é um jargão em inglês ininteligível para a advocacia cível (não se explica se é área jurídica, rito ou modelo). Além disso, enquanto na aba de Mensagens há botões para inserir '{nome}', na aba 'Editor de Menus' (textarea 'input-etapa-msg') não há nenhum botão de tags, deixando a advogada sem saber se variáveis funcionam ali.
5. Modal de criação descontextualizado: O 'modal-submenu' (linhas 1400-1412) apenas solicita 'Qual o nome da especialidade ou setor? (Ex: Direito Trabalhista)', sem explicar nem permitir definir onde esse submenu será encaixado na navegação ou a qual opção do menu ele responderá, passando a sensação de criar algo solto no vazio.

#### O que está ruim no design
1. Tipografia excessivamente reduzida e ilegível para visão madura: Uso massivo de fontes em tamanhos 'text-[9px]', 'text-[10px]' e 'text-[11px]' (como nos horários '10:42', legendas de tags, badges e textos auxiliares) sobre fundos escuros 'bg-zinc-950/70', gerando severa fadiga visual e desconforto para uma advogada de 52 anos que necessita de boa legibilidade.
2. Poluição visual e sobrecarga de prévias simultâneas: A sub-aba 'Central de Mensagens' empilha múltiplos cartões com balões repetidos ('wa-wallpaper-dark' e 'wa-bubble-out'). O Grupo B espreme 6 modelos de mensagens em um grid de duas colunas com textareas apertadas de apenas 'rows=3', tornando a tela claustrofóbica e poluída.
3. Inconsistência e ansiedade com botões de salvamento: O cabeçalho exibe duas sinalizações de salvamento automático ('Auto-Save Contínuo' na linha 2189 e '✓ Auto-Save Ativo' na linha 2201), mas concorrem na mesma tela quatro botões manuais de salvar ('Salvar Menu' no topo, 'Salvar Todas as Mensagens' no Grupo A, 'Salvar Template' no Grupo C e 'Salvar Ações' na terceira sub-aba). Para uma usuária leiga, isso gera insegurança imediata sobre se suas alterações estão realmente salvas ou se serão perdidas ao fechar.
4. Elementos ocultos e falta de hierarquia: O botão 'Remover' etapa ('btn-excluir-etapa', linha 2551) vem oculto com a classe 'hidden', sem nenhuma pista visual de como excluir um submenu criado por engano; já o botão 'Novo Submenu' fica isolado no topo direito, totalmente distante do container onde as opções são gerenciadas.

#### Sugestões de melhoria
1. Unificar o fluxo em tela única integrada: Eliminar a divisão fragmentada entre as 3 sub-abas ('Central de Mensagens', 'Editor de Menus' e 'Central de Ações'). Criar um fluxo linear onde, ao selecionar ou criar uma opção de atendimento, a advogada configure em um mesmo bloco visual: o texto que o cliente recebe, os botões/números de resposta e a ação correspondente (ex: abrir submenu ou acionar IA/advogado).
2. Humanizar os rótulos e eliminar vazamento de código: Remover sumariamente os identificadores técnicos '#input-msg-boasvindas' e '#dossie-template-mensagem-docs' dos rótulos visíveis. Substituir o termo técnico '{preset}' por '{area_do_direito}' ou '{tipo_de_acao}' e padronizar toda a nomenclatura do sistema para 'Menu de Atendimento' e 'Opções', abandonando a mistura confusa de 'etapa', 'submenu' e 'árvore'.
3. Botões de tags e variáveis visíveis em todos os campos: Adicionar a barra de inserção rápida de tags (+ {nome}, + {processo}) também no campo 'Texto de Atendimento' ('input-etapa-msg') do editor, acompanhada de um texto explicativo simples: 'Clique para inserir automaticamente o nome do cliente na mensagem'.
4. Simplificação do salvamento e acessibilidade visual: Manter uma indicação única de auto-save ('Todas as alterações foram salvas automaticamente às 14:30') e apenas um botão principal claro de 'Publicar no WhatsApp', extinguindo os 4 botões manuais dispersos. Aumentar a tipografia básica de textos auxiliares para no mínimo 13px/14px e elevar o contraste das fontes secundárias para garantir leitura confortável a advogados seniores.
5. Contexto claro no Modal de Submenu: Adicionar no 'modal-submenu' um campo seletor: 'Vincular este submenu a qual opção do menu principal?', garantindo que a usuária entenda exatamente a conexão hierárquica do novo submenu antes de criá-lo.

---

### Persona #9 — Dr. Thiago (33 anos) — Advogado Legal Ops (Power User)
- **Nota UX (escala 0–10):** `6.5 / 10`

#### O que está difícil de entender
1. Quebra grave no fluxo de atalhos de teclado (Alt + Setas): o array 'ORDEM_ABAS' (linha 10049) inclui 'dossie-clientes' entre 'fluxo' e 'financeiro'. Como o botão 'nav-btn-dossie-clientes' (linha 1540) é um elemento oculto ('class=hidden') que redireciona via código diretamente para a aba 'processos' (2ª aba), o usuário que navega via teclado ao sair de 'Menu Automático' (fluxo) é jogado bruscamente de volta para o início em vez de avançar para 'Financeiro & PIX'.
2. Promessa falsa no Spotlight (Ctrl+K): o rodapé do modal (linha 1427) indica expressamente '↑↓ Navegar ↵ Selecionar', mas o input não possui tratamento de evento de setas para cima/baixo para percorrer os resultados, gerando frustração imediata em quem opera via teclado sem mouse.
3. Rótulos ambíguos e jargões técnicos: a presença de badges estáticos com termos de TI como 'Sandbox' (linha 1530) no Simulador WhatsApp e 'PIX' (linha 1559) no Financeiro misturados com crachás numéricos de contagem real; além disso, a ação de 'Dossiê de Clientes (Art. 319 CPC)' fica confusa por não ser uma aba independente na barra, mas sim uma visão embutida em Processos.

#### O que está ruim no design
1. Desaparecimento da telemetria no cabeçalho: a barra superior minimalista (linhas 1618-1639) possui apenas 44px de altura ('h-11') e eliminou completamente os indicadores de status do WhatsApp ('#status-pill' e trigger de QR Code), deixando o Legal Ops 'às cegas' sobre o estado da automação sem abrir as Configurações. O código tenta atrelar listeners de popover ('toggleQrPopover' nas linhas 10068-10078) a elementos que sequer existem no cabeçalho visível.
2. Ausência de breadcrumbs reais: o cabeçalho possui apenas o span plano '#top-bar-page-name' (linha 1622), sem indicar a categoria estrutural (ex: 'Operação', 'Automação', 'Controladoria') nem subníveis de processos ou clientes. O cabeçalho detalhado anterior ('#main-header') foi escondido com 'class=hidden' (linhas 1458-1461), descartando o subtítulo de contexto operacional.
3. Redundância de controles e poluição visual: existem dois botões distintos para recolher a barra lateral com o mesmo atalho Ctrl+B ('#btn-toggle-sidebar' no topo e '#btn-sidebar-collapse-toggle' no rodapé, linhas 1479 e 1610), além de inconsistência no tratamento de badges no modo colapsado, exigindo um MutationObserver em JS (linhas 10115-10134) para tentar limpar tags de texto que usam a mesma classe dos contadores numéricos.

#### Sugestões de melhoria
1. Corrigir o ciclo de navegação sequencial: remover imediatamente 'dossie-clientes' do array 'ORDEM_ABAS' no controlador da barra (linha 10049), garantindo que os atalhos 'Alt + Seta Direita/Esquerda' transitem unicamente pelas abas ativas e visíveis da sidebar sem loops reversos.
2. Implementar navegação real por setas no Spotlight: adicionar manipulador de eventos de teclado (ArrowDown, ArrowUp) no '#spotlight-input' para alternar a classe de foco ativo entre os itens renderizados em '#spotlight-results', disparando com 'Enter' exatamente o item focado.
3. Restaurar o Status Pill de Conexão WhatsApp no Cabeçalho: reintroduzir o componente '#status-pill' ao lado do botão Spotlight na barra superior (linha 1625), permitindo abrir o popover do QR Code em qualquer tela sob demanda e fornecendo telemetria em tempo real (online/offline/conectando) para o Legal Ops.
4. Transformar '#top-bar-page-name' em Breadcrumb Hierárquico: exibir a trilha completa navegável (ex.: 'Operação / Clientes & Processos > Dossiê') e separar os badges da sidebar entre contadores dinâmicos (numéricos) e tags de módulo (texto fixo), evitando gambiarras de CSS/JS para o modo recolhido.

---

### Persona #10 — Dra. Helena (59 anos) — Advogada em Notebook Pequeno (1366x768)
- **Nota UX (escala 0–10):** `5 / 10`

#### O que está difícil de entender
1. Deslocamento abrupto de contexto: o botão 'Personalizar Mensagens do Bot' (#btn-toggle-msg-processos) localizado no cabeçalho da Gestão de Processos executa 'ativarAba(fluxo)' e força a mudança para a sub-aba de mensagens, tirando a advogada repentinamente da triagem processual sem aviso prévio.
2. Botão 'Liberar Reenvio' (#btn-resetar-visto-ficha): o termo soa como jargão técnico/flag interna de banco de dados (resetar cache/visto) e não deixa claro ao operador jurídico que sua função prática é permitir que o cliente realize uma nova consulta automática via WhatsApp.
3. Jargões de TI desnecessários: 'Higienizar Base' (#btn-higienizar-base) em vez de 'Remover Duplicados', e a exposição de caminhos de diretório de sistema como 'Pasta: ./documentos_clientes/' na galeria de documentos forenses.
4. Duplicidade conceitual na 'Aba Fluxo': a coexistência de três sub-abas ('Central de Mensagens', 'Editor de Menus & Árvore' e 'Central de Ações') gera dúvida sobre onde de fato as mensagens do robô devem ser cadastradas, pois há campos de texto tanto no painel de mensagens com balões quanto no editor de árvore.
5. Instrução truncada de triagem: o texto 'Ao receber o resumo: 1 encerra • 2 chama o advogado' abaixo do campo de resumo do andamento parece uma anotação de configuração de bot misturada aos dados do processo.

#### O que está ruim no design
1. Desperdício crítico de espaço vertical em tela 768p: o card de 'Importação Inteligente de Pastas' (#dropzone-processos) fica permanentemente aberto no topo com mais de 220px de altura, empurrando a lista de processos e a ficha cadastral para fora da primeira dobra visível.
2. Armadilha de rolagem interna dupla (Nested Scrolling): as colunas possuem alturas calculadas com 'max-h-[calc(100vh-200px)]' e 'overflow-y-auto' (#lista-processos-box e #box-form-processo), gerando barras de rolagem aninhadas que travam a navegação no trackpad do notebook.
3. Superlotação no cabeçalho da ficha do processo: em uma coluna de proporção 7/12 (apenas ~680px úteis), o cabeçalho agrupa o avatar, títulos e uma fileira de até 6 botões de ação ('Copiar CPC', 'Ver Dossiê', 'Solicitar Docs', 'Anexar Peça', 'Liberar Reenvio' e exclusão). Isso provoca quebra de linha desordenada (flex-wrap) e empurra o formulário para baixo.
4. Compressão horizontal excessiva dos dados processuais: a linha de identificação (#detalhe-pane-processo) divide CPF, Nº do Processo e Nome em 3 colunas rígidas ('sm:col-span-4'). O número CNJ (25 dígitos: '0000000-00.2026.8.00.0000') fica espremido e sofre corte visual.
5. Tipografia microscópica e fadiga visual: uso disseminado de fontes minúsculas (text-[9px], text-[10px] e text-[11px]) em badges, botões, horários dos balões e campos auxiliares, gerando grande esforço de leitura para uma usuária de 59 anos em monitor de baixa densidade de pixels.

#### Sugestões de melhoria
1. Transformar a área de 'Importação Inteligente / Dropzone' em um painel retrátil (accordion colapsável) ou botão modal compacto, liberando imediatamente os 220px de altura vertical para que a lista e a ficha do processo fiquem visíveis sem rolagem inicial.
2. Reorganizar o cabeçalho da ficha do processo: manter visíveis apenas os botões de ação primária ('Salvar' e 'Copiar CPC') e agrupar as ações secundárias ('Liberar Reenvio', 'Anexar Peça', 'Solicitar Docs' e 'Excluir') dentro de um menu suspenso de ações secundárias (botão '···' / Mais Ações), eliminando a quebra de linha feia.
3. Ajustar a grade de inputs para notebooks: reconfigurar o grid de 3 colunas ('sm:col-span-4') para 2 colunas ('col-span-12 md:col-span-6') para CPF e Nome, deixando o campo de 'Nº do Processo (CNJ)' com largura total ou destaque para comportar os 25 caracteres sem truncamento.
4. Padronizar a escala tipográfica acessível: eliminar textos inferiores a 12px ('text-xs'), aumentando os rótulos de 10px/11px para no mínimo 12px/13px, e substituir termos técnicos por vocabulário jurídico claro ('Remover Duplicidades' em vez de 'Higienizar Base'; 'Permitir Nova Consulta do Cliente' em vez de 'Liberar Reenvio').
5. Eliminar rolagens aninhadas, unificando a rolagem na viewport principal ou estabelecendo altura flexível integrada sem travar o scroll da página.

---

### Persona #11 — Dr. Rafael (36 anos) — Advogado Criminalista (Plantão e Horários)
- **Nota UX (escala 0–10):** `5.8 / 10`

#### O que está difícil de entender
1. Jargões de TI e Call Center: O cabeçalho da Fila de Espera exibe badges com 'Transbordo & Prioridade' e 'Copilot 1-Clique Ativo'. Para a rotina jurídica de um criminalista, o termo 'transbordo' é puramente técnico e confuso (o correto seria 'Fila de Espera Humana' ou 'Casos em Plantão').
2. Ambiguidade nos prefixos de mensagens da Agenda: Os campos 'Início da mensagem enviado no horário de almoço' e 'Início da Mensagem Fora de Expediente' deixam dúvidas se o robô apenas anexa essa frase e segue conversando sozinho (conforme insinua o texto de apoio 'segue adiantando o atendimento') ou se ele encerra o atendimento até a reabertura do escritório.
3. Botão 'Reativar Robô' sem consequência clara: Fica no topo direito de cada card da fila humana em tom chamativo, mas o advogado não sabe se ao clicar nele o robô vai disparar uma mensagem para o cliente, apagar a fila ou ignorar o atendimento que o advogado acabou de iniciar.
4. Falta de feedback visual em dias desativados: Na grade semanal de horários, ao desmarcar o checkbox de um dia (ex: Domingo), os campos de horário de 'Abertura' e 'Fechamento' continuam com o mesmo contraste e ativos para edição, gerando dúvida se aquele horário ainda terá efeito no sistema.

#### O que está ruim no design
1. Conteúdo crítico escondido atrás de clique: No 'aba-pausados', mesmo para clientes com badge '🚨 URGÊNCIA CRÍTICA (URGÊNCIA MÁXIMA)', todo o conteúdo vital — o player de áudio com as mensagens de voz recebidas, a transcrição fonética e o resumo executivo — vem oculto por padrão dentro de uma div com a classe 'hidden' (#painel-resumo), exigindo que o advogado clique obrigatoriamente no botão 'Ver Resumo do Cliente'. Em plantão de flagrante criminal, cada segundo conta e esse dado deveria estar imediatamente visível.
2. Inversão de prioridade visual nos botões: O botão 'Reativar Robô' tem enorme destaque visual em degradê dourado ('champagne-gradient') logo no topo do card ao lado do nome do cliente, facilitando cliques acidentais que devolvem uma emergência penal para a automação antes mesmo do advogado ler o caso. Por outro lado, a caixa e o botão de 'Enviar Resposta' ficam escondidos no rodapé do painel expansível.
3. Botão fora de contexto para o Direito Penal: Cada card traz em destaque o botão 'Solicitar Documentos' (#btn-solicitar-docs), o que é inadequado para um cliente detido em flagrante ou em audiência de custódia onde a prioridade é contato imediato e não recolhimento prévio de papelada.
4. Falta de suporte a plantão noturno e virada de turno na Agenda: A grade semanal (#grade-dias-semana) só permite definir 'Abertura' e 'Fechamento' no mesmo dia com campos type='time', sem prever plantões noturnos que cruzam a meia-noite (ex: 19:00 às 07:00) nem uma opção 'Plantão 24 Horas'.
5. Almoço rígido e genérico: A 'Pausa de Almoço Automática' possui apenas um horário de início (12:00) e fim (13:30) compartilhado por toda a semana, sem possibilidade de desativar o almoço nos finais de semana de plantão mantendo nos dias úteis.
6. Tipografia excessivamente miúda e poluição visual: Uso saturado de textos minúsculos ('text-[10px]', 'text-[11px]'), classes 'animate-pulse' permanentes em múltiplos elementos do card crítico e contraste idêntico nos fundos escuros ('bg-zinc-950/60', 'border-zinc-800/80'), gerando fadiga visual rápida durante a madrugada.

#### Sugestões de melhoria
1. Auto-abertura obrigatória para Urgências Críticas: Na renderização da Fila de Espera, se 'nivelUrgencia === CRITICA', o '#painel-resumo' deve vir aberto por padrão (sem a classe 'hidden'), expondo de imediato o player de áudio, a transcrição da ocorrência e o resumo executivo do caso penal.
2. Botão de Ligação Telefônica Direta: Incluir nos cards de urgência crítica um botão de ação prioritária 'Ligar Imediatamente' (link direto 'tel:' ou atalho de discagem via WhatsApp), essencial para contatar a família ou a delegacia sem perder tempo digitando.
3. Modo Plantão 24h e Turno Noturno na Agenda: Implementar um toggle por dia da semana 'Plantão 24h' (que oculta os campos de horário e mantém atendimento irrestrito) e permitir horários de fechamento no dia seguinte (ex: das 18:00 às 08:00), além de uma regra explícita de exceção: urgências penais identificadas pela IA devem furar a mensagem de fora de expediente e alertar o criminalista de plantão com som prioritário.
4. Ajuste na hierarquia dos botões do card: Rebaixar o botão 'Reativar Robô' para um botão secundário discreto (estilo outline/neutro) e posicionar a caixa de resposta rápida e o botão 'Enviar Resposta' em evidência no topo ou logo abaixo da identificação da urgência.
5. Humanização dos rótulos: Substituir 'Transbordo & Prioridade' por 'Fila de Plantão & Intervenção Humana' e esclarecer no campo de fora de expediente: 'Aviso que o cliente recebe antes da resposta da IA quando o escritório estiver fechado'.

---

### Persona #12 — Juliana (31 anos) — Coordenadora de Atendimento (Auditoria de Conversas)
- **Nota UX (escala 0–10):** `4.5 / 10`

#### O que está difícil de entender
Há um excesso gritante de jargões técnicos de TI e terminologia importada de blockchain/cripto que não fazem sentido para uma equipe de atendimento jurídico: termos como 'Ledger Forense', 'Live Stream 24/7', 'Ledger de Auditoria' e '● Ledger Ativo' confundem a operação, que só precisa saber se as mensagens do WhatsApp estão sendo registradas. A mensagem do estado vazio menciona 'transbordo humano em tempo real' (jargão técnico de call center em vez de 'encaminhamento para advogados') e 'registrada nesta sessão', gerando insegurança se o histórico é salvo permanentemente ou se desaparecerá ao fechar o programa. Além disso, a filtragem rápida por botões ('Todos', 'Clientes', 'Robô') fragmenta a conversa: ao clicar em 'Robô', veem-se respostas isoladas sem a pergunta do cliente, impossibilitando auditar se a resposta automatizada foi coerente com o contexto.

#### O que está ruim no design
A área principal de exibição (#logs-box) foi desenhada como um terminal/console de programador, utilizando tipografia monoespaçada (font-mono text-xs) e fundo ultra escuro (bg-zinc-950/80) com microtextos de 10px e 11px em cinza de baixo contraste (text-zinc-500). As mensagens aparecem em um fluxo cronológico linear único e desordenado, misturando clientes e respostas automáticas em vez de agrupar em conversas ou threads por cliente. O campo de busca (#input-filtro-logs) também usa fonte monoespaçada e fica espremido em uma barra superior compacta. Além disso, o botão de risco crítico 'Limpar Histórico' (#btn-limpar-logs) está posicionado com destaque imediato no cabeçalho executivo ao lado do título, sem qualquer barreira visual de segurança ou aviso de que apagará dados essenciais de auditoria.

#### Sugestões de melhoria
Transformar a aba de terminal em uma verdadeira central de Auditoria de Atendimento no formato Master-Detail (duas colunas): à esquerda, uma lista organizada de clientes/conversas recentes com nome, telefone, última interação e tag de status (ex.: 'Com Robô', 'Encaminhado ao Advogado'); à direita, a timeline completa e contínua da conversa selecionada com balões legíveis de diálogo (estilo chat moderno com fonte padrão sem serifa), diferenciando claramente as falas do cliente, do robô e dos advogados. Substituir os jargões 'Ledger Forense' e 'Live Stream' por termos amigáveis como 'Auditoria de Conversas' e 'Monitoramento Ativo'. Ajustar os filtros para critérios operacionais úteis ('Todas', 'Aguardando Advogado', 'Finalizadas') e incluir um modal de confirmação obrigatório antes de executar a limpeza de registros no botão 'Limpar Histórico'.

---

### Persona #13 — Dr. Eduardo (48 anos) — Sócio Focado em Backup e Nuvem
- **Nota UX (escala 0–10):** `4.2 / 10`

#### O que está difícil de entender
A distinção entre o Backup Local e a Nuvem é confusa e gera risco de falsa sensação de segurança. Como sócio responsável pela governança de dados do escritório, ao ler 'Sincronização com Servidor Nuvem (24/7)' logo abaixo do backup, presumi que meus processos, prazos e clientes estivessem sendo salvos automaticamente na nuvem o tempo todo. Porém, o subtítulo restringe isso a 'fila humana e status do atendimento em tempo real', o que significa que NÃO é um backup em nuvem da base jurídica completa. Além disso, há uma contradição flagrante: o título promete 'Sincronização (24/7)', mas o badge ao lado indica 'Offline / Standby' e há um botão manual 'Sincronizar Agora' — se é 24/7, por que está offline e exige acionamento manual? Para piorar, a interface está repleta de jargões de infraestrutura de TI incompreensíveis para quem é do Direito: badges como 'Snapshot Instantâneo' e 'Disaster Recovery', aviso afirmando que a importação ocorre 'de forma atômica', campo técnico 'URL do Servidor Remoto' expondo o endereço cru 'https://advocacia-2-0.onrender.com', e o rótulo 'Token de Segurança (API_SECRET_TOKEN)' com placeholder de desenvolvedor ('Opcional se desativado no server...').

#### O que está ruim no design
O layout parece uma mescla entre painel corporativo e console de testes de programador (estilo Postman ou Swagger). A insistência em colocar a extensão técnica '(.JSON)' em todos os cantos (no título da aba, nas badges, nas descrições e nos botões) polui a visualização sem agregar valor negocial para o advogado. O card 'Sincronização com Servidor Nuvem (24/7)' adota uma divisão assimétrica em grid (md:grid-cols-12: 6 colunas para URL, 4 para Token e apenas 2 para o botão de ação), deixando o botão 'Sincronizar Agora' espremido e com texto apertado ao lado de caixas de entrada de código excessivamente largas. As badges de status 'Offline / Standby' com cinza apagado não deixam claro se o sistema está com erro de conexão, desativado por padrão ou aguardando configuração inicial.

#### Sugestões de melhoria
1. Separar conceitualmente o Backup dos Dados Jurídicos da Conexão de Atendimento: se a sincronização na nuvem sincroniza apenas filas e status do WhatsApp/chat, ela não deveria estar nesta aba como se fosse o backup na nuvem do escritório, ou deve ser reescrita para deixar claríssimo o escopo exato do que sobe para a nuvem. 2. Humanizar a linguagem técnica: substituir 'Snapshot Instantâneo' por 'Cópia Imediata', 'Disaster Recovery' por 'Recuperação de Emergência', retirar a menção a 'de forma atômica' (trocando por 'sem perigo de apagar ou corromper os dados existentes') e substituir a ênfase em '.JSON' por 'Arquivo de Segurança Seguro'. 3. Ocultar parâmetros de TI em um menu retrátil 'Opções Avançadas de Servidor': campos como URL do Render e API_SECRET_TOKEN nunca devem ficar expostos na rotina de um advogado; o sistema deve vir pré-conectado à nuvem contratada com um botão de chave liga/desliga ('Ativar Sincronização Automática em Nuvem') e feedback visual evidente (ex: 'Última sincronização realizada há 5 minutos').

---

### Persona #14 — Dra. Camila (27 anos) — Advogada Trabalhista em Audiência (Uso Rápido)
- **Nota UX (escala 0–10):** `4.5 / 10`

#### O que está difícil de entender
1. Pílula 'Recentes' que injeta a string '2024' na busca: O controle segmentado '#segmented-filter-processos' traz as abas 'Todos' e 'Recentes' (linhas 1960-1964), mas a função 'alternarFiltroProcessosPill' (linha 4457) executa literalmente 'inputBusca.value = '2024''. Além de apagar qualquer termo que a advogada já tivesse digitado no '#busca-processos', restringe a lista ao ano fixo '2024', quebrando totalmente a busca em audiências realizadas em 2025/2026.
2. Botão 'Copiar CPC' ambíguo e fora de contexto para audiência: O botão em destaque dourado '#btn-copiar-cpc' (linha 2011) tem rótulo que sugere cópia de dados processuais, mas copia o parágrafo formal extenso de qualificação do Art. 319 do CPC (com nacionalidade, estado civil e endereço residencial). Em plena audiência, quando o juiz ou secretário pede os dados dos autos, clicar nesse botão gera frustração imediata por encher a área de transferência com um texto de petição inicial em vez do número do processo.
3. Ausência de aba/pílula de filtro para 'Audiência': Apesar de a base de dados possuir tags específicas como 'Audiência Próxima' (ex: Mariana Vasconcelos, 45ª Vara do Trabalho, linha 4326) e estilização dedicada em 'obterEstiloTag' (linha 4287), o seletor rápido só oferece 'Todos' e 'Recentes'. A advogada é forçada a adivinhar e digitar 'Audiência' manualmente no campo de busca para filtrar a pauta do dia.
4. Rótulo 'Liberar Reenvio' confuso: O botão '#btn-resetar-visto-ficha' (linha 2027) com tooltip 'Permite que o cliente consulte novamente no WhatsApp' traz jargão de controle interno ('resetar visto') em um card processual, gerando insegurança sobre qual ação real será disparada no WhatsApp do cliente durante a audiência.

#### O que está ruim no design
1. Desperdício crítico de espaço vertical com o dropzone: No topo da aba de processos, antes da lista e busca, há a enorme seção 'Smart Import Multiformato' com o '#dropzone-processos' (linhas 1909-1952) que ocupa mais de 200px de altura. Em notebook de bancada de audiência (telas de 1366x768 ou 1080p), isso empurra a lista de processos ('#lista-processos-box') e os detalhes ('#box-form-processo') para baixo, exigindo scroll contínuo sob a pressão do pregão.
2. Ausência de botão 1-clique para copiar o número CNJ: O número do processo fica confinado em um input editável comum '<input id="proc-numero">' (linha 2061) e no texto minúsculo do card ('text-[10px] font-mono', linha 7198). Não há botão ou ícone de cópia rápida. Selecionar manualmente com cursor um número de 25 caracteres ('0014589-32.2023.5.02.0045') durante a audiência frequentemente resulta em espaços extras ou dígitos faltantes ao colar no PJe-JT.
3. Telefone/WhatsApp do cliente completamente invisível: O placeholder de '#busca-processos' afirma 'Buscar CPF, Nome, CNJ ou Telefone...', mas os cards renderizados em '#lista-processos-box' só exibem CPF e Nº do Processo (linha 7198). Além disso, o formulário '#detalhe-pane-processo' (linhas 2054-2067) sequer possui campo para telefone. Se a reclamante ou testemunha não estiver na sala do Zoom/Meet e o juiz cobrar o contato, a advogada não consegue visualizar o número na ficha do processo.
4. Inversão de prioridade visual nos botões de ação: O cabeçalho da ficha (linha 2011) concede o botão de maior destaque visual ('champagne-gradient', texto escuro e sombra) ao '#btn-copiar-cpc', enquanto dados vitais para a audiência (copiar CNJ, copiar CPF ou acionar cliente por WhatsApp) não possuem botão próprio.

#### Sugestões de melhoria
1. Botão dedicado 'Copiar CNJ' com feedback instantâneo: Adicionar um botão de cópia com ícone de clipboard tanto no card do processo em '#lista-processos-box' quanto ao lado do input '#proc-numero', permitindo cópia em 1 clique (formatada ou apenas números) com toast rápido ('CNJ copiado para a área de transferência!').
2. Visualização e atalho de Telefone/WhatsApp na Ficha e no Card: Exibir o telefone do cliente com formatação legível diretamente no card da lista e incluir uma linha de contato rápido com botão 'Chamar no WhatsApp / Ligar' no topo do painel '#detalhe-pane-processo', agilizando o contato de emergência com clientes ausentes na audiência.
3. Dropzone de importação recolhível (Accordian / Modal): Transformar o bloco '#dropzone-processos' em um botão recolhível ('Importar Arquivos') ou movê-lo para um modal/gaveta, garantindo que ao abrir a aba 'Processos', o campo de busca e a lista ocupem imediatamente a área nobre superior da tela.
4. Correção e enriquecimento das pílulas segmentadas: Corrigir o filtro 'Recentes' para ordenar por data real de atualização ('updatedAt') sem sobrescrever o campo '#busca-processos' com o texto estático '2024', e adicionar a pílula 'Audiências' no container '#segmented-filter-processos' para isolar em 1 clique os processos com audiência marcada.

---

### Persona #15 — Dr. Sérgio (55 anos) — Sócio Tributarista (Avaliador de Estética e Poluição Visual)
- **Nota UX (escala 0–10):** `5.5 / 10`

#### O que está difícil de entender
1. Terminologia conflitante sobre automação: no cabeçalho há a pílula 'Assistente IA Operante' (linha 1661), enquanto nos botões e cartões o sistema alterna entre 'Simulador' (linha 1684), 'Mensagens do Robô' (linha 1733/1822) e 'Robô Ativo' (linha 1834). Não fica claro para o sócio se o escritório usa inteligência artificial generativa, árvore de decisão pré-programada ou chatbot básico de WhatsApp.
2. Métrica enigmática '94% auto': no Card 3 de Mensagens do Robô (linha 1838), exibe-se um badge '94% auto' sem nenhum tooltip explicativo. Não dá para saber se são 94% de mensagens automáticas disparadas, 94% de resolução sem humano ou 94% de taxa de acerto.
3. Estimativa de '~0h economizadas': o badge (linha 1835) projeta economia de tempo sem explicitar a metodologia de cálculo de horas-homem ou volume considerado, parecendo um número decorativo de startup em vez de dado auditável de gestão.
4. Relação entre 'Cadastrar Processo' e 'Dossiê de Clientes': o botão rápido direciona para 'Dossiê de Clientes' (linha 1690, citando Art. 319 CPC) enquanto o card de métricas abaixo associa 'Processos Cadastrados' a 'Consultas por CPF/CNJ - 0 clientes' (linhas 1782-1784). O fluxo de inserção de pasta versus qualificação de cliente fica ambíguo para quem quer apenas consultar processos fiscais.
5. Estado contraditório 'Verificando...': o Card 4 (linha 1863) mostra 'Expediente Hoje' com uma luz verde piscante (animate-ping), mas o texto afirma 'Verificando...', gerando dúvida se a sincronização falhou ou se o escritório está realmente aberto.

#### O que está ruim no design
1. Poluição por animações piscantes contínuas (animate-ping): a tela inicial conta com 3 elementos piscando ininterruptamente nos cards de telemetria (ponto rosa em Fila de Atendimento na linha 1807, ponto verde em Robô Ativo na linha 1831 e outro ponto verde em Expediente Hoje na linha 1860). Para uma rotina de trabalho concentrada de um advogado sênior, esse pulsar constante causa fadiga visual e distração inútil.
2. Falta de sobriedade cromática e 'efeito arco-íris' nos cartões: cada um dos 4 cards de telemetria (linhas 1757, 1792, 1820 e 1849) possui um friso brilhante em degradê de cor diferente no topo (âmbar, rosa-coral, esmeralda e safira/céu), além de halos coloridos e sombras saturadas (ex.: shadow-[0_0_8px_rgba(251,191,36,0.6)] no sparkline e shadow-[0_0_15px_rgba(245,158,11,0.25)] no botão de cadastro). Essa estética de painel gamer/fintech colide com a sobriedade esperada em uma banca jurídica tradicional.
3. Excesso de microbadges e fontes diminutas: o CSS força fontes de 9px e 8.5px para 10px (!important, linhas 565-570), mas a tela continua repleta de pílulas minúsculas em fonte monoespaçada com baixo contraste em monitores normais (ex.: '0 pastas', 'Aguardando', 'Seg-Sex', '08h-18h', 'Escritório Aberto'). Para quem tem mais de 50 anos, essa profusão de micropílulas espalhadas polui a leitura.
4. Disparidade tipográfica e excessos decorativos: há uma mistura caótica entre Playfair Display serifada nos títulos (linha 1668), Plus Jakarta Sans no corpo, e font-mono em múltiplos rótulos operacionais. Além disso, o banner inicial carrega uma esfera decorativa em degradê borrado com blur-3xl (linha 1697) e o CSS global ainda define animações como 'mascot-float', 'mascot-eye' e 'blinkEye' (linhas 477-479), elementos infantis e desnecessários em um software corporativo.
5. Inversão da hierarquia visual na página: os blocos operacionais de 'Processos Recentes' e 'Mensagens do WhatsApp' (linhas 1701-1750) foram posicionados antes da grade de KPIs executivos (tour-metrics-bar, linhas 1753-1874), forçando o usuário a rolar para baixo para ver os totais consolidados do escritório.

#### Sugestões de melhoria
1. Desativar completamente as animações 'animate-ping' nos cards de status e substituí-las por indicadores sólidos discretos com cores semafóricas suaves (verde/cinza estáveis), sem efeitos de radar pulsante.
2. Unificar a identidade visual corporativa da suíte executiva: remover os gradientes de borda multicoloridos (rosa, esmeralda, céu) e halos fluorescentes dos cartões, adotando uma paleta monocromática de cinzas profundos (zinc-900/zinc-800) com acentos exclusivos em tom dourado/âmbar discreto ou bronze para destaques ativos.
3. Corrigir a hierarquia estrutural da aba-inicio: reposicionar a grade de KPIs/telemetria (tour-metrics-bar) logo abaixo do Hero Banner de boas-vindas, descendo as listas operacionais de 'Processos Recentes' e 'Mensagens' para a parte inferior da tela, respeitando a leitura natural do painel gerencial.
4. Higienizar a tipografia e rótulos: padronizar o vocabulário para termos jurídicos sóbrios ('Atendimento Automatizado' em vez de 'Mensagens do Robô' / 'Simulador'; 'Fila de Transbordo Humano' em vez de 'Fila de Atendimento'), remover rótulos crípticos como '94% auto' ou dotá-los de tooltips explicativos claros, e eliminar o uso de 'font-mono' e micropílulas de 10px em status rotineiros, elevando o corpo mínimo de legendas para 12px com espaçamento arejado.

---

### Persona #16 — Dra. Beatriz (34 anos) — Advogada Consumidorista (Gestão de WhatsApp e Spam)
- **Nota UX (escala 0–10):** `5.5 / 10`

#### O que está difícil de entender
Conflito conceitual perigoso entre 'Escudo VIP' e 'Bloqueio/Blacklist': a interface mistura na mesma tela dois públicos opostos. O cabeçalho estampa 'Escudo VIP & Blacklist' e os botões rápidos preenchem 'Sócio / Advogado', 'Vara Judicial / Juiz', 'Familiar' e 'Fornecedor', mas o botão de confirmação chama-se categoricamente 'Bloquear' (#btn-add-ignorado) e o topo marca 'Restrição Absoluta' com contador 'Total Bloqueados'. Para uma advogada, clicar em 'Bloquear' para o Juiz da Vara ou para o Sócio gera pânico de estar rompendo contato telefônico ou bloqueando no WhatsApp, quando o texto de apoio oculta que se trata apenas de suprimir disparos automáticos e lembretes PIX. Além disso, embora a persona busque conter spam, não existe nenhum chip rápido para 'Spam', 'Telemarketing' ou 'Golpe'. Por fim, 'Contatos Ignorados' está agrupado ilogicamente na sidebar sob 'Controladoria' (ao lado de Financeiro e Histórico), em vez de estar em 'Operação' junto da fila de atendimento e WhatsApp.

#### O que está ruim no design
Omissão do status de conexão do WhatsApp na barra superior: a barra do topo (linhas 1618–1639) possui apenas a busca global (#btn-top-spotlight) e o botão genérico de Configurações (#btn-top-configuracoes); não há indicador visível se o WhatsApp está conectado nem gatilho direto para abrir o popover do QR Code, forçando a advogada a abandonar seu trabalho e abrir a aba de Configurações inteira só para checar a sessão. Na aba de ignorados (linhas 3009–3024), o formulário aperta o botão '#btn-add-ignorado' em apenas 2 colunas (sm:col-span-2) com gradiente champagne contra campos de 5 colunas, estrangulando o texto 'Bloquear' com ícone. Há poluição visual com excesso de alertas cromáticos dissonantes: badge pulsante vermelho (#rose-400), badge cinza mono, contador em caixa isolada e botões em dourado, transmitindo tom alarmista exagerado. O card de estado vazio (#lista-ignorados) tem altura excessiva (p-10) enquanto a lista real fica confinada a max-h-[420px].

#### Sugestões de melhoria
1. Exibir Status e QR Code no Topo: Inserir na barra superior (#top-bar), ao lado de Configurações, uma pílula interativa de status do WhatsApp (ex: ponto verde 'Conectado' ou âmbar piscante 'Reconectar QR Code') que abra o popover do QR Code com 1 clique em qualquer tela do sistema, sem exigir entrar em Configurações. 2. Separar 'Contatos VIP (Sem Robô)' de 'Blacklist / Spam Real': Dividir a funcionalidade em dois módulos ou abas distintas: uma para 'Atendimento Pessoal / VIP' (Sócio, Juiz, Família) com botão 'Isentar de Robô', e outra para 'Bloqueio de Spam / Telemarketing' com chips dedicados ('Telemarketing', 'Cobrança', 'Fraude') e botão claro 'Bloquear Número'. 3. Redesenhar o Formulário e Importação Rápida: Ajustar a largura do botão de cadastro (sm:col-span-3 ou botão em linha dedicada) e incluir um botão para 'Puxar número recente do WhatsApp / Fila de Atendimento', evitando a digitação manual de números de 13 dígitos no input #input-ignorado-numero. 4. Reorganizar na Navegação: Mover 'Contatos Ignorados' do menu 'Controladoria' para 'Operação' ou vinculá-lo diretamente às opções de gestão do WhatsApp.

---

### Persona #17 — Dr. André (40 anos) — Advogado Imobiliário (Fluxo Processo <-> Financeiro)
- **Nota UX (escala 0–10):** `4.5 / 10`

#### O que está difícil de entender
1. Ruptura total de fluxo e retrabalho manual: Na aba Processos (linhas 2070-2145) não existe campo algum de honorários, valor da causa ou contrato imobiliário. Ao ir para a aba Financeiro (linhas 3388-3419), Dr. André é obrigado a redigitar 'Nome do Cliente *' e 'WhatsApp *' (sem máscara telefônica, exigindo formato '5511999999999'). Não há campo para vincular ao 'Nº do Processo (CNJ)' nem CPF, impedindo saber a qual ação judicial ou contrato imobiliário aquela cobrança pertence.
2. Jargões de desenvolvedor assustadores: No subtítulo da aba financeira (linha 3251), lê-se 'dispare com delay anti-ban'. Para um advogado de 40 anos, 'delay anti-ban' é gíria de TI ininteligível que gera insegurança jurídica de ter a linha do escritório bloqueada pelo WhatsApp.
3. Rótulo enganoso 'Salvar PIX': O botão id='btn-salvar-config-cobranca' (linha 3328) no bloco 'Régua de Cobrança Semanal' está rotulado apenas como 'Salvar PIX', mas salva conjuntamente a frequência semanal (1x, 2x, 3x) e os dias da semana selecionados, induzindo o usuário a achar que só salvou a chave bancária.
4. 'Recebido na Semana (IA)' e 'Visão Computacional Gemini': Usar o sufixo '(IA)' no KPI financeiro e o selo 'Visão Computacional Gemini' gera confusão se o valor foi efetivamente creditado na conta ou se é apenas uma estimativa/leitura automatizada não auditada por humano.
5. Mensagem solta e críptica no processo: Na linha 2081, o texto 'Ao receber o resumo: 1 encerra • 2 chama o advogado.' surge solto acima do botão 'Salvar Pasta do Processo', sem contexto de como essa automação de triagem se relaciona com cobranças ou com o cliente.

#### O que está ruim no design
1. Microtipografia e baixo contraste: Uso generalizado de classes 'text-[10px]' e 'text-[11px]' com 'text-zinc-400' sobre fundos escuros ('bg-zinc-900/50', 'bg-zinc-950/70' e 'bg-zinc-950/80'), tanto no formulário de Dossiê Forense (linhas 2107-2132) quanto nos formulários e cards de KPIs financeiros (linhas 3268-3312 e 3334-3412). Para um advogado de 40 anos acostumado a ler contratos e certidões, as fontes minúsculas geram fadiga visual.
2. Layout verticalmente espremido na coluna de parcelas: Na coluna direita da aba Financeiro (linhas 3382-3430), agrupa-se em 7 colunas o formulário 'Lançar Nova Parcela de Honorários' e logo abaixo a lista '#tabela-parcelas' com altura máxima engessada em 'max-h-[360px] overflow-y-auto'. Isso obriga o usuário a lidar com rolagem interna restrita bem abaixo de botões de ação pesados.
3. Seletor de dias da régua em micro-botões apertados: A grade 'grid-cols-5 gap-1.5' com checkboxes individuais para os dias da semana (Seg a Sex, linhas 3344-3365) possui área de clique minúscula com rótulos 'text-[11px]', parecendo uma gambiarra visual desconectada do restante dos controles executivos.
4. Ausência de indicadores financeiros dentro da pasta do processo: Ao consultar a ficha de um processo imobiliário ('detalhe-pane-processo' e 'detalhe-pane-dossie'), não há nenhum selo, badge ou sumário que informe se os honorários daquele caso estão pendentes, em dia ou quitados.

#### Sugestões de melhoria
1. Unificação do cadastro de honorários na Ficha do Processo: Criar uma terceira sub-aba no box do processo (ao lado de 'Ficha do Processo' e 'Dossiê Civil') denominada 'Honorários & Contrato', permitindo cadastrar valor, parcelas, vencimento e vincular diretamente à pasta do processo sem trocar de aba.
2. Vínculo automático no Financeiro: Na aba Financeiro ('Lançar Nova Parcela'), substituir os campos de texto livre por um campo de busca/seleção do Processo/Cliente já cadastrado, preenchendo automaticamente Nome, Telefone formatado e Nº do Processo (CNJ).
3. Higienização de jargões técnicos: Substituir 'dispare com delay anti-ban' por 'disparo inteligente com espaçamento de segurança'; renomear o botão 'Salvar PIX' para 'Salvar Régua & PIX'; e ajustar o KPI 'Recebido na Semana (IA)' para 'Honorários Recebidos (PIX Confirmado)'.
4. Badge de status financeiro na pasta do processo: Exibir no cabeçalho do processo (junto ao avatar e título da pasta) uma pílula informativa do status de pagamento (ex: 'Honorários: 2/6 pagos - Em dia' ou '1 parcela pendente'), permitindo ao advogado imobiliário ter visão 360° do cliente em uma única tela.

---

### Persona #18 — Dra. Larissa (30 anos) — Advogada no Primeiro Dia de Uso (Onboarding)
- **Nota UX (escala 0–10):** `5.5 / 10`

#### O que está difícil de entender
O fluxo de inicialização é desorientador para uma advogada no primeiro dia. Logo no cockpit (#tour-home-banner), os chips informativos exibem estaticamente 'WhatsApp Ativo' (com ponto verde) e 'Assistente IA Operante' (com ponto âmbar), transmitindo a impressão equivocada e assustadora de que o sistema já está integrado ao WhatsApp do escritório e interagindo com clientes, antes mesmo de qualquer leitura de QR Code. Além disso, a ordem natural de implantação (Login -> Conectar WhatsApp -> Cadastrar Processos -> Configurar Robô) é ignorada nas ações rápidas: os botões oferecidos são 'Cadastrar Processo', 'Simulador', 'Fila de Atendimento' e 'Dossiê de Clientes (Art. 319 CPC)', sem nenhum botão primário para parear o WhatsApp ou cadastrar dados do robô. Para completar, há excesso de jargões de TI nos modais e telas de transição, como 'Smart Ingestão Multiformato com deduplicação inteligente', 'Simulador de WhatsApp Sandbox', 'transbordo humano', 'motor de alta velocidade' e a instrução técnica de digitar a palavra 'RESETAR' para redefinir credenciais.

#### O que está ruim no design
O design apresenta graves incoerências visuais em estados vazios e emissão de alarmes falsos. Na tela de login (#auth-screen), os campos de nome do escritório e chave de recuperação ficam ocultos com classe 'hidden', sem nenhum botão ou aba para 'Primeiro Acesso / Cadastre seu Escritório', gerando dúvida se a usuária já deveria ter um usuário pré-existente. No Cockpit (#aba-inicio), o bloco de 'Processos Recentes' (#home-ultimos-processos) é um container cru totalmente em branco, sem card explicativo ou CTA acolhedor para o primeiro cadastro. Na Bento Grid de métricas (#tour-metrics-bar), há poluição visual e falsos alertas: o card de 'Fila de Atendimento' exibe um dot-ping vermelho piscando (animate-ping bg-rose-400) com status 'Prioritário' mesmo com valor '0'; o card de 'Processos Cadastrados' mostra um mini sparkline estático com barras âmbar altas fingindo 'atividade dos últimos 7 dias' quando há '0 pastas'; e o card de automação mostra 'Robô Ativo' e badge '94% auto' com ping verde antes de qualquer configuração real. O modal de recuperação (#modal-recuperar-senha) também parece uma tela inacabada de desenvolvedor.

#### Sugestões de melhoria
1. Adicionar um Checklist de Onboarding Progressivo ('Primeiros Passos da Dra. Larissa') no topo do Cockpit quando o escritório estiver zerado, com indicador visual de etapas (ex: 0 de 4 concluídos): 1º 'Conectar WhatsApp do Escritório (QR Code)' -> 2º 'Cadastrar ou Importar Primeiros Processos' -> 3º 'Definir Horários e Mensagens do Robô' -> 4º 'Fazer Teste no Simulador'. 2. Corrigir os chips de status no banner (#tour-home-banner) e os cartões de telemetria para refletirem o estado real: se o WhatsApp não estiver pareado, exibir chip âmbar 'WhatsApp Desconectado' com link direto para conexão; ocultar os pings de alerta (animate-ping) e os gráficos sparklines quando as métricas forem zero. 3. Substituir o container vazio de processos (#home-ultimos-processos) por um Empty State convidativo com ilustração e botão centralizado 'Cadastrar Meu Primeiro Processo'. 4. Na tela de login, criar uma alternância clara entre 'Entrar' e 'Primeiro Acesso / Configurar Novo Escritório', substituindo comandos de console como 'RESETAR' por instruções jurídicas amigáveis de redefinição de chave mestra.

---

### Persona #19 — Dr. Marcelo (44 anos) — Advogado com Baixa Visão e Daltonismo (Acessibilidade)
- **Nota UX (escala 0–10):** `4.5 / 10`

#### O que está difícil de entender
1. Jargões de TI e termos técnicos desconectados da prática forense: O uso frequente de expressões como 'Visão Computacional Gemini' (linha 3243), 'delay anti-ban' (linha 3251), 'Sandbox' no badge de Simulador (linha 1530) e 'Hub Unificado • CPC Art. 319 & IA Forense' (linha 1889) gera estranheza e insegurança. Para um advogado que já lida com o esforço visual de leitura, decifrar terminologia de programador adiciona fricção cognitiva desnecessária.
2. Botão de disparo com ação incerta e risco de envio inadvertido: O botão 'Revisar e Disparar Régua' (linha 3255) em destaque dourado brilhante não deixa claro se o clique provocará o envio instantâneo de mensagens de cobrança aos clientes no WhatsApp ou se apenas abrirá uma tela de confirmação prévia. Usuários com baixa visão evitam clicar com medo de cometer um erro irreversível perante a clientela.
3. Rótulo contraditório na Régua de Cobrança: O bloco é denominado 'Régua de Cobrança Semanal' (linha 3325), mas o botão principal de gravação tem o rótulo restrito 'Salvar PIX' (linha 3328). Não fica claro se ao clicar ali o sistema salva também a frequência (1, 2 ou 3 vezes) e os dias da semana marcados (Seg/Qui), ou se grava estritamente a chave digitada.
4. Cores aleatórias e confusas em rótulos de formulário: No bloco de cadastro de parcelas (linhas 3394-3411), os rótulos misturam cores sem critério semântico: 'Nome do Cliente' em cinza claro (text-zinc-200), 'Valor Parcela' em verde esmeralda (text-emerald-400) e 'Qtd Parcelas' em dourado (text-amber-400). Para quem tem daltonismo, isso transmite a falsa impressão de que verde significa campo já validado ou opcional, quando na verdade é apenas enfeite estético.

#### O que está ruim no design
1. Microfontes generalizadas (inacessíveis para baixa visão): O sistema recorre extensivamente a classes text-[10px], text-[11px] e text-xs em elementos fundamentais. Mesmo com o CSS forçando 8.5px e 9px para 10px (linhas 565-570), 10px em monitores comuns é ilegível sem esforço extremo ou lupa. Exemplos visíveis: chips de status no cockpit ('WhatsApp Ativo', 'Assistente IA Operante' e 'Escritório Aberto' a text-[10px], linhas 1655-1663); legendas dos cards de telemetria ('pastas', '08h-18h', '94% auto' a text-[10px], linhas 1768, 1838, 1869); e todos os cabeçalhos dos 4 KPIs financeiros ('Recebido na Semana (IA)', 'Total a Receber Geral' a text-[10px], linhas 3268, 3281, 3294, 3307).
2. Dependência de cor pura em indicadores minúsculos (bloqueio para daltônicos): A verificação de status operacional e de fila apoia-se em pontos de 6px a 8px (w-1.5 h-1.5 e h-2 w-2) que alternam entre verde esmeralda (bg-emerald-400) e âmbar/vermelho (bg-amber-400 / bg-rose-500, linhas 1656-1660, 1806-1809 e 1830-1833). Para quem tem daltonismo vermelho-verde (deuteranopia ou protanopia), essas microesferas piscantes sem ícone geométrico de diferenciação (como check, triângulo ou cruz) tornam impossível saber se a fila está com alertas críticos ou se o robô está ativo.
3. Linhas decorativas de 1.5px/2px imperceptíveis e baixo contraste de seleção: Os cartões utilizam filetes superiores com espessura de apenas 1.5px e 2px (h-[1.5px] e h-[2px]) com opacidade reduzida (opacity-40, linhas 1757, 1792, 3266, 3279), que desaparecem sobre o fundo cinza escuro. Além disso, a seleção dos 'Dias Permitidos para Disparo' (linhas 3344-3365) usa checkboxes minúsculos padrão em caixas cinzas escuras (bg-zinc-950/80); não há mudança de cor de fundo ou contorno espesso quando o dia está marcado ou desmarcado.
4. Gráfico sparkline inacessível: O mini gráfico de 7 dias (linhas 1771-1779) é composto por barras finíssimas de 4px (w-1) em tons sutis de cinza e âmbar, sem rótulos textuais nem números acessíveis via leitor de tela ou alto contraste.

#### Sugestões de melhoria
1. Botão de acessibilidade visual na barra superior (Zoom de Tipografia e Alto Contraste): Adicionar na barra superior (ao lado de Buscar Ctrl+K e Configurações, linha 1625) um controle de tamanho de fonte (A- / A / A+) que garanta piso mínimo de 13px para textos secundários e 15px para títulos, além de um atalho para modo de Alto Contraste (preto absoluto #000000, texto branco puro #FFFFFF e contornos de foco amarelo vibrante #FFD700 com espessura de 2px).
2. Redesenho de status para daltonismo com ícones semânticos de apoio: Substituir as bolinhas lisas de 6px/8px por ícones com formatos geométricos distintos e alto contraste: um selo com ícone de 'V' (check) para status ativo/conectado, um triângulo com exclamação para fila com espera/atenção e um quadrado com 'X' para pausado/inativo, sempre acompanhados de rótulo textual legível com contraste mínimo de 7:1 (padrão WCAG AAA).
3. Botões de dias da semana em estilo Pill com feedback de alto relevo: Reformular os checkboxes de dias de disparo da cobrança (Seg a Sex, linha 3345) em botões de toque largo que, quando ativados, preencham o fundo em tom dourado escuro com borda evidente de 2px e texto escuro de alta legibilidade, tornando inequívoca a identificação dos dias habilitados sem exigir esforço visual.
4. Ajuste de rótulos e prevenção de erros: Renomear o botão 'Revisar e Disparar Régua' para 'Revisar Régua de Cobrança (Prévia)', assegurando ao profissional que a ação abre uma conferência antes do envio; trocar o rótulo 'Salvar PIX' para 'Salvar Configurações da Régua e PIX'; e padronizar todas as etiquetas de campos de formulário na cor cinza neutro de alto contraste, reservando o asterisco vermelho com tooltip para identificar campos obrigatórios.

---

### Persona #20 — Dra. Vanessa (37 anos) — Sócia Full-Service (Revisão de IA e Copilot)
- **Nota UX (escala 0–10):** `5.8 / 10`

#### O que está difícil de entender
1. Ausência de confirmação e prévia do disparo no WhatsApp: O botão 'Enviar Resposta' (linhas 7653 e 9886) dispara a mensagem instantaneamente para o WhatsApp do cliente e deleta o card da tela ('card.remove()', linha 9950), sem qualquer diálogo de confirmação, pré-visualização de formatação ou opção de desfazer, gerando enorme insegurança para o advogado sócio.
2. Ambiguidade entre 'Enviar Resposta' e 'Reativar Robô': O card traz um botão destacado 'Reativar Robô' no topo direito (linhas 7607 e 9844) e 'Enviar Resposta' no rodapé (linhas 7653 e 9886). Não é óbvio se responder ao cliente já reativa o robô automaticamente ou se o mantém em espera humana.
3. Jargões técnicos desnecessários: Rótulos como 'Transcrição Fonética (Áudio / Mensagens)' (linha 7628) em vez de uma nomenclatura jurídica/executiva clara como 'Transcrição do Áudio do Cliente', e metadados no dossiê como 'Catalogado (IA)' (linha 6272).
4. Desconexão do fluxo do Dossiê: O 'modal-dossie-processo' existe para catalogar peças e histórico, mas no card da fila de atendimento pausado não há botão para abrir o dossiê daquele cliente antes de validar a sugestão do Copilot.

#### O que está ruim no design
1. Caixa de resposta em linha única: A digitação/edição da resposta e o recebimento das sugestões do Copilot utilizam um '<input type=\"text\">' simples (linhas 7652 e 9885: 'input-resposta-${cardId}'). Mensagens jurídicas contêm múltiplos parágrafos e saudações formais; num input de texto único, a mensagem fica achatada e corta o conteúdo horizontalmente, tornando péssima a revisão do texto sugerido pela IA.
2. Área de conteúdo do Dossiê estrangulada: No 'modal-dossie-processo' (linhas 1290-1340), as listas de peças e histórico usam 'max-h-72' (288px), criando um container com rolagem interna minúsculo e desconfortável em monitores modernos.
3. Glitch visual no botão de anexos do Dossiê: O botão '#btn-dossie-anexar-mais' (linhas 1331-1333) contém dois ícones SVG de clipe renderizados lado a lado (um SVG inline completo com path e outro com use '#icon-paperclip'), gerando duplicação visual evidente.
4. Poluição visual nos Cards da Fila: Excesso de badges empilhados com animações concorrentes ('animate-pulse', 'animate-ping', linhas 7511-7520), misturando múltiplas tonalidades (rose, âmbar, esmeralda, zinco) e botões compactos com pesos visuais desbalanceados.

#### Sugestões de melhoria
1. Substituir imediatamente o '<input type=\"text\">' de resposta por um '<textarea>' com altura dinâmica (min-h-[90px]), suporte a quebras de linha visíveis e atalhos de formatação do WhatsApp (*negrito*, _itálico_).
2. Criar uma etapa de confirmação com 'Prévia do WhatsApp': ao clicar em 'Enviar Resposta', abrir um popover ou modal de confirmação mostrando a simulação exata do balão verde do WhatsApp, com o destinatário e duas caixas de seleção: '[ ] Reativar robô após envio' ou '[x] Manter robô pausado para novos esclarecimentos'.
3. Integrar o Dossiê ao Card da Fila: adicionar um botão 'Consultar Dossiê do Processo' no cabeçalho do card pausado, abrindo o modal com as peças e andamentos daquele caso para subsidiar a conferência do resumo da IA.
4. Corrigir o botão '#btn-dossie-anexar-mais' eliminando a tag SVG duplicada e expandir o container do dossiê para ocupar melhor a altura disponível da janela (flex-1 dinâmico em vez de max-h-72 fixo).

---
