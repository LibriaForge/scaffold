import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useTempProject } from '../helpers/use-temp-project';

// Use vi.hoisted to properly hoist the mock variable before vi.mock runs
const { mockExecAsync } = vi.hoisted(() => {
    return {
        mockExecAsync: vi.fn().mockResolvedValue({ stdout: 'NestJS project created', stderr: '' }),
    };
});

// Mock child_process and util before imports
vi.mock('child_process', () => ({
    exec: vi.fn(),
}));

vi.mock('util', () => ({
    promisify: () => mockExecAsync,
}));

// Mock @inquirer/prompts
vi.mock('@inquirer/prompts', () => ({
    input: vi.fn(),
    confirm: vi.fn(),
    select: vi.fn(),
}));

// Import after mocking
import { select, confirm } from '@inquirer/prompts';
import nestjsPlugin from '../../templates/nestjs';

const mockedSelect = vi.mocked(select);
const mockedConfirm = vi.mocked(confirm);

describe('nestjs template', () => {
    let cleanup: () => Promise<void>;

    beforeEach(async () => {
        const temp = await useTempProject('nestjs');
        cleanup = temp.cleanup;

        vi.clearAllMocks();

        // Reset the exec mock to default resolved value
        mockExecAsync.mockResolvedValue({ stdout: 'NestJS project created', stderr: '' });
    });

    afterEach(async () => {
        await cleanup();
    });

    describe('plugin definition', () => {
        it('should have correct plugin type', () => {
            expect(nestjsPlugin.pluginType).toBe('scaffold-template');
        });

        it('should have correct name', () => {
            expect(nestjsPlugin.name).toBe('nestjs');
        });

        it('should have correct argument', () => {
            expect(nestjsPlugin.api.argument).toBe('nestjs');
        });

        it('should have execute function', () => {
            expect(typeof nestjsPlugin.api.execute).toBe('function');
        });
    });

    describe('getUserOptions', () => {
        beforeEach(() => {
            mockedSelect.mockResolvedValueOnce('npm'); // packageManager
            mockedConfirm
                .mockResolvedValueOnce(true) // strict
                .mockResolvedValueOnce(false) // skipGit
                .mockResolvedValueOnce(false); // skipInstall
        });

        it('should ask about package manager', async () => {
            await nestjsPlugin.api.execute({ name: 'test-nest' });

            expect(mockedSelect).toHaveBeenCalledWith(
                expect.objectContaining({ message: 'Package manager:' })
            );
        });

        it('should ask about strict mode', async () => {
            await nestjsPlugin.api.execute({ name: 'test-nest' });

            expect(mockedConfirm).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: 'Enable strict mode? (stricter TypeScript compiler options)',
                })
            );
        });

        it('should ask about skipping git', async () => {
            await nestjsPlugin.api.execute({ name: 'test-nest' });

            expect(mockedConfirm).toHaveBeenCalledWith(
                expect.objectContaining({ message: 'Skip git initialization?' })
            );
        });

        it('should ask about skipping install', async () => {
            await nestjsPlugin.api.execute({ name: 'test-nest' });

            expect(mockedConfirm).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: 'Skip package installation? (faster, run manually later)',
                })
            );
        });
    });

    describe('package manager choices', () => {
        it('should offer npm, yarn, and pnpm as package manager options', async () => {
            mockedSelect.mockResolvedValueOnce('npm');
            mockedConfirm
                .mockResolvedValueOnce(true)
                .mockResolvedValueOnce(false)
                .mockResolvedValueOnce(false);

            await nestjsPlugin.api.execute({ name: 'test-nest' });

            expect(mockedSelect).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: 'Package manager:',
                    choices: expect.arrayContaining([
                        expect.objectContaining({ value: 'npm' }),
                        expect.objectContaining({ value: 'yarn' }),
                        expect.objectContaining({ value: 'pnpm' }),
                    ]),
                })
            );
        });
    });

    describe('command generation', () => {
        it('should run npx @nestjs/cli new with correct arguments', async () => {
            mockedSelect.mockResolvedValueOnce('npm');
            mockedConfirm
                .mockResolvedValueOnce(true) // strict
                .mockResolvedValueOnce(false) // skipGit
                .mockResolvedValueOnce(false); // skipInstall

            await nestjsPlugin.api.execute({ name: 'my-api' });

            expect(mockExecAsync).toHaveBeenCalledWith(
                expect.stringContaining('npx @nestjs/cli@latest new my-api'),
                expect.any(Object)
            );
        });

        it('should use selected package manager', async () => {
            mockedSelect.mockResolvedValueOnce('yarn');
            mockedConfirm
                .mockResolvedValueOnce(true)
                .mockResolvedValueOnce(false)
                .mockResolvedValueOnce(false);

            await nestjsPlugin.api.execute({ name: 'my-api' });

            expect(mockExecAsync).toHaveBeenCalledWith(
                expect.stringContaining('--package-manager=yarn'),
                expect.any(Object)
            );
        });

        it('should include strict flag when enabled', async () => {
            mockedSelect.mockResolvedValueOnce('npm');
            mockedConfirm
                .mockResolvedValueOnce(true) // strict - yes
                .mockResolvedValueOnce(false)
                .mockResolvedValueOnce(false);

            await nestjsPlugin.api.execute({ name: 'my-api' });

            expect(mockExecAsync).toHaveBeenCalledWith(
                expect.stringContaining('--strict'),
                expect.any(Object)
            );
        });

        it('should not include strict flag when disabled', async () => {
            mockedSelect.mockResolvedValueOnce('npm');
            mockedConfirm
                .mockResolvedValueOnce(false) // strict - no
                .mockResolvedValueOnce(false)
                .mockResolvedValueOnce(false);

            await nestjsPlugin.api.execute({ name: 'my-api' });

            const call = mockExecAsync.mock.calls[0][0] as string;
            expect(call).not.toContain('--strict');
        });

        it('should include skip-git flag when requested', async () => {
            mockedSelect.mockResolvedValueOnce('npm');
            mockedConfirm
                .mockResolvedValueOnce(true)
                .mockResolvedValueOnce(true) // skipGit - yes
                .mockResolvedValueOnce(false);

            await nestjsPlugin.api.execute({ name: 'my-api' });

            expect(mockExecAsync).toHaveBeenCalledWith(
                expect.stringContaining('--skip-git'),
                expect.any(Object)
            );
        });

        it('should include skip-install flag when requested', async () => {
            mockedSelect.mockResolvedValueOnce('npm');
            mockedConfirm
                .mockResolvedValueOnce(true)
                .mockResolvedValueOnce(false)
                .mockResolvedValueOnce(true); // skipInstall - yes

            await nestjsPlugin.api.execute({ name: 'my-api' });

            expect(mockExecAsync).toHaveBeenCalledWith(
                expect.stringContaining('--skip-install'),
                expect.any(Object)
            );
        });

        it('should include dry-run flag when dryRun option is true', async () => {
            mockedSelect.mockResolvedValueOnce('npm');
            mockedConfirm
                .mockResolvedValueOnce(true)
                .mockResolvedValueOnce(false)
                .mockResolvedValueOnce(false);

            await nestjsPlugin.api.execute({ name: 'my-api', dryRun: true });

            expect(mockExecAsync).toHaveBeenCalledWith(
                expect.stringContaining('--dry-run'),
                expect.any(Object)
            );
        });

        it('should use pnpm package manager when selected', async () => {
            mockedSelect.mockResolvedValueOnce('pnpm');
            mockedConfirm
                .mockResolvedValueOnce(true)
                .mockResolvedValueOnce(false)
                .mockResolvedValueOnce(false);

            await nestjsPlugin.api.execute({ name: 'my-api' });

            expect(mockExecAsync).toHaveBeenCalledWith(
                expect.stringContaining('--package-manager=pnpm'),
                expect.any(Object)
            );
        });
    });
});
