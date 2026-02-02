import fs from 'fs/promises';
import path from 'path';

export interface LbScaffoldConfig {
    plugins?: string[];
}

const CONFIG_FILENAME = '.lbscaffold';

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
 * Load the config file
 */
export async function loadConfig(configPath?: string): Promise<LbScaffoldConfig> {
    const resolvedPath = configPath ?? await findConfigPath();

    if (!resolvedPath) {
        return {};
    }

    try {
        const content = await fs.readFile(resolvedPath, 'utf-8');
        return JSON.parse(content) as LbScaffoldConfig;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return {};
        }
        throw new Error(`Failed to load config from ${resolvedPath}: ${(error as Error).message}`);
    }
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
        plugins: [
            './plugins/**'
        ]
    };

    await saveConfig(defaultConfig, resolvedPath);
    return resolvedPath;
}

/**
 * Add a plugin glob pattern to the config
 */
export async function addPluginGlob(glob: string, configPath?: string): Promise<void> {
    const config = await loadConfig(configPath);

    if (!config.plugins) {
        config.plugins = [];
    }

    if (config.plugins.includes(glob)) {
        throw new Error(`Plugin pattern '${glob}' already exists in config`);
    }

    config.plugins.push(glob);
    await saveConfig(config, configPath ?? await findConfigPath() ?? getDefaultConfigPath());
}

/**
 * Remove a plugin glob pattern from the config
 */
export async function removePluginGlob(glob: string, configPath?: string): Promise<void> {
    const resolvedPath = configPath ?? await findConfigPath();

    if (!resolvedPath) {
        throw new Error('No config file found');
    }

    const config = await loadConfig(resolvedPath);

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
 * Get absolute plugin paths from config globs
 */
export async function getPluginPaths(configPath?: string): Promise<string[]> {
    const resolvedConfigPath = configPath ?? await findConfigPath();

    if (!resolvedConfigPath) {
        return [];
    }

    const config = await loadConfig(resolvedConfigPath);
    const configDir = path.dirname(resolvedConfigPath);

    return (config.plugins ?? []).map(glob => {
        // If glob is absolute, use as-is; otherwise resolve relative to config file
        if (path.isAbsolute(glob)) {
            return glob.replace(/\\/g, '/');
        }
        return path.resolve(configDir, glob).replace(/\\/g, '/');
    });
}
