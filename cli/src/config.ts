import fs from 'fs/promises';
import os from 'os';
import path from 'path';

export interface LbScaffoldConfig {
    plugins?: string[];
    packages?: string[];
}

const CONFIG_FILENAME = '.lbscaffold.json';

export const GLOBAL_CONFIG_PATH = path.join(os.homedir(), CONFIG_FILENAME);

/**
 * Find the config file by searching up the directory tree
 */
export async function findConfigPath(startDir: string = process.cwd()): Promise<string | null> {
    let currentDir = startDir;

    while (true) {
        const configPath = path.join(currentDir, CONFIG_FILENAME);
        try {
            await fs.access(configPath);
            return configPath;
        } catch {
            const parentDir = path.dirname(currentDir);
            if (parentDir === currentDir) {
                // Reached root
                return null;
            }
            currentDir = parentDir;
        }
    }
}

/**
 * Get the default config path in the current directory
 */
export function getDefaultConfigPath(): string {
    return path.join(process.cwd(), CONFIG_FILENAME);
}

/**
 * Load a single config file from a specific path
 */
export async function loadRawConfig(configPath: string): Promise<LbScaffoldConfig> {
    try {
        const content = await fs.readFile(configPath, 'utf-8');
        return JSON.parse(content) as LbScaffoldConfig;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return {};
        }
        throw new Error(`Failed to load config from ${configPath}: ${(error as Error).message}`);
    }
}

/**
 * Load the merged config (global defaults + local overrides).
 * When configPath is provided explicitly, only that file is loaded (no merging).
 */
export async function loadConfig(configPath?: string): Promise<LbScaffoldConfig> {
    if (configPath) {
        return loadRawConfig(configPath);
    }

    const globalConfig = await loadRawConfig(GLOBAL_CONFIG_PATH);
    const localPath = await findConfigPath();
    const localConfig = localPath ? await loadRawConfig(localPath) : {};

    // Per-key merge: local keys fully override global keys
    return { ...globalConfig, ...localConfig };
}

/**
 * Save the config file
 */
export async function saveConfig(config: LbScaffoldConfig, configPath?: string): Promise<void> {
    const resolvedPath = configPath ?? getDefaultConfigPath();
    await fs.writeFile(resolvedPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
}

/**
 * Initialize a new config file
 */
export async function initConfig(configPath?: string): Promise<string> {
    const resolvedPath = configPath ?? getDefaultConfigPath();

    try {
        await fs.access(resolvedPath);
        throw new Error(`Config file already exists at ${resolvedPath}`);
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
            throw error;
        }
    }

    const defaultConfig: LbScaffoldConfig = {
        plugins: ['./plugins/**'],
        packages: [],
    };

    await saveConfig(defaultConfig, resolvedPath);
    return resolvedPath;
}

/**
 * Add a plugin glob pattern to the config
 */
export async function addPluginGlob(glob: string, configPath?: string): Promise<void> {
    const resolvedPath = configPath ?? (await findConfigPath()) ?? getDefaultConfigPath();
    const config = await loadRawConfig(resolvedPath);

    if (!config.plugins) {
        config.plugins = [];
    }

    if (config.plugins.includes(glob)) {
        throw new Error(`Plugin pattern '${glob}' already exists in config`);
    }

    config.plugins.push(glob);
    await saveConfig(config, resolvedPath);
}

/**
 * Remove a plugin glob pattern from the config
 */
export async function removePluginGlob(glob: string, configPath?: string): Promise<void> {
    const resolvedPath = configPath ?? (await findConfigPath());

    if (!resolvedPath) {
        throw new Error('No config file found');
    }

    const config = await loadRawConfig(resolvedPath);

    if (!config.plugins || !config.plugins.includes(glob)) {
        throw new Error(`Plugin pattern '${glob}' not found in config`);
    }

    config.plugins = config.plugins.filter(p => p !== glob);
    await saveConfig(config, resolvedPath);
}

/**
 * List all plugin glob patterns in the config
 */
export async function listPluginGlobs(configPath?: string): Promise<string[]> {
    const config = await loadConfig(configPath);
    return config.plugins ?? [];
}

/**
 * Resolve globs from a single config file relative to its directory
 */
function resolveGlobs(globs: string[], configDir: string): string[] {
    return globs.map(glob => {
        if (path.isAbsolute(glob)) {
            return glob.replace(/\\/g, '/');
        }
        return path.resolve(configDir, glob).replace(/\\/g, '/');
    });
}

/**
 * Get absolute plugin paths from config globs.
 * When no configPath is given, merges global and local configs:
 * - If local config defines `plugins`, use local only (resolved relative to local config dir)
 * - Otherwise, fall through to global `plugins` (resolved relative to $HOME)
 */
export async function getPluginPaths(configPath?: string): Promise<string[]> {
    if (configPath) {
        const config = await loadRawConfig(configPath);
        const configDir = path.dirname(configPath);
        return resolveGlobs(config.plugins ?? [], configDir);
    }

    const localPath = await findConfigPath();
    const localConfig = localPath ? await loadRawConfig(localPath) : {};

    // If local defines plugins, use local only
    if (localConfig.plugins) {
        return resolveGlobs(localConfig.plugins, path.dirname(localPath!));
    }

    // Fall through to global
    const globalConfig = await loadRawConfig(GLOBAL_CONFIG_PATH);
    return resolveGlobs(globalConfig.plugins ?? [], os.homedir());
}

/**
 * Add an npm package name to the config
 */
export async function addPackage(packageName: string, configPath?: string): Promise<void> {
    const resolvedPath = configPath ?? (await findConfigPath()) ?? getDefaultConfigPath();
    const config = await loadRawConfig(resolvedPath);

    if (!config.packages) {
        config.packages = [];
    }

    if (config.packages.includes(packageName)) {
        throw new Error(`Package '${packageName}' already exists in config`);
    }

    config.packages.push(packageName);
    await saveConfig(config, resolvedPath);
}

/**
 * Remove an npm package name from the config
 */
export async function removePackage(packageName: string, configPath?: string): Promise<void> {
    const resolvedPath = configPath ?? (await findConfigPath());

    if (!resolvedPath) {
        throw new Error('No config file found');
    }

    const config = await loadRawConfig(resolvedPath);

    if (!config.packages || !config.packages.includes(packageName)) {
        throw new Error(`Package '${packageName}' not found in config`);
    }

    config.packages = config.packages.filter(p => p !== packageName);
    await saveConfig(config, resolvedPath);
}

/**
 * List all npm package names in the config.
 * When no configPath is given, uses per-key merge (local `packages` overrides global).
 */
export async function listPackages(configPath?: string): Promise<string[]> {
    const config = await loadConfig(configPath);
    return config.packages ?? [];
}
