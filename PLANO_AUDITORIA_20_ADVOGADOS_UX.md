# 📋 PLANO DE AUDITORIA UX/UI: 20 ADVOGADOS E USUÁRIOS DO ESCRITÓRIO (B2B)

> **Projeto:** Advocacia Studio Pro v2.0 (`index.html`)  
> **Modo de Execução:** 100% Somente-Leitura (`READ-ONLY` — nenhuma linha de código do aplicativo pode ser modificada durante esta auditoria)  
> **Objetivo:** Avaliar o aplicativo sob a ótica de **20 profissionais reais de advocacia e equipe de escritório** operando o software diariamente, identificando falhas de design, rótulos técnicos confusos, botões escondidos e atritos de usabilidade.

---

## 1. Mapa de Inspeção de Telas (`index.html`)

| Faixa de Linhas | Módulos / Elementos Cobertos |
| :--- | :--- |
| **1 – 600** | CSS global, tema Executive Dark, variáveis, contraste, fontes e micro-estilos |
| **1050 – 1140** | Tela de Login / Bloqueio, Tour Guiado, recuperação de senha |
| **1120 – 1644** | Modais globais (`modal-preview-ingestao`, `modal-dossie-processo`, `modal-submenu`, `modal-spotlight`), QR Code Popover, Header e Sidebar Icon Rail |
| **1645 – 1877** | `aba-inicio`: Painel do Escritório, Bento Grid de 4 KPIs, Processos Recentes, Mensagens do WhatsApp |
| **1878 – 2177** | `aba-processos`: Lista lateral, filtros, formulário Master-Detail, sub-aba Ficha do Processo, sub-aba Dossiê Civil (Art. 319 CPC), Honorários & PIX |
| **2178 – 2658** | `aba-fluxo`: Menu Automático (sub-aba Mensagens do Robô, sub-aba Editor de Etapas/Fluxograma, sub-aba Central de Ações) |
| **2659 – 2762** | `aba-agenda` (Horários & Almoço) e `aba-pausados` (Fila do Advogado) |
| **2763 – 3048** | `aba-terminal` (Histórico de Mensagens), `aba-backup` (Cópia de Segurança `.json` e Sincronização Nuvem 24/7), `aba-ignorados` (Contatos Ignorados) |
| **3049 – 3692** | `aba-simulador` (Simulador WhatsApp), `aba-financeiro` (4 KPIs, Régua Semanal, Auditoria PIX), `aba-configuracoes` (API Key Gemini, Modelos, Segurança) e `modal-solicitar-documentos` |
| **7300 – 7660** | Lógica de renderização e cards da Fila Humana (`aba-pausados`), detector de urgência e painel de resumo |
| **9800 – 9935** | Cards dinâmicos de transbordo, sugestões Copilot e ações de resposta rápida |
| **10014 – 10226** | Controlador da Sidebar retrátil, popover do QR Code e atalhos globais |

---

## 2. As 20 Personas de Usuários do Escritório (B2B)

1. **Dr. Roberto (64 anos) — Sócio-Fundador Tradicional**  
   *Foco:* `aba-inicio`, Sidebar e `aba-configuracoes` (linhas 1450–1877, 3437–3648).  
   *Avalia:* Jargões de TI ("JSON", "API Key", "Render", "Token"), ícones sem rótulo visível na barra recolhida e tamanhos de fonte.

2. **Dra. Mariana (29 anos) — Advogada Autônoma (Solo Practitioner)**  
   *Foco:* `aba-processos` e `modal-preview-ingestao` (linhas 1219–1289, 1878–2177).  
   *Avalia:* Importação de planilhas, quantidade de campos no formulário de processo e clareza dos botões de salvar/importar.

3. **Dr. Henrique (45 anos) — Sócio-Diretor Focado em Gestão**  
   *Foco:* `aba-inicio` e `aba-financeiro` (linhas 1645–1877, 3231–3436).  
   *Avalia:* Se os 4 cards da Home e os 4 KPIs financeiros respondem rápido à saúde do escritório ou se falta filtro por período / há redundâncias.

4. **Carla (24 anos) — Secretária / Recepcionista Jurídica**  
   *Foco:* `aba-pausados`, `modal-solicitar-documentos` e `aba-ignorados` (linhas 2739–2762, 2966–3048, 3649–3692, 7450–7650).  
   *Avalia:* Triagem da fila humana, solicitação de documentos de onboarding e bloqueio de contatos.

5. **Dr. Lucas (26 anos) — Advogado Júnior (Controlador de Andamentos)**  
   *Foco:* `aba-processos` e `aba-simulador` (linhas 1990–2177, 3049–3227).  
   *Avalia:* Campo de resumo para o cliente, botão "Melhorar com IA" e validação no simulador.

6. **Dra. Fernanda (38 anos) — Advogada de Família (Foco em Dossiê e Documentos)**  
   *Foco:* `modal-dossie-processo` e `subtab-detalhe-dossie` (linhas 1290–1399, 2035–2177).  
   *Avalia:* Visualização de RG/CNH/comprovantes recebidos e clareza na divisão entre "Ficha do Processo" e "Dossiê Civil".

7. **Dr. Gustavo (41 anos) — Gestor Financeiro do Escritório**  
   *Foco:* `aba-financeiro` e Honorários no processo (linhas 2070–2140, 3231–3436).  
   *Avalia:* Descoberta do cadastro de honorários (atualmente dentro da aba Processos em vez de na aba Financeiro) e uso da Régua Semanal.

8. **Dra. Patrícia (52 anos) — Advogada Cível Leiga em Tecnologia**  
   *Foco:* `aba-fluxo` e `modal-submenu` (linhas 1400–1415, 2178–2658).  
   *Avalia:* Compreensão das 3 sub-abas do Menu Automático ("Mensagens", "Editor de Etapas", "Central de Ações") por alguém leigo.

9. **Dr. Thiago (33 anos) — Advogado Legal Ops (Power User)**  
   *Foco:* `modal-spotlight`, Sidebar e cabeçalho (linhas 1416–1644, 10014–10226).  
   *Avalia:* Atalhos de teclado, busca global (`Ctrl+K`), popover do QR Code e feedback visual de navegação.

10. **Dra. Helena (59 anos) — Advogada em Notebook Pequeno (1366x768)**  
    *Foco:* `aba-processos` e `aba-fluxo` (linhas 1878–2658).  
    *Avalia:* Densidade de colunas (5 cols vs 7 cols), quebra de linha em botões do cabeçalho e áreas de rolagem aninhadas.

11. **Dr. Rafael (36 anos) — Advogado Criminalista (Plantão e Horários)**  
    *Foco:* `aba-agenda` e `aba-pausados` (linhas 2659–2762).  
    *Avalia:* Configuração de horários de expediente/plantão, intervalo de almoço e destaque visual para urgências críticas na fila.

12. **Juliana (31 anos) — Coordenadora de Atendimento (Auditoria de Conversas)**  
    *Foco:* `aba-terminal` (linhas 2763–2827).  
    *Avalia:* Tela de "Histórico de Mensagens", legibilidade para auditoria de conversas por cliente vs aparência de terminal técnico (`font-mono`).

13. **Dr. Eduardo (48 anos) — Sócio Focado em Backup e Nuvem**  
    *Foco:* `aba-backup` (linhas 2828–2965).  
    *Avalia:* Clareza entre "Exportar Backup Local (.json)" e "Sincronização com Servidor Nuvem (24/7)" para usuários não técnicos.

14. **Dra. Camila (27 anos) — Advogada Trabalhista em Audiência (Uso Rápido)**  
    *Foco:* Lista de processos e busca em `aba-processos` (linhas 1940–2050).  
    *Avalia:* Rapidez para filtrar clientes, copiar número CNJ em 1 clique e encontrar o telefone do cliente.

15. **Dr. Sérgio (55 anos) — Sócio Tributarista (Estética e Sobriedade Visual)**  
    *Foco:* CSS global e `aba-inicio` (linhas 1–600, 1645–1877).  
    *Avalia:* Hierarquia tipográfica, excesso de bordas/gradientes/badges e sobriedade jurídica executiva.

16. **Dra. Beatriz (34 anos) — Advogada Consumidorista (Gestão de WhatsApp e Spam)**  
    *Foco:* Popover de QR Code e `aba-ignorados` (linhas 1550–1640, 2966–3048).  
    *Avalia:* Fluxo para conectar/desconectar o WhatsApp e gerenciamento de contatos ignorados.

17. **Dr. André (40 anos) — Advogado Imobiliário (Fluxo Processo ↔ Financeiro)**  
    *Foco:* Conexão entre cadastrar cobrança na `aba-processos` e gerenciar na `aba-financeiro` (linhas 2075–2135, 3231–3436).  
    *Avalia:* Jornada completa para criar cobrança e dar baixa manual em parcela.

18. **Dra. Larissa (30 anos) — Advogada no Primeiro Dia de Uso (Onboarding)**  
    *Foco:* Tela de Login/Bloqueio, Tour Guiado e estados vazios (linhas 1050–1140, 1645–1877).  
    *Avalia:* Curva de aprendizado inicial ao abrir o app pela primeira vez sem manual externo.

19. **Dr. Marcelo (44 anos) — Advogado com Baixa Visão e Daltonismo (Acessibilidade)**  
    *Foco:* Contrastes, tamanhos de fonte (`text-[10px]`, `text-xs`), ícones e cores semânticas ao longo de `index.html` (linhas 1–600, 1645–2177, 3231–3436).  
    *Avalia:* Acessibilidade visual, dependência exclusiva de cor para status e conforto de leitura.

20. **Dra. Vanessa (37 anos) — Sócia Full-Service (Revisão de IA e Copilot)**  
    *Foco:* Cards da Fila Humana com Copilot e `modal-dossie-processo` (linhas 1290–1399, 7480–7650, 9800–9935).  
    *Avalia:* Leitura do resumo gerado por IA, edição das sugestões do Copilot e segurança/previsibilidade antes de disparar mensagem no WhatsApp.

---

## 3. Formato de Saída por Agente

Cada agente deve inspecionar as faixas especificadas em `index.html` via `read_file` e devolver exclusivamente um objeto JSON conforme o schema:
- `id` (`integer`): 1 a 20
- `nome_perfil` (`string`)
- `nota_ux` (`number`): 1.0 a 5.0
- `o_que_esta_ruim_no_design` (`string`)
- `o_que_esta_dificil_de_entender` (`string`)
- `sugestao_melhoria` (`string`)
