import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';

const ignoredDirs = new Set(['node_modules', 'dist', '.git', '.cache', '.npm']);
const ignoredFiles = new Set(['xauusd-smc-quant-full-project.zip']);

function addDirectoryToZip(currentDir: string, zipFolder: JSZip) {
  const entries = fs.readdirSync(currentDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!ignoredDirs.has(entry.name) && !entry.name.startsWith('.')) {
        const subFolder = zipFolder.folder(entry.name);
        if (subFolder) {
          addDirectoryToZip(path.join(currentDir, entry.name), subFolder);
        }
      }
    } else {
      if (!ignoredFiles.has(entry.name) && !entry.name.endsWith('.zip')) {
        const filePath = path.join(currentDir, entry.name);
        const fileData = fs.readFileSync(filePath);
        zipFolder.file(entry.name, fileData);
      }
    }
  }
}

export async function generateProjectZipBuffer(): Promise<Buffer> {
  const zip = new JSZip();
  addDirectoryToZip(process.cwd(), zip);
  const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  
  const publicDir = path.join(process.cwd(), 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }
  fs.writeFileSync(path.join(publicDir, 'xauusd-smc-quant-full-project.zip'), buffer);
  return buffer;
}

export function getProjectZipPath(): string {
  const target = path.join(process.cwd(), 'public', 'xauusd-smc-quant-full-project.zip');
  return target;
}
