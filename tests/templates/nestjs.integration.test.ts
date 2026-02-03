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
import nestjsPlugin from '../../templates/nestjs';

const mockedSelect = vi.mocked(select);
const mockedConfirm = vi.mocked(confirm);

describe('nestjs template integration', () => {
    let cleanup: () => Promise<void>;
    let tmpDir: string;
    let originalCwd: string;

    beforeEach(async () => {
        const temp = await useTempProject('nestjs-integration');
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

    it('should create a real NestJS project with files', async () => {
        const projectName = 'test-nest-app';

        // Setup mock responses
        mockedSelect.mockResolvedValueOnce('npm'); // packageManager
        mockedConfirm
            .mockResolvedValueOnce(true) // strict
            .mockResolvedValueOnce(true) // skipGit - yes for faster test
            .mockResolvedValueOnce(true); // skipInstall - yes for faster test

        // Execute the plugin - this actually runs npx @nestjs/cli@latest
        await nestjsPlugin.api.execute({ name: projectName });

        const projectDir = path.join(tmpDir, projectName);

        // Verify project directory was created
        const dirStat = await fs.stat(projectDir);
        expect(dirStat.isDirectory()).toBe(true);

        // Verify key NestJS files exist
        const expectedFiles = [
            'nest-cli.json',
            'package.json',
            'tsconfig.json',
            'tsconfig.build.json',
            'src/main.ts',
            'src/app.module.ts',
            'src/app.controller.ts',
            'src/app.service.ts',
            'src/app.controller.spec.ts',
            'test/jest-e2e.json',
            'test/app.e2e-spec.ts',
        ];

        for (const file of expectedFiles) {
            const filePath = path.join(projectDir, file);
            const exists = await fs
                .stat(filePath)
                .then(() => true)
                .catch(() => false);
            expect(exists, `Expected ${file} to exist`).toBe(true);
        }

        // Verify package.json has NestJS dependencies
        const packageJsonPath = path.join(projectDir, 'package.json');
        const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));

        expect(packageJson.name).toBe(projectName);
        expect(packageJson.dependencies['@nestjs/core']).toBeDefined();
        expect(packageJson.dependencies['@nestjs/common']).toBeDefined();
        expect(packageJson.dependencies['@nestjs/platform-express']).toBeDefined();

        // Verify no node_modules (since we skipped install)
        const nodeModulesExists = await fs
            .stat(path.join(projectDir, 'node_modules'))
            .then(() => true)
            .catch(() => false);
        expect(nodeModulesExists).toBe(false);

        // Verify no .git directory (since we skipped git)
        const gitExists = await fs
            .stat(path.join(projectDir, '.git'))
            .then(() => true)
            .catch(() => false);
        expect(gitExists).toBe(false);
    }, 120000); // 2 minute timeout for NestJS CLI

    it('should create NestJS project with strict mode enabled', async () => {
        const projectName = 'test-nest-strict';

        // Setup mock responses
        mockedSelect.mockResolvedValueOnce('npm'); // packageManager
        mockedConfirm
            .mockResolvedValueOnce(true) // strict - yes
            .mockResolvedValueOnce(true) // skipGit
            .mockResolvedValueOnce(true); // skipInstall

        await nestjsPlugin.api.execute({ name: projectName });

        const projectDir = path.join(tmpDir, projectName);

        // Verify tsconfig.json has strict mode
        const tsconfigPath = path.join(projectDir, 'tsconfig.json');
        const tsconfig = JSON.parse(await fs.readFile(tsconfigPath, 'utf-8'));

        // Strict mode enables stricter compiler options
        expect(tsconfig.compilerOptions.strictNullChecks).toBe(true);
        expect(tsconfig.compilerOptions.noImplicitAny).toBe(true);
        expect(tsconfig.compilerOptions.strictBindCallApply).toBe(true);
        expect(tsconfig.compilerOptions.forceConsistentCasingInFileNames).toBe(true);
        expect(tsconfig.compilerOptions.noFallthroughCasesInSwitch).toBe(true);
    }, 120000);

    it('should create NestJS project with yarn as package manager', async () => {
        const projectName = 'test-nest-yarn';

        // Setup mock responses
        mockedSelect.mockResolvedValueOnce('yarn'); // packageManager - yarn
        mockedConfirm
            .mockResolvedValueOnce(false) // strict
            .mockResolvedValueOnce(true) // skipGit
            .mockResolvedValueOnce(true); // skipInstall

        await nestjsPlugin.api.execute({ name: projectName });

        const projectDir = path.join(tmpDir, projectName);

        // Verify project was created
        const dirStat = await fs.stat(projectDir);
        expect(dirStat.isDirectory()).toBe(true);

        // Verify package.json exists
        const packageJsonPath = path.join(projectDir, 'package.json');
        const exists = await fs
            .stat(packageJsonPath)
            .then(() => true)
            .catch(() => false);
        expect(exists).toBe(true);
    }, 120000);
});
