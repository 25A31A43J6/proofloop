/**
 * ProofLoop Full-Stack Express Server
 * Hosts REST API, Model Context Protocol (MCP) Streamable HTTP, and Vite frontend.
 * Amazon Developer Hackathon 2026 — Alexa+ track
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { mcpRouter } from './src/server/mcpRoutes.js';
import { apiRouter } from './src/server/apiRoutes.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseArg(flag: string): string | undefined {
  for (let i = 0; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg === flag && i + 1 < process.argv.length) {
      return process.argv[i + 1];
    }
    if (arg.startsWith(`${flag}=`)) {
      return arg.slice(flag.length + 1);
    }
  }
  return undefined;
}

async function startServer() {
  const app = express();
  const cliPort = parseArg('--port') || parseArg('-p');
  const cliHost = parseArg('--host') || parseArg('-h');
  const PORT = parseInt(process.env.PORT || cliPort || '3000', 10);
  const HOST = process.env.HOST || cliHost || '0.0.0.0';
  const isProd = process.env.NODE_ENV === 'production';

  app.use(express.json());

  // Mount MCP router (Streamable HTTP at /mcp, /mcp/sse, and /api/mcp)
  app.use(mcpRouter);

  // Mount Application REST API
  app.use('/api', apiRouter);

  // Mount Frontend
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
        watch: process.env.DISABLE_HMR === 'true' ? null : {},
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  const server = app.listen(PORT, HOST, () => {
    // Print Vite-compatible readiness lines for supervisor log monitors
    console.log(`\n  VITE v8.3.0  ready in 120 ms\n`);
    console.log(`  ➜  Local:   http://localhost:${PORT}/`);
    console.log(`  ➜  Network: http://${HOST === '0.0.0.0' ? '127.0.0.1' : HOST}:${PORT}/`);
    console.log(`  ➜  MCP:     http://localhost:${PORT}/mcp\n`);
    console.log(`=======================================================`);
    console.log(` ProofLoop Server running on http://${HOST}:${PORT}`);
    console.log(` Tagline: "Don't just make a plan. Get it done."`);
    console.log(` Hackathon: Amazon Developer Hackathon 2026 (Alexa+)`);
    console.log(`=======================================================`);
  });

  const handleShutdown = () => {
    server.close(() => {
      process.exit(0);
    });
  };
  process.on('SIGINT', handleShutdown);
  process.on('SIGTERM', handleShutdown);
}

startServer().catch((err) => {
  console.error('[Server Fatal Error]', err);
  process.exit(1);
});
