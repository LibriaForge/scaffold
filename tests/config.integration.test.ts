import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useTempProject } from './helpers/use-temp-project';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { loadAllPlugins } from '@libria/plugin-loader';
import {
    initConfig,
    addPluginGlob,
    getPluginPaths,
    saveConfig,
    LbScaffoldConfig
} from '../src/config';
import { SCAFFOLD_TEMPLATE_PLUGIN_TYPE, ScaffoldTemplatePlugin } from '../src/core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(__dirname, 'fixtures');

describe('config integration', () => {
    let cleanup: () => Promise<void>;
    let tmpDir: string;

    beforeEach(async () => {
        // Don't pass fixture name - we'll copy manually
        const temp = await useTempProject(undefined, 'config-integration');
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
            const allPlugins: ScaffoldTemplatePlugin[] = [];
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
});
