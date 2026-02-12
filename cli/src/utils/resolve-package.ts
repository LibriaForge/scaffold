import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Resolve an npm package name to its installed root directory.
 * Uses import.meta.resolve() to find the package entry point,
 * then walks up to find the package.json — this works regardless
 * of the package's `exports` configuration.
 *
 * Correctly handles:
 * - npm workspaces (hoisted node_modules)
 * - Symlinked packages
 * - Global installs
 */
export async function resolvePackageDir(packageName: string): Promise<string> {
    try {
        const entryUrl = import.meta.resolve(packageName);
        let dir = path.dirname(fileURLToPath(entryUrl));

        // Walk up until we find the package.json
        while (dir !== path.dirname(dir)) {
            try {
                await fs.access(path.join(dir, 'package.json'));
                return dir;
            } catch {
                dir = path.dirname(dir);
            }
        }

        throw new Error('package.json not found');
    } catch {
        throw new Error(
            `Package '${packageName}' not found. ` +
                `Install it locally (npm install ${packageName}) or globally (npm install -g ${packageName}).`
        );
    }
}
