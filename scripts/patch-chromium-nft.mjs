import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, relative, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

const nftPath = join(
  projectRoot,
  '.next/server/app/api/gerar-pdf/[id]/route.js.nft.json'
);

const chromiumBinDir = join(projectRoot, 'node_modules/@sparticuz/chromium/bin');
const routeFileDir = dirname(nftPath);

function listFilesRecursive(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFilesRecursive(fullPath));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

const nft = JSON.parse(readFileSync(nftPath, 'utf8'));
const existingFiles = new Set(nft.files);

const binFiles = listFilesRecursive(chromiumBinDir);
let added = 0;
for (const absPath of binFiles) {
  const relPath = relative(routeFileDir, absPath).replace(/\\/g, '/');
  if (!existingFiles.has(relPath)) {
    nft.files.push(relPath);
    existingFiles.add(relPath);
    added++;
  }
}

writeFileSync(nftPath, JSON.stringify(nft));
console.log(`patch-chromium-nft: added ${added} binary files to NFT trace`);
console.log(`  total files in trace: ${nft.files.length}`);
