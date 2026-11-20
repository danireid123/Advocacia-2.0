# Plano de Execução: Simulação de Primeiro Uso (15 Advogados Compradores Zero-Knowledge + Limite de 2h/Reembolso + 2 Subagentes Especialistas em Design e Engenharia de App)

## 1. Contexto e Objetivo
Simulação realista de **Primeiro Uso (Onboarding Zero-Knowledge)** no projeto **Advocacia Studio Pro 2.0** (`index.html`, `main.js`, `server.js`):
1. **15 Clientes Advogados Compradores (Zero-Knowledge):**
   - Cada cliente acabou de comprar o sistema e está abrindo o site **pela primeira vez sem saber absolutamente nada sobre ele**.
   - Cada um possui uma **personalidade diferente** e um **objetivo prático diferente** (configurar seu escritório no sistema desde o zero até o robô do WhatsApp estar realmente funcionando e respondendo na hora quando alguém manda mensagem).
2. **Regra de Tempo Máximo (2 Horas / 120 Minutos) e Reembolso (Churn):**
   - Cada cliente tem no máximo **2 horas (120 minutos)** para concluir seu objetivo sozinho navegando na interface atual (`index.html`, `main.js`, `server.js`).
   - Se o cliente ultrapassar **2 horas (120 min)** sem conseguir fazer o robô funcionar exatamente como queria (por culpa de menus escondidos, sub-abas confusas, botões duplicados ou configurações espalhadas), ele **cancela a compra, pede REEMBOLSO (Refund)** e deixa uma review detalhada explicando onde travou.
   - Mesmo os clientes que conseguirem antes de 2 horas registram o tempo gasto e escrevem uma review detalhada com todas as dificuldades, menus escondidos e elementos jogados/inúteis.
3. **Resumo com Palavras Literais do Cliente:**
   - Resumo detalhado do feedback de cada um dos 15 clientes mantendo trechos literais com as próprias palavras do cliente, além do Tempo Gasto e Status Final (`✅ Concluiu em X min` ou `❌ REEMBOLSO (>2h)`).
4. **2 Subagentes Especialistas de Fundo (Design + Engenharia de App):**
   - **Especialista #16 (Lead Product Designer / UX Architect):** Arquitetura de informação, menus escondidos, sub-abas confusas, elementos jogados inutilmente e redesign de usabilidade.
   - **Especialista #17 (Staff App Engineer / Software Architect):** Auditoria de sincronização de estado e código entre `index.html`, `main.js` e `server.js`.

---

## 2. Os 15 Perfis de Clientes

1. **Cliente #01 — Dr. Marcos Vinícius (34 anos, Trabalhista Solo — Impaciente e Prático):** Mudar opções do menu inicial para triagem trabalhista ("1 - Fui demitido", "2 - Já sou cliente") e testar no simulador respondendo `"1"`.
2. **Cliente #02 — Dra. Patrícia Nogueira (41 anos, Criminalista de Plantão — Urgência Noturna):** Configurar Plantão 24h no fim de semana, cadastrar termos de urgência (`preso`, `delegacia`, `flagrante`) e testar alerta crítico e resposta imediata.
3. **Cliente #03 — Dra. Camila Souza (29 anos, Direito de Família — Coleta de Documentos):** Configurar documentos de Divórcio/Pensão, simular envio de RG/Certidão no WhatsApp e abrir o arquivo na ficha do cliente.
4. **Cliente #04 — Dr. Alberto Albuquerque (62 anos, Sócio Sênior Cível — Baixa Familiaridade Digital):** Cadastrar 1 processo real com CPF e andamento simples e testar consulta por CPF no robô sem ajuda técnica.
5. **Cliente #05 — Dr. Rafael Mendes (38 anos, Consumidor Massificado — Planilha/Lote):** Importar 30 processos em lote e testar se qualquer CPF já responde andamento na hora no WhatsApp.
6. **Cliente #06 — Dra. Fernanda Lima (45 anos, Sócia Financeira — Cobrança e PIX):** Cadastrar chave PIX CNPJ, lançar contrato parcelado em 5x, ativar cobrança automática e testar envio de comprovante PIX no robô.
7. **Cliente #07 — Dr. Henrique Bastos (50 anos, Previdenciarista / INSS — Árvore de Submenus):** Criar submenu na opção 2 para benefícios do INSS (1. Aposentadoria, 2. Auxílio-Doença, 3. BPC/LOAS) funcionando no chat.
8. **Cliente #08 — Dr. Lucas Silveira (31 anos, Direito Imobiliário — Dossiê e Qualificação CPC 319):** Simular recebimento de CNH/comprovante no WhatsApp, extrair dados civis e copiar parágrafo do Art. 319 CPC.
9. **Cliente #09 — Dra. Juliana Costa (36 anos, Autônoma em Notebook 1366x768 — Correria):** Conectar WhatsApp via QR Code, cadastrar 5 contatos na Lista de Ignorados, configurar horário de almoço e validar quem o robô ignora vs responde.
10. **Cliente #10 — Dr. Eduardo Vasconcelos (48 anos, Sócio Controlador — Auditoria):** Configurar saudação, simular 2 clientes distintos no chat e auditar as duas conversas separadas no Histórico.
11. **Cliente #11 — Dr. Gustavo Paiva (55 anos, Tributarista Empresarial — Formalidade e LGPD):** Trocar todas as mensagens do robô para tom corporativo sem emojis, testar resposta e configurar backup seguro.
12. **Cliente #12 — Dra. Beatriz Rocha (25 anos, Recém-Formada — Ansiosa):** Colocar escritório no ar em 15 minutos usando modelos prontos, cadastrar 1º cliente e testar resposta sem manual.
13. **Cliente #13 — Dr. Rodrigo Tavares (43 anos, Cível/Empresarial — Transbordo Humano e Copilot):** Configurar "Falar com Advogado", simular lead complexo, abrir Fila de Espera, gerar sugestão IA e responder.
14. **Cliente #14 — Dr. Marcelo Dantas (39 anos, Trânsito e CNH — Funil Comercial):** Criar funil comercial com 3 opções ("1 - Cassação de CNH", "2 - Lei Seca", "3 - Foto da Notificação") e validar que ao enviar "1" o robô não caia em consulta de CPF.
15. **Cliente #15 — Dr. Sérgio Cavalcanti (52 anos, Sócio Cético — Testador de Estresse):** Cadastrar processo, anexar PDF de sentença, resumir/traduzir andamento, personalizar menu e testar ciclo completo no WhatsApp antes de completar 2h.

---

## 3. Os 2 Subagentes Especialistas

- **Especialista #16 — Lead Product Designer & UX Architect**
- **Especialista #17 — Staff App Engineer & Software Architect**
