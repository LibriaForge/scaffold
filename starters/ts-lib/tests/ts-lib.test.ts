import path from 'path';

import fs from 'fs-extra';
import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest';

import {useTempProject} from './helpers/use-temp-project';
import {SCAFFOLD_TEMPLATE_PLUGIN_TYPE} from "@libria/scaffold";

describe('plugin execute (project generation)', () => {
    let cleanup: () => Promise<void>;
    let tmp: string;

    beforeEach(async () => {
        ({tmp, cleanup} = await useTempProject('generate'));
    });

    afterEach(async () => {
        await cleanup();
    });

    it('should create the project directory with template files', async () => {
        const tsLibModule = await import('../src/ts-lib');
        const plugin = tsLibModule.default;
        const ctx = {} as any;
        const instance = await plugin.create(ctx);

        const projectName = 'test-project';
        await instance.api.execute({
            name: projectName,
            dryRun: false,
            force: false,
            packageName: '@test/my-lib',
            description: 'A test library',
            version: '1.0.0',
            author: 'Test Author',
            githubRepo: 'test/my-lib',
            gitInit: false,
            install: false,
            packageManager: 'npm',
        });

        const projectDir = path.join(tmp, projectName);
        expect(await fs.pathExists(projectDir)).toBe(true);
        expect(await fs.pathExists(path.join(projectDir, 'package.json'))).toBe(true);
        expect(await fs.pathExists(path.join(projectDir, 'tsconfig.json'))).toBe(true);
        expect(await fs.pathExists(path.join(projectDir, 'src'))).toBe(true);
    });

    it('should replace all placeholders in generated files', async () => {
        const tsLibModule = await import('../src/ts-lib');
        const plugin = tsLibModule.default;
        const ctx = {} as any;
        const instance = await plugin.create(ctx);

        const projectName = 'placeholder-test';
        await instance.api.execute({
            name: projectName,
            dryRun: false,
            force: false,
            packageName: '@my-scope/placeholder-test',
            description: 'Placeholder test description',
            version: '3.2.1',
            author: 'Jane Doe',
            githubRepo: 'jane/placeholder-test',
            gitInit: false,
            install: false,
            packageManager: 'npm',
        });

        const projectDir = path.join(tmp, projectName);
        const pkgJson = JSON.parse(
            await fs.readFile(path.join(projectDir, 'package.json'), 'utf-8')
        );

        expect(pkgJson.name).toBe('@my-scope/placeholder-test');
        expect(pkgJson.version).toBe('3.2.1');
        expect(pkgJson.description).toBe('Placeholder test description');
        expect(pkgJson.author).toBe('Jane Doe');
        expect(pkgJson.repository.url).toContain('jane/placeholder-test');
    });

    it('should overwrite existing directory when force is true', async () => {
        const tsLibModule = await import('../src/ts-lib');
        const plugin = tsLibModule.default;
        const ctx = {} as any;
        const instance = await plugin.create(ctx);

        const projectName = 'force-test';
        const projectDir = path.join(tmp, projectName);

        // Create existing directory with a marker file
        await fs.ensureDir(projectDir);
        await fs.writeFile(path.join(projectDir, 'old-file.txt'), 'old');

        await instance.api.execute({
            name: projectName,
            dryRun: false,
            force: true,
            packageName: 'force-test',
            description: '',
            version: '0.0.0',
            author: '',
            githubRepo: '',
            gitInit: false,
            install: false,
            packageManager: 'npm',
        });

        // Old file should be gone, new project files should exist
        expect(await fs.pathExists(path.join(projectDir, 'old-file.txt'))).toBe(false);
        expect(await fs.pathExists(path.join(projectDir, 'package.json'))).toBe(true);
    });

    it('should not create files when dryRun is true', async () => {
        const tsLibModule = await import('../src/ts-lib');
        const plugin = tsLibModule.default;
        const ctx = {} as any;
        const instance = await plugin.create(ctx);

        const projectName = 'dry-run-test';
        const consoleSpy = vi.spyOn(console, 'log');

        await instance.api.execute({
            name: projectName,
            dryRun: true,
            force: false,
            packageName: 'dry-run-test',
            description: '',
            version: '0.0.0',
            author: '',
            githubRepo: '',
            gitInit: false,
            install: false,
            packageManager: 'npm',
        });

        const projectDir = path.join(tmp, projectName);
        expect(await fs.pathExists(projectDir)).toBe(false);

        const dryRunLogs = consoleSpy.mock.calls.flat().filter(
            (msg: unknown) => typeof msg === 'string' && msg.includes('[dry-run]')
        );
        expect(dryRunLogs.length).toBeGreaterThan(0);

        consoleSpy.mockRestore();
    });
});

describe('plugin getOptions', () => {
    it('should return all expected option keys', async () => {
        const tsLibModule = await import('../src/ts-lib');
        const plugin = tsLibModule.default;
        const ctx = {} as any;
        const instance = await plugin.create(ctx);

        const options = await instance.api.getOptions({name: 'test'});

        expect(options).toHaveProperty('packageName');
        expect(options).toHaveProperty('description');
        expect(options).toHaveProperty('version');
        expect(options).toHaveProperty('author');
        expect(options).toHaveProperty('githubRepo');
        expect(options).toHaveProperty('gitInit');
        expect(options).toHaveProperty('install');
        expect(options).toHaveProperty('packageManager');
    });

    it('should use the init name as default packageName', async () => {
        const tsLibModule = await import('../src/ts-lib');
        const plugin = tsLibModule.default;
        const ctx = {} as any;
        const instance = await plugin.create(ctx);

        const options = await instance.api.getOptions({name: 'my-cool-lib'});
        expect(options.packageName.defaultValue).toBe('my-cool-lib');
    });

    it('should have correct default values', async () => {
        const tsLibModule = await import('../src/ts-lib');
        const plugin = tsLibModule.default;
        const ctx = {} as any;
        const instance = await plugin.create(ctx);

        const options = await instance.api.getOptions({name: 'test'});
        expect(options.version.defaultValue).toBe('0.0.0');
        expect(options.gitInit.defaultValue).toBe(true);
        expect(options.install.defaultValue).toBe(true);
        expect(options.packageManager.defaultValue).toBe('npm');
    });

    it('should have correct package manager choices', async () => {
        const tsLibModule = await import('../src/ts-lib');
        const plugin = tsLibModule.default;
        const ctx = {} as any;
        const instance = await plugin.create(ctx);

        const options = await instance.api.getOptions({name: 'test'});
        expect(options.packageManager.choices).toEqual(['npm', 'yarn', 'pnpm']);
    });
});

describe('plugin metadata', () => {
    it('should have correct id, name, and pluginType', async () => {
        const tsLibModule = await import('../src/ts-lib');
        const plugin = tsLibModule.default;

        expect(plugin.id).toBe('libria:scaffold:ts-lib');
        expect(plugin.name).toBe('ts-lib');
        expect(plugin.pluginType).toBe(SCAFFOLD_TEMPLATE_PLUGIN_TYPE);
    });
});

describe('postProcess (git init and install)', () => {
    let cleanup: () => Promise<void>;
    let tmp: string;

    beforeEach(async () => {
        ({tmp, cleanup} = await useTempProject('post-process'));
    });

    afterEach(async () => {
        await cleanup();
    });

    it('should initialize a git repo when gitInit is true', async () => {
        const tsLibModule = await import('../src/ts-lib');
        const plugin = tsLibModule.default;
        const ctx = {} as any;
        const instance = await plugin.create(ctx);

        const projectName = 'git-init-test';
        await instance.api.execute({
            name: projectName,
            dryRun: false,
            force: false,
            packageName: 'git-init-test',
            description: '',
            version: '0.0.0',
            author: '',
            githubRepo: '',
            gitInit: true,
            install: false,
            packageManager: 'npm',
        });

        const projectDir = path.join(tmp, projectName);
        expect(await fs.pathExists(path.join(projectDir, '.git'))).toBe(true);
    });

    it('should not initialize git when gitInit is false', async () => {
        const tsLibModule = await import('../src/ts-lib');
        const plugin = tsLibModule.default;
        const ctx = {} as any;
        const instance = await plugin.create(ctx);

        const projectName = 'no-git-test';
        await instance.api.execute({
            name: projectName,
            dryRun: false,
            force: false,
            packageName: 'no-git-test',
            description: '',
            version: '0.0.0',
            author: '',
            githubRepo: '',
            gitInit: false,
            install: false,
            packageManager: 'npm',
        });

        const projectDir = path.join(tmp, projectName);
        expect(await fs.pathExists(path.join(projectDir, '.git'))).toBe(false);
    });

    it('should skip post-processing in dryRun mode', async () => {
        const tsLibModule = await import('../src/ts-lib');
        const plugin = tsLibModule.default;
        const ctx = {} as any;
        const instance = await plugin.create(ctx);

        const projectName = 'dry-post-test';
        const consoleSpy = vi.spyOn(console, 'log');

        await instance.api.execute({
            name: projectName,
            dryRun: true,
            force: false,
            packageName: 'dry-post-test',
            description: '',
            version: '0.0.0',
            author: '',
            githubRepo: '',
            gitInit: true,
            install: true,
            packageManager: 'npm',
        });

        const dryRunMessages = consoleSpy.mock.calls.flat().filter(
            (msg: unknown) => typeof msg === 'string' && msg.includes('[dry-run]')
        );
        expect(dryRunMessages.length).toBeGreaterThan(0);

        // Project dir should not exist in dry-run
        expect(await fs.pathExists(path.join(tmp, projectName))).toBe(false);

        consoleSpy.mockRestore();
    });
});
