# 🏛️ PLANO MESTRE DE AUDITORIA MULTIAGENTE: ADVOCACIA 2.0
> **Documento de Especificação e Execução para o Agente Remoto / Swarm (`/teamwork`)**  
> **Repositório:** `https://github.com/danireid123/Advocacia-2.0.git`  
> **Versão:** 2.0.0-alpha.1  
> **Data:** Novembro de 2026  

---

## 1. OBJETIVO GERAL DA MISSÃO
Executar uma auditoria exaustiva, multiperspectiva e de longa duração no ecossistema **Advocacia Studio Pro 2.0**, combinando:
1. **Auditoria de Engenharia & Correção de Bugs:** Mapeamento profundo do código, testes e refatoração ativa.
2. **Auditoria de Design & Usabilidade (UX/UI):** Avaliação estética, contraste, elegância visual e coerência de telas.
3. **Simulação Empírica com 30 Personas de Clientes Leigos:** Teste de estresse humano simulando pessoas reais no WhatsApp, registrando cada dúvida, receio de golpe, nota de satisfação e feedback individual.
4. **Governança Estrita:** Agentes de Design e Clientes Fictícios operam em **modo estritamente Somente-Leitura (Read-Only)**. Apenas os Engenheiros têm permissão de alterar arquivos de código.
5. **Aprovação Soberana:** Nenhum redesign visual é aplicado sem a apresentação prévia ao Daniel para análise e validação.

---

## 2. ARQUITETURA DE MODELOS & DISTRIBUIÇÃO DE SQUADS

| Squad | Papel | Modelo Recomendado | Permissão de Código |
| :--- | :--- | :--- | :--- |
| **Squad 0: Orquestrador Chefe** | Coordenação geral, gestão do quadro e consolidação dos relatórios | **Gemini 4 Carbon** (ou `pro`) | Somente Leitura / Gestão |
| **Squad 1: Engenheiros de Código** | Varredura de bugs, correção de IPC, reparo de sintaxe e testes | **Gemini 4 Carbon** (ou `pro`) | **Escrita Total (Edição de Código)** |
| **Squad 2: Designers Profissionais UX/UI** | Avaliação visual, heurísticas de Nielsen e propostas de layout | **Gemini 4 Carbon** (ou `pro`) | **Somente Leitura (Zero alteração)** |
| **Squad 3: Auditores de Funcionalidades** | Checklist funcional de todas as 12 abas e modais | **Gemini 4 Carbon** (ou `pro`) | **Somente Leitura (Zero alteração)** |
| **Squad 4: 30 Clientes Fictícios** | Simulação comportamental leiga e emissão de feedbacks individuais | **Gemini 4 Hydrogen** (ou `flash`) | **Somente Leitura (Zero alteração)** |

---

## 3. CHECKLIST COMPLETO DE TODAS AS FUNCIONALIDADES DO SISTEMA

Cada auditor funcional e engenheiro deve inspecionar rigorosamente os 12 módulos:

### 3.1. Painel Inicial (`aba-inicio`)
- [ ] Bento Grid de Métricas: Processos Cadastrados, Fila de Atendimento, Robô Ativo, Expediente Hoje.
- [ ] Sincronização contínua e em tempo real do contador da fila (`#metric-fila-humana-home`) com a sidebar (`#badge-pausados`).
- [ ] Lista unificada de Processos Recentes e Mensagens do WhatsApp com atualização dinâmica.
- [ ] Botões executivos de atalho: "Cadastrar Processo", "Simulador", "Fila de Atendimento".
- [ ] Ausência de cards obsoletos ou botões sem ação vinculada.

### 3.2. Gestão de Processos & Dossiês (`aba-processos`)
- [ ] Cadastro manual com deduplicação atômica por Número CNJ e CPF.
- [ ] Importação de planilhas Excel (`.xlsx`) e relatórios judiciais (`.pdf`).
- [ ] Segmented control deslizante de filtros (`Todos`, `Recentes`).
- [ ] Modal de detalhes do processo com linha do tempo de andamentos e tradução por IA.
- [ ] Modal de Dossiê Unificado do Cliente com histórico de atendimentos e peças catalogadas.

### 3.3. Fila de Atendimento Humano & Transbordo (`aba-pausados`)
- [ ] Furador de fila com classificação automática em 4 níveis de urgência: `CRITICA`, `ALTA`, `MEDIA`, `BAIXA`.
- [ ] Ordenação ponderada por peso de urgência e desempate por timestamp.
- [ ] Badges visuais coloridos e bordas de destaque por nível de gravidade.
- [ ] Copilot do Advogado com 3 sugestões de resposta contextualizada com 1 clique (imune a quebra de aspas).
- [ ] Envio de resposta rápida com despausa automática do cliente no WhatsApp.
- [ ] Disparo de alerta sonoro Web Audio API (`playUrgencyAlert`) para urgências críticas.

### 3.4. Simulador Interativo WhatsApp (`aba-simulador`)
- [ ] Interface visual idêntica ao WhatsApp Web com balões de cliente (esmeralda/cinza) e advogado (destaque).
- [ ] Envio de texto, simulação de áudios e transcrição multimodal.
- [ ] Botão de gravação de voz e cancelamento de áudio (`window.cancelarGravacaoVozSimulador`).
- [ ] Botão de limpeza de histórico do simulador (`btn-simulador-limpar`).
- [ ] Teste de cenários pré-configurados ("Olá", "Consulta CPF", "Dúvida").

### 3.5. Fluxo de Atendimento & Robô (`aba-fluxo`)
- [ ] Sub-aba *Mensagens*: Mensagem de boas-vindas, mensagem fora do expediente e menu principal.
- [ ] Sub-aba *Editor de Etapas*: Fluxograma interativo com adição/edição de menus, sub-etapas e barra de formatação (negrito, itálico, variáveis dinâmicas).
- [ ] Sub-aba *Ações Rápidas*: Gatilhos por palavra-chave, transbordo imediato e rotas de resposta.

### 3.6. Dossiê de Clientes (`aba-dossie-clientes`)
- [ ] Visualização de documentos enviados por clientes (RG, CNH, comprovantes de residência).
- [ ] Extração de OCR e metadados via IA Gemini.
- [ ] Isolamento estrito: documentos civis jamais podem dar baixa financeira no sistema.

### 3.7. Módulo Financeiro & PIX (`aba-financeiro`)
- [ ] Painel de honorários, cobranças pendentes e recebimentos.
- [ ] Geração de QR Code PIX e chave cópia-e-cola.
- [ ] Blindagem absoluta contra baixas indevidas e integridade do ledger financeiro.

### 3.8. Agenda & Expediente (`aba-agenda`)
- [ ] Definição de horários de abertura e fechamento por dia da semana (Segunda a Domingo).
- [ ] Verificação dinâmica do status em tempo real ("Aberto Hoje" vs "Fechado").
- [ ] Resposta automática inteligente fora do horário de atendimento.

### 3.9. Contatos Ignorados (`aba-ignorados`)
- [ ] Lista negra de números para descarte imediato (evita loops de spam, robôs bancários e propagandas).
- [ ] Adição manual de telefone e exclusão de contato ignorado.

### 3.10. Terminal & Telemetria (`aba-terminal`)
- [ ] Stream contínuo de logs do processo principal e da sessão do WhatsApp Web.
- [ ] Indicadores de sub-status, monitor de memória e reconexão anti-freeze.

### 3.11. Backup & Sincronização Cloud (`aba-backup`)
- [ ] Exportação atômica do arquivo de configuração `config.json`.
- [ ] Importação com mesclagem segura de processos e contatos pausados.
- [ ] Sincronização bidirecional com o servidor SaaS na nuvem (Render) via endpoints REST autenticados.

### 3.12. Configurações Globais (`aba-configuracoes`)
- [ ] Configuração de chave de API Google Gemini (`GEMINI_API_KEY`).
- [ ] Seletor de modelo prioritário (`gemini-4-hydrogen`, `gemini-4-carbon`, `gemini-3.5-flash`).
- [ ] Reset de credenciais com senha mestre de segurança.

---

## 4. O GRUPO DOS 30 CLIENTES FICTÍCIOS (PERSONAS LEIGAS)

Cada agente simulador deve adotar estritamente a psicologia da sua persona, interagir no simulador de atendimento e preencher sua ficha de feedback individual:

1. **Dona Neusa (68 anos) - Aposentada Digitalmente Insegura:**
   - *Comportamento:* Digita com erros, demora para responder, teme cair em golpe de WhatsApp.
   - *Caso:* Quer saber se a revisão do benefício do INSS já saiu.
2. **Seu Sebastião (72 anos) - Tradicional e Cético:**
   - *Comportamento:* Exige falar com uma pessoa de carne e osso; acha que o robô é enrolação.
   - *Caso:* Recebeu uma carta sobre processo antigo e não sabe se é verdadeira.
3. **Marcos (21 anos) - Jovem Ansioso (Geração Z):**
   - *Comportamento:* Manda 6 mensagens seguidas de 2 palavras cada, com abreviações ("vc", "qnd", "pq").
   - *Caso:* Multa de trânsito que tomou com carro provisório.
4. **Camila (34 anos) - Empresária Desesperada com Bloqueio Judicial:**
   - *Comportamento:* Tom de voz aflito, frases em caixa alta, pede ligação imediata.
   - *Caso:* Conta bancária da sua loja foi bloqueada via Sisbajud hoje cedo.
5. **Dra. Vanessa (42 anos) - Médica Sem Tempo:**
   - *Comportamento:* Extremamente objetiva, não quer ler menus longos; quer apenas o número do protocolo.
   - *Caso:* Contrato de prestação de serviços hospitalares.
6. **Rogério (55 anos) - Motorista com Mandado de Apreensão:**
   - *Comportamento:* Desesperado, relata que oficial de justiça está no portão da sua casa.
   - *Caso:* Busca e apreensão do veículo de trabalho por parcelas atrasadas.
7. **Leticia (28 anos) - Vítima de Golpe do PIX:**
   - *Comportamento:* Nervosa, quer saber se o escritório garante que o dinheiro volta hoje.
   - *Caso:* Transferiu R$ 4.500 para falso leilão online.
8. **Valdir (61 anos) - Trabalhador Rural (Só envia áudios):**
   - *Comportamento:* Quase analfabeto funcional, manda apenas áudios com barulho de trator e animais.
   - *Caso:* Aposentadoria rural por idade.
9. **Patrícia (39 anos) - Mãe Solo Aflita:**
   - *Comportamento:* Preocupada com os filhos, relata dificuldades financeiras.
   - *Caso:* Pai das crianças não paga pensão há 3 meses.
10. **Lucas (19 anos) - Primeiro Emprego:**
    - *Comportamento:* Informal, pergunta se "dá um bom dinheiro" processar a empresa.
    - *Caso:* Horas extras não pagas no telemarketing.
11. **Sr. Antônio (80 anos) - Sem Documentos em Mãos:**
    - *Comportamento:* Não sabe número de processo nem vara, apenas seu CPF.
    - *Caso:* Inventário da falecida esposa.
12. **Bárbara (45 anos) - Prolixa e Magoada:**
    - *Comportamento:* Digita blocos de 5 parágrafos contando a vida inteira e dramas pessoais.
    - *Caso:* Demissão sem justa causa logo após retornar de licença médica.
13. **Eduardo (31 anos) - O "Testador Hacker":**
    - *Comportamento:* Manda comandos do tipo `help`, `admin`, caracteres especiais `;; --` para ver se quebra o robô.
    - *Caso:* Curioso simulando atendimento.
14. **Carla (50 anos) - Em Pânico com Intimação:**
    - *Comportamento:* Acha que intimação judicial significa que ela vai ser presa amanhã.
    - *Caso:* Intimação para ser testemunha em ação cível.
15. **Felipe (26 anos) - Só Manda Imagens:**
    - *Comportamento:* Manda print da tela do tribunal sem nenhuma legenda e depois pergunta: *"E aí?"*.
    - *Caso:* Consulta de andamento de processo trabalhista.
16. **Tânia (58 anos) - Professora Crítica de Português:**
    - *Comportamento:* Analisa pontuação, crase e concordância do robô; se desilude com erros.
    - *Caso:* Ação de cobrança de aluguel.
17. **Cláudio (47 anos) - Atrasado para Audiência:**
    - *Comportamento:* Mensagens urgentes pedindo o link do Google Meet / Zoom da audiência de hoje.
    - *Caso:* Audiência de instrução marcada para daqui a 30 minutos.
18. **Juliana (36 anos) - Medo de Preço:**
    - *Comportamento:* Toda pergunta dela é se o escritório vai cobrar pela conversa ou se a consulta é grátis.
    - *Caso:* Dúvida sobre partilha de bens em divórcio.
19. **Marcelo (40 anos) - Cliente Recorrente Irritado:**
    - *Comportamento:* Reclama que já falou com o advogado ontem e não quer responder o menu inicial de novo.
    - *Caso:* Andamento de recurso no Tribunal de Justiça.
20. **Aline (23 anos) - Madrugadora Indignada:**
    - *Comportamento:* Manda mensagem às 03:15 da madrugada e reclama se o robô demorar 5 minutos.
    - *Caso:* Problema com voo cancelado no aeroporto.
21. **Geraldo (65 anos) - Confuso com Prazos e Órgãos:**
    - *Comportamento:* Confunde Tribunal de Justiça com INSS, acha que audiência é no banco.
    - *Caso:* Empréstimo consignado não autorizado.
22. **Beatriz (33 anos) - Tímida e Traumatizada:**
    - *Comportamento:* Relato fragmentado, medo de represálias, pede sigilo absoluto.
    - *Caso:* Assédio moral praticado pela diretoria da empresa.
23. **Otávio (52 anos) - Cobrador Ríspido:**
    - *Comportamento:* Tom impositivo, fala em termos empresariais, cobra prazos com rispidez.
    - *Caso:* Execução de duplicata mercantil de R$ 120.000.
24. **Renata (29 anos) - Custo-Benefício Duvidoso:**
    - *Comportamento:* Pergunta se vale a pena gastar com advogado por causa de uma multa leve.
    - *Caso:* Recurso contra infração de trânsito de R$ 195.
25. **Joaquim (70 anos) - Dificuldade de Visão:**
    - *Comportamento:* Pede textos grandes e pede para o advogado mandar áudio porque não enxerga bem.
    - *Caso:* Usucapião de imóvel urbano.
26. **Sabrina (38 anos) - Pagamento Facilitado:**
    - *Comportamento:* Pergunta se parcela honorários no cartão de crédito em 12 vezes sem juros.
    - *Caso:* Ação de despejo contra inquilino inadimplente.
27. **Rodrigo (44 anos) - Preocupado com a LGPD:**
    - *Comportamento:* Pergunta onde os dados dele ficam guardados e se o WhatsApp é seguro.
    - *Caso:* Disputa societária sigilosa.
28. **Fernanda (30 anos) - Brasileira no Exterior:**
    - *Comportamento:* Fuso horário diferente de 5 horas, solicita atendimento online fora do horário padrão de Brasília.
    - *Caso:* Procuração pública e validação de diploma.
29. **Henrique (63 anos) - Negativa de Plano de Saúde:**
    - *Comportamento:* Desespero com a saúde da esposa, precisa de liminar médica em 24h.
    - *Caso:* Negativa de fornecimento de prótese cirúrgica urgente.
30. **Viviane (25 anos) - Só Figurinhas e Emojis:**
    - *Comportamento:* Quase não escreve texto, responde com 👍, 🙏, 😭 e figurinhas animadas.
    - *Caso:* Pedido de pensão por morte.

---

## 5. DIRETRIZES DE AUDITORIA DE DESIGN (SQUAD 2)
*(Modo Somente Leitura — Propostas para Aprovação do Daniel)*
1. **Contraste & Acessibilidade (WCAG AA):** Avaliar legibilidade de fontes sobre os fundos escuros (`zinc-900`, `zinc-950`).
2. **Hierarquia Tipográfica:** Validar se os títulos, métricas e labels seguem proporções elegantes sem sobrecarga visual.
3. **Consistência de Cores Semânticas:**
   - Dourado/Âmbar: Processos, pastas e prestígio jurídico.
   - Esmeralda: WhatsApp, robô operante, confirmações e sucesso.
   - Rose/Vermelho: Urgências críticas, mandados e avisos fatais.
   - Azul Safira: Calendário, expediente e prazos.
4. **Espaçamentos e Responsividade:** Testar comportamento do Bento Grid e das abas em resoluções de 1366x768 (notebooks comuns) até 4K.

---

## 6. DIRETRIZES DE AUDITORIA DE ENGENHARIA (SQUAD 1)
*(Permissão Total de Escrita — Manter 100% de Testes Verdes)*
1. **Execução de Todas as Baterias:**
   - `node test_bateria_gemini_hydrogen.js` (10/10 testes).
   - `node test_blindagem_v2_cloud_desktop.js` (26/26 testes).
   - `node test_urgencia_cronologia_fila.js` (10/10 testes).
   - `node test_tradutor_ia.js` (8/8 testes).
   - `npx electron test_electron_deep_interactive.js` (66/66 testes).
2. **Blindagem do Módulo Financeiro:** Documentos civis (RG/CNH) jamais podem alterar o saldo ou disparar baixas no livro-caixa.
3. **Tolerância a Falhas de Rede:** Qualquer chamada ao Gemini deve conter fallback limpo em menos de 5ms sem travar o renderer nem o backend.
4. **Higiene de Sintaxe:** Garantir que todo `<script>` dentro de `index.html` compile sem erros no motor V8.

---

## 7. FORMATO OBRIGATÓRIO DE ENTREGA FINAL PARA O DANIEL

Ao concluir a operação, o Orquestrador Chefe deve consolidar os resultados em um único documento executivo estruturado:

1. **Sumário Executivo:** Visão geral do estado de maturidade do software.
2. **Dossiê dos 30 Feedbacks de Clientes:** Ficha individual de cada persona contendo:
   - Nome e Perfil
   - Facilidade de Uso (Nota 1 a 5)
   - Onde sentiu medo ou confusão
   - Sugestão prática da persona
3. **Relatório de Design UX/UI:** Diagnóstico estético e lista de melhorias propostas para aprovação do Daniel.
4. **Relatório de Engenharia:** Tabela com todos os bugs detectados e corrigidos, acompanhada do log de execução de testes 100% aprovados.
5. **Decisões Submetidas à Aprovação:** Pontos estratégicos que dependem exclusivamente do "Sim" ou "Não" do Daniel.
