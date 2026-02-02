import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useTempProject } from '../helpers/use-temp-project';

// Use vi.hoisted to properly hoist the mock variable before vi.mock runs
const { mockExecAsync } = vi.hoisted(() => {
    return {
        mockExecAsync: vi.fn().mockResolvedValue({ stdout: 'Angular project created', stderr: '' }),
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
import angularPlugin from '../../templates/angular';

const mockedSelect = vi.mocked(select);
const mockedConfirm = vi.mocked(confirm);

describe('angular template', () => {
    let cleanup: () => Promise<void>;
    let tmpDir: string;

    beforeEach(async () => {
        const temp = await useTempProject('angular');
        cleanup = temp.cleanup;
        tmpDir = temp.tmp;

        vi.clearAllMocks();

        // Reset the exec mock to default resolved value
        mockExecAsync.mockResolvedValue({ stdout: 'Angular project created', stderr: '' });
    });

    afterEach(async () => {
        await cleanup();
    });

    describe('plugin definition', () => {
        it('should have correct plugin type', () => {
            expect(angularPlugin.pluginType).toBe('scaffold-template');
        });

        it('should have correct name', () => {
            expect(angularPlugin.name).toBe('angular');
        });

        it('should have correct argument', () => {
            expect(angularPlugin.api.argument).toBe('angular');
        });

        it('should have execute function', () => {
            expect(typeof angularPlugin.api.execute).toBe('function');
        });
    });

    describe('getUserOptions', () => {
        beforeEach(() => {
            mockedSelect
                .mockResolvedValueOnce('latest')  // version
                .mockResolvedValueOnce('scss');   // style
            mockedConfirm
                .mockResolvedValueOnce(true)   // routing
                .mockResolvedValueOnce(false)  // ssr
                .mockResolvedValueOnce(false)  // skipGit
                .mockResolvedValueOnce(false); // skipInstall
        });

        it('should ask about Angular version', async () => {
            await angularPlugin.api.execute({ name: 'test-angular' });

            expect(mockedSelect).toHaveBeenCalledWith(
                expect.objectContaining({ message: 'Angular version:' })
            );
        });

        it('should ask about stylesheet format', async () => {
            await angularPlugin.api.execute({ name: 'test-angular' });

            expect(mockedSelect).toHaveBeenCalledWith(
                expect.objectContaining({ message: 'Stylesheet format:' })
            );
        });

        it('should ask about routing', async () => {
            await angularPlugin.api.execute({ name: 'test-angular' });

            expect(mockedConfirm).toHaveBeenCalledWith(
                expect.objectContaining({ message: 'Add routing?' })
            );
        });

        it('should ask about SSR', async () => {
            await angularPlugin.api.execute({ name: 'test-angular' });

            expect(mockedConfirm).toHaveBeenCalledWith(
                expect.objectContaining({ message: 'Enable Server-Side Rendering (SSR)?' })
            );
        });

        it('should ask about skipping git', async () => {
            await angularPlugin.api.execute({ name: 'test-angular' });

            expect(mockedConfirm).toHaveBeenCalledWith(
                expect.objectContaining({ message: 'Skip git initialization?' })
            );
        });

        it('should ask about skipping install', async () => {
            await angularPlugin.api.execute({ name: 'test-angular' });

            expect(mockedConfirm).toHaveBeenCalledWith(
                expect.objectContaining({ message: 'Skip npm install? (faster, run manually later)' })
            );
        });
    });

    describe('version choices', () => {
        it('should offer latest and last 4 major versions', async () => {
            mockedSelect
                .mockResolvedValueOnce('latest')
                .mockResolvedValueOnce('css');
            mockedConfirm
                .mockResolvedValueOnce(true)
                .mockResolvedValueOnce(false)
                .mockResolvedValueOnce(false)
                .mockResolvedValueOnce(false);

            await angularPlugin.api.execute({ name: 'test-angular' });

            expect(mockedSelect).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: 'Angular version:',
                    choices: expect.arrayContaining([
                        expect.objectContaining({ value: 'latest' }),
                        expect.objectContaining({ value: '20' }),
                        expect.objectContaining({ value: '19' }),
                        expect.objectContaining({ value: '18' }),
                        expect.objectContaining({ value: '17' }),
                        expect.objectContaining({ value: '16' }),
                    ])
                })
            );
        });
    });

    describe('style choices', () => {
        it('should offer scss, css, sass, and less as style options', async () => {
            mockedSelect
                .mockResolvedValueOnce('latest')
                .mockResolvedValueOnce('css');
            mockedConfirm
                .mockResolvedValueOnce(true)
                .mockResolvedValueOnce(false)
                .mockResolvedValueOnce(false)
                .mockResolvedValueOnce(false);

            await angularPlugin.api.execute({ name: 'test-angular' });

            expect(mockedSelect).toHaveBeenCalledWith(
                expect.objectContaining({
                    choices: expect.arrayContaining([
                        expect.objectContaining({ value: 'scss' }),
                        expect.objectContaining({ value: 'css' }),
                        expect.objectContaining({ value: 'sass' }),
                        expect.objectContaining({ value: 'less' }),
                    ])
                })
            );
        });
    });

    describe('command generation', () => {
        it('should run npx @angular/cli new with correct arguments', async () => {
            mockedSelect
                .mockResolvedValueOnce('latest')
                .mockResolvedValueOnce('scss');
            mockedConfirm
                .mockResolvedValueOnce(true)   // routing
                .mockResolvedValueOnce(false)  // ssr
                .mockResolvedValueOnce(false)  // skipGit
                .mockResolvedValueOnce(false); // skipInstall

            await angularPlugin.api.execute({ name: 'my-app' });

            expect(mockExecAsync).toHaveBeenCalledWith(
                expect.stringContaining('npx @angular/cli@latest new my-app'),
                expect.any(Object)
            );
        });

        it('should use specific version when selected', async () => {
            mockedSelect
                .mockResolvedValueOnce('19')
                .mockResolvedValueOnce('scss');
            mockedConfirm
                .mockResolvedValueOnce(true)
                .mockResolvedValueOnce(false)
                .mockResolvedValueOnce(false)
                .mockResolvedValueOnce(false);

            await angularPlugin.api.execute({ name: 'my-app' });

            expect(mockExecAsync).toHaveBeenCalledWith(
                expect.stringContaining('npx @angular/cli@19 new my-app'),
                expect.any(Object)
            );
        });

        it('should include style option in command', async () => {
            mockedSelect
                .mockResolvedValueOnce('latest')
                .mockResolvedValueOnce('less');
            mockedConfirm
                .mockResolvedValueOnce(true)
                .mockResolvedValueOnce(false)
                .mockResolvedValueOnce(false)
                .mockResolvedValueOnce(false);

            await angularPlugin.api.execute({ name: 'my-app' });

            expect(mockExecAsync).toHaveBeenCalledWith(
                expect.stringContaining('--style=less'),
                expect.any(Object)
            );
        });

        it('should include routing flag when enabled', async () => {
            mockedSelect
                .mockResolvedValueOnce('latest')
                .mockResolvedValueOnce('scss');
            mockedConfirm
                .mockResolvedValueOnce(true)   // routing - yes
                .mockResolvedValueOnce(false)
                .mockResolvedValueOnce(false)
                .mockResolvedValueOnce(false);

            await angularPlugin.api.execute({ name: 'my-app' });

            expect(mockExecAsync).toHaveBeenCalledWith(
                expect.stringContaining('--routing'),
                expect.any(Object)
            );
        });

        it('should include skip-git flag when requested', async () => {
            mockedSelect
                .mockResolvedValueOnce('latest')
                .mockResolvedValueOnce('scss');
            mockedConfirm
                .mockResolvedValueOnce(true)
                .mockResolvedValueOnce(false)
                .mockResolvedValueOnce(true)   // skipGit - yes
                .mockResolvedValueOnce(false);

            await angularPlugin.api.execute({ name: 'my-app' });

            expect(mockExecAsync).toHaveBeenCalledWith(
                expect.stringContaining('--skip-git'),
                expect.any(Object)
            );
        });

        it('should include skip-install flag when requested', async () => {
            mockedSelect
                .mockResolvedValueOnce('latest')
                .mockResolvedValueOnce('scss');
            mockedConfirm
                .mockResolvedValueOnce(true)
                .mockResolvedValueOnce(false)
                .mockResolvedValueOnce(false)
                .mockResolvedValueOnce(true);  // skipInstall - yes

            await angularPlugin.api.execute({ name: 'my-app' });

            expect(mockExecAsync).toHaveBeenCalledWith(
                expect.stringContaining('--skip-install'),
                expect.any(Object)
            );
        });

        it('should include dry-run flag when dryRun option is true', async () => {
            mockedSelect
                .mockResolvedValueOnce('latest')
                .mockResolvedValueOnce('scss');
            mockedConfirm
                .mockResolvedValueOnce(true)
                .mockResolvedValueOnce(false)
                .mockResolvedValueOnce(false)
                .mockResolvedValueOnce(false);

            await angularPlugin.api.execute({ name: 'my-app', dryRun: true });

            expect(mockExecAsync).toHaveBeenCalledWith(
                expect.stringContaining('--dry-run'),
                expect.any(Object)
            );
        });
    });
});
