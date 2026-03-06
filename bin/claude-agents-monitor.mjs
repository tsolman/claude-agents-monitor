#!/usr/bin/env node

import { execSync, spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const distDir = path.join(root, 'dist');

// Build frontend if not already built
if (!fs.existsSync(path.join(distDir, 'index.html'))) {
  console.log('Building frontend...');
  execSync('npm run build', { cwd: root, stdio: 'inherit' });
}

// Start the server
const server = spawn('node', ['--import', 'tsx', path.join(root, 'server/index.ts')], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env },
});

server.on('close', (code) => {
  process.exit(code ?? 0);
});

process.on('SIGINT', () => {
  server.kill('SIGINT');
});

process.on('SIGTERM', () => {
  server.kill('SIGTERM');
});
