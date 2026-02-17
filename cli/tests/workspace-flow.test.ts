import path from 'path';
import fs from 'fs-extra';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PluginManager } from '@libria/plugin-loader';

import { useTempProject } from './helpers/use-temp-project';
import { ExecuteOptions, ScaffoldTemplatePlugin } from '@libria/scaffold-core';
import { AngularOptions } from '@libria/scaffold-plugin-angular';
import { AddOptions, InitOptions } from '@libria/scaffold-plugin-ts-workspace';
const STARTERS_DIR = path.resolve(import.meta.dirname, '../../starters');
import { Options as TsLibOptions } from '@libria/scaffold-plugin-ts-lib';
import { NestJSOptions } from '@libria/scaffold-plugin-nestjs';
import { NextJSOptions } from '@libria/scaffold-plugin-nextjs';
import ts from 'typescript';

function parseJsonc(text: string): any {
    const { config } = ts.parseConfigFileTextToJson('tsconfig.json', text);
    return config;
}

async function loadPlugins(): Promise<PluginManager> {
    const pm = new PluginManager();
    await pm.loadPlugins([
        path.join(STARTERS_DIR, 'ts-lib'),
        path.join(STARTERS_DIR, 'angular'),
        path.join(STARTERS_DIR, 'nestjs'),
        path.join(STARTERS_DIR, 'ts-workspace'),
        path.join(STARTERS_DIR, 'nextjs'),
    ]);
    return pm;
}

describe('workspace flow: init + add ts-lib + add angular + add nestjs', () => {
    let cleanup: () => Promise<void>;
    let tmp: string;
    let pm: PluginManager;

    beforeEach(async () => {
        ({ tmp, cleanup } = await useTempProject('workspace-flow'));
        pm = await loadPlugins();
    });

    afterEach(async () => {
        await pm.shutdown();
        await cleanup();
    });

    it('should init a workspace, add a ts-lib, an angular app, a nestjs app and a nextjs app', async () => {
        const plugin = pm.getPlugin<
            ScaffoldTemplatePlugin<
                InitOptions | (AddOptions & AngularOptions) | (AddOptions & NestJSOptions)
            >
        >('libria:scaffold:ts-workspace');

        // 1. Init workspace
        await plugin.execute({
            name: 'my-workspace',
            subcommand: 'init',
            dryRun: false,
            force: false,
            gitInit: false,
            packageManager: 'npm',
        });

        const wsDir = path.join(tmp, 'my-workspace');
        expect(await fs.pathExists(path.join(wsDir, 'package.json'))).toBe(true);
        expect(await fs.pathExists(path.join(wsDir, 'tsconfig.base.json'))).toBe(true);

        // 2. Add ts-lib package
        const tsLibOptions: ExecuteOptions<AddOptions & TsLibOptions> = {
            name: 'my-lib',
            subcommand: 'add',
            dryRun: false,
            force: false,
            workspace: 'my-workspace',
            template: 'ts-lib',
            packageName: '@test/my-lib',
            description: 'A test library',
            version: '0.0.0',
            author: 'Test',
            githubRepo: 'test/my-lib',
            gitInit: false,
            install: false,
            packageManager: 'npm',
            basePath: 'packages',
        };
        await plugin.execute(tsLibOptions);

        const libDir = path.join(wsDir, 'packages', 'my-lib');
        expect(await fs.pathExists(path.join(libDir, 'package.json'))).toBe(true);
        expect(await fs.pathExists(path.join(libDir, 'src'))).toBe(true);

        // 3. Add angular app
        const ngOptions: ExecuteOptions<AddOptions & AngularOptions> = {
            workspace: 'my-workspace',
            template: 'angular',

            name: 'my-app',
            subcommand: 'add',
            version: '21',
            dryRun: false,
            force: false,
            style: 'scss',
            packageManager: 'npm',
            routing: true,
            ssr: false,
            standalone: true,
            strict: true,
            prefix: 'app',
            viewEncapsulation: 'Emulated',
            fileNameStyleGuide: '2025',
            testRunner: 'vitest',
            minimal: true,
            skipGit: true,
            skipInstall: true,
            skipTests: true,

            aiConfig: undefined,
            inlineStyle: false,
            zoneless: false,
            inlineTemplate: false,
            serverRouting: false,
            experimentalZoneless: false,

            basePath: 'packages',
        };
        await plugin.execute(ngOptions);

        const appDir = path.join(wsDir, 'packages', 'my-app');
        expect(await fs.pathExists(path.join(appDir, 'package.json'))).toBe(true);
        expect(await fs.pathExists(path.join(appDir, 'angular.json'))).toBe(true);

        // 4. Add nestjs app
        const nestOptions: ExecuteOptions<AddOptions & NestJSOptions> = {
            workspace: 'my-workspace',
            template: 'nestjs',

            name: 'my-api',
            subcommand: 'add',
            dryRun: false,
            force: false,
            version: '11',
            language: 'ts',
            packageManager: 'npm',
            strict: true,
            skipGit: true,
            skipInstall: true,

            basePath: 'packages',
        };
        await plugin.execute(nestOptions);

        const apiDir = path.join(wsDir, 'packages', 'my-api');
        expect(await fs.pathExists(path.join(apiDir, 'package.json'))).toBe(true);
        expect(await fs.pathExists(path.join(apiDir, 'tsconfig.json'))).toBe(true);

        // 5. Add nextjs app
        const nextOptions: ExecuteOptions<AddOptions & NextJSOptions> = {
            workspace: 'my-workspace',
            template: 'nextjs',

            name: 'my-nextjs',
            subcommand: 'add',
            dryRun: false,
            force: false,
            version: 'latest',
            language: 'ts',
            linter: 'eslint',
            bundler: 'turbopack',
            projectType: 'app',
            tailwind: true,
            packageManager: 'npm',
            srcDir: true,
            example: undefined,
            examplePath: undefined,
            importAlias: '@/*',
            reactCompiler: false,
            install: false,
            gitInit: false,

            basePath: 'packages',
        };
        await plugin.execute(nextOptions);

        const nextDir = path.join(wsDir, 'packages', 'my-nextjs');
        expect(await fs.pathExists(path.join(nextDir, 'package.json'))).toBe(true);
        expect(await fs.pathExists(path.join(nextDir, 'tsconfig.json'))).toBe(true);

        // Workspace package.json has all three packages
        const wsPkg = await fs.readJson(path.join(wsDir, 'package.json'));
        expect(wsPkg.workspaces).toContain('packages/my-lib');
        expect(wsPkg.workspaces).toContain('packages/my-app');
        expect(wsPkg.workspaces).toContain('packages/my-api');
        expect(wsPkg.workspaces).toContain('packages/my-nextjs');

        // Workspace tsconfig.json has all three references
        const wsTsconfig = parseJsonc(
            await fs.readFile(path.join(wsDir, 'tsconfig.json'), 'utf-8')
        );
        expect(wsTsconfig.references).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ path: 'packages/my-lib' }),
                expect.objectContaining({ path: 'packages/my-app' }),
                expect.objectContaining({ path: 'packages/my-api' }),
                expect.objectContaining({ path: 'packages/my-nextjs' }),
            ])
        );

        // All package tsconfigs extend workspace base
        const libTsconfig = parseJsonc(
            await fs.readFile(path.join(libDir, 'tsconfig.json'), 'utf-8')
        );
        expect(libTsconfig.extends).toContain('tsconfig.base.json');

        const appTsconfig = parseJsonc(
            await fs.readFile(path.join(appDir, 'tsconfig.json'), 'utf-8')
        );
        expect(appTsconfig.extends).toContain('tsconfig.base.json');

        const apiTsconfig = parseJsonc(
            await fs.readFile(path.join(apiDir, 'tsconfig.json'), 'utf-8')
        );
        expect(apiTsconfig.extends).toContain('tsconfig.base.json');

        const nextTsconfig = parseJsonc(
            await fs.readFile(path.join(nextDir, 'tsconfig.json'), 'utf-8')
        );
        expect(nextTsconfig.extends).toContain('tsconfig.base.json');
    }, 180_000);
});
