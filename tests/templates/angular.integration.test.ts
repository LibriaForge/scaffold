import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useTempProject } from '../helpers/use-temp-project';
import path from 'path';
import fs from 'fs/promises';

// Mock @inquirer/prompts to auto-answer questions
vi.mock('@inquirer/prompts', () => ({
    input: vi.fn(),
    confirm: vi.fn(),
    select: vi.fn(),
}));

import { select, confirm } from '@inquirer/prompts';
import angularPlugin from '../../templates/angular';

const mockedSelect = vi.mocked(select);
const mockedConfirm = vi.mocked(confirm);

describe('angular template integration', () => {
    let cleanup: () => Promise<void>;
    let tmpDir: string;
    let originalCwd: string;

    beforeEach(async () => {
        const temp = await useTempProject('angular-integration');
        cleanup = temp.cleanup;
        tmpDir = temp.tmp;
        originalCwd = process.cwd();

        // Change to temp directory so project is created there
        process.chdir(tmpDir);

        vi.clearAllMocks();
    });

    afterEach(async () => {
        // Restore original working directory
        process.chdir(originalCwd);
        await cleanup();
    });

    it('should create a real Angular 19 project with files', async () => {
        const projectName = 'test-angular-app';

        // Setup mock responses
        mockedSelect
            .mockResolvedValueOnce('19')   // version - use specific version 19
            .mockResolvedValueOnce('css'); // style - use css for faster generation
        mockedConfirm
            .mockResolvedValueOnce(false)  // routing - no for faster generation
            .mockResolvedValueOnce(false)  // ssr - no
            .mockResolvedValueOnce(true)   // skipGit - yes
            .mockResolvedValueOnce(true);  // skipInstall - yes

        // Execute the plugin - this actually runs npx @angular/cli@19
        await angularPlugin.api.execute({ name: projectName });

        const projectDir = path.join(tmpDir, projectName);

        // Verify project directory was created
        const dirStat = await fs.stat(projectDir);
        expect(dirStat.isDirectory()).toBe(true);

        // Verify key Angular files exist
        // Note: Angular 19 uses .component.ts naming, Angular 20+ uses shorter names (app.ts)
        const expectedFiles = [
            'angular.json',
            'package.json',
            'tsconfig.json',
            'src/main.ts',
            'src/index.html',
            'src/styles.css',
            'src/app/app.component.ts',
            'src/app/app.component.html',
            'src/app/app.config.ts',
        ];

        for (const file of expectedFiles) {
            const filePath = path.join(projectDir, file);
            const exists = await fs.stat(filePath).then(() => true).catch(() => false);
            expect(exists, `Expected ${file} to exist`).toBe(true);
        }

        // Verify package.json has Angular dependencies
        const packageJsonPath = path.join(projectDir, 'package.json');
        const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));

        expect(packageJson.name).toBe(projectName);
        expect(packageJson.dependencies['@angular/core']).toBeDefined();
        expect(packageJson.dependencies['@angular/common']).toBeDefined();

        // Verify Angular 19 was used (version should start with ^19 or ~19)
        const angularCoreVersion = packageJson.dependencies['@angular/core'];
        expect(angularCoreVersion).toMatch(/^[\^~]?19\./);

        // Verify no node_modules (since we skipped install)
        const nodeModulesExists = await fs.stat(path.join(projectDir, 'node_modules'))
            .then(() => true)
            .catch(() => false);
        expect(nodeModulesExists).toBe(false);

        // Verify no .git directory (since we skipped git)
        const gitExists = await fs.stat(path.join(projectDir, '.git'))
            .then(() => true)
            .catch(() => false);
        expect(gitExists).toBe(false);
    }, 120000); // 2 minute timeout for Angular CLI

    it('should create a real Angular 20 project with files', async () => {
        const projectName = 'test-angular-20-app';

        // Setup mock responses
        mockedSelect
            .mockResolvedValueOnce('20')   // version - use specific version 20
            .mockResolvedValueOnce('css'); // style - use css for faster generation
        mockedConfirm
            .mockResolvedValueOnce(false)  // routing - no for faster generation
            .mockResolvedValueOnce(false)  // ssr - no
            .mockResolvedValueOnce(true)   // skipGit - yes
            .mockResolvedValueOnce(true);  // skipInstall - yes

        // Execute the plugin - this actually runs npx @angular/cli@20
        await angularPlugin.api.execute({ name: projectName });

        const projectDir = path.join(tmpDir, projectName);

        // Verify project directory was created
        const dirStat = await fs.stat(projectDir);
        expect(dirStat.isDirectory()).toBe(true);

        // Verify key Angular files exist
        // Note: Angular 20 uses shorter filenames (app.ts instead of app.component.ts)
        const expectedFiles = [
            'angular.json',
            'package.json',
            'tsconfig.json',
            'src/main.ts',
            'src/index.html',
            'src/styles.css',
            'src/app/app.ts',
            'src/app/app.html',
            'src/app/app.config.ts',
        ];

        for (const file of expectedFiles) {
            const filePath = path.join(projectDir, file);
            const exists = await fs.stat(filePath).then(() => true).catch(() => false);
            expect(exists, `Expected ${file} to exist`).toBe(true);
        }

        // Verify package.json has Angular dependencies
        const packageJsonPath = path.join(projectDir, 'package.json');
        const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));

        expect(packageJson.name).toBe(projectName);
        expect(packageJson.dependencies['@angular/core']).toBeDefined();
        expect(packageJson.dependencies['@angular/common']).toBeDefined();

        // Verify Angular 20 was used (version should start with ^20 or ~20)
        const angularCoreVersion = packageJson.dependencies['@angular/core'];
        expect(angularCoreVersion).toMatch(/^[\^~]?20\./);

        // Verify no node_modules (since we skipped install)
        const nodeModulesExists = await fs.stat(path.join(projectDir, 'node_modules'))
            .then(() => true)
            .catch(() => false);
        expect(nodeModulesExists).toBe(false);

        // Verify no .git directory (since we skipped git)
        const gitExists = await fs.stat(path.join(projectDir, '.git'))
            .then(() => true)
            .catch(() => false);
        expect(gitExists).toBe(false);
    }, 120000); // 2 minute timeout for Angular CLI
});
