/*
 * ---
 * Projeto: Servidor de Arquivos Estáticos Local (Node.js)
 * Descrição: Este script inicia um servidor HTTP local para servir arquivos de um diretório
 *            especificado (ou do diretório atual, por padrão). Ele lista o conteúdo
 *            dos diretórios e serve os arquivos com o tipo MIME correto.
 *            É uma ferramenta útil para desenvolvimento web rápido.
 *
 * Bibliotecas necessárias: Nenhuma biblioteca externa é necessária.
 *                          Este script requer apenas o Node.js instalado.
 *
 * Como executar:
 * 1. Abra o terminal no diretório onde este arquivo está salvo.
 * 2. Execute o comando: node main.js [porta] [diretorio]
 *
 * Parâmetros (opcionais):
 *   [porta]:      O número da porta na qual o servidor irá escutar. Padrão: 3000.
 *   [diretorio]:  O caminho para o diretório que você deseja servir. Padrão: diretório atual.
 *
 * Exemplos de uso:
 *   # Inicia o servidor na porta 3000 servindo o diretório atual
 *   node main.js
 *
 *   # Inicia o servidor na porta 8080 servindo o diretório atual
 *   node main.js 8080
 *
 *   # Inicia o servidor na porta 5000 servindo o diretório '~/meu-site'
 *   node main.js 5000 ./meu-site
 * ---
 */

const http = require('http');
const fs = require('fs/promises');
const path = require('path');
const url = require('url');

// Mapeamento simples de extensões de arquivo para tipos MIME
const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.txt': 'text/plain',
    'default': 'application/octet-stream'
};

/**
 * Obtém o tipo MIME correspondente para um caminho de arquivo.
 * @param {string} filePath - O caminho do arquivo.
 * @returns {string} O tipo MIME.
 */
function getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return MIME_TYPES[ext] || MIME_TYPES['default'];
}

/**
 * Gera uma página HTML para listar o conteúdo de um diretório.
 * @param {string[]} items - Uma lista de nomes de arquivos e pastas.
 * @param {string} currentPath - O caminho do diretório atual relativo à raiz do servidor.
 * @returns {string} O conteúdo HTML da página de listagem.
 */
function generateDirectoryListing(items, currentPath) {
    const listItems = items.map(item => `<li><a href="${path.join(currentPath, item)}">${item}</a></li>`).join('');
    
    // Adiciona um link para voltar ao diretório pai, se não estiver na raiz
    const parentLink = currentPath !== '/' ? `<li><a href="${path.join(currentPath, '..')}">.. (Voltar)</a></li>` : '';

    return `
        <!DOCTYPE html>
        <html lang="pt-br">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Index of ${currentPath}</title>
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 20px; }
                h1 { border-bottom: 2px solid #eee; padding-bottom: 10px; }
                ul { list-style-type: none; padding-left: 0; }
                li { padding: 8px 0; }
                a { text-decoration: none; color: #007bff; }
                a:hover { text-decoration: underline; }
            </style>
        </head>
        <body>
            <h1>Index of ${currentPath}</h1>
            <ul>
                ${parentLink}
                ${listItems}
            </ul>
        </body>
        </html>
    `;
}

/**
 * O manipulador principal de requisições do servidor.
 * @param {http.IncomingMessage} req - O objeto da requisição.
 * @param {http.ServerResponse} res - O objeto da resposta.
 * @param {string} rootDir - O diretório raiz que está sendo servido.
 */
async function requestHandler(req, res, rootDir) {
    const parsedUrl = url.parse(req.url);
    // Decodifica o caminho para lidar com espaços e caracteres especiais (ex: %20)
    const decodedPath = decodeURIComponent(parsedUrl.pathname);
    
    // Constrói um caminho seguro para o arquivo, evitando ataques de "directory traversal"
    const filePath = path.join(rootDir, path.normalize(decodedPath));

    try {
        const stats = await fs.stat(filePath);

        if (stats.isDirectory()) {
            const items = await fs.readdir(filePath);
            const html = generateDirectoryListing(items, decodedPath);
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(html);
        } else if (stats.isFile()) {
            const fileContent = await fs.readFile(filePath);
            const mimeType = getMimeType(filePath);
            res.writeHead(200, { 'Content-Type': mimeType });
            res.end(fileContent);
        }
    } catch (error) {
        if (error.code === 'ENOENT') { // ENOENT: Error NO ENTry (Arquivo ou diretório não encontrado)
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found');
        } else {
            console.error(`Erro ao processar ${filePath}:`, error);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('500 Internal Server Error');
        }
    }
}

/**
 * Função principal que inicializa o servidor.
 */
function main() {
    // Pega a porta e o diretório dos argumentos da linha de comando
    const args = process.argv.slice(2);
    const port = parseInt(args[0], 10) || 3000;
    const rootDirArg = args[1] || '.';
    const rootDir = path.resolve(rootDirArg);

    const server = http.createServer((req, res) => requestHandler(req, res, rootDir));

    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.error(`Erro: A porta ${port} já está em uso.`);
        } else {
            console.error('Erro no servidor:', err);
        }
        process.exit(1);
    });

    server.listen(port, () => {
        console.log(`\n🚀 Servidor de arquivos estáticos iniciado.`);
        console.log(`   - Servindo arquivos do diretório: ${rootDir}`);
        console.log(`   - Acessível em: http://localhost:${port}`);
        console.log(`\n(Pressione Ctrl+C para parar o servidor)`);
    });
}

// Inicia a aplicação
main();