import { spawn } from 'node:child_process';
import path from 'node:path';

const nextCli = path.resolve('node_modules', 'next', 'dist', 'bin', 'next');
const child = spawn(process.execPath, [nextCli, 'dev', '-p', '4001'], {
  stdio: 'inherit',
  env: { ...process.env, CINESEYA_DEMO_MODE: 'true' },
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
