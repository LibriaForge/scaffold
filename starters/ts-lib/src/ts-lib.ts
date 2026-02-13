import { exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';

import { definePlugin, PluginContext } from '@libria/plugin-loader';
import {
    ExecuteOptions,
    replacePlaceholders,
    SCAFFOLD_TEMPLATE_PLUGIN_TYPE,
    ScaffoldTemplatePlugin,
} from '@libria/scaffold-core';
import fs from 'fs-extra';

import { Options } from './types';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILES_DIR = path.resolve(__dirname, '..', 'template-files');

const execAsync = promisify(exec);

export default definePlugin<ScaffoldTemplatePlugin<Options>>({
    id: 'libria:scaffold:ts-lib',
    name: 'ts-lib',
    pluginType: SCAFFOLD_TEMPLATE_PLUGIN_TYPE,

    async create(_: PluginContext) {
        return {
            api: {
                argument: 'ts-lib',
                getOptions: async (initOptions): Promise<Options> => {
                    return {
                        packageName: {
                            flags: '--package-name',
                            description: 'Package name:',
                            defaultValue: initOptions.name,
                        },
                        description: {
                            flags: '--description',
                            description: 'Description:',
                        },
                        version: {
                            flags: '--version',
                            description: 'Version:',
                            defaultValue: '0.0.0',
                            required: true,
                        },
                        author: {
                            flags: '--author',
                            description: 'Author:',
                        },
                        githubRepo: {
                            flags: '--github-repo',
                            description: 'GitHub repository (owner/repo):',
                        },
                        gitInit: {
                            flags: '--git-init',
                            description: 'Initialize git repository?',
                            defaultValue: true,
                            required: false,
                        },
                        packageManager: {
                            flags: '--package-manager',
                            description: 'Package Manager (npm/yarn/pnpm):',
                            choices: ['npm', 'yarn', 'pnpm'],
                            defaultValue: 'npm',
                        },
                        install: {
                            flags: '--install',
                            description: 'Install dependencies?',
                            defaultValue: true,
                            required: false,
                        },
                    };
                },
                execute: async options => {
                    await generateProject(options);
                    await postProcess(options);
                },
            },
        };
    },
});

async function generateProject(options: ExecuteOptions<Options>): Promise<void> {
    const { name, dryRun, force } = options;
    const targetDir = path.resolve(process.cwd(), name);

    // Check if target directory exists
    if (await fs.pathExists(targetDir)) {
        if (!force) {
            console.error(`Directory '${name}' already exists. Use --force to overwrite.`);
            process.exit(1);
        }
        if (dryRun) {
            console.log(`[dry-run] Would remove existing directory: ${targetDir}`);
        } else {
            await fs.remove(targetDir);
            console.log(`Removed existing directory: ${targetDir}`);
        }
    }

    // Create target directory
    if (dryRun) {
        console.log(`[dry-run] Would create directory: ${targetDir}`);
    } else {
        await fs.ensureDir(targetDir);
        console.log(`Created directory: ${targetDir}`);
    }

    // Copy all files from files directory to target
    const entries = await fs.readdir(FILES_DIR, { withFileTypes: true });
    await copyEntries(FILES_DIR, targetDir, entries, dryRun);

    if (!dryRun) {
        await replacePlaceholders(targetDir, {
            '{PROJECT_NAME}': options.name,
            '{PACKAGE_NAME}': options.packageName,
            '{DESCRIPTION}': options.description,
            '{VERSION}': options.version,
            '{GITHUB_REPO}': options.githubRepo,
            '{AUTHOR}': options.author,
        });
    }

    if (dryRun) {
        console.log('\n[dry-run] No files were actually created.');
    } else {
        console.log(`\nProject '${name}' created successfully!`);
    }
}

async function copyEntries(
    sourceDir: string,
    targetDir: string,
    entries: fs.Dirent[],
    dryRun?: boolean
): Promise<void> {
    // Files that need to be renamed when copying (npm strips dotfiles like .gitignore)
    const RENAME_FILES: Record<string, string> = {
        gitignore: '.gitignore',
    };

    for (const entry of entries) {
        const sourcePath = path.join(sourceDir, entry.name);
        const targetName = RENAME_FILES[entry.name] ?? entry.name;
        const targetPath = path.join(targetDir, targetName);

        if (entry.isDirectory()) {
            if (dryRun) {
                console.log(`[dry-run] Would create directory: ${targetPath}`);
            } else {
                await fs.ensureDir(targetPath);
            }
            // Recursively copy directory contents
            const subEntries = await fs.readdir(sourcePath, { withFileTypes: true });
            await copyEntries(sourcePath, targetPath, subEntries, dryRun);
        } else if (entry.isFile()) {
            if (dryRun) {
                console.log(`[dry-run] Would copy: ${entry.name}`);
            } else {
                await fs.copy(sourcePath, targetPath);
                console.log(`Copied: ${entry.name}`);
            }
        }
    }
}

async function postProcess(options: ExecuteOptions<Options>): Promise<void> {
    const { name, dryRun, gitInit, install, packageManager } = options;
    const targetDir = path.resolve(process.cwd(), name);

    if (dryRun) {
        console.log('\n[dry-run] Skipping post-process steps.');
        return;
    }

    if (gitInit) {
        try {
            console.log('Initializing git repository...');
            await execAsync('git init', { cwd: targetDir });
            console.log('Git repository initialized.');
        } catch (error) {
            console.error('Failed to initialize git repository:', (error as Error).message);
        }
    }

    if (install) {
        try {
            console.log('Installing dependencies (this may take a moment)...');

            await execAsync(`${packageManager} install`, { cwd: targetDir });
            console.log('Dependencies installed successfully.');
        } catch (error) {
            console.error('Failed to install dependencies:', (error as Error).message);
        }
    }

    console.log('\nAll done! Your project is ready.');
    console.log(`\n  cd ${name}`);
    if (!install) {
        console.log(`  ${packageManager} install`);
    }
    console.log(`  ${packageManager} run build`);
    console.log(`  ${packageManager} test`);
}
