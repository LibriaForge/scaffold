import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useTempProject } from './helpers/use-temp-project';
import path from 'path';
import fs from 'fs/promises';
import {
    findConfigPath,
    getDefaultConfigPath,
    loadConfig,
    saveConfig,
    initConfig,
    addPluginGlob,
    removePluginGlob,
    listPluginGlobs,
    getPluginPaths,
    addPackage,
    removePackage,
    listPackages,
    LbScaffoldConfig
} from '../src/config';

describe('config', () => {
    let cleanup: () => Promise<void>;
    let tmpDir: string;

    beforeEach(async () => {
        // useTempProject already handles cwd change and cleanup
        const temp = await useTempProject(undefined, 'config');
        cleanup = temp.cleanup;
        tmpDir = temp.tmp;
    });

    afterEach(async () => {
        await cleanup();
    });

    describe('findConfigPath', () => {
        it('should return null when no config file exists', async () => {
            const result = await findConfigPath(tmpDir);
            expect(result).toBeNull();
        });

        it('should find config file in current directory', async () => {
            const configPath = path.join(tmpDir, '.lbscaffold');
            await fs.writeFile(configPath, '{}');

            const result = await findConfigPath(tmpDir);
            expect(result).toBe(configPath);
        });

        it('should find config file in parent directory', async () => {
            const configPath = path.join(tmpDir, '.lbscaffold');
            await fs.writeFile(configPath, '{}');

            const subDir = path.join(tmpDir, 'subdir');
            await fs.mkdir(subDir);

            const result = await findConfigPath(subDir);
            expect(result).toBe(configPath);
        });
    });

    describe('getDefaultConfigPath', () => {
        it('should return path in current working directory', () => {
            const result = getDefaultConfigPath();
            expect(result).toBe(path.join(process.cwd(), '.lbscaffold'));
        });
    });

    describe('loadConfig', () => {
        it('should return empty object when no config file exists', async () => {
            const result = await loadConfig();
            expect(result).toEqual({});
        });

        it('should load config from file', async () => {
            const config: LbScaffoldConfig = { plugins: ['./plugins/**'] };
            const configPath = path.join(tmpDir, '.lbscaffold');
            await fs.writeFile(configPath, JSON.stringify(config));

            const result = await loadConfig(configPath);
            expect(result).toEqual(config);
        });

        it('should throw on invalid JSON', async () => {
            const configPath = path.join(tmpDir, '.lbscaffold');
            await fs.writeFile(configPath, 'invalid json');

            await expect(loadConfig(configPath)).rejects.toThrow();
        });
    });

    describe('saveConfig', () => {
        it('should save config to file', async () => {
            const config: LbScaffoldConfig = { plugins: ['./plugins/**'] };
            const configPath = path.join(tmpDir, '.lbscaffold');

            await saveConfig(config, configPath);

            const content = await fs.readFile(configPath, 'utf-8');
            expect(JSON.parse(content)).toEqual(config);
        });

        it('should format config with indentation', async () => {
            const config: LbScaffoldConfig = { plugins: ['./plugins/**'] };
            const configPath = path.join(tmpDir, '.lbscaffold');

            await saveConfig(config, configPath);

            const content = await fs.readFile(configPath, 'utf-8');
            expect(content).toContain('\n');
            expect(content).toContain('  ');
        });
    });

    describe('initConfig', () => {
        it('should create new config file with default plugins', async () => {
            const configPath = await initConfig();

            expect(configPath).toBe(path.join(tmpDir, '.lbscaffold'));

            const content = await fs.readFile(configPath, 'utf-8');
            const config = JSON.parse(content);
            expect(config.plugins).toContain('./plugins/**');
        });

        it('should throw if config file already exists', async () => {
            const configPath = path.join(tmpDir, '.lbscaffold');
            await fs.writeFile(configPath, '{}');

            await expect(initConfig()).rejects.toThrow(/already exists/);
        });
    });

    describe('addPluginGlob', () => {
        it('should add glob pattern to existing config', async () => {
            await initConfig();

            await addPluginGlob('./custom/**');

            const globs = await listPluginGlobs();
            expect(globs).toContain('./plugins/**');
            expect(globs).toContain('./custom/**');
        });

        it('should throw if pattern already exists', async () => {
            await initConfig();

            await expect(addPluginGlob('./plugins/**')).rejects.toThrow(/already exists/);
        });

        it('should create plugins array if not present', async () => {
            const configPath = path.join(tmpDir, '.lbscaffold');
            await fs.writeFile(configPath, '{}');

            await addPluginGlob('./custom/**');

            const globs = await listPluginGlobs();
            expect(globs).toContain('./custom/**');
        });
    });

    describe('removePluginGlob', () => {
        it('should remove glob pattern from config', async () => {
            await initConfig();

            await removePluginGlob('./plugins/**');

            const globs = await listPluginGlobs();
            expect(globs).not.toContain('./plugins/**');
        });

        it('should throw if pattern does not exist', async () => {
            await initConfig();

            await expect(removePluginGlob('./nonexistent/**')).rejects.toThrow(/not found/);
        });

        it('should throw if no config file exists', async () => {
            await expect(removePluginGlob('./plugins/**')).rejects.toThrow(/No config file/);
        });
    });

    describe('listPluginGlobs', () => {
        it('should return empty array when no config exists', async () => {
            const result = await listPluginGlobs();
            expect(result).toEqual([]);
        });

        it('should return empty array when plugins not defined', async () => {
            const configPath = path.join(tmpDir, '.lbscaffold');
            await fs.writeFile(configPath, '{}');

            const result = await listPluginGlobs();
            expect(result).toEqual([]);
        });

        it('should return all plugin patterns', async () => {
            const config: LbScaffoldConfig = { plugins: ['./a/**', './b/**'] };
            const configPath = path.join(tmpDir, '.lbscaffold');
            await fs.writeFile(configPath, JSON.stringify(config));

            const result = await listPluginGlobs();
            expect(result).toEqual(['./a/**', './b/**']);
        });
    });

    describe('getPluginPaths', () => {
        it('should return empty array when no config exists', async () => {
            const result = await getPluginPaths();
            expect(result).toEqual([]);
        });

        it('should resolve relative paths to absolute', async () => {
            const config: LbScaffoldConfig = { plugins: ['./plugins/**'] };
            const configPath = path.join(tmpDir, '.lbscaffold');
            await fs.writeFile(configPath, JSON.stringify(config));

            const result = await getPluginPaths();
            expect(result).toHaveLength(1);
            expect(result[0]).toBe(path.join(tmpDir, 'plugins/**').replace(/\\/g, '/'));
        });

        it('should keep absolute paths as-is', async () => {
            const absolutePath = '/absolute/path/**';
            const config: LbScaffoldConfig = { plugins: [absolutePath] };
            const configPath = path.join(tmpDir, '.lbscaffold');
            await fs.writeFile(configPath, JSON.stringify(config));

            const result = await getPluginPaths();
            expect(result).toContain(absolutePath);
        });

        it('should convert backslashes to forward slashes', async () => {
            const config: LbScaffoldConfig = { plugins: ['./plugins/**'] };
            const configPath = path.join(tmpDir, '.lbscaffold');
            await fs.writeFile(configPath, JSON.stringify(config));

            const result = await getPluginPaths();
            expect(result[0]).not.toContain('\\');
        });
    });

    describe('addPackage', () => {
        it('should add package to existing config', async () => {
            await initConfig();

            await addPackage('@libria/scaffold-ts-lib');

            const packages = await listPackages();
            expect(packages).toContain('@libria/scaffold-ts-lib');
        });

        it('should throw if package already exists', async () => {
            await initConfig();
            await addPackage('@libria/scaffold-ts-lib');

            await expect(addPackage('@libria/scaffold-ts-lib')).rejects.toThrow(/already exists/);
        });

        it('should create packages array if not present', async () => {
            const configPath = path.join(tmpDir, '.lbscaffold');
            await fs.writeFile(configPath, JSON.stringify({ plugins: [] }));

            await addPackage('@libria/scaffold-ts-lib');

            const packages = await listPackages();
            expect(packages).toContain('@libria/scaffold-ts-lib');
        });
    });

    describe('removePackage', () => {
        it('should remove package from config', async () => {
            await initConfig();
            await addPackage('@libria/scaffold-ts-lib');

            await removePackage('@libria/scaffold-ts-lib');

            const packages = await listPackages();
            expect(packages).not.toContain('@libria/scaffold-ts-lib');
        });

        it('should throw if package does not exist', async () => {
            await initConfig();

            await expect(removePackage('@libria/nonexistent')).rejects.toThrow(/not found/);
        });

        it('should throw if no config file exists', async () => {
            await expect(removePackage('@libria/scaffold-ts-lib')).rejects.toThrow(
                /No config file/
            );
        });
    });

    describe('listPackages', () => {
        it('should return empty array when no config exists', async () => {
            const result = await listPackages();
            expect(result).toEqual([]);
        });

        it('should return empty array when packages not defined', async () => {
            const configPath = path.join(tmpDir, '.lbscaffold');
            await fs.writeFile(configPath, '{}');

            const result = await listPackages();
            expect(result).toEqual([]);
        });

        it('should return all package names', async () => {
            const config: LbScaffoldConfig = {
                packages: ['@libria/scaffold-ts-lib', '@libria/scaffold-react'],
            };
            const configPath = path.join(tmpDir, '.lbscaffold');
            await fs.writeFile(configPath, JSON.stringify(config));

            const result = await listPackages();
            expect(result).toEqual(['@libria/scaffold-ts-lib', '@libria/scaffold-react']);
        });
    });
});
