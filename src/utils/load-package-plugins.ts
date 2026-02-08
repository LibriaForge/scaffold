import fs from 'fs/promises';
import path from 'path';

import { LibriaPlugin, PluginManifest, loadPlugin, loadAllPlugins } from '@libria/plugin-loader';

/**
 * Load plugins from an npm package directory.
 *
 * Handles two package structures:
 * 1. Single-template: plugin.json at package root -> use loadPlugin directly
 * 2. Multi-template: subdirectories with plugin.json -> use loadAllPlugins
 */
export async function loadPackagePlugins<T>(
    packageDir: string,
    pluginType?: string
): Promise<LibriaPlugin<T>[]> {
    const rootPluginJson = path.join(packageDir, 'plugin.json');

    try {
        const content = await fs.readFile(rootPluginJson, 'utf-8');
        const rawManifest = JSON.parse(content);

        // Filter by pluginType if specified
        if (pluginType && rawManifest.pluginType !== pluginType) {
            return [];
        }

        const manifest: PluginManifest = {
            ...rawManifest,
            __dir: packageDir,
        };

        const plugin = await loadPlugin<T>(manifest);
        return [plugin];
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
            // plugin.json exists but failed to load/parse -- rethrow
            throw error;
        }
    }

    // No root plugin.json -- try multi-template: scan subdirectories
    return loadAllPlugins<T>(packageDir, pluginType);
}
