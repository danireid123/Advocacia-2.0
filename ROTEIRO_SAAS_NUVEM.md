# GUIA MESTRE DE IMPLANTAÇÃO EM NUVEM (SAAS 24/7)
## Advocacia Studio Pro v2.0 - Arquitetura Headless de Alta Disponibilidade

Este roteiro detalha a arquitetura e os passos práticos para migrar e hospedar o **Advocacia Studio Pro v2.0** em um servidor na nuvem (VPS/Docker), permitindo que o robô de atendimento do WhatsApp e o tradutor jurídico por IA operem **24 horas por dia, 7 dias por semana**, sem a necessidade de manter o computador do escritório ligado.

---

### 1. ARQUITETURA HEADLESS E DE ACOPLAMENTO ZERO

O ecossistema v2.0 foi arquitetado em duas modalidades complementares:

| Modalidade | Executável | Ambiente Recomendado | Finalidade Principal |
| :--- | :--- | :--- | :--- |
| **Desktop Executivo (GUI)** | `npm start` / `electron .` | Windows Desktop do Advogado | Gestão visual, importação de planilhas/PDFs, simulador sandbox e atendimento presencial com alertas sonoros |
| **Servidor Autônomo (Headless)** | `npm run server` / `Docker` | Servidor Linux / Nuvem / VPS | Atendimento 24/7 ininterrupto, conexão direta ao WhatsApp Web e tradução jurídica via IA |

Ambas as modalidades compartilham a mesma estrutura de dados (`config.json`), o mesmo motor de regras de fluxo multinível e o mesmo cache de tradução por IA.

---

### 2. HOSPEDAGEM A CUSTO ZERO: ORACLE CLOUD ALWAYS FREE

A **Oracle Cloud Infrastructure (OCI)** disponibiliza uma das camadas gratuitas mais generosas do mundo, **100% gratuita para sempre** (*Always Free*), perfeitamente adequada para hospedar até 10 instâncias simultâneas do bot:

- **Instância ARM Ampere A1:** Até **4 vCPUs** e **24 GB de memória RAM**.
- **Armazenamento em Disco:** **200 GB SSD** NVMe.
- **Tráfego de Rede:** 10 TB de transferência de saída por mês gratuitos.

#### Passo 2.1: Criando a Máquina Virtual na Oracle Cloud
1. Crie uma conta no portal [Oracle Cloud](https://cloud.oracle.com).
2. No menu principal, vá em **Compute > Instances > Create Instance**.
3. Escolha:
   - **Imagem do SO:** `Ubuntu 22.04 LTS` ou `Ubuntu 24.04 LTS`.
   - **Shape (Hardware):** `Ampere (ARM)` -> selecione 2 vCPUs e 8 GB de RAM (ou até 4 vCPUs / 24 GB).
   - **SSH Keys:** Baixe sua chave privada (`.key`) para conectar via terminal.
4. Clique em **Create**. Em 60 segundos o servidor estará com um IP Público dedicado.

#### Passo 2.2: Liberando as Portas de Rede na VCN (Firewall Oracle)
1. Na página da instância, clique na sua **Subnet** vinculada e abra a **Default Security List**.
2. Clique em **Add Ingress Rules**:
   - **Source CIDR:** `0.0.0.0/0`
   - **IP Protocol:** `TCP`
   - **Destination Port Range:** `80, 443, 3000`
   - **Description:** `Portas HTTP, HTTPS e Advocacia Studio Pro Server`

---

### 3. DEPLOY AUTOMATIZADO COM DOCKER & DOCKER COMPOSE

Este é o método mais recomendado pela robustez e isolamento de dependências.

#### Passo 3.1: Conectar ao Servidor via SSH e Instalar o Docker
No terminal do seu computador (PowerShell ou Bash):
```bash
ssh -i /caminho/para/sua-chave.key ubuntu@<SEU_IP_PUBLICO>
```

Atualize o sistema e instale o Docker:
```bash
# Atualiza pacotes
sudo apt-get update && sudo apt-get upgrade -y

# Instala Docker e utilitários
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker ubuntu

# Instala Docker Compose Plugin
sudo apt-get install -y docker-compose-plugin git
```

#### Passo 3.2: Clonar o Repositório e Configurar o Ambiente
```bash
# Clona o repositório oficial
git clone https://github.com/danireid123/Advocacia-2.0.git
cd Advocacia-2.0

# Cria o arquivo de configuração de variáveis de ambiente
cat << 'EOF' > .env
PORT=3000
NODE_ENV=production
# Insira sua chave Gemini abaixo (opcional, ativa tradução com IA)
GEMINI_API_KEY=AIzaSy...
EOF

# Garante que o diretório de dados da sessão exista
mkdir -p wwebjs_auth_session_v2 cache
```

#### Passo 3.3: Iniciar o Container
```bash
docker compose up -d --build
```

#### Passo 3.4: Escanear o QR Code de Conexão do WhatsApp
Existem duas maneiras simples e imediatas de escanear o QR Code:

1. **Pelo Terminal (Logs do Docker):**
   ```bash
   docker compose logs -f
   ```
   O QR Code será renderizado em modo texto diretamente no terminal. Abra o WhatsApp no celular (**Aparelhos Conectados > Conectar um aparelho**) e aponte a câmera.

2. **Pelo Navegador (Interface Web Remota):**
   Abra no seu navegador: `http://<SEU_IP_PUBLICO>:3000/qr`
   A página exibirá a imagem do QR Code com atualização automática.

---

### 4. DEPLOY ALTERNATIVO COM PM2 (EXECUÇÃO DIRETA NO UBUNTU)

Caso prefira não usar Docker, é possível rodar diretamente no Node.js do sistema:

```bash
# 1. Instalar Node.js 20 LTS e Chromium
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs chromium-browser

# 2. Instalar PM2 (Gerenciador de Processos)
sudo npm install -g pm2

# 3. Instalar dependências da aplicação
cd Advocacia-2.0
npm install --omit=dev

# 4. Iniciar via PM2
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium pm2 start server.js --name "advocacia-bot"

# 5. Salvar para inicialização automática após reboot do servidor
pm2 startup
pm2 save

# 6. Ver logs e escanear o QR Code
pm2 logs advocacia-bot
```

---

### 5. CONFIGURAÇÃO DE DOMÍNIO COM NGINX E SSL GRÁTIS (HTTPS)

Para acessar o painel com segurança criptografada (`https://bot.meuescritorio.adv.br`):

```bash
sudo apt-get install -y nginx certbot python3-certbot-nginx
```

Crie o arquivo de configuração do Nginx:
```bash
sudo nano /etc/nginx/sites-available/advocacia-bot
```

Cole o bloco abaixo:
```nginx
server {
    listen 80;
    server_name bot.meuescritorio.adv.br;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Ative o site e gere o certificado SSL gratuito:
```bash
sudo ln -s /etc/nginx/sites-available/advocacia-bot /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# Gera o certificado HTTPS com renovação automática
sudo certbot --nginx -d bot.meuescritorio.adv.br
```

---

### 6. ENDPOINTS DA API DO SERVIDOR HEADLESS

O servidor embutido fornece rotas para observabilidade e integração:

- `GET /`: Painel de status em tempo real com contador de atendimentos.
- `GET /health` ou `GET /status`: Retorna JSON com uptime, status da conexão, contatos pausados e total de processos cadastrados.
- `GET /qr`: Retorna visualizador HTML com o QR Code para conectar o WhatsApp de qualquer navegador.

Exemplo de retorno do `/health`:
```json
{
  "status": "ok",
  "botStatus": "ready",
  "uptimeSegundos": 86420,
  "momentoConexao": 1773760000,
  "totalProcessosCadastrados": 128,
  "totalMensagensProcessadas": 452,
  "contatosPausadosQtd": 2,
  "contatosPausados": {
    "5511999998888": {
      "telefone": "5511999998888",
      "nome": "Cliente WhatsApp",
      "pausadoEm": "2026-10-17T14:00:00.000Z"
    }
  }
}
```

---

### 7. POLÍTICA DE BACKUP AUTOMÁTICO & RECUPERAÇÃO DE DESASTRES

Para garantir que a base de clientes e a sessão do WhatsApp nunca sejam perdidas, configure um cronjob diário:

```bash
crontab -e
```

Adicione a linha para gerar backup diário compactado às 03:00 da manhã:
```bash
0 3 * * * tar -czf /home/ubuntu/backup_bot_$(date +\%F).tar.gz /home/ubuntu/Advocacia-2.0/config.json /home/ubuntu/Advocacia-2.0/wwebjs_auth_session_v2
```

---

### 8. SINCRONIZAÇÃO ENTRE A VERSÃO DESKTOP E O SERVIDOR NUVEM

Caso você utilize o **Advocacia Studio Pro Desktop** para cadastrar processos e queira replicar na Nuvem:
1. No seu desktop, o arquivo de dados fica salvo em:
   - `%APPDATA%\advocacia-studio-pro\config.json`
2. Basta enviar o `config.json` para a pasta do servidor na nuvem via SCP ou SFTP:
   ```bash
   scp -i chave.key config.json ubuntu@<SEU_IP>:/home/ubuntu/Advocacia-2.0/config.json
   ```
3. O servidor atualizará os processos em tempo real sem necessidade de reiniciar a sessão do WhatsApp.
