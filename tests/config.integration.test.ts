import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useTempProject } from './helpers/use-temp-project';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import {LibriaPlugin, loadAllPlugins} from '@libria/plugin-loader';
import {
    getPluginPaths,
    saveConfig,
    LbScaffoldConfig
} from '../src/config';
import {SCAFFOLD_TEMPLATE_PLUGIN_TYPE, ScaffoldTemplatePlugin, ScaffoldTemplatePluginOptions} from '../src/core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(__dirname, 'fixtures');

describe('config integration', () => {
    let cleanup: () => Promise<void>;
    let tmpDir: string;

    beforeEach(async () => {
        const temp = await useTempProject('config-integration');
        cleanup = temp.cleanup;
        tmpDir = temp.tmp;
        // useTempProject already changes to tmpDir
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

    describe('loading user plugins from config', () => {
        it('should load a custom template plugin from config path', async () => {
            // Copy test template fixture to temp directory
            const pluginsDir = path.join(tmpDir, 'my-plugins');
            await fs.mkdir(pluginsDir, { recursive: true });
            await copyFixture('test-template', pluginsDir);

            // Create config pointing to the plugins directory
            const config: LbScaffoldConfig = {
                plugins: ['./my-plugins/**']
            };
            await saveConfig(config);

            // Get plugin paths and verify they resolve correctly
            const pluginPaths = await getPluginPaths();
            expect(pluginPaths).toHaveLength(1);
            expect(pluginPaths[0]).toContain('my-plugins');

            // Load plugins from the config path
            const plugins = await loadAllPlugins<ScaffoldTemplatePlugin>(
                pluginPaths[0],
                SCAFFOLD_TEMPLATE_PLUGIN_TYPE
            );

            expect(plugins).toHaveLength(1);
            expect(plugins[0].name).toBe('test-template');
            expect(plugins[0].api.argument).toBe('test-template');
        });

        it('should execute a custom template plugin', async () => {
            // Copy test template fixture to temp directory
            const pluginsDir = path.join(tmpDir, 'my-plugins');
            await fs.mkdir(pluginsDir, { recursive: true });
            await copyFixture('test-template', pluginsDir);

            // Create config pointing to the plugins directory
            const config: LbScaffoldConfig = {
                plugins: ['./my-plugins/**']
            };
            await saveConfig(config);

            // Load and execute the plugin
            const pluginPaths = await getPluginPaths();
            const plugins = await loadAllPlugins<ScaffoldTemplatePlugin>(
                pluginPaths[0],
                SCAFFOLD_TEMPLATE_PLUGIN_TYPE
            );

            const testPlugin = plugins.find(p => p.name === 'test-template');
            expect(testPlugin).toBeDefined();

            // Execute the plugin
            const projectName = 'my-test-project';
            await testPlugin!.api.execute({ name: projectName });

            // Verify the plugin created the expected files
            const projectDir = path.join(tmpDir, projectName);
            const markerPath = path.join(projectDir, 'test-template.marker');

            const markerExists = await fs.stat(markerPath).then(() => true).catch(() => false);
            expect(markerExists).toBe(true);

            const markerContent = await fs.readFile(markerPath, 'utf-8');
            expect(markerContent).toContain('Created by test-template plugin');
            expect(markerContent).toContain(projectName);
        });

        it('should load plugins from multiple config paths', async () => {
            // Create two separate plugin directories
            const pluginsDir1 = path.join(tmpDir, 'plugins-a');
            const pluginsDir2 = path.join(tmpDir, 'plugins-b');
            await fs.mkdir(pluginsDir1, { recursive: true });
            await fs.mkdir(pluginsDir2, { recursive: true });

            // Copy the same fixture to first directory
            await copyFixture('test-template', pluginsDir1);

            // Create a second mock plugin in the second directory
            const plugin2Dir = path.join(pluginsDir2, 'another-template');
            await fs.mkdir(plugin2Dir, { recursive: true });
            await fs.writeFile(path.join(plugin2Dir, 'plugin.json'), JSON.stringify({
                name: 'another-template',
                pluginType: 'scaffold-template',
                module: './index.mjs'
            }));
            await fs.writeFile(path.join(plugin2Dir, 'index.mjs'), `
import { definePlugin } from '@libria/plugin-loader';
export default definePlugin('scaffold-template', 'another-template', {
    argument: 'another-template',
    async execute(options) {
        console.log('Another template executed');
    }
});
`);

            // Create config with both paths
            const config: LbScaffoldConfig = {
                plugins: ['./plugins-a/**', './plugins-b/**']
            };
            await saveConfig(config);

            // Get plugin paths
            const pluginPaths = await getPluginPaths();
            expect(pluginPaths).toHaveLength(2);

            // Load all plugins
            const allPlugins: LibriaPlugin<ScaffoldTemplatePlugin>[] = [];
            for (const pluginPath of pluginPaths) {
                const loaded = await loadAllPlugins<ScaffoldTemplatePlugin>(
                    pluginPath,
                    SCAFFOLD_TEMPLATE_PLUGIN_TYPE
                );
                allPlugins.push(...loaded);
            }

            expect(allPlugins).toHaveLength(2);
            const pluginNames = allPlugins.map(p => p.name).sort();
            expect(pluginNames).toEqual(['another-template', 'test-template']);
        });

        it('should handle dry-run mode in custom plugin', async () => {
            // Copy test template fixture to temp directory
            const pluginsDir = path.join(tmpDir, 'my-plugins');
            await fs.mkdir(pluginsDir, { recursive: true });
            await copyFixture('test-template', pluginsDir);

            // Create config
            const config: LbScaffoldConfig = {
                plugins: ['./my-plugins/**']
            };
            await saveConfig(config);

            // Load and execute the plugin with dryRun
            const pluginPaths = await getPluginPaths();
            const plugins = await loadAllPlugins<ScaffoldTemplatePlugin>(
                pluginPaths[0],
                SCAFFOLD_TEMPLATE_PLUGIN_TYPE
            );

            const testPlugin = plugins.find(p => p.name === 'test-template');

            const projectName = 'dry-run-project';
            await testPlugin!.api.execute({ name: projectName, dryRun: true });

            // Verify the project was NOT created
            const projectDir = path.join(tmpDir, projectName);
            const exists = await fs.stat(projectDir).then(() => true).catch(() => false);
            expect(exists).toBe(false);
        });
    });

    describe('config file in parent directory', () => {
        it('should find config in parent and resolve paths relative to it', async () => {
            // Create config in tmpDir
            const pluginsDir = path.join(tmpDir, 'plugins');
            await fs.mkdir(pluginsDir, { recursive: true });
            await copyFixture('test-template', pluginsDir);

            const config: LbScaffoldConfig = {
                plugins: ['./plugins/**']
            };
            await saveConfig(config);

            // Create and change to a subdirectory
            const subDir = path.join(tmpDir, 'projects', 'my-project');
            await fs.mkdir(subDir, { recursive: true });
            process.chdir(subDir);

            // Plugin paths should still resolve correctly
            const pluginPaths = await getPluginPaths();
            expect(pluginPaths).toHaveLength(1);

            // Load plugins - should find the test-template
            const plugins = await loadAllPlugins<ScaffoldTemplatePlugin>(
                pluginPaths[0],
                SCAFFOLD_TEMPLATE_PLUGIN_TYPE
            );

            expect(plugins).toHaveLength(1);
            expect(plugins[0].name).toBe('test-template');
        });
    });

    describe('CLI plugin loading and validation', () => {
        it.skip('should load user plugins and merge with built-in plugins', async () => {
            // Set up user plugins directory
            const pluginsDir = path.join(tmpDir, 'my-plugins');
            await fs.mkdir(pluginsDir, { recursive: true });
            await copyFixture('test-template', pluginsDir);

            // Create config pointing to user plugins
            const config: LbScaffoldConfig = {
                plugins: ['./my-plugins/**']
            };
            await saveConfig(config);

            // Simulate CLI plugin loading logic
            const builtInPlugins = await loadAllPlugins<ScaffoldTemplatePlugin>(
                path.join(__dirname, '../templates/**').replace(/\\/g, '/'),
                SCAFFOLD_TEMPLATE_PLUGIN_TYPE
            );

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
                    // CLI would warn but continue
                    console.warn(`Failed to load plugins from '${pluginPath}': ${(error as Error).message}`);
                }
            }

            // Merge and deduplicate (user plugins override built-in)
            const pluginMap = new Map<string, LibriaPlugin<ScaffoldTemplatePlugin>>();
            for (const plugin of builtInPlugins) {
                pluginMap.set(plugin.name, plugin);
            }
            for (const plugin of userPlugins) {
                pluginMap.set(plugin.name, plugin);
            }
            const allPlugins = Array.from(pluginMap.values()).sort((a, b) => a.name.localeCompare(b.name));

            // Validate that both built-in and user plugins are present
            const pluginNames = allPlugins.map(p => p.name);
            expect(pluginNames).toContain('test-template'); // User plugin
            expect(pluginNames).toContain('ts-lib'); // Built-in plugin (if exists)

            // Validate each plugin structure
            for (const plugin of allPlugins) {
                expect(plugin.name).toBeTruthy();
                expect(plugin.api.argument).toBeTruthy();
                expect(typeof plugin.api.execute).toBe('function');
            }
        });

        it.skip('should allow user plugin to override built-in plugin with same name', async () => {
            // Create a user plugin that shadows a built-in name
            const pluginsDir = path.join(tmpDir, 'my-plugins');
            await fs.mkdir(pluginsDir, { recursive: true });

            // Create a ts-lib override plugin
            const overrideDir = path.join(pluginsDir, 'ts-lib');
            await fs.mkdir(overrideDir, { recursive: true });

            await fs.writeFile(
                path.join(overrideDir, 'plugin.json'),
                JSON.stringify({
                    name: 'ts-lib',
                    pluginType: 'scaffold-template',
                    module: './index.mjs'
                })
            );

            await fs.writeFile(
                path.join(overrideDir, 'index.mjs'),
                `
import { definePlugin } from '@libria/plugin-loader';
export default definePlugin('scaffold-template', 'ts-lib', {
    argument: 'ts-lib',
    async execute(options) {
        // This is the user override
    }
});
            `
            );

            const config: LbScaffoldConfig = {
                plugins: ['./my-plugins/**']
            };
            await saveConfig(config);

            // Load built-in plugins
            const builtInPlugins = await loadAllPlugins<ScaffoldTemplatePlugin>(
                path.join(__dirname, '../templates').replace(/\\/g, '/'),
                SCAFFOLD_TEMPLATE_PLUGIN_TYPE
            );

            // Load user plugins
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
                    console.warn(`Failed to load plugins: ${(error as Error).message}`);
                }
            }

            // Merge - user plugin should override
            const pluginMap = new Map<string, LibriaPlugin<ScaffoldTemplatePlugin>>();
            for (const plugin of builtInPlugins) {
                pluginMap.set(plugin.name, plugin);
            }
            for (const plugin of userPlugins) {
                pluginMap.set(plugin.name, plugin);
            }

            const allPlugins = Array.from(pluginMap.values());
            const tsLibPlugin = allPlugins.find(p => p.name === 'ts-lib');

            expect(tsLibPlugin).toBeDefined();

            // The user override plugin should be from the my-plugins directory
            const builtInHasTsLib = builtInPlugins.some(p => p.name === 'ts-lib');
            expect(builtInHasTsLib).toBe(true);
            expect(userPlugins.some(p => p.name === 'ts-lib')).toBe(true);
        });

        it('should handle invalid plugin paths gracefully', async () => {
            // Create config with a non-existent path
            const config: LbScaffoldConfig = {
                plugins: ['./nonexistent-plugins/**', './my-plugins/**']
            };
            await saveConfig(config);

            // Load user plugins - should handle non-existent path gracefully
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
                    console.error(`Failed to load plugins: ${(error as Error).message}`);
                    // CLI would warn but continue
                }
            }

            // One path should fail (nonexistent), other should work (empty my-plugins)
            expect(userPluginPaths).toHaveLength(2);
        });

        it('should validate plugin structure and API compliance', async () => {
            // Create a properly structured plugin
            const pluginsDir = path.join(tmpDir, 'my-plugins');
            await fs.mkdir(pluginsDir, { recursive: true });
            await copyFixture('test-template', pluginsDir);

            const config: LbScaffoldConfig = {
                plugins: ['./my-plugins/**']
            };
            await saveConfig(config);

            const userPluginPaths = await getPluginPaths();
            const plugins = await loadAllPlugins<ScaffoldTemplatePlugin>(
                userPluginPaths[0],
                SCAFFOLD_TEMPLATE_PLUGIN_TYPE
            );

            expect(plugins).toHaveLength(1);

            const plugin = plugins[0];

            // Validate name
            expect(typeof plugin.name).toBe('string');
            expect(plugin.name.length).toBeGreaterThan(0);

            // Validate api structure
            expect(plugin.api).toBeDefined();
            expect(typeof plugin.api.argument).toBe('string');
            expect(plugin.api.argument.length).toBeGreaterThan(0);
            expect(typeof plugin.api.execute).toBe('function');

            // Test execute function signature
            const executeOptions: ScaffoldTemplatePluginOptions = {
                name: 'test-project',
                dryRun: true
            };

            // Should execute without error in dry-run mode
            await expect(plugin.api.execute(executeOptions)).resolves.not.toThrow();
        });

        it('should support multiple globs pointing to different locations', async () => {
            // Create multiple plugin directories
            const pluginsDir1 = path.join(tmpDir, 'plugins-location-a');
            const pluginsDir2 = path.join(tmpDir, 'plugins-location-b');
            await fs.mkdir(pluginsDir1, { recursive: true });
            await fs.mkdir(pluginsDir2, { recursive: true });

            // Copy test-template to both
            await copyFixture('test-template', pluginsDir1);

            // Create a different plugin in second location
            const plugin2Dir = path.join(pluginsDir2, 'another-template');
            await fs.mkdir(plugin2Dir, { recursive: true });
            await fs.writeFile(
                path.join(plugin2Dir, 'plugin.json'),
                JSON.stringify({
                    name: 'another-template',
                    pluginType: 'scaffold-template',
                    module: './index.mjs'
                })
            );
            await fs.writeFile(
                path.join(plugin2Dir, 'index.mjs'),
                `
import { definePlugin } from '@libria/plugin-loader';
export default definePlugin('scaffold-template', 'another-template', {
    argument: 'another-template',
    async execute(options) {}
});
            `
            );

            const config: LbScaffoldConfig = {
                plugins: ['./plugins-location-a/**', './plugins-location-b/**']
            };
            await saveConfig(config);

            // Load all plugins from multiple globs
            const userPluginPaths = await getPluginPaths();
            expect(userPluginPaths).toHaveLength(2);

            const allPlugins: LibriaPlugin<ScaffoldTemplatePlugin>[] = [];
            for (const pluginPath of userPluginPaths) {
                const loaded = await loadAllPlugins<ScaffoldTemplatePlugin>(
                    pluginPath,
                    SCAFFOLD_TEMPLATE_PLUGIN_TYPE
                );
                allPlugins.push(...loaded);
            }

            const pluginNames = allPlugins.map(p => p.name).sort();
            expect(pluginNames).toEqual(['another-template', 'test-template']);
        });
    });

    describe('plugin loading edge cases', () => {
        it('should handle plugins with complex directory structures', async () => {
            // Create nested plugin structure
            const pluginsDir = path.join(tmpDir, 'my-plugins');
            const nestedPath = path.join(pluginsDir, 'category', 'frameworks', 'web');
            await fs.mkdir(nestedPath, { recursive: true });

            // Create plugin in nested directory
            await fs.writeFile(
                path.join(nestedPath, 'plugin.json'),
                JSON.stringify({
                    name: 'nested-web-plugin',
                    pluginType: 'scaffold-template',
                    module: './index.mjs'
                })
            );
            await fs.writeFile(
                path.join(nestedPath, 'index.mjs'),
                `
import { definePlugin } from '@libria/plugin-loader';
export default definePlugin('scaffold-template', 'nested-web-plugin', {
    argument: 'nested-web-plugin',
    async execute(options) {}
});
            `
            );

            const config: LbScaffoldConfig = {
                plugins: ['./my-plugins/**']
            };
            await saveConfig(config);

            const userPluginPaths = await getPluginPaths();
            const plugins = await loadAllPlugins<ScaffoldTemplatePlugin>(
                userPluginPaths[0],
                SCAFFOLD_TEMPLATE_PLUGIN_TYPE
            );

            expect(plugins).toHaveLength(1);
            expect(plugins[0].name).toBe('nested-web-plugin');
        });

        it('should deduplicate plugins with same name from different paths', async () => {
            const pluginsDir = path.join(tmpDir, 'my-plugins');
            const dir1 = path.join(pluginsDir, 'location-a');
            const dir2 = path.join(pluginsDir, 'location-b');
            await fs.mkdir(dir1, { recursive: true });
            await fs.mkdir(dir2, { recursive: true });

            // Create two plugins with same name
            for (const dir of [dir1, dir2]) {
                await fs.writeFile(
                    path.join(dir, 'plugin.json'),
                    JSON.stringify({
                        name: 'duplicate-plugin',
                        pluginType: 'scaffold-template',
                        module: './index.mjs'
                    })
                );
                await fs.writeFile(
                    path.join(dir, 'index.mjs'),
                    `
import { definePlugin } from '@libria/plugin-loader';
export default definePlugin('scaffold-template', 'duplicate-plugin', {
    argument: 'duplicate-plugin',
    async execute(options) {}
});
            `
                );
            }

            const config: LbScaffoldConfig = {
                plugins: ['./my-plugins/**']
            };
            await saveConfig(config);

            const userPluginPaths = await getPluginPaths();
            const plugins = await loadAllPlugins<ScaffoldTemplatePlugin>(
                userPluginPaths[0],
                SCAFFOLD_TEMPLATE_PLUGIN_TYPE
            );

            // Should load both (glob matches both)
            expect(plugins.length).toBeGreaterThanOrEqual(2);
            const duplicates = plugins.filter(p => p.name === 'duplicate-plugin');
            expect(duplicates.length).toBeGreaterThanOrEqual(2);

            // When deduplicating via Map, last one wins (location-b)
            const pluginMap = new Map<string, LibriaPlugin<ScaffoldTemplatePlugin>>();
            for (const plugin of plugins) {
                pluginMap.set(plugin.name, plugin);
            }
            expect(pluginMap.get('duplicate-plugin')).toBeDefined();
        });

        it('should load plugins using absolute paths from config', async () => {
            const pluginsDir = path.join(tmpDir, 'my-plugins');
            await fs.mkdir(pluginsDir, { recursive: true });
            await copyFixture('test-template', pluginsDir);

            // Use absolute path in config
            const absolutePath = pluginsDir.replace(/\\/g, '/');
            const config: LbScaffoldConfig = {
                plugins: [absolutePath + '/**']
            };
            await saveConfig(config);

            const userPluginPaths = await getPluginPaths();
            expect(userPluginPaths).toHaveLength(1);

            const plugins = await loadAllPlugins<ScaffoldTemplatePlugin>(
                userPluginPaths[0],
                SCAFFOLD_TEMPLATE_PLUGIN_TYPE
            );

            expect(plugins).toHaveLength(1);
            expect(plugins[0].name).toBe('test-template');
        });
    });
});
