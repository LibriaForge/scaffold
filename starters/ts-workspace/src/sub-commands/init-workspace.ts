import { exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';

import { ExecuteOptions } from '@libria/scaffold-core';
import fs from 'fs-extra';

import { InitOptions } from '../types';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILES_DIR = path.resolve(__dirname, '..', 'template-files');
const execAsync = promisify(exec);

export async function initWorkspace(options: ExecuteOptions<InitOptions>) {
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

    if (dryRun) {
        console.log('\n[dry-run] No files were actually created.');
    } else {
        console.log(`\nProject '${name}' created successfully!`);
    }

    await initPostProcess(options);
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

async function initPostProcess(options: ExecuteOptions<InitOptions>): Promise<void> {
    const { name, dryRun, gitInit } = options;
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

    console.log('\nAll done! Your workspace is ready.');
}
