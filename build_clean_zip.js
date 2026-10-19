/**
 * =========================================================================
 * BUILD CLEAN ZIP - ADVOCACIA STUDIO PRO v2.0
 * =========================================================================
 * Gera o pacote .zip de distribuição limpo, seguro e com árvore perfeita:
 * - Exclui estritamente: .env, node_modules, .git, .agents, wwebjs_auth_session*, *.zip
 * - Preserva rigorosamente os caminhos relativos (src/..., exemplos_importacao/...)
 * - Sem duplicação ou achatamento de subpastas na raiz
 * - Valida a integridade do arquivo gerado
 */

const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const PROJECT_ROOT = path.resolve(__dirname);
const ARTIFACT_DEST = 'C:\\Users\\Daniel\\.gemini\\antigravity\\brain\\05dacc8a-1a18-4a2b-9c17-a3142a4b0e27\\advocacia-2.0-completo.zip';
const SCRATCH_DEST = 'C:\\Users\\Daniel\\.gemini\\antigravity\\scratch\\advocacia-2.0-completo.zip';

// Lista de padrões a ignorar estritamente
const IGNORE_PATTERNS = [
  '.env',
  '.env.local',
  'node_modules',
  '.git',
  '.agents',
  'wwebjs_auth_session',
  'wwebjs_auth_session_v2',
  'gemini_cache.json',
  'dist',
  'build',
  '.cache'
];

function deveIgnorar(caminhoRelativo) {
  const norm = caminhoRelativo.replace(/\\/g, '/');
  const partes = norm.split('/');
  
  // Ignora se for ou começar com qualquer padrão proibido
  for (const part of partes) {
    if (IGNORE_PATTERNS.includes(part)) return true;
    if (part.startsWith('wwebjs_auth_session')) return true;
  }
  
  if (norm === '.env' || norm.endsWith('/.env')) return true;
  if (norm.endsWith('.zip')) return true;
  
  return false;
}

async function criarZipParaDestino(destinoZip) {
  return new Promise((resolve, reject) => {
    // Garante que o diretório pai existe
    const dirPai = path.dirname(destinoZip);
    if (!fs.existsSync(dirPai)) {
      fs.mkdirSync(dirPai, { recursive: true });
    }

    if (fs.existsSync(destinoZip)) {
      try { fs.unlinkSync(destinoZip); } catch (_) {}
    }

    const output = fs.createWriteStream(destinoZip);
    const archive = archiver('zip', {
      zlib: { level: 9 } // Compressão máxima
    });

    output.on('close', () => {
      resolve({
        caminho: destinoZip,
        totalBytes: archive.pointer()
      });
    });

    archive.on('warning', (err) => {
      if (err.code === 'ENOENT') {
        console.warn('Aviso de compressão:', err);
      } else {
        reject(err);
      }
    });

    archive.on('error', (err) => reject(err));

    archive.pipe(output);

    // Escaneia a árvore recursivamente de forma limpa e adiciona cada arquivo com seu caminho relativo exato
    function adicionarDiretorioRecursivo(dirAtual) {
      const itens = fs.readdirSync(dirAtual, { withFileTypes: true });

      for (const item of itens) {
        const fullPath = path.join(dirAtual, item.name);
        const relPath = path.relative(PROJECT_ROOT, fullPath).replace(/\\/g, '/');

        if (deveIgnorar(relPath)) {
          continue;
        }

        if (item.isDirectory()) {
          // Se for diretório vazio ou documentos_clientes, garante que a pasta exista no zip
          const subItens = fs.readdirSync(fullPath);
          if (subItens.length === 0) {
            archive.append('', { name: `${relPath}/.gitkeep` });
          } else {
            adicionarDiretorioRecursivo(fullPath);
          }
        } else if (item.isFile()) {
          archive.file(fullPath, { name: relPath });
        }
      }
    }

    adicionarDiretorioRecursivo(PROJECT_ROOT);
    archive.finalize();
  });
}

// Validação profunda do arquivo .zip gerado
async function validarZip(caminhoZip) {
  const AdmZip = (() => {
    try {
      return require('adm-zip');
    } catch (_) {
      return null;
    }
  })();

  if (!AdmZip) {
    console.log('ℹ️ adm-zip não instalado, pulando validação com AdmZip.');
    return;
  }

  const zip = new AdmZip(caminhoZip);
  const entries = zip.getEntries();
  const nomes = entries.map(e => e.entryName.replace(/\\/g, '/'));

  console.log(`\n🔍 Auditoria do arquivo: ${caminhoZip}`);
  console.log(`Total de entradas no .zip: ${nomes.length}`);

  // 1. Checagem de .env
  const temEnv = nomes.some(n => n === '.env' || n.endsWith('/.env'));
  if (temEnv) {
    throw new Error('🚨 FALHA CRÍTICA: Arquivo .env foi detectado dentro do .zip!');
  }
  console.log('✅ Chave de segurança: Nenhum arquivo .env incluído!');

  // 2. Checagem de arquivos soltos de src na raiz
  const modulosEmSrc = [
    'tradutorJuridico.js',
    'validadorDocumentos.js',
    'armazenamentoDocs.js',
    'gestaoFinanceira.js',
    'validadorComprovantePix.js',
    'onboardingController.js',
    'audioAlert.js',
    'motorIngestao.js'
  ];

  for (const mod of modulosEmSrc) {
    if (nomes.includes(mod)) {
      throw new Error(`🚨 FALHA CRÍTICA: Módulo ${mod} encontrado solto na raiz do .zip!`);
    }
    const versaoCorreta = nomes.find(n => n.startsWith('src/') && n.endsWith(mod));
    if (!versaoCorreta) {
      throw new Error(`🚨 FALHA: Módulo ${mod} não encontrado dentro de src/ no .zip!`);
    }
  }
  console.log('✅ Hierarquia de código: Todos os módulos de src/ estão no caminho relativo correto!');

  // 3. Checagem de duplicatas de entrada
  const conjuntoNomes = new Set();
  const duplicatas = [];
  for (const n of nomes) {
    if (conjuntoNomes.has(n)) {
      duplicatas.push(n);
    }
    conjuntoNomes.add(n);
  }

  if (duplicatas.length > 0) {
    throw new Error(`🚨 FALHA: Entradas duplicadas encontradas no .zip: ${duplicatas.slice(0, 5).join(', ')}`);
  }
  console.log('✅ Unicidade: Zero arquivos duplicados no índice!');
}

async function main() {
  console.log('🚀 Iniciando empacotamento limpo do Advocacia Studio Pro v2.0...');
  
  const res1 = await criarZipParaDestino(SCRATCH_DEST);
  console.log(`📦 Gerado em scratch: ${(res1.totalBytes / 1024 / 1024).toFixed(2)} MB`);
  await validarZip(SCRATCH_DEST);

  const res2 = await criarZipParaDestino(ARTIFACT_DEST);
  console.log(`📦 Gerado em artifacts: ${(res2.totalBytes / 1024 / 1024).toFixed(2)} MB`);
  await validarZip(ARTIFACT_DEST);

  console.log('\n🎉 EMPACOTAMENTO CONCLUÍDO COM 100% DE SUCESSO!');
}

main().catch(err => {
  console.error('❌ Erro no empacotamento:', err);
  process.exit(1);
});
