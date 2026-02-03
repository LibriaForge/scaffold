import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useTempProject } from './helpers/use-temp-project';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { LibriaPlugin, loadAllPlugins } from '@libria/plugin-loader';
import {
    findConfigPath,
    getPluginPaths,
    saveConfig,
    loadConfig,
    initConfig,
    addPluginGlob,
    removePluginGlob,
    listPluginGlobs,
    LbScaffoldConfig,
} from '../src';
import {
    SCAFFOLD_TEMPLATE_PLUGIN_TYPE,
    ScaffoldTemplatePlugin,
    ScaffoldTemplatePluginOptions,
} from '../src';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(__dirname, 'fixtures');

/**
 * Simulates the CLI plugin loading logic.
 * This is the same pattern used in cli.ts to load plugins.
 */
async function loadPluginsForCli(
    builtInPluginsPath?: string
): Promise<LibriaPlugin<ScaffoldTemplatePlugin>[]> {
    // Load built-in plugins (if path provided)
    const builtInPlugins: LibriaPlugin<ScaffoldTemplatePlugin>[] = [];
    if (builtInPluginsPath) {
        try {
            const loaded = await loadAllPlugins<ScaffoldTemplatePlugin>(
                builtInPluginsPath,
                SCAFFOLD_TEMPLATE_PLUGIN_TYPE
            );
            builtInPlugins.push(...loaded);
        } catch {
            // Built-in plugins path may not exist in test environment
        }
    }

    // Load user plugins from config
    const userPluginPaths = await getPluginPaths();
    const userPlugins: LibriaPlugin<ScaffoldTemplatePlugin>[] = [];

    for (const pluginPath of userPluginPaths) {
        try {
            const loaded = await loadAllPlugins<ScaffoldTemplatePlugin>(
                pluginPath,
                SCAFFOLD_TEMPLATE_PLUGIN_TYPE
            );
            userPlugins.push(...loaded);
        } catch (error) {
            console.warn(`Failed to load plugins from '${pluginPath}': ${(error as Error).message}`);
        }
    }

    // Merge and deduplicate (user plugins override built-in with same name)
    const pluginMap = new Map<string, LibriaPlugin<ScaffoldTemplatePlugin>>();
    for (const plugin of builtInPlugins) {
        pluginMap.set(plugin.name, plugin);
    }
    for (const plugin of userPlugins) {
        pluginMap.set(plugin.name, plugin);
    }

    return Array.from(pluginMap.values()).sort((a, b) => a.name.localeCompare(b.name));
}

describe('config integration with CLI', () => {
    let cleanup: () => Promise<void>;
    let tmpDir: string;

    beforeEach(async () => {
        const temp = await useTempProject('config-integration');
        cleanup = temp.cleanup;
        tmpDir = temp.tmp;
    });

    afterEach(async () => {
        await cleanup();
    });

    async function copyFixture(fixtureName: string, destDir: string): Promise<string> {
        const fixtureDir = path.join(FIXTURES_DIR, fixtureName);
        const targetDir = path.join(destDir, fixtureName);

        await fs.mkdir(targetDir, { recursive: true });

        const files = await fs.readdir(fixtureDir);
        for (const file of files) {
            const srcPath = path.join(fixtureDir, file);
            const destPath = path.join(targetDir, file);
            await fs.copyFile(srcPath, destPath);
        }

        return targetDir;
    }

    describe('CLI config commands', () => {
        it('config init should create a config file with default plugins', async () => {
            const configPath = await initConfig();

            expect(configPath).toBe(path.join(tmpDir, '.lbscaffold'));

            const config = await loadConfig(configPath);
            expect(config.plugins).toBeDefined();
            expect(config.plugins).toContain('./plugins/**');
        });

        it('config add should add a plugin glob pattern', async () => {
            await initConfig();

            await addPluginGlob('./custom-plugins/**');

            const globs = await listPluginGlobs();
            expect(globs).toContain('./plugins/**');
            expect(globs).toContain('./custom-plugins/**');
        });

        it('config remove should remove a plugin glob pattern', async () => {
            await initConfig();

            await removePluginGlob('./plugins/**');

            const globs = await listPluginGlobs();
            expect(globs).not.toContain('./plugins/**');
        });

        it('config list should return all plugin patterns', async () => {
            const config: LbScaffoldConfig = {
                plugins: ['./plugins/**', './custom/**', './third-party/**'],
            };
            await saveConfig(config);

            const globs = await listPluginGlobs();
            expect(globs).toEqual(['./plugins/**', './custom/**', './third-party/**']);
        });

        it('config show should return the full config', async () => {
            const config: LbScaffoldConfig = {
                plugins: ['./my-plugins/**'],
            };
            await saveConfig(config);

            const loadedConfig = await loadConfig();
            expect(loadedConfig).toEqual(config);
        });

        it('findConfigPath should find config in parent directory', async () => {
            // Create config in tmpDir
            await saveConfig({ plugins: ['./plugins/**'] });

            // Create subdirectory and change to it
            const subDir = path.join(tmpDir, 'projects', 'my-app');
            await fs.mkdir(subDir, { recursive: true });
            process.chdir(subDir);

            const configPath = await findConfigPath();
            expect(configPath).toBe(path.join(tmpDir, '.lbscaffold'));
        });
    });

    describe('user plugins available to CLI', () => {
        it('should load user plugins from config', async () => {
            // Set up user plugins directory
            const pluginsDir = path.join(tmpDir, 'my-plugins');
            await fs.mkdir(pluginsDir, { recursive: true });
            await copyFixture('test-template', pluginsDir);

            // Create config pointing to user plugins
            await saveConfig({ plugins: ['./my-plugins/**'] });

            // Load plugins using CLI pattern
            const plugins = await loadPluginsForCli();

            expect(plugins).toHaveLength(1);
            expect(plugins[0].name).toBe('test-template');
            expect(plugins[0].api.argument).toBe('test-template');
        });

        it('should make user plugin available for project creation', async () => {
            // Set up user plugins
            const pluginsDir = path.join(tmpDir, 'my-plugins');
            await fs.mkdir(pluginsDir, { recursive: true });
            await copyFixture('test-template', pluginsDir);

            await saveConfig({ plugins: ['./my-plugins/**'] });

            // Load plugins as CLI would
            const plugins = await loadPluginsForCli();
            const testPlugin = plugins.find(p => p.name === 'test-template');
            expect(testPlugin).toBeDefined();

            // Execute the plugin (as CLI create command would)
            const projectName = 'my-new-project';
            await testPlugin!.api.execute({ name: projectName });

            // Verify project was created
            const projectDir = path.join(tmpDir, projectName);
            const markerPath = path.join(projectDir, 'test-template.marker');

            const markerExists = await fs
                .stat(markerPath)
                .then(() => true)
                .catch(() => false);
            expect(markerExists).toBe(true);

            const markerContent = await fs.readFile(markerPath, 'utf-8');
            expect(markerContent).toContain('Created by test-template plugin');
            expect(markerContent).toContain(projectName);
        });

        it('should support dry-run mode in user plugins', async () => {
            const pluginsDir = path.join(tmpDir, 'my-plugins');
            await fs.mkdir(pluginsDir, { recursive: true });
            await copyFixture('test-template', pluginsDir);

            await saveConfig({ plugins: ['./my-plugins/**'] });

            const plugins = await loadPluginsForCli();
            const testPlugin = plugins.find(p => p.name === 'test-template');

            const projectName = 'dry-run-project';
            await testPlugin!.api.execute({ name: projectName, dryRun: true });

            // Project should NOT be created in dry-run mode
            const projectDir = path.join(tmpDir, projectName);
            const exists = await fs
                .stat(projectDir)
                .then(() => true)
                .catch(() => false);
            expect(exists).toBe(false);
        });

        it('should load plugins from multiple config paths', async () => {
            // Create two plugin directories
            const pluginsDir1 = path.join(tmpDir, 'plugins-a');
            const pluginsDir2 = path.join(tmpDir, 'plugins-b');
            await fs.mkdir(pluginsDir1, { recursive: true });
            await fs.mkdir(pluginsDir2, { recursive: true });

            // Copy fixture to first directory
            await copyFixture('test-template', pluginsDir1);

            // Create another plugin in second directory
            const plugin2Dir = path.join(pluginsDir2, 'another-template');
            await fs.mkdir(plugin2Dir, { recursive: true });
            await fs.writeFile(
                path.join(plugin2Dir, 'plugin.json'),
                JSON.stringify({
                    name: 'another-template',
                    pluginType: 'scaffold-template',
                    module: './index.mjs',
                })
            );
            await fs.writeFile(
                path.join(plugin2Dir, 'index.mjs'),
                `
import { definePlugin } from '@libria/plugin-loader';
export default definePlugin('scaffold-template', 'another-template', {
    argument: 'another-template',
    async execute(options) {
        console.log('Another template executed');
    }
});
`
            );

            // Config with both paths
            await saveConfig({ plugins: ['./plugins-a/**', './plugins-b/**'] });

            const plugins = await loadPluginsForCli();

            expect(plugins).toHaveLength(2);
            const pluginNames = plugins.map(p => p.name).sort();
            expect(pluginNames).toEqual(['another-template', 'test-template']);
        });

        it('should resolve plugin paths relative to config file location', async () => {
            // Create config and plugins in tmpDir
            const pluginsDir = path.join(tmpDir, 'plugins');
            await fs.mkdir(pluginsDir, { recursive: true });
            await copyFixture('test-template', pluginsDir);

            await saveConfig({ plugins: ['./plugins/**'] });

            // Change to a subdirectory
            const subDir = path.join(tmpDir, 'projects', 'my-project');
            await fs.mkdir(subDir, { recursive: true });
            process.chdir(subDir);

            // Plugins should still load correctly
            const plugins = await loadPluginsForCli();

            expect(plugins).toHaveLength(1);
            expect(plugins[0].name).toBe('test-template');
        });

        it('should handle missing config gracefully', async () => {
            // No config file exists
            const plugins = await loadPluginsForCli();

            // Should return empty array (no user plugins, no built-in path provided)
            expect(plugins).toEqual([]);
        });

        it('should handle invalid plugin paths gracefully', async () => {
            // Create config with non-existent path
            await saveConfig({ plugins: ['./nonexistent/**'] });

            // Should not throw, just return empty
            const plugins = await loadPluginsForCli();
            expect(plugins).toEqual([]);
        });
    });

    describe('plugin validation', () => {
        it('should validate plugin has required API properties', async () => {
            const pluginsDir = path.join(tmpDir, 'my-plugins');
            await fs.mkdir(pluginsDir, { recursive: true });
            await copyFixture('test-template', pluginsDir);

            await saveConfig({ plugins: ['./my-plugins/**'] });

            const plugins = await loadPluginsForCli();
            expect(plugins).toHaveLength(1);

            const plugin = plugins[0];

            // Validate required properties
            expect(typeof plugin.name).toBe('string');
            expect(plugin.name.length).toBeGreaterThan(0);

            expect(plugin.api).toBeDefined();
            expect(typeof plugin.api.argument).toBe('string');
            expect(plugin.api.argument.length).toBeGreaterThan(0);
            expect(typeof plugin.api.execute).toBe('function');
        });

        it('should execute plugin without error in dry-run mode', async () => {
            const pluginsDir = path.join(tmpDir, 'my-plugins');
            await fs.mkdir(pluginsDir, { recursive: true });
            await copyFixture('test-template', pluginsDir);

            await saveConfig({ plugins: ['./my-plugins/**'] });

            const plugins = await loadPluginsForCli();
            const plugin = plugins[0];

            const options: ScaffoldTemplatePluginOptions = {
                name: 'validation-test',
                dryRun: true,
            };

            // Should execute without throwing
            await expect(plugin.api.execute(options)).resolves.not.toThrow();
        });
    });

    describe('user plugin overrides built-in', () => {
        it('should allow user plugin to override a built-in plugin with same name', async () => {
            // Create a "built-in" plugin
            const builtInDir = path.join(tmpDir, 'built-in');
            const builtInPluginDir = path.join(builtInDir, 'my-plugin');
            await fs.mkdir(builtInPluginDir, { recursive: true });

            await fs.writeFile(
                path.join(builtInPluginDir, 'plugin.json'),
                JSON.stringify({
                    name: 'my-plugin',
                    pluginType: 'scaffold-template',
                    module: './index.mjs',
                })
            );
            await fs.writeFile(
                path.join(builtInPluginDir, 'index.mjs'),
                `
import { definePlugin } from '@libria/plugin-loader';
export default definePlugin('scaffold-template', 'my-plugin', {
    argument: 'my-plugin',
    version: 'built-in',
    async execute(options) {
        console.log('Built-in plugin');
    }
});
`
            );

            // Create a user override plugin with same name
            const userDir = path.join(tmpDir, 'user-plugins');
            const userPluginDir = path.join(userDir, 'my-plugin');
            await fs.mkdir(userPluginDir, { recursive: true });

            await fs.writeFile(
                path.join(userPluginDir, 'plugin.json'),
                JSON.stringify({
                    name: 'my-plugin',
                    pluginType: 'scaffold-template',
                    module: './index.mjs',
                })
            );
            await fs.writeFile(
                path.join(userPluginDir, 'index.mjs'),
                `
import { definePlugin } from '@libria/plugin-loader';
export default definePlugin('scaffold-template', 'my-plugin', {
    argument: 'my-plugin',
    version: 'user-override',
    async execute(options) {
        console.log('User override plugin');
    }
});
`
            );

            // Set up config to use user plugins
            await saveConfig({ plugins: ['./user-plugins/**'] });

            // Simulate CLI loading with built-in path
            const builtInPluginsPath = path.join(builtInDir, '**').replace(/\\/g, '/');
            const plugins = await loadPluginsForCli(builtInPluginsPath);

            // Should only have one plugin (user override wins)
            expect(plugins).toHaveLength(1);
            expect(plugins[0].name).toBe('my-plugin');
            // User version should be loaded (user plugins are added after built-in, so they override)
            expect((plugins[0].api as { version?: string }).version).toBe('user-override');
        });
    });

    describe('absolute paths in config', () => {
        it('should support absolute plugin paths in config', async () => {
            const pluginsDir = path.join(tmpDir, 'my-plugins');
            await fs.mkdir(pluginsDir, { recursive: true });
            await copyFixture('test-template', pluginsDir);

            // Use absolute path in config
            const absolutePath = pluginsDir.replace(/\\/g, '/') + '/**';
            await saveConfig({ plugins: [absolutePath] });

            const plugins = await loadPluginsForCli();

            expect(plugins).toHaveLength(1);
            expect(plugins[0].name).toBe('test-template');
        });
    });
});
