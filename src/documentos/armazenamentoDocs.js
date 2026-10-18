/**
 * Advocacia Studio Pro v2.0 - Armazenamento Físico Seguro de Documentos Forenses
 * Arquivo: src/documentos/armazenamentoDocs.js
 * 
 * Funcionalidades:
 * - Persistência segura em ./documentos_clientes/<clienteId>/
 * - Sanitização rigorosa contra Path Traversal (.., /, \, null bytes, caracteres inválidos)
 * - Nomenclatura com timestamp e UUID para unicidade sem perda da extensão original
 * - Catalogação local de metadados de auditoria forense (.meta.json e _manifest.json)
 * - Padrão de retorno híbrido (compatível com chamadas síncronas e assíncronas/await)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Diretório base padrão para os documentos
const DIRETORIO_BASE_PADRAO = path.resolve(process.cwd(), 'documentos_clientes');

// Lista de nomes reservados pelo Windows
const NOMES_RESERVADOS_WINDOWS = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

/**
 * Sanitiza o ID do cliente garantindo que não contenha caracteres maliciosos ou de travessia.
 * @param {string|number} clienteId 
 * @returns {string} ID sanitizado e seguro para nome de pasta
 */
function sanitizarClienteId(clienteId) {
    if (!clienteId && clienteId !== 0) return 'cliente_geral';
    
    let limpo = String(clienteId).trim();
    // Normaliza acentuações e caracteres diacríticos
    limpo = limpo.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    // Remove bytes nulos e caracteres de controle
    limpo = limpo.replace(/[\x00-\x1f\x7f]/g, '');
    // Remove barras, barras invertidas e sequências de pontos
    limpo = limpo.replace(/[\\\/]+/g, '_').replace(/\.{2,}/g, '_');
    // Substitui caracteres não alfanuméricos por underline, mantendo traços seguros
    limpo = limpo.replace(/[^a-zA-Z0-9_\-]/g, '_');
    // Remove underscores repetidos e das extremidades
    limpo = limpo.replace(/_+/g, '_').replace(/^_+|_+$/g, '');
    
    if (!limpo || limpo === '.' || limpo === '..') {
        return 'cliente_geral';
    }
    if (NOMES_RESERVADOS_WINDOWS.test(limpo)) {
        limpo = `cli_${limpo}`;
    }
    return limpo;
}

/**
 * Sanitiza o nome original de um arquivo, preservando a extensão e removendo caracteres perigosos.
 * @param {string} nomeOriginal 
 * @returns {string} Nome de arquivo seguro e higienizado
 */
function sanitizarNomeArquivo(nomeOriginal) {
    if (!nomeOriginal) return 'documento_anexo.bin';

    // 1. Extrai apenas o nome base para neutralizar qualquer path traversal
    let base = path.basename(String(nomeOriginal).trim());
    
    // 2. Remove bytes nulos e caracteres de controle
    base = base.replace(/[\x00-\x1f\x7f]/g, '');
    
    // 3. Normaliza acentos
    base = base.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // 4. Separa extensão e corpo do nome
    const extRaw = path.extname(base);
    let ext = extRaw.toLowerCase().replace(/[^a-z0-9.]/g, '');
    if (ext.length > 10) ext = ext.slice(0, 10); // Limite de extensão razoável

    let corpo = base.slice(0, base.length - extRaw.length);
    
    // 5. Remove caracteres ilegais para Windows/Linux (< > : " / \ | ? *)
    corpo = corpo.replace(/[<>:"/\\|?*]/g, '_');
    // Remove sequências de pontos perigosas no corpo
    corpo = corpo.replace(/\.{2,}/g, '_');
    // Substitui espaços e caracteres estranhos
    corpo = corpo.replace(/[\s\t\n]+/g, '_');
    corpo = corpo.replace(/[^a-zA-Z0-9_\-]/g, '_');
    corpo = corpo.replace(/_+/g, '_').replace(/^_+|_+$/g, '');

    if (!corpo) {
        corpo = 'documento';
    }

    // 6. Protege contra nomes de dispositivos reservados no Windows
    if (NOMES_RESERVADOS_WINDOWS.test(corpo)) {
        corpo = `doc_${corpo}`;
    }

    return `${corpo}${ext}`;
}

/**
 * Salva um documento físico do cliente de forma segura no disco.
 * Cria o diretório ./documentos_clientes/<clienteId>/ se não existir.
 * 
 * @param {string|number} clienteId - Identificador do cliente (telefone, CPF ou ID)
 * @param {string} nomeOriginal - Nome original do arquivo (ex: RG_Frente.jpg)
 * @param {Buffer|string} buffer - Buffer de bytes ou string base64 do arquivo
 * @param {Object} [metadados={}] - Metadados de auditoria forense extraídos
 * @param {string} [diretorioBase] - Sobrescrita opcional do diretório raiz
 * @returns {Object|Promise<Object>} Estrutura com idDocumento, caminhos e status
 */
function salvarDocumentoCliente(clienteId, nomeOriginal, buffer, metadados = {}, diretorioBase = null) {
    try {
        // Validação e conversão do buffer
        let buf = null;
        if (Buffer.isBuffer(buffer)) {
            buf = buffer;
        } else if (typeof buffer === 'string') {
            // Suporte a Data URLs (ex: data:image/png;base64,iVBORw0KGgo...)
            if (buffer.startsWith('data:')) {
                const virgulaIndex = buffer.indexOf(',');
                const base64Data = virgulaIndex !== -1 ? buffer.slice(virgulaIndex + 1) : buffer;
                buf = Buffer.from(base64Data, 'base64');
            } else {
                // Tenta base64, com fallback para utf8
                try {
                    buf = Buffer.from(buffer, 'base64');
                    // Se a conversão gerou buffer vazio ou inválido para string não-vazia, tenta utf8
                    if (buf.length === 0 && buffer.trim().length > 0) {
                        buf = Buffer.from(buffer, 'utf8');
                    }
                } catch {
                    buf = Buffer.from(buffer, 'utf8');
                }
            }
        }

        if (!buf || buf.length === 0) {
            const erroRes = {
                sucesso: false,
                erro: 'Buffer inválido ou vazio fornecido para salvarDocumentoCliente',
                idDocumento: null,
                caminhoRelativo: null,
                caminhoAbsoluto: null,
                tamanhoBytes: 0,
                dataUpload: new Date().toISOString(),
                metadados: metadados || {}
            };
            const pErro = Promise.resolve(erroRes);
            Object.assign(pErro, erroRes);
            return pErro;
        }

        // Sanitização estrita de ID e nome de arquivo
        const idClienteLimpo = sanitizarClienteId(clienteId);
        const nomeArquivoLimpo = sanitizarNomeArquivo(nomeOriginal);

        // Resolução do diretório base com proteção contra Path Traversal
        const baseDir = diretorioBase ? path.resolve(diretorioBase) : DIRETORIO_BASE_PADRAO;
        const pastaCliente = path.resolve(baseDir, idClienteLimpo);

        // VERIFICAÇÃO DE SEGURANÇA 1: O diretório do cliente deve estar estritamente contido no baseDir
        if (!pastaCliente.startsWith(baseDir)) {
            throw new Error(`Tentativa de Directory Traversal detectada no clienteId: "${clienteId}"`);
        }

        // Criação recursiva da pasta se não existir
        if (!fs.existsSync(pastaCliente)) {
            fs.mkdirSync(pastaCliente, { recursive: true });
        }

        // Geração de ID único e nome cronológico com UUID
        const timestamp = Date.now();
        const uuidCurto = (crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(8).toString('hex')).replace(/-/g, '').slice(0, 8);
        const idDocumento = `doc_${timestamp}_${uuidCurto}`;
        const nomeArquivoFinal = `${timestamp}_${uuidCurto}_${nomeArquivoLimpo}`;

        const caminhoAbsoluto = path.resolve(pastaCliente, nomeArquivoFinal);

        // VERIFICAÇÃO DE SEGURANÇA 2: O arquivo deve estar contido na pasta do cliente
        if (!caminhoAbsoluto.startsWith(pastaCliente)) {
            throw new Error(`Tentativa de Directory Traversal detectada no nome do arquivo: "${nomeOriginal}"`);
        }

        // Gravação física do arquivo no disco
        fs.writeFileSync(caminhoAbsoluto, buf);

        // Caminho relativo a partir do process.cwd() normalizado com barras /
        const caminhoRelativo = path.relative(process.cwd(), caminhoAbsoluto).replace(/\\/g, '/');
        const dataUpload = new Date().toISOString();

        const registroMeta = {
            idDocumento,
            nomeOriginal: String(nomeOriginal || ''),
            nomeArquivoSalvo: nomeArquivoFinal,
            caminhoRelativo,
            caminhoAbsoluto,
            tamanhoBytes: buf.length,
            dataUpload,
            metadados: metadados || {}
        };

        // Grava arquivo de metadados (.meta.json) lateral para recuperação instantânea
        try {
            fs.writeFileSync(`${caminhoAbsoluto}.meta.json`, JSON.stringify(registroMeta, null, 2), 'utf8');
        } catch (errMeta) {
            console.warn(`[ArmazenamentoDocs] Aviso ao gravar .meta.json: ${errMeta.message}`);
        }

        // Atualiza manifesto do cliente (_manifest.json)
        try {
            const manifestPath = path.resolve(pastaCliente, '_manifest.json');
            let manifest = [];
            if (fs.existsSync(manifestPath)) {
                try {
                    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
                    if (!Array.isArray(manifest)) manifest = [];
                } catch {
                    manifest = [];
                }
            }
            manifest.push(registroMeta);
            fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
        } catch (errMan) {
            console.warn(`[ArmazenamentoDocs] Aviso ao atualizar _manifest.json: ${errMan.message}`);
        }

        const resultado = {
            sucesso: true,
            idDocumento,
            caminhoRelativo,
            caminhoAbsoluto,
            tamanhoBytes: buf.length,
            dataUpload,
            metadados: metadados || {}
        };

        // Padrão híbrido síncrono/assíncrono:
        // Permite "const r = salvarDocumentoCliente(...)" direto síncrono E "const r = await salvarDocumentoCliente(...)"
        const promiseRetorno = Promise.resolve(resultado);
        Object.assign(promiseRetorno, resultado);
        return promiseRetorno;

    } catch (erro) {
        console.error('[ArmazenamentoDocs] Erro ao salvar documento:', erro.message);
        const resultadoFalha = {
            sucesso: false,
            erro: erro.message,
            idDocumento: null,
            caminhoRelativo: null,
            caminhoAbsoluto: null,
            tamanhoBytes: 0,
            dataUpload: new Date().toISOString(),
            metadados: metadados || {}
        };
        const pErro = Promise.resolve(resultadoFalha);
        Object.assign(pErro, resultadoFalha);
        return pErro;
    }
}

/**
 * Lista todos os documentos armazenados de um determinado cliente.
 * @param {string|number} clienteId 
 * @param {string} [diretorioBase]
 * @returns {Array<Object>} Lista de registros de documentos
 */
function listarDocumentosCliente(clienteId, diretorioBase = null) {
    try {
        const idLimpo = sanitizarClienteId(clienteId);
        const baseDir = diretorioBase ? path.resolve(diretorioBase) : DIRETORIO_BASE_PADRAO;
        const pastaCliente = path.resolve(baseDir, idLimpo);

        if (!fs.existsSync(pastaCliente)) return [];

        const manifestPath = path.resolve(pastaCliente, '_manifest.json');
        if (fs.existsSync(manifestPath)) {
            try {
                const dados = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
                if (Array.isArray(dados)) return dados;
            } catch {
                // Se falhar o JSON, faz a varredura direta dos arquivos
            }
        }

        const arquivos = fs.readdirSync(pastaCliente);
        const docs = [];
        for (const arq of arquivos) {
            if (arq === '_manifest.json' || arq.endsWith('.meta.json')) continue;
            const abs = path.resolve(pastaCliente, arq);
            const stat = fs.statSync(abs);
            let meta = {};
            const metaFile = `${abs}.meta.json`;
            if (fs.existsSync(metaFile)) {
                try {
                    meta = JSON.parse(fs.readFileSync(metaFile, 'utf8')).metadados || {};
                } catch {}
            }
            docs.push({
                idDocumento: arq,
                nomeOriginal: arq,
                nomeArquivoSalvo: arq,
                caminhoRelativo: path.relative(process.cwd(), abs).replace(/\\/g, '/'),
                caminhoAbsoluto: abs,
                tamanhoBytes: stat.size,
                dataUpload: stat.mtime.toISOString(),
                metadados: meta
            });
        }
        return docs;
    } catch {
        return [];
    }
}

/**
 * Obtém o caminho absoluto de um documento de cliente por ID ou nome.
 * @param {string|number} clienteId 
 * @param {string} idOuNome 
 * @param {string} [diretorioBase]
 * @returns {string|null}
 */
function obterCaminhoDocumento(clienteId, idOuNome, diretorioBase = null) {
    try {
        const docs = listarDocumentosCliente(clienteId, diretorioBase);
        const encontrado = docs.find(d => d.idDocumento === idOuNome || d.nomeArquivoSalvo === idOuNome || d.nomeOriginal === idOuNome);
        return encontrado ? encontrado.caminhoAbsoluto : null;
    } catch {
        return null;
    }
}

/**
 * Lê o buffer de um documento armazenado.
 * @param {string|number} clienteId 
 * @param {string} idOuNome 
 * @param {string} [diretorioBase]
 * @returns {{ buffer: Buffer, metadados: Object, caminhoAbsoluto: string }|null}
 */
function lerDocumentoCliente(clienteId, idOuNome, diretorioBase = null) {
    try {
        const caminhoAbs = obterCaminhoDocumento(clienteId, idOuNome, diretorioBase);
        if (!caminhoAbs || !fs.existsSync(caminhoAbs)) return null;

        const buffer = fs.readFileSync(caminhoAbs);
        let metadados = {};
        const metaPath = `${caminhoAbs}.meta.json`;
        if (fs.existsSync(metaPath)) {
            try {
                metadados = JSON.parse(fs.readFileSync(metaPath, 'utf8')).metadados || {};
            } catch {}
        }
        return { buffer, metadados, caminhoAbsoluto: caminhoAbs };
    } catch {
        return null;
    }
}

/**
 * Exclui com segurança um documento e seus metadados.
 * @param {string|number} clienteId 
 * @param {string} idOuNome 
 * @param {string} [diretorioBase]
 * @returns {boolean}
 */
function excluirDocumentoCliente(clienteId, idOuNome, diretorioBase = null) {
    try {
        const idLimpo = sanitizarClienteId(clienteId);
        const baseDir = diretorioBase ? path.resolve(diretorioBase) : DIRETORIO_BASE_PADRAO;
        const pastaCliente = path.resolve(baseDir, idLimpo);
        const caminhoAbs = obterCaminhoDocumento(clienteId, idOuNome, diretorioBase);

        if (!caminhoAbs || !fs.existsSync(caminhoAbs)) return false;

        fs.unlinkSync(caminhoAbs);

        const metaPath = `${caminhoAbs}.meta.json`;
        if (fs.existsSync(metaPath)) {
            try { fs.unlinkSync(metaPath); } catch {}
        }

        // Atualiza manifesto
        const manifestPath = path.resolve(pastaCliente, '_manifest.json');
        if (fs.existsSync(manifestPath)) {
            try {
                let manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
                if (Array.isArray(manifest)) {
                    manifest = manifest.filter(d => d.caminhoAbsoluto !== caminhoAbs && d.idDocumento !== idOuNome);
                    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
                }
            } catch {}
        }

        return true;
    } catch {
        return false;
    }
}

module.exports = {
    salvarDocumentoCliente,
    sanitizarClienteId,
    sanitizarNomeArquivo,
    listarDocumentosCliente,
    obterCaminhoDocumento,
    lerDocumentoCliente,
    excluirDocumentoCliente,
    DIRETORIO_BASE_PADRAO
};
