import { spawn } from 'node:child_process';
import process from 'node:process';

// Detect if running with tsx loader or if already bootstrapped
const hasTsx = process.execArgv.some((arg) => arg.includes('tsx')) || process.env.__BOOTSTRAP_TSX__ === '1';

if (!hasTsx) {
  process.env.__BOOTSTRAP_TSX__ = '1';
  const child = spawn(process.execPath, ['--import', 'tsx', ...process.argv.slice(1)], {
    stdio: 'inherit',
    env: process.env,
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
    } else {
      process.exit(code ?? 0);
    }
  });

  process.on('SIGINT', () => child.kill('SIGINT'));
  process.on('SIGTERM', () => child.kill('SIGTERM'));
} else {
  await import('./server_main.ts');
}
