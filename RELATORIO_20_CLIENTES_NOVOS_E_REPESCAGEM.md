# Relatório de Revalidação Pós-Correções — Advocacia Studio Pro 2.0 (20 Clientes Simulados)

**Escopo da Auditoria:** Revalidação estrita sobre a base de código atualizada em `C:\Users\Daniel\.gemini\antigravity\scratch\Advocacia-2.0\` (sem alterações em arquivos-fonte durante os testes).  
**Orçamento por Cliente:** Máximo de **120 minutos (2 horas)** por advogado(a), com nota final de **0 a 10**, justificativa técnica detalhada dos pontos positivos e atritos encontrados no código/interface, e depoimento literal (*verbatim*).

---

## 1. Placar Comparativo (Antes vs. Depois)

| Indicador | Rodada Anterior (Antes das Correções) | Rodada Atual (Após as Correções) | Variação / Diagnóstico |
| :--- | :---: | :---: | :--- |
| **Taxa de Sucesso — Novos Clientes (0 → Produção < 2h)** | **33,3%** (5 de 15 concluíram) | **90,0%** (9 de 10 concluíram) | **+56,7 p.p.** — Apenas 1 pedido de reembolso entre os 10 novatos (`#02 Dr. Otávio`) |
| **Nota Média — 10 Novos Clientes (0 a 10)** | — *(baseline anterior apenas em Grupos)* | **7,27 / 10** (máx. `8,6`, mín. `4,8`) | Tempo médio entre os 9 aprovados: **29,7 min** (todos bem abaixo dos 120 min) |
| **Taxa de Recuperação — Repescagem (Ex-Reembolsos)** | **0%** (10 de 10 haviam reembolsado) | **50,0%** (5 mantiveram / 5 cancelaram) | **5 advogados recuperados** no teste de 1 mês grátis |
| **Nota Média — 10 Ex-Reembolsos (Antes → Depois)** | **2,15 / 10** | **6,10 / 10** | **+3,95 pontos** (aprovados ficaram entre `7,0` e `8,2`; recancelamentos entre `3,5` e `5,5`) |

---

## 2. Grupo 1 — 10 Novos Clientes (Primeiro Contato, Orçamento 120 min)

### Resumo Executivo do Grupo 1

| # | Cliente / Perfil | Status (< 120 min) | Tempo | Nota (0–10) | Principal Ponto Positivo | Principal Atrito / Gargalo |
| :---: | :--- | :---: | :---: | :---: | :--- | :--- |
| **#01** | Dra. Larissa Monteiro (Consumidor / Aéreo) | ✅ Concluiu | 28 min | **7,2** | Checklist Passo 3 abre `#aba-fluxo` unificado com prévia ao vivo (`#wa-preview-etapa-real`) | Opção `texto` deixa `aguardarRelatoLivre` desligado/oculto em botão secundário; prévia crua com `*1*` |
| **#02** | Dr. Otávio Mendonça (Agrário / Sucessões) | ❌ **REEMBOLSO** | 58 min | **4,8** | Cadastro de processo manual + anexo de PDF atualiza `proc.resumo` | `{escritorio}` não é interpolado em `formatarMensagemProcesso()` e saudação padrão ignora nome salvo |
| **#03** | Dra. Renata Vasques (Trabalhista / Fila IA) | ✅ Concluiu | 32 min | **7,0** | Pausa respeitada (`contatosPausados`) + `✨ Sugerir Resposta com IA` + `Liberar para o Robô` | Resposta enviada pela fila duplica balão no Simulador; `"acidente de trabalho"` não dispara urgência |
| **#04** | Dr. Bruno Farias (Digital / Startups) | ✅ Concluiu | 11 min | **8,6** | `#modal-qr-rapido` em 1 clique, zero UI de API Key, logs no `#aba-terminal`, cenários sem duplicar | Envio automático de `"Olá"` ao abrir Simulador; humano na fila logado com `tipo: 'robo'` |
| **#05** | Dra. Helena Figueiredo (Previdenciário / 40 procs Excel) | ✅ Concluiu | 38 min | **8,1** | `Planilha Modelo (.xlsx)`, prévia de 50 linhas e consulta por CPF funcionando na hora | Submenu recém-criado nasce "órfão" sem vínculo automático no menu `raiz`; regex `/\\D/g` em telefone |
| **#06** | Dr. Caio Junqueira (Penal Econômico / Urgência) | ✅ Concluiu | 24 min | **8,5** | `#agenda-palavras-urgencia` + `isMensagemCritica` normaliza acento; badge `Plantão 24h Ativo` | `Plantão 24h` de sábado/domingo vem `disabled` até habilitar o dia; 2º teste exige resetar conversa |
| **#07** | Dra. Vanessa Prado (Condominial / PIX 6x850) | ✅ Concluiu | 38 min | **8,0** | CNPJ + Beneficiário + `Valor de cada Parcela` (`6x R$ 850 = R$ 5.100`); editar menu não apaga PIX | Comparação estrita `pTel === telLimpo` (sem vs. com `55`) deixa baixa de parcela em R$ 0 |
| **#08** | Dr. Thiago Alencar (Imobiliário / Art. 319 CPC) | ✅ Concluiu | 29 min | **6,5** | `Copiar CPC` lê `#dossie-nacionalidade`, `#dossie-email` e gera concordância perfeita | `main.js:1775` descarta edições manuais de `salvarDossieCivilAtual` ao reiniciar via `salvar-config` |
| **#09** | Dra. Mônica Siqueira (Direito Médico / Ignorados + UTI) | ✅ Concluiu | 32 min | **6,5** | `"liminar cirurgia"` e `"uti"` furam fila; texto e foto/PDF de ignorados bloqueados | Áudio no Simulador (`despacharAudioParaIAEFila`) burla `isContactIgnored`; match assimétrico com `55` |
| **#10** | Dr. Leonardo Paes (Autônomo 64a / 1366×768) | ✅ Concluiu | 35 min | **7,5** | Janela `1280×720` cabe sem cortar; Checklist 1–4 claro; Backup JSON limpo | Mensagem enganosa de importação ("mesclará sem apagar"); celular do Simulador força rolagem em 720px |

---

### Detalhamento Individual — Novos Clientes (#01 a #10)

#### Novo #01 — Dra. Larissa Monteiro (Consumidor / Aéreo & Golpe do PIX)
- **Status:** ✅ Concluiu configuração e validação ao vivo em **28 min**
- **Nota:** **7,2 / 10**
- **Jornada & Evidências Técnicas:**
  - **O que funcionou:** Pelo Checklist Passo 3 na Home, acessou diretamente `#aba-fluxo` (editor unificado na etapa `raiz`) com a prévia ao vivo `#wa-preview-etapa-real` exibindo texto de boas-vindas e opções numeradas `*1*`, `*2*`, `*3*`.
  - **O que atrapalhou / justificativa da nota (`7,2`):**
    1. Opções do tipo `texto` iniciam com `aguardarRelatoLivre = false`, e essa chave fica escondida dentro de `"Ações & Funções desta Opção"` (`index.html:5396`, `check-relato-editor-0`). Quando o cliente responde com uma dúvida livre após digitar `"1"`, o robô devolve o menu raiz inteiro (`main.js:2597-2608`).
    2. A prévia `#wa-preview-etapa-real` exibe asteriscos literais (`*1*`) e não atualiza automaticamente ao clicar `+ Nova Opção` (`index.html:6120`) ou trocar o `<select>`.
    3. `aoAbrirAbaSimulador` dispara `"Olá"` automático (`index.html:10980`), e `config.json:61` traz o genérico `"⚖️ *Escritório de Advocacia*"`.
- **Depoimento Literal:**
  > "Gostei muito da tela de editar o menu já mostrando a prévia do lado, consegui montar minhas opções de aéreo e golpe do PIX bem rápido. Só achei enganoso no começo porque não tem 'botões clicáveis' no WhatsApp, mas pelo menos o texto numerado bate com o que o cliente recebe — tirando os asteriscos aparecendo crus na prévia."
  >
  > "Agora, quase me fez perder cliente na simulação: configurei a opção 1 como 'Responder Texto' pedindo pro cliente contar o caso do voo, e quando ele respondeu com a dúvida, o robô vomitou o menu inteiro de volta! Só depois fuçando eu achei aquele botão escondido de 'Ações & Funções desta Opção' pra ligar o 'Aguardar relato livre'. Isso tinha que estar na cara no seletor principal!"

#### Novo #02 — Dr. Otávio Mendonça (Agrário / Sucessões & Inventário)
- **Status:** ❌ **REEMBOLSO** (Desistiu aos **58 min**)
- **Nota:** **4,8 / 10**
- **Jornada & Evidências Técnicas:**
  - **O que funcionou:** Checklist Passo 2 salva corretamente `config.nomeEscritorio` (`index.html:11220`); o cadastro manual de processo funciona e anexar PDF atualiza `proc.resumo` (`main.js:2660-2741`).
  - **O que levou ao reembolso (`4,8`):**
    1. **Falha crítica de identidade:** `{escritorio}` não reflete na saudação padrão (`config.json:61` mantém `"⚖️ *Escritório de Advocacia*"`) e `formatarMensagemProcesso()` (`main.js:705-711`) **nunca interpola `{escritorio}`** (apenas `{nome}`, `{cpf}`, `{processo}`, `{resumo}`, `{data}`, `{ultima_consulta}`). Ao inserir `{escritorio}` nos templates do Grupo B, o cliente recebe literalmente `"{escritorio}"`!
    2. **Fluxo de anexo escondido e fallback pobre:** `#btn-anexar-peca-proc` nasce com `hidden` (`index.html:2193`) até o salvamento prévio do processo; e no fallback offline `catalogarLocalmente()` (`src/ia/tradutorJuridico.js:507-546`), decisões interlocutórias geram resumo genérico (e `main.js:2717` compara com string divergente `'Documento anexado ao processo.'`). Observado também `.env:6` com chave `GEMINI_API_KEY=AQ.Ab8RN6...` em formato não padrão.
- **Depoimento Literal:**
  > "Para um escritório tradicional de sucessões, o nome da nossa banca na comunicação com o herdeiro é questão de seriedade. Fiz o Passo 2 na tela inicial mandando salvar o nome do meu escritório, mas quando fui testar no simulador apareceu 'Escritório de Advocacia' genérico, e na consulta do CPF do inventário o nome do escritório simplesmente não aparece — e quando tentei escrever `{escritorio}` no modelo de resposta, o robô cuspiu a palavra `{escritorio}` entre chaves para o cliente!"
  >
  > "Além disso, fiquei vários minutos procurando onde anexar o PDF da decisão porque o botão fica escondido até salvar a ficha, e quando anexou sem internet da IA virou uma frase vaga dizendo apenas que 'foi anexado'. Não dá para colocar isso em produção com clientes de inventário."

#### Novo #03 — Dra. Renata Vasques (Trabalhista / Fila de Atendimento & IA)
- **Status:** ✅ Concluiu em **32 min**
- **Nota:** **7,0 / 10**
- **Jornada & Evidências Técnicas:**
  - **O que funcionou:** Clientes inseridos em `contatosPausados` não sofrem interferência do bot quando enviam novas mensagens (`main.js:2279-2332`); o botão `✨ Sugerir Resposta com IA` (`index.html:9071`, `main.js:2934`) entrega sugestão funcional inclusive com fallback `gerarSugestaoFilaFallback`; e `Liberar para o Robô` (`index.html:9153`) devolve o controle de forma limpa.
  - **O que reduziu a nota (`7,0`):**
    1. Enviar resposta humana por `#aba-pausados` **duplica o balão do advogado no Simulador**: `main.js:2890` emite `'simulador-resposta-advogado'` (tratado em `index.html:10942`) e `index.html:9142-9144` também invoca `adicionarBalaoAdvogadoNoSimulador`.
    2. A expressão `"acidente de trabalho"` na raiz não é reconhecida como urgência crítica, devolvendo o menu inicial.
    3. O card de rotina (`ROTINA`) volta a colapsar quando `emitirPausados()` re-renderiza (`index.html:8177`).
- **Depoimento Literal:**
  > "O mais importante no meu escritório trabalhista funcionou bem: enquanto eu estou conversando com o acidentado pela fila, o robô não mete o bedelho no meio da conversa se o cliente mandar outra mensagem, e o botão 'Sugerir Resposta com IA' já deixa um texto ótimo pronto para eu só ajustar e mandar."
  >
  > "Mas encontrei duas coisas chatas no teste: primeiro, se o trabalhador já chegar escrevendo 'sofri acidente de trabalho' sem apertar a opção 3, o robô não detecta gravidade e joga o menu de volta; segundo, quando respondi pela fila e olhei o simulador, minha mensagem apareceu duplicada duas vezes seguidas — e o card na fila fechou na minha cara bem depois que enviei."

#### Novo #04 — Dr. Bruno Farias (Direito Digital / Startups)
- **Status:** ✅ Concluiu em **11 min**
- **Nota:** **8,6 / 10** *(maior nota entre os 20 avaliados)*
- **Jornada & Evidências Técnicas:**
  - **O que funcionou:** Abertura em 1 clique do `#modal-qr-rapido` pela barra superior/Home/Passo 1 (`index.html:11286`), ausência total de inputs/modais pedindo Gemini API Key, botões de cenário rápido do Simulador disparando uma única vez por clique (`index.html:3314-3336`, `10378`) e logs em tempo real no `#aba-terminal`.
  - **Ressalvas técnicas (`8,6`):** Disparo automático de `"Olá"` ao abrir `#aba-simulador`; clicar em `Enviar "Olá"` não retira pausa após `Falar Advogado` (`main.js:2284`); respostas humanas da fila são registradas com `tipo: 'robo'` em `main.js:2914`; e `ia-testar-conexao` retorna `success: true` mesmo em fallback (`main.js:2109`).
- **Depoimento Literal:**
  > "Interface enxuta e rápida de verdade: em dois minutos eu já estava com o modal do QR Code na tela sem ficar procurando aba escondida e sem nenhum pop-up chato me pedindo token ou API Key. Os botões de cenário rápido do Simulador agora disparam exatamente uma vez por clique, dá pra validar o fluxo em segundos e conferir tudo batendo no Histórico de Mensagens."
  >
  > "Como dev/advogado de digital, só apontaria três ajustes finos: tirar aquele 'Olá' automático quando você só quer abrir o Simulador, fazer o botão 'Enviar Olá' destravar a pausa depois de clicar em 'Falar Advogado', e diferenciar no Histórico quando quem respondeu foi um advogado humano e não o robô."

#### Novo #05 — Dra. Helena Figueiredo (Previdenciário / Volume — 40 Processos via Excel)
- **Status:** ✅ Concluiu em **38 min**
- **Nota:** **8,1 / 10**
- **Jornada & Evidências Técnicas:**
  - **O que funcionou:** Botão `Planilha Modelo (.xlsx)` (`#btn-baixar-modelo-xlsx`), importação em lote com prévia das 50 linhas e consultas por CPF de todos os segurados testados funcionando imediatamente no Simulador; criação do submenu `beneficios_do_inss` com `0 - Voltar ao Início` via `+ Novo Submenu`.
  - **Ressalvas técnicas (`8,1`):**
    1. O submenu criado nasce "órfão" (`index.html:6148-6156`), exigindo voltar manualmente à etapa `raiz` e criar/ligar uma opção até ele.
    2. `aguardarRelatoLivre` segue oculto nas subopções.
    3. `motorIngestao.js:786` possui regex `/\\D/g` com barra dupla em `apenasNum` (inofensivo na planilha modelo de 5 colunas sem telefone, mas quebraria limpeza caso haja coluna de telefone formatado).
- **Depoimento Literal:**
  > "Para quem tem volume de clientes previdenciários como eu, baixar a planilha modelo oficial e subir 40 processos de uma vez só com validação na prévia foi um alívio enorme! Todos os CPFs que testei dos meus segurados do INSS responderam na hora no simulador."
  >
  > "Só perdi um tempinho no Menu Automático porque quando criei o submenu de 'Benefícios do INSS', achei que ele já ia aparecer automático no menu principal — demorei um pouco para entender que eu precisava voltar no Menu Principal e ligar uma opção até esse submenu. Se tivesse um aviso ou vínculo automático na criação, seria nota 10."

#### Novo #06 — Dr. Caio Junqueira (Penal Econômico / Plantão & Urgência)
- **Status:** ✅ Concluiu em **24 min**
- **Nota:** **8,5 / 10**
- **Jornada & Evidências Técnicas:**
  - **O que funcionou:** Campo `#agenda-palavras-urgencia` visível na aba de Agenda; `isMensagemCritica` normaliza acentos e captura `"polícia federal"` e `"flagrante"` furando o menu com alerta crítico; `Plantão 24h` remove prefixo de fora do expediente (`main.js:466`, `525`) e exibe status `Plantão 24h Ativo` na Home.
  - **Ressalvas técnicas (`8,5`):** O checkbox `Plantão 24h` de sábado e domingo permanece `disabled` até desmarcar o dia como fechado (`index.html:7789`); o item da barra lateral exibe apenas `"Horários & Almoço"`; e testar uma segunda urgência seguida no Simulador exige clicar em `Resetar Conversa` porque o contato já entrou em pausa (`main.js:2287`).
- **Depoimento Literal:**
  > "Para criminalista de plantão, o furador de fila funcionou na mosca: testei 'polícia federal' — que nem vinha na lista padrão — e 'flagrante', e nos dois casos o robô cortou o menu e jogou o cliente direto como emergência máxima na fila com alerta sonoro. Também gostei de ver 'Plantão 24h Ativo' direto no painel inicial."
  >
  > "Só perdi uns minutos bobos porque na barra lateral está escrito só 'Horários & Almoço', e quando fui ligar o Plantão 24h do sábado e do domingo o botão parecia morto porque estava travado até eu desmarcar o '(Fechado)' do dia. Fora isso, no segundo teste seguido no simulador ele caiu em pausa e precisei resetar a conversa."

#### Novo #07 — Dra. Vanessa Prado (Condominial / Parcelamento PIX 6x R$ 850)
- **Status:** ✅ Concluiu em **38 min**
- **Nota:** **8,0 / 10**
- **Jornada & Evidências Técnicas:**
  - **O que funcionou:** Configuração de `#tipoChavePix` (`CNPJ`) + `#beneficiarioPix`; cálculo em `Valor de cada Parcela (R$)` com `modoValor: 'PARCELA'` gerando exatamente 6x R$ 850 = R$ 5.100 (`src/financeiro/gestaoFinanceira.js:432`); edição no Menu Automático preserva integralmente dados de PIX/parcelas (`main.js:1765-1779`); envio de `comprovante_pix.png` roteado corretamente para `processarComprovanteRecebido`.
  - **Ressalvas técnicas (`8,0`):** Em `src/financeiro/gestaoFinanceira.js:314`, a comparação de telefone é estrita (`pTel === telLimpo`). Se a parcela for cadastrada sem o prefixo `55` e o Simulador usar `+55`, o comprovante é aprovado com `valorEsperado = 0` sem abater a parcela! Também falta tooltip de comprovante PIX no clipe do Simulador e suporte offline a comprovantes binários.
- **Depoimento Literal:**
  > "Lançar honorários parcelados é muito claro: coloquei 850 reais em 6x e ele já mostrou o total de R$ 5.100 e criou as seis cobranças certinhas com vencimento mensal. O meu maior medo — de mexer no texto do robô no Menu Automático e perder os dados financeiros — não aconteceu, voltou tudo intacto."
  >
  > "O único susto foi no simulador: cadastrei o telefone do síndico só com DDD e número, sem o 55 na frente, e quando mandei o comprovante pelo número padrão do simulador o robô não deu baixa na parcela de 850. Quando coloquei o 55 igualzinho dos dois lados e mandei o comprovante completo, ele validou e abateu na hora."

#### Novo #08 — Dr. Thiago Alencar (Imobiliário / Qualificação Art. 319 CPC)
- **Status:** ✅ Concluiu em **29 min**
- **Nota:** **6,5 / 10**
- **Jornada & Evidências Técnicas:**
  - **O que funcionou:** `Copiar CPC` (`#btn-copiar-cpc`, `index.html:8673`) lê `#dossie-nacionalidade`, `#dossie-email` e os demais campos civis via `src/onboarding/formatadorCPC.js`, gerando qualificação com concordância de gênero e preposições corretas.
  - **Bugs graves que derrubaram a nota (`6,5`):**
    1. **Perda silenciosa ao reiniciar:** `Salvar Alterações do Dossiê` (`index.html:7459`) persiste via `salvar-config`, mas **`main.js:1775` sobrescreve `nc['dossiesClientes'] = atualEmMemoria['dossiesClientes']`**, descartando as edições manuais do dossiê ao fechar e reabrir o app!
    2. Os campos abrem editáveis na tela mesmo sem processo selecionado, mas clicar em salvar exibe `"Selecione um cliente primeiro."` (`index.html:7393`), enquanto `#btn-copiar-cpc` funciona mesmo assim. Além disso, `#dossie-filiacao` não é enviado em `copiarQualificacaoCPCDoCliente`.
- **Depoimento Literal:**
  > "Quando cliquei em 'Copiar CPC', o parágrafo do artigo 319 veio redondinho, já com o CPF pontuado, nacionalidade, concordância de gênero certa e o 'com endereço eletrônico' no lugar exato para jogar na petição inicial de usucapião. Isso economiza um tempo danado no dia a dia."
  >
  > "Mas o comportamento da tela de Dossiê me confundiu e me preocupou: todos os campos estavam abertos, preenchi tudo, cliquei no botão de salvar embaixo e ele me barrou dizendo 'Selecione um cliente primeiro', sendo que o botão 'Copiar CPC' lá em cima funcionou mesmo assim! E quando finalmente vinculei um processo e salvei, deu aviso de salvo, mas depois que fechei e abri os campos civis que digitei tinham sumido."

#### Novo #09 — Dra. Mônica Siqueira (Direito Médico / Contatos Ignorados & Urgência UTI)
- **Status:** ✅ Concluiu em **32 min**
- **Nota:** **6,5 / 10**
- **Jornada & Evidências Técnicas:**
  - **O que funcionou:** `"liminar cirurgia"` e `"uti"` disparam alerta imediato `CRITICA` furando toda a triagem (`src/ia/tradutorJuridico.js:1212`); contatos ignorados barram texto, imagens e PDFs no Simulador (`main.js:2152-2162`).
  - **Brecha crítica encontrada (`6,5`):** O fluxo de **áudio no Simulador** (`#simulador-audio-file` / `#btn-mic-simulador` -> `despacharAudioParaIAEFila` em `index.html:10627`) passa por fora de `executarSimulacaoMensagem` e **não verifica `isContactIgnored`**! Além disso, `isContactIgnored` (`main.js:149`) usa comparação assimétrica `cleanNumber.includes(item)`, falhando quando cadastrado com `55` e testado sem `55`.
- **Depoimento Literal:**
  > "Com paciente grave o sistema foi exemplar: digitei 'liminar cirurgia' e 'uti' simulando familiar desesperado no pronto-socorro e ele furou toda a triagem e acionou o alerta máximo na hora. A lista de Contatos Ignorados também barrou texto e foto/PDF do meu marido e do médico perito."
  >
  > "O que me deixou com o pé atrás foi quando testei mandar um áudio pelo botão de áudio do simulador usando o número bloqueado do médico parceiro: tocou o sino na minha tela, o Copilot foi acionado e abriu atendimento na fila em vez de ficar mudo! Em saúde, se vazar áudio de colega na fila ou se houver dúvida por causa do '55' no número, eu fico insegura até confirmar."

#### Novo #10 — Dr. Leonardo Paes (Autônomo 64 anos / Notebook 1366×768)
- **Status:** ✅ Concluiu em **35 min**
- **Nota:** **7,5 / 10**
- **Jornada & Evidências Técnicas:**
  - **O que funcionou:** Janela `1280×720` abre íntegra em tela `1366×768`; Checklist 1–4 orienta bem o iniciante; `#aba-backup` simplificou o texto e ocultou nuvem dentro de `<details>`.
  - **Ressalvas técnicas (`7,5`):** O texto de restauração (`index.html:3096-3099`) promete `"mesclará... sem risco de apagar"`, mas a importação sobrescreve configurações (`index.html:9454`, mantendo financeiro/dossiês via `main.js:1769-1778`); `adv_menu_editado` não é gravado em lugar nenhum (`index.html:11248-11251`); e a altura fixa `h-[590px]` do celular no Simulador obriga a rolar a tela em notebooks de 720–768px de altura.
- **Depoimento Literal:**
  > "No meu notebook normal a tela abriu no tamanho certo e aquele roteiro de Passo 1, 2, 3, 4 na entrada me deu tranquilidade — fui preenchendo o nome do escritório, cadastrei um processo e já testei o atendimento no simulador vendo o robô responder e puxar o andamento pelo CPF certinho."
  >
  > "Gostei que na Cópia de Segurança tiraram aquelas coisas complicadas de servidor da frente e deixaram um botão claro de 'Baixar Backup Completo (.JSON)', apesar de o celular do simulador exigir rolar a tela para digitar embaixo e algumas letrinhas serem pequenas. Só me assustaria se precisasse restaurar depois: ali diz com todas as letras que a importação mescla sem risco de apagar nada, mas não passa muita segurança se você já tiver alterado processos novos."

---

## 3. Grupo 2 — 10 Ex-Clientes em Repescagem (1 Mês Grátis, Orçamento 120 min)

### Resumo Executivo do Grupo 2

| # | Cliente (Ex-ID) | Decisão | Tempo | Nota (Antes → Depois) | O que foi Corrigido | O que Permaneceu Quebrado (ou Ressalva) |
| :---: | :--- | :---: | :---: | :---: | :--- | :--- |
| **R#01** | Dra. Patrícia Nogueira (Ex-#02 · Criminal) | ✅ **Mantida** | 22 min | `2,0` → **7,0** | `#agenda-palavras-urgencia`, `delegacia`/`flagrante` em `isMensagemCritica`, madrugada, `server.js:629` | Sáb/Dom `plantao24h` trava até marcar dia; `server.js` envia fora do expediente antes; pausado ignora termos custom (`main.js:785`) |
| **R#02** | Dra. Camila Souza (Ex-#03 · Família/Docs) | ❌ **Cancelou Novamente** | 78 min | `2,0` → **3,5** | Lightbox `file:///` real (`8581`, `6547`); dossiês exibidos em `#lista-processos-box` | Preset promete `"e Renda"` sem pedir Renda (`onboardingController.js:48-56`); `DOCS_PARCIAIS` oculto; Simulador não sincroniza aba Processos; `main.js:1775` descarta edição civil |
| **R#03** | Dra. Fernanda Lima (Ex-#06 · PIX/Cobrança) | ❌ **Cancelou Novamente** | 46 min | `2,0` → **5,0** | CNPJ + Beneficiário; `5x1200`; edição de menu preserva PIX; comprovante roteado | `main.js:3141` chama `dispararReguaCobranca` com 3 args (vs. 2 em `gestaoFinanceira.js:141`) -> 0 msgs no WhatsApp; `index.html:9063` mostra `"0 lembrete(s) enviado(s)!"`; sem cron semanal |
| **R#04** | Dr. Lucas Silveira (Ex-#08 · Imobiliário/CPC) | ❌ **Cancelou Novamente** | 68 min | `2,0` → **5,5** | Nacionalidade/E-mail; `Copiar CPC` lê DOM; zero UI de API Key; listener único; thumbs `file:///` | `main.js:1775` apaga edição manual do dossiê ao reiniciar; Simulador não atualiza `#aba-processos`; OCR offline (`validadorDocumentos.js:274`) cria `CARLOS EDUARDO DA SILVA` |
| **R#05** | Dra. Juliana Costa (Ex-#09 · Notebook/Ignorados) | ✅ **Mantida** | 18 min | `2,5` → **8,0** | `1280×720` sem corte; `#modal-qr-rapido`; ignorados barram texto e foto/PDF (`main.js:2151-2162`) | Almoço não segura o menu (só prefixa); Home lê `confHoje.almocoAtivo` (`4465`) |
| **R#06** | Dr. Eduardo Vasconcelos (Ex-#10 · Auditoria) | ✅ **Mantida** | 68 min | `2,5` → **8,0** | `#aba-terminal` preserva nome do cliente, alinha bot à direita, sem corte de 180 chars, filtro `Robô` funciona | Trocar nome mantendo mesmo tel agrupa sob mesma chave; busca por texto ignora filtro; `server.js` sem `bot-log` |
| **R#07** | Dr. Gustavo Paiva (Ex-#11 · Tributarista/LGPD) | ❌ **Cancelou Novamente** | 44 min | `2,0` → **3,5** | Removeu texto falso "criptografado", limpou URL visual do Render, `sanitizarConfigParaRenderer` | `main.js:2885` grava `👨‍⚖️ *Mensagem do Advogado:*`; `tradutorJuridico.js:975` ordena emojis; JSON em texto puro (`passHash`/`recoveryKey`); fallback Render ainda oculto em `index.html:9473`/`main.js:1814`/`server.js:1049` |
| **R#08** | Dr. Rodrigo Tavares (Ex-#13 · Cível/Copilot) | ✅ **Mantida** | 62 min | `2,5` → **8,2** | `#aba-fluxo` unificado; zero input de API Key; `✨ Sugerir Resposta com IA`; `despausar: false` até `Liberar para o Robô` | 3 frases genéricas de CPF ainda aparecem antes do clique da IA (`7977-7985`); fallback de áudio sem botão |
| **R#09** | Dr. Marcelo Dantas (Ex-#14 · Trânsito/Funil) | ✅ **Mantida** | 58 min | `2,0` → **7,8** | `#painel-fluxo-editor` unificado + `#wa-preview-etapa-real`; `tipo: 'texto'` não trava em `aguardando_relato` sem opt-in | Texto livre após opção 1 devolve `raiz`; `server.js` dessincronizado; refs JS menores |
| **R#10** | Dr. Sérgio Cavalcanti (Ex-#15 · Cético/PDF) | ❌ **Cancelou Novamente** | 39 min | `2,0` → **4,5** | `anexarArquivosAoProcesso` extrai texto de PDF e preenche `proc.resumo`; listener único; zero UI de API Key | Versões conflitantes (`v2.4.0` em `3835`, `(Beta 0.8)` em `package.json:4`, `2.0.0-alpha.1` em `package.json:3`/`migracao.js:16`/`9754`); PIX falso `pix@escritorio.adv.br`; sentença TJSP vira `(PETICAO_INICIAL)` (`tradutorJuridico.js:422-425`) |

---

### Detalhamento Individual — Repescagem Ex-Reembolsos (R#01 a R#10)

#### Repescagem #01 (Ex-#02) — Dra. Patrícia Nogueira (Criminalista / Plantão)
- **Decisão:** ✅ **Assinatura Mantida** (Validou em **22 min**)
- **Nota:** `2,0 / 10` → **`7,0 / 10`** (`+5,0`)
- **Análise Técnica:**
  - **Resolvido:** Campo `#agenda-palavras-urgencia` visível e editável; `"delegacia"` e `"flagrante"` adicionados em `isMensagemCritica`; turnos de madrugada configuráveis; checagem de urgência também presente em `server.js:629`.
  - **Pendências observadas:** Checkboxes `plantao24h` de sábado/domingo bloqueados até habilitar o dia; contatos já pausados ignoram palavras personalizadas de `config` (`main.js:785`); e `server.js` dispara aviso de fora do expediente antes da análise de urgência.
- **Depoimento Literal:**
  > "Na primeira vez eu não tinha nem onde escrever minhas palavras de plantão e o robô respondeu menu comum para 'delegacia em flagrante'. Agora finalmente encontrei a caixa de palavras-chave na aba de horários, digitei meus termos extras, configurei a madrugada e testei 'delegacia' e 'flagrante' no Simulador — cortou a fila na hora e disparou o alerta crítico! Ainda achei chato o 'Plantão 24h' do sábado e domingo continuar travado até eu marcar o dia antes, e notei que no modo nuvem ele ainda manda aviso de 'fora de expediente' antes de ver o flagrante, mas o risco fatal de perder um cliente preso de madrugada foi resolvido. Vou manter a assinatura."

#### Repescagem #02 (Ex-#03) — Dra. Camila Souza (Família / Documentos & Dossiê)
- **Decisão:** ❌ **Cancelou a Assinatura Novamente** (Abandonou aos **78 min**)
- **Nota:** `2,0 / 10` → **`3,5 / 10`** (`+1,5`)
- **Análise Técnica:**
  - **Resolvido:** Miniaturas e lightbox real via `file:///` para imagens anexadas (`index.html:8581`, `6547`) e listagem de dossiês em `#lista-processos-box`.
  - **O que manteve o cancelamento:**
    1. Preset `Familia` segue prometendo `"e Renda"` no menu sem coletar comprovante de renda (`onboardingController.js:48-56`) e ignora edições de 4º documento na mensagem.
    2. Casos com envio parcial (`DOCS_PARCIAIS`, ex.: 2 de 3 documentos) seguem invisíveis em `obterDossies()`.
    3. Envios realizados no Simulador não atualizam `#aba-processos` em tempo real (exige reiniciar o app).
    4. `main.js:1775` descarta edições de `salvarDossieCivilAtual`, e apóstrofo em nomes quebra o `onclick` JSON inline.
- **Depoimento Literal:**
  > "Quando abri o dossiê depois de reiniciar o app e cliquei na foto da certidão em JPG, aí sim a imagem real abriu no zoom — nisso melhorou. Mas todo o resto que me fez pedir reembolso continua igualzinho! O preset de Família ainda promete 'e Renda' no menu sem pedir Renda nenhuma e ignora se eu escrevo o 4º documento na mensagem; quando o cliente manda 2 de 3 documentos e para, o caso continua desaparecido sem aparecer em lugar nenhum; e no Simulador os documentos continuam não aparecendo na aba de Processos até fechar e abrir o programa. É inviável trabalhar assim no dia a dia de Família. Cancelo novamente."

#### Repescagem #03 (Ex-#06) — Dra. Fernanda Lima (Financeiro / Régua PIX)
- **Decisão:** ❌ **Cancelou a Assinatura Novamente** (Abandonou aos **46 min**)
- **Nota:** `2,0 / 10` → **`5,0 / 10`** (`+3,0`)
- **Análise Técnica:**
  - **Resolvido:** Suporte a chave CNPJ + Nome Beneficiário, geração exata de `5x R$ 1.200`, preservação de PIX ao editar menu e roteamento correto do comprovante PIX no Simulador.
  - **Bug fatal que manteve o cancelamento:**
    1. `main.js:3141` continua invocando `dispararReguaCobranca(cfg, enviarMsgFn, { ... })` com **3 argumentos**, enquanto `src/financeiro/gestaoFinanceira.js:141` recebe apenas **2** — fazendo `enviarMensagemWhatsApp` chegar `undefined`, enviando **0 mensagens reais no WhatsApp** apesar de incrementar `cobrancasNaSemana`.
    2. `index.html:9063` lê `rel.enviados` e imprime `"0 lembrete(s) enviado(s)!"`.
    3. Continua sem agendamento automático (cron) semanal para os dias selecionados.
- **Depoimento Literal:**
  > "Eu reconheço que arrumaram bastante coisa: consegui colocar minha chave PIX CNPJ com nome da sociedade, lancei 5x de R$ 1.200 e gerou R$ 1.200 certinho por parcela, editar o menu não apaga mais o PIX, e o comprovante PIX no simulador finalmente caiu no financeiro em vez de virar CNH. Mas na hora H da cobrança o sistema ainda me deixa na mão: não tem agendamento automático semanal nenhum para os dias que eu marco, e quando clico para disparar os lembretes manualmente o sistema ainda cospe na tela '0 lembrete(s) enviado(s)!' e não manda uma única mensagem no WhatsApp conectado! Software de cobrança onde o disparo da cobrança não funciona não dá para assinar."

#### Repescagem #04 (Ex-#08) — Dr. Lucas Silveira (Imobiliário / Qualificação Art. 319)
- **Decisão:** ❌ **Cancelou a Assinatura Novamente** (Abandonou aos **68 min**)
- **Nota:** `2,0 / 10` → **`5,5 / 10`** (`+3,5`)
- **Análise Técnica:**
  - **Resolvido:** Campos de Nacionalidade e E-mail adicionados, `Copiar CPC` lê do DOM em tempo real, zero caixa falsa de API Key, listener único em `#btn-ver-dossie-proc` e miniaturas `file:///`.
  - **Bugs críticos que mantiveram o cancelamento:**
    1. `main.js:1775` sobrescreve `nc['dossiesClientes'] = atualEmMemoria['dossiesClientes']`, apagando ao reiniciar as edições salvas em `salvarDossieCivilAtual`.
    2. Simulador continua sem atualizar `#aba-processos` em tempo real.
    3. Fallback offline de OCR (`validadorDocumentos.js:274`) ainda fabrica dados fictícios de `CARLOS EDUARDO DA SILVA`.
- **Depoimento Literal:**
  > "Melhorou bastante a aparência e a parte do Art. 319: agora existem os campos de Nacionalidade e E-mail, sumiu aquela caixinha mentirosa de chave Gemini e o botão Copiar CPC já puxa o que eu acabei de digitar na tela. Mas caí em duas armadilhas fatais de novo: quando subi os documentos no Simulador, a aba de Processos continuou sem atualizar na hora, me obrigando a fechar e abrir o app igual antes — e quando corrigi o e-mail e a nacionalidade do cliente no dossiê, cliquei em 'Salvar Alterações do Dossiê', apareceu 'salvo com sucesso' e, ao reabrir o sistema, minhas edições tinham sumido do arquivo porque o salvamento principal joga o dossiê fora! Além disso, se a IA falhar uma vez na vida, o código ainda inventa o tal 'CARLOS EDUARDO DA SILVA'. Não dá para confiar minhas iniciais nisso."

#### Repescagem #05 (Ex-#09) — Dra. Juliana Costa (Notebook 1366×768 / Ignorados)
- **Decisão:** ✅ **Assinatura Mantida** (Validou em **18 min**)
- **Nota:** `2,5 / 10` → **`8,0 / 10`** (`+5,5`)
- **Análise Técnica:**
  - **Resolvido:** Janela `1280×720` sem cortes em notebook `1366×768`, acesso instantâneo via `#modal-qr-rapido` e bloqueio real no Simulador para texto, foto e PDF de contatos ignorados (`main.js:2151-2162`).
  - **Pendências menores:** Intervalo de almoço apenas prefixa a resposta sem segurar o menu; Home lê `confHoje.almocoAtivo` (`index.html:4465`).
- **Depoimento Literal:**
  > "Agora sim! O programa abriu inteirinho sem cortar meu notebook 1366x768, o QR Code já aparece clicando direto no botão do WhatsApp ali no topo e — o mais importante para a minha paz antes de entrar em audiência — cadastrei o número da minha mãe em Contatos Ignorados, mandei 'Oi' e até uma foto no Simulador e o robô bloqueou tudo na hora avisando que o contato foi ignorado de verdade! Só acho que o horário de almoço ainda podia segurar o menu em vez de só avisar no começo e mandar as opções mesmo assim, mas o risco de mandar menu automático para família e juiz acabou. Fico com a assinatura!"

#### Repescagem #06 (Ex-#10) — Dr. Eduardo Vasconcelos (Controlador / Auditoria de Mensagens)
- **Decisão:** ✅ **Assinatura Mantida** (Validou em **68 min**)
- **Nota:** `2,5 / 10` → **`8,0 / 10`** (`+5,5`)
- **Análise Técnica:**
  - **Resolvido:** `#aba-terminal` preserva o nome real do cliente, alinha mensagens do robô à direita (`justify-end`), exibe texto completo sem corte de 180 caracteres, envia `bot-log` em produção e o filtro `Robô` funciona corretamente.
  - **Pendências menores:** Trocar o nome no Simulador sem mudar o telefone agrupa sob a mesma chave; busca textual ignora `filtroLogLedgerAtivo`; `server.js` não emite `bot-log`; Simulador ainda envia `"Olá"` automático no reset.
- **Depoimento Literal:**
  > "Na primeira vez eu pedi reembolso porque o Histórico Mensagens parecia uma caixa-preta invertida: chamava meus clientes de '🤖 Robô → João', jogava as falas do bot na esquerda, cortava o texto em 180 letras e o botão 'Robô' zerava tudo. Agora testei duas conversas e também olhei o envio de produção: o nome do cliente fica preservado, o robô responde alinhado à direita com o texto completo sem cortes e o filtro 'Robô' finalmente funciona de verdade. Ainda me incomoda o simulador mandar 'Olá' sozinho ao resetar e a busca por texto ignorar o filtro de remetente quando combinados, além de misturar se eu esquecer de trocar o telefone padrão. Mesmo assim, para controle diário do escritório no desktop, agora a auditoria é confiável. Vou manter a assinatura."

#### Repescagem #07 (Ex-#11) — Dr. Gustavo Paiva (Tributarista Corporativo / LGPD & Compliance)
- **Decisão:** ❌ **Cancelou a Assinatura Novamente** (Abandonou aos **44 min**)
- **Nota:** `2,0 / 10` → **`3,5 / 10`** (`+1,5`)
- **Análise Técnica:**
  - **Resolvido:** Retirou afirmação falsa de "criptografado" em `#aba-backup`, limpou visualmente o campo de URL do Render e implementou `sanitizarConfigParaRenderer`.
  - **Falhas corporativas/LGPD mantidas:**
    1. `main.js:2885` continua prefixando `👨‍⚖️ *Mensagem do Advogado:*\n\n` (e emojis persistem em `main.js`, `src/financeiro/gestaoFinanceira.js` e `index.html:10125`).
    2. `src/ia/tradutorJuridico.js:975` ordena no prompt do `"Melhorar com IA"` a injeção de emojis.
    3. Exportação `.JSON` grava dados sensíveis e credenciais (`passHash`, `recoveryKey`, CPFs) em texto puro sem criptografia.
    4. `index.html:9473`, `main.js:1814` e `server.js:1049` mantêm fallback silencioso para `'https://advocacia-2-0.onrender.com'`.
- **Depoimento Literal:**
  > "Dou crédito por terem retirado a mentira de que o JSON era criptografado na tela de Backup e por tirarem a API key de lá. Mas na prática vocês só maquiaram o visual e deixaram os mesmos problemas de fundo: na resposta humana da fila o sistema continua cravando um bonequinho '👨‍⚖️ *Mensagem do Advogado:*' na cara do CFO que atendo, o 'Melhorar com IA' continua recebendo ordem no código para entupir o texto de balança e brilhinho, o backup exportado ainda abre no Bloco de Notas com 'recoveryKey' e CPFs de clientes em texto puro sem criptografia, e o pior — a URL 'advocacia-2-0.onrender.com' só sumiu da caixinha porque continua escondida no fallback do clique se alguém sincronizar sem preencher nada. Para advocacia corporativa e LGPD, é reprovável. Cancelo de novo."

#### Repescagem #08 (Ex-#13) — Dr. Rodrigo Tavares (Cível / Copilot de IA & Pausa)
- **Decisão:** ✅ **Assinatura Mantida** (Validou em **62 min**)
- **Nota:** `2,5 / 10` → **`8,2 / 10`** (`+5,7`, maior evolução do Grupo 2)
- **Análise Técnica:**
  - **Resolvido:** `#aba-fluxo` unificado, zero input de API Key, botão `✨ Sugerir Resposta com IA` integrado ao card da Fila (`index.html:8216`, `main.js:2934`) lendo o contexto do caso, e `despausar: false` mantendo o cliente pausado até o clique explícito em `Liberar para o Robô`.
  - **Pendências menores:** As 3 frases genéricas pedindo CPF ainda renderizam em `index.html:7977-7985` antes do clique no botão de IA; card fallback de áudio não traz o botão.
- **Depoimento Literal:**
  > "Antes eu testei um caso societário de R$ 400 mil e passei raiva dupla: a única sugestão disponível pedia o CPF do cliente e, na hora que mandei a primeira resposta, o sistema reativou o robô sozinho para atrapalhar minha negociação. Agora, sim: cliquei em '✨ Sugerir Resposta com IA' dentro do próprio card da Fila, a IA leu o relato da conversa e já montou uma resposta técnica coerente no campo de texto sem me pedir nenhuma chave de API. Melhor ainda: quando cliquei em 'Enviar Resposta', o cliente continuou pausado comigo na réplica, só voltando para a automação quando eu cliquei em 'Liberar para o Robô'. Ainda acho estranho aparecer aquela sugestão fixa de pedir CPF antes de eu apertar o botão da IA, mas com o Copilot sob demanda funcionando e sem o robô me atropelar, atende perfeitamente meu escritório."

#### Repescagem #09 (Ex-#14) — Dr. Marcelo Dantas (Trânsito / Funil & Tráfego Pago)
- **Decisão:** ✅ **Assinatura Mantida** (Validou em **58 min**)
- **Nota:** `2,0 / 10` → **`7,8 / 10`** (`+5,8`)
- **Análise Técnica:**
  - **Resolvido:** `#painel-fluxo-editor` unificado + `#wa-preview-etapa-real` espelha fielmente `montarTextoEtapa`; opções `tipo: 'texto'` não forçam mais `aguardando_relato` automaticamente (`main.js:1237`, `2597` exigem opt-in `#check-relato-editor-${idx}`).
  - **Pendências menores:** Texto livre após opção 1 ainda devolve menu `raiz`; `server.js` dessincronizado frente ao `main.js`; pequenas referências JS obsoletas.
- **Depoimento Literal:**
  > "Na primeira compra parecia pegadinha: eu mudava boas-vindas, via no preview bonito e no Simulador o robô respondia opções antigas pedindo CPF; e quando achava o editor certo, o lead mandava '1' e já travava em 'aguardando_relato'. Hoje abri a aba de Fluxo e já caí direto no editor real com o preview mostrando exatamente os botões 1, 2 e 3 do meu funil de trânsito. Testei o lead mandando '1' para Cassação de CNH e logo depois '2' para Lei Seca, e funcionou liso sem travar! Ainda falta o bot ser mais esperto se o lead mandar uma pergunta solta no meio sem jogar o menu inicial inteiro na cara dele de novo, e sei que não posso depender do servidor web com a mesma fidelidade do desktop. Como rodo tráfego pago pelo app no computador com menu numérico, agora fecha meu funil e fico com o sistema."

#### Repescagem #10 (Ex-#15) — Dr. Sérgio Cavalcanti (Auditor Cético / PDF & Governança)
- **Decisão:** ❌ **Cancelou a Assinatura Novamente** (Abandonou aos **39 min**)
- **Nota:** `2,0 / 10` → **`4,5 / 10`** (`+2,5`)
- **Análise Técnica:**
  - **Resolvido:** `anexarArquivosAoProcesso` (`main.js:2660-2741`) extrai texto de PDFs (validado em 3 PDFs) e grava em `proc.resumo`; listener único em `#btn-ver-dossie-proc`; zero API Key na interface.
  - **Motivos do novo cancelamento:**
    1. **Controle de versão inconsistente:** `index.html:3835` exibe `v2.4.0 Studio Pro`, `index.html:4004` exibe `v2.0.0 Studio Pro`, `package.json:4` traz `(Beta 0.8)`, enquanto `package.json:3`, `migracao.js:16` e `index.html:9754` declaram `2.0.0-alpha.1`.
    2. **Chave PIX placeholder armada de fábrica:** `pix@escritorio.adv.br` ainda pré-populada em `migracao.js:77`, `config.json:131` e `src/financeiro/gestaoFinanceira.js:47, 120`.
    3. **Classificação errada de sentença:** Sentenças do TJSP que citam `"petição inicial"` no relatório são rotuladas como `(PETICAO_INICIAL)` pela ordem de `if/else` em `src/ia/tradutorJuridico.js:422-425`.
    4. Dessincronia entre `server.js` e `main.js`.
- **Depoimento Literal:**
  > "Reconheço dois avanços reais: agora quando anexo o PDF da sentença ele finalmente preenche o resumo do processo com o conteúdo da decisão para o robô ler, o dossiê não dispara mais evento duplicado e tiraram aquela história de chave Gemini do Simulador. Mas eu fui bem claro no meu primeiro pedido de reembolso sobre controle de versão e risco operacional para uma equipe de 8 advogados: abro Configurações e ainda está lá escrito 'v2.4.0 Studio Pro' dentro de um sistema cujo código diz '2.0.0-alpha.1' e 'Beta 0.8'! Vou no Financeiro e o PIX falso 'pix@escritorio.adv.br' ainda vem pré-armado de fábrica pronto para vazar em cobrança se alguém esquecer de trocar! Anexei a sentença do TJSP e o sistema rotulou a etiqueta como '(PETICAO_INICIAL)' porque achou essa palavra no relatório antes do dispositivo, fora `server.js` e `main.js` continuarem desalinhados. Melhorou o motor de PDF, mas ainda não tem rigor de produção. Cancelado de novo."

---

## 4. Top 4 Bugs-Raiz Restantes Revelados por Esta Auditoria

1. **Perda de Edições Manuais do Dossiê Civil (`main.js:1775`):** `nc['dossiesClientes'] = atualEmMemoria['dossiesClientes']` apaga ao reiniciar tudo o que foi salvo via `salvarDossieCivilAtual`, além da ausência de live-sync com `#aba-processos` e fallback fictício `CARLOS EDUARDO DA SILVA` (`validadorDocumentos.js:274`). *(Impactou `#08 Thiago`, `R#02 Camila`, `R#04 Lucas`)*.
2. **Disparo da Régua PIX Inoperante (`main.js:3141` vs. `src/financeiro/gestaoFinanceira.js:141` vs. `index.html:9063`):** Chamada com 3 argumentos vs. função de 2 deixa `enviarMensagemWhatsApp = undefined` (disparo manual envia **0 mensagens** e reporta `"0 lembrete(s) enviado(s)!"`), somado a comparação estrita `pTel === telLimpo` sem normalização de `55` (`gestaoFinanceira.js:314`), ausência de cron semanal e PIX fake padrão `pix@escritorio.adv.br`. *(Impactou `#07 Vanessa`, `R#03 Fernanda`, `R#10 Sérgio`)*.
3. **Variável `{escritorio}` Quebrada (`main.js:705-711` & `config.json:61`):** `formatarMensagemProcesso()` não interpola `{escritorio}` (retornando literal `"{escritorio}"`) e a saudação inicial ignora `config.nomeEscritorio`. *(Único reembolso dos 10 novos clientes: `#02 Otávio`)*.
4. **Governança, Emojis/LGPD e Consistência (`index.html`, `package.json`, `tradutorJuridico.js`, `main.js`):** Versões conflitantes (`v2.4.0`, `v2.0.0`, `Beta 0.8`, `2.0.0-alpha.1`), fallback silencioso para `advocacia-2-0.onrender.com`, JSON sem criptografia, emojis forçados na resposta humana/IA e falha de bloqueio de áudio para contatos ignorados no Simulador (`despacharAudioParaIAEFila`). *(Impactou `#09 Mônica`, `R#07 Gustavo`, `R#10 Sérgio`)*.
