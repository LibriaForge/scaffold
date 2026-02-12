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

function parseJsonc(text: string): any {
    return JSON.parse(text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, ''));
}

async function loadPlugins(): Promise<PluginManager> {
    const pm = new PluginManager();
    await pm.loadPlugins([
        path.join(STARTERS_DIR, 'ts-lib'),
        path.join(STARTERS_DIR, 'angular'),
        path.join(STARTERS_DIR, 'nestjs'),
        path.join(STARTERS_DIR, 'ts-workspace'),
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

    it('should init a workspace, add a ts-lib, an angular app, and a nestjs app', async () => {
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
        };
        await plugin.execute(nestOptions);

        const apiDir = path.join(wsDir, 'packages', 'my-api');
        expect(await fs.pathExists(path.join(apiDir, 'package.json'))).toBe(true);
        expect(await fs.pathExists(path.join(apiDir, 'tsconfig.json'))).toBe(true);

        // Workspace package.json has all three packages
        const wsPkg = await fs.readJson(path.join(wsDir, 'package.json'));
        expect(wsPkg.workspaces).toContain('packages/my-lib');
        expect(wsPkg.workspaces).toContain('packages/my-app');
        expect(wsPkg.workspaces).toContain('packages/my-api');

        // Workspace tsconfig.json has all three references
        const wsTsconfig = parseJsonc(
            await fs.readFile(path.join(wsDir, 'tsconfig.json'), 'utf-8')
        );
        expect(wsTsconfig.references).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ path: 'packages/my-lib' }),
                expect.objectContaining({ path: 'packages/my-app' }),
                expect.objectContaining({ path: 'packages/my-api' }),
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
    }, 180_000);
});
