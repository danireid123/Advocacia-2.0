# Advocacia Studio Pro v2.0 (Alpha Comercial)

Sistema de automação inteligente e gestão de atendimento via WhatsApp desenvolvido especificamente para escritórios de advocacia, combinando operação local segura, triagem híbrida e tradução de andamentos processuais com conformidade ética da OAB (Provimento 205/2021).

---

## 🚀 Como Rodar o Projeto para Testes (3 Passos Rápidos)

### 1. Instalação e Execução
Abra o terminal na pasta do projeto e execute:
```bash
npm install
npm start
```
> O Electron iniciará em modo de desenvolvimento local.

---

### 2. Configuração da IA (Google AI Studio - Custo R$ 0,00)
A IA tradutora de andamentos processuais utiliza o modelo **Gemini 1.5 Flash** e opera com a cota gratuita do Google AI Studio (até 1.500 consultas por dia gratuitas por escritório):

1. Obtenha sua chave gratuita em: [Google AI Studio (API Keys)](https://aistudio.google.com/app/apikey)
2. Duplique o arquivo `.env.example` e renomeie para `.env`:
   ```bash
   cp .env.example .env
   ```
3. Cole a sua chave no `.env`:
   ```env
   GEMINI_API_KEY=sua_chave_aqui
   ```
> **Nota de Segurança:** O arquivo `.env` está protegido no `.gitignore` e **nunca** é enviado ao GitHub.  
> Caso não queira usar IA no momento, deixe o campo vazio: o sistema continuará operando 100% no **Modo Código Puro Gratuito** com fallback automático instantâneo (0ms).

---

### 3. Teste de Importação de Arquivos e Consulta
Na pasta `exemplos_importacao/` há 3 arquivos sintéticos prontos para você testar:
- `exemplo_processos.xlsx`: Planilha com cabeçalhos reais de clientes e andamentos.
- `relatorio_tribunal.txt`: Simulação de extrato textual contínuo de tribunais (PJe / e-SAJ).
- `ficha_cliente.docx`: Documento Word com dados de clientes e processos.

#### Como testar:
1. Com o app aberto, navegue até a aba **Consultar Processo**.
2. Arraste qualquer um dos arquivos da pasta `exemplos_importacao/` para a área de **Drag-and-Drop** (ou clique em *Selecionar Arquivo*).
3. O **Modal de Prévia** será aberto exibindo a contagem de novos registros, atualizados e conformidade de CPF/CNJ.
4. Clique em **Confirmar e Gravar na Base**.
5. Simule a consulta pelo WhatsApp enviando o CPF ou o Número de Processo cadastrado!

---

## 🛠️ Tecnologias e Arquitetura

- **Desktop Core:** Electron 33 + Node.js 20
- **WhatsApp Engine:** whatsapp-web.js com sessão persistente isolada
- **Motor de Ingestão Multiformato:** `xlsx` (SheetJS), `pdf-parse`, `mammoth`
- **Validações Matemáticas Oficiais:**
  - CPF: Módulo 11 (Receita Federal)
  - Processo: Módulo 97 Base 10 (Resolução 65 do CNJ)
- **Áudio & Transbordo:** Sintetizador harmônico nativo via **Web Audio API** (dois tons Mi5 -> Lá5: 659.25Hz -> 880Hz) e notificações nativas do Windows.
- **IA Híbrida:** Google Gemini 1.5 Flash com Cache MD5 em memória/disco e Fallback Gracioso Instantâneo (< 2.8s).
