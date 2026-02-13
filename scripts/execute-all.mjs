import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);

if (!args.length) {
    console.error('Usage: node scripts/execute-all.mjs <command> [args...]');
    console.error('Example: node scripts/execute-all.mjs npm install --save-dev cross-env');
    process.exit(1);
}

const cmd = args.join(' ');
const rootPkg = JSON.parse(readFileSync('package.json', 'utf8'));

for (const dir of rootPkg.workspaces) {
    console.log(`\n--- ${dir} ---`);
    try {
        execSync(cmd, { cwd: dir, stdio: 'inherit' });
    } catch {
        console.error(`Failed in ${dir}`);
    }
}
