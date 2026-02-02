import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'path';
import fs from 'fs-extra';
import { useTempProject } from '../helpers/use-temp-project';

// Mock @inquirer/prompts
vi.mock('@inquirer/prompts', () => ({
    input: vi.fn(),
    confirm: vi.fn(),
    select: vi.fn(),
}));

// Import after mocking
import { input, confirm } from '@inquirer/prompts';
import tsLibPlugin from '../../templates/ts-lib';

const mockedInput = vi.mocked(input);
const mockedConfirm = vi.mocked(confirm);

describe('ts-lib template', () => {
    let cleanup: () => Promise<void>;
    let tmpDir: string;

    beforeEach(async () => {
        const temp = await useTempProject('ts-lib');
        cleanup = temp.cleanup;
        tmpDir = temp.tmp;

        // Reset all mocks completely
        vi.resetAllMocks();
    });

    afterEach(async () => {
        await cleanup();
    });

    describe('plugin definition', () => {
        it('should have correct plugin type', () => {
            expect(tsLibPlugin.pluginType).toBe('scaffold-template');
        });

        it('should have correct name', () => {
            expect(tsLibPlugin.name).toBe('ts-lib');
        });

        it('should have correct argument', () => {
            expect(tsLibPlugin.api.argument).toBe('ts-lib');
        });

        it('should have execute function', () => {
            expect(typeof tsLibPlugin.api.execute).toBe('function');
        });
    });

    describe('generateProject', () => {
        beforeEach(() => {
            // Mock user inputs
            mockedInput
                .mockResolvedValueOnce('my-test-package')  // packageName
                .mockResolvedValueOnce('A test description')  // description
                .mockResolvedValueOnce('1.0.0')  // version
                .mockResolvedValueOnce('testauthor')  // author
                .mockResolvedValueOnce('testauthor/my-test-package');  // githubRepo

            // Mock post-process confirmations (decline both)
            mockedConfirm
                .mockResolvedValueOnce(false)  // git init
                .mockResolvedValueOnce(false);  // npm install
        });

        it('should create project directory', async () => {
            await tsLibPlugin.api.execute({ name: 'test-project' });

            const projectDir = path.join(tmpDir, 'test-project');
            expect(await fs.pathExists(projectDir)).toBe(true);
        });

        it('should copy all template files', async () => {
            await tsLibPlugin.api.execute({ name: 'test-project' });

            const projectDir = path.join(tmpDir, 'test-project');

            // Check root files
            expect(await fs.pathExists(path.join(projectDir, 'package.json'))).toBe(true);
            expect(await fs.pathExists(path.join(projectDir, 'tsconfig.json'))).toBe(true);
            expect(await fs.pathExists(path.join(projectDir, 'tsdown.config.ts'))).toBe(true);
            expect(await fs.pathExists(path.join(projectDir, 'vitest.config.ts'))).toBe(true);
            expect(await fs.pathExists(path.join(projectDir, 'README.md'))).toBe(true);
            expect(await fs.pathExists(path.join(projectDir, '.gitignore'))).toBe(true);
            expect(await fs.pathExists(path.join(projectDir, '.prettierrc'))).toBe(true);
        });

        it('should create src directory with index.ts', async () => {
            await tsLibPlugin.api.execute({ name: 'test-project' });

            const srcIndex = path.join(tmpDir, 'test-project', 'src', 'index.ts');
            expect(await fs.pathExists(srcIndex)).toBe(true);

            const content = await fs.readFile(srcIndex, 'utf-8');
            expect(content).toContain('export function add');
        });

        it('should create tests directory with test file', async () => {
            await tsLibPlugin.api.execute({ name: 'test-project' });

            const testFile = path.join(tmpDir, 'test-project', 'tests', 'my.test.ts');
            expect(await fs.pathExists(testFile)).toBe(true);

            const content = await fs.readFile(testFile, 'utf-8');
            expect(content).toContain('describe');
            expect(content).toContain('vitest');
        });
    });

    describe('placeholder replacement', () => {
        beforeEach(() => {
            mockedInput
                .mockResolvedValueOnce('@myorg/awesome-lib')  // packageName
                .mockResolvedValueOnce('An awesome library')  // description
                .mockResolvedValueOnce('2.0.0')  // version
                .mockResolvedValueOnce('myorg')  // author
                .mockResolvedValueOnce('myorg/awesome-lib');  // githubRepo

            mockedConfirm
                .mockResolvedValueOnce(false)
                .mockResolvedValueOnce(false);
        });

        it('should replace {PACKAGE_NAME} in package.json', async () => {
            await tsLibPlugin.api.execute({ name: 'test-project' });

            const packageJson = await fs.readJson(path.join(tmpDir, 'test-project', 'package.json'));
            expect(packageJson.name).toBe('@myorg/awesome-lib');
        });

        it('should replace {DESCRIPTION} in package.json', async () => {
            await tsLibPlugin.api.execute({ name: 'test-project' });

            const packageJson = await fs.readJson(path.join(tmpDir, 'test-project', 'package.json'));
            expect(packageJson.description).toBe('An awesome library');
        });

        it('should replace {VERSION} in package.json', async () => {
            await tsLibPlugin.api.execute({ name: 'test-project' });

            const packageJson = await fs.readJson(path.join(tmpDir, 'test-project', 'package.json'));
            expect(packageJson.version).toBe('2.0.0');
        });

        it('should replace {AUTHOR} in package.json', async () => {
            await tsLibPlugin.api.execute({ name: 'test-project' });

            const packageJson = await fs.readJson(path.join(tmpDir, 'test-project', 'package.json'));
            expect(packageJson.author).toBe('myorg');
        });

        it('should replace {GITHUB_REPO} in package.json', async () => {
            await tsLibPlugin.api.execute({ name: 'test-project' });

            const packageJson = await fs.readJson(path.join(tmpDir, 'test-project', 'package.json'));
            expect(packageJson.repository.url).toBe('git+https://github.com/myorg/awesome-lib.git');
            expect(packageJson.bugs.url).toBe('https://github.com/myorg/awesome-lib/issues');
            expect(packageJson.homepage).toBe('https://github.com/myorg/awesome-lib#readme');
        });

        it('should replace placeholders in README.md', async () => {
            await tsLibPlugin.api.execute({ name: 'test-project' });

            const readme = await fs.readFile(path.join(tmpDir, 'test-project', 'README.md'), 'utf-8');
            expect(readme).toContain('# @myorg/awesome-lib');
            expect(readme).toContain('An awesome library');
        });
    });

    describe('force option', () => {
        beforeEach(() => {
            mockedInput
                .mockResolvedValueOnce('my-package')
                .mockResolvedValueOnce('Description')
                .mockResolvedValueOnce('1.0.0')
                .mockResolvedValueOnce('author')
                .mockResolvedValueOnce('author/my-package');

            mockedConfirm
                .mockResolvedValueOnce(false)
                .mockResolvedValueOnce(false);
        });

        it('should overwrite existing directory when force is true', async () => {
            const projectDir = path.join(tmpDir, 'test-project');

            // Create existing directory with a file
            await fs.ensureDir(projectDir);
            await fs.writeFile(path.join(projectDir, 'old-file.txt'), 'old content');

            // Reset mocks for second call
            mockedInput
                .mockResolvedValueOnce('my-package')
                .mockResolvedValueOnce('Description')
                .mockResolvedValueOnce('1.0.0')
                .mockResolvedValueOnce('author')
                .mockResolvedValueOnce('author/my-package');
            mockedConfirm
                .mockResolvedValueOnce(false)
                .mockResolvedValueOnce(false);

            await tsLibPlugin.api.execute({ name: 'test-project', force: true });

            // Old file should be gone
            expect(await fs.pathExists(path.join(projectDir, 'old-file.txt'))).toBe(false);
            // New files should exist
            expect(await fs.pathExists(path.join(projectDir, 'package.json'))).toBe(true);
        });
    });

    describe('dryRun option', () => {
        beforeEach(() => {
            mockedInput
                .mockResolvedValueOnce('my-package')
                .mockResolvedValueOnce('Description')
                .mockResolvedValueOnce('1.0.0')
                .mockResolvedValueOnce('author')
                .mockResolvedValueOnce('author/my-package');
        });

        it('should not create any files when dryRun is true', async () => {
            await tsLibPlugin.api.execute({ name: 'test-project', dryRun: true });

            const projectDir = path.join(tmpDir, 'test-project');
            expect(await fs.pathExists(projectDir)).toBe(false);
        });

        it('should not call post-process confirmations when dryRun is true', async () => {
            await tsLibPlugin.api.execute({ name: 'test-project', dryRun: true });

            expect(mockedConfirm).not.toHaveBeenCalled();
        });
    });

    describe('postProcess', () => {
        it('should ask about git init', async () => {
            mockedInput
                .mockResolvedValueOnce('my-package')
                .mockResolvedValueOnce('Description')
                .mockResolvedValueOnce('1.0.0')
                .mockResolvedValueOnce('author')
                .mockResolvedValueOnce('author/my-package');
            mockedConfirm
                .mockResolvedValueOnce(false)  // git init - no
                .mockResolvedValueOnce(false);  // npm install - no

            await tsLibPlugin.api.execute({ name: 'test-project' });

            expect(mockedConfirm).toHaveBeenCalledWith(
                expect.objectContaining({ message: 'Initialize git repository?' })
            );
        });

        it('should ask about npm install', async () => {
            mockedInput
                .mockResolvedValueOnce('my-package')
                .mockResolvedValueOnce('Description')
                .mockResolvedValueOnce('1.0.0')
                .mockResolvedValueOnce('author')
                .mockResolvedValueOnce('author/my-package');
            mockedConfirm
                .mockResolvedValueOnce(false)
                .mockResolvedValueOnce(false);

            await tsLibPlugin.api.execute({ name: 'test-project' });

            expect(mockedConfirm).toHaveBeenCalledWith(
                expect.objectContaining({ message: 'Run npm install?' })
            );
        });

        it('should initialize git when user confirms', async () => {
            mockedInput
                .mockResolvedValueOnce('my-package')
                .mockResolvedValueOnce('Description')
                .mockResolvedValueOnce('1.0.0')
                .mockResolvedValueOnce('author')
                .mockResolvedValueOnce('author/my-package');
            mockedConfirm
                .mockResolvedValueOnce(true)  // git init - yes
                .mockResolvedValueOnce(false);  // npm install - no

            await tsLibPlugin.api.execute({ name: 'test-project-git-yes' });

            const gitDir = path.join(tmpDir, 'test-project-git-yes', '.git');
            expect(await fs.pathExists(gitDir)).toBe(true);
        });

        it('should not initialize git when user declines', async () => {
            mockedInput
                .mockResolvedValueOnce('my-package')
                .mockResolvedValueOnce('Description')
                .mockResolvedValueOnce('1.0.0')
                .mockResolvedValueOnce('author')
                .mockResolvedValueOnce('author/my-package');
            mockedConfirm
                .mockResolvedValueOnce(false)  // git init - no
                .mockResolvedValueOnce(false);  // npm install - no

            await tsLibPlugin.api.execute({ name: 'test-project-git-no' });

            const gitDir = path.join(tmpDir, 'test-project-git-no', '.git');
            expect(await fs.pathExists(gitDir)).toBe(false);
        });
    });
});
