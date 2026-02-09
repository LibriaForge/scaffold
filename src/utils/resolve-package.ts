import fs from 'fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'path';

const execFileAsync = promisify(execFile);

/**
 * Resolve an npm package name to its installed root directory.
 * Tries local node_modules first (relative to cwd), then global.
 */
export async function resolvePackageDir(packageName: string): Promise<string> {
    // Strategy 1: resolve from local node_modules via cwd
    const localCandidate = path.join(process.cwd(), 'node_modules', packageName);
    try {
        await fs.access(path.join(localCandidate, 'package.json'));
        return localCandidate;
    } catch {
        // Not found locally, try global
    }

    // Strategy 2: resolve from global node_modules
    const globalDir = await getGlobalNodeModulesDir();
    if (globalDir) {
        const globalCandidate = path.join(globalDir, packageName);
        try {
            await fs.access(path.join(globalCandidate, 'package.json'));
            return globalCandidate;
        } catch {
            // Not found globally either
        }
    }

    throw new Error(
        `Package '${packageName}' not found. ` +
            `Install it locally (npm install ${packageName}) or globally (npm install -g ${packageName}).`
    );
}

/**
 * Get the global node_modules directory using npm root -g.
 */
async function getGlobalNodeModulesDir(): Promise<string | null> {
    try {
        const { stdout } = await execFileAsync('npm', ['root', '-g'], { encoding: 'utf-8' });
        const dir = stdout.trim();
        await fs.access(dir);
        return dir;
    } catch {
        return null;
    }
}
