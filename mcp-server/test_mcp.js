import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mcpPath = path.join(__dirname, 'dist', 'index.js');

async function runMcpTest() {
    console.log('--- Starting MCP Server Test ---');

    const mcp = spawn('node', [mcpPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, DB_NAME: 'test' }
    });

    let messageId = 1;

    const sendRequest = (method, params = {}) => {
        const request = {
            jsonrpc: '2.0',
            id: messageId++,
            method,
            params
        };
        console.log(`\n> Sending: ${method}`);
        mcp.stdin.write(JSON.stringify(request) + '\n');
    };

    mcp.stdout.on('data', (data) => {
        const responses = data.toString().split('\n').filter(l => l.trim());
        responses.forEach(res => {
            try {
                const parsed = JSON.parse(res);
                console.log(`\n< Received Response (ID: ${parsed.id}):`);
                console.log(JSON.stringify(parsed, null, 2));
            } catch (e) {
                console.log(`\n< Non-JSON output: ${res.trim()}`);
            }
        });
    });

    mcp.stderr.on('data', (data) => {
        console.error(`\n[MCP Log]: ${data.toString().trim()}`);
    });

    // 1. List Tools
    setTimeout(() => {
        sendRequest('tools/list');
    }, 1000);

    // 2. Search RAG
    setTimeout(() => {
        sendRequest('tools/call', {
            name: 'search_rag',
            arguments: { query: 'reset password' }
        });
    }, 2000);

    // Close after 5 seconds
    setTimeout(() => {
        console.log('\n--- Closing MCP Server ---');
        mcp.kill();
        process.exit(0);
    }, 5000);
}

runMcpTest().catch(console.error);
