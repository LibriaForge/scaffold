import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import {definePlugin} from "@libria/plugin-loader";
import {SCAFFOLD_TEMPLATE_PLUGIN_TYPE, ScaffoldTemplatePlugin, ScaffoldTemplatePluginOptions} from "../../src";
import {input, confirm} from "@inquirer/prompts";
import {TsLibInitialOptions} from "./types";

const execAsync = promisify(exec);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILES_DIR = path.resolve(__dirname, 'files');
export default definePlugin<ScaffoldTemplatePlugin>(SCAFFOLD_TEMPLATE_PLUGIN_TYPE, 'ts-lib', {
    argument: 'ts-lib',
    async execute(options: ScaffoldTemplatePluginOptions): Promise<void> {
        const userOptions = await getInitialUserOptions(options);
        await generateProject(userOptions);
        await postProcess(userOptions);
    }
})

async function replacePlaceholders(targetDir: string, options: TsLibInitialOptions) {
    const { packageName, description, version, githubRepo, author } = options;

    const replacements: Record<string, string> = {
        '{PACKAGE_NAME}': packageName,
        '{DESCRIPTION}': description,
        '{VERSION}': version,
        '{GITHUB_REPO}': githubRepo,
        '{AUTHOR}': author,
    };

    async function replaceInFiles(folder: string) {
        const entries = await fs.readdir(folder);
        for (const entry of entries) {
            const fullPath = path.join(folder, entry);
            const stat = await fs.stat(fullPath);
            if (stat.isDirectory()) {
                await replaceInFiles(fullPath);
            } else if (/\.(ts|js|json|md|txt)$/i.test(entry)) {
                let content = await fs.readFile(fullPath, 'utf-8');
                for (const [placeholder, value] of Object.entries(replacements)) {
                    content = content.replaceAll(placeholder, value);
                }
                await fs.writeFile(fullPath, content, 'utf-8');
            }
        }
    }

    await replaceInFiles(targetDir);
}

async function generateProject(options: TsLibInitialOptions): Promise<void> {
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
    await replacePlaceholders(targetDir, options);

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
    for (const entry of entries) {
        const sourcePath = path.join(sourceDir, entry.name);
        const targetPath = path.join(targetDir, entry.name);

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


async function getInitialUserOptions(options: ScaffoldTemplatePluginOptions): Promise<TsLibInitialOptions> {
    const packageName = await input({
        message: 'Package name:',
        default: options.name,
    });

    const description = await input({
        message: 'Description:',
    });

    const version = await input({
        message: 'Version:',
        default: '0.1.0',
    });

    const author = await input({
        message: 'Author:',
    });

    const githubRepo = await input({
        message: 'GitHub repository (owner/repo):',
        default: `${author}/${packageName}`,
    });

    return {
        packageName,
        description,
        version,
        author,
        githubRepo,
        ...options,
    };
}

async function postProcess(options: TsLibInitialOptions): Promise<void> {
    const { name, dryRun } = options;
    const targetDir = path.resolve(process.cwd(), name);

    if (dryRun) {
        console.log('\n[dry-run] Skipping post-process steps.');
        return;
    }

    const runGitInit = await confirm({
        message: 'Initialize git repository?',
        default: true,
    });

    if (runGitInit) {
        try {
            console.log('Initializing git repository...');
            await execAsync('git init', { cwd: targetDir });
            console.log('Git repository initialized.');
        } catch (error) {
            console.error('Failed to initialize git repository:', (error as Error).message);
        }
    }

    const runNpmInstall = await confirm({
        message: 'Run npm install?',
        default: true,
    });

    if (runNpmInstall) {
        try {
            console.log('Installing dependencies (this may take a moment)...');
            await execAsync('npm install', { cwd: targetDir });
            console.log('Dependencies installed successfully.');
        } catch (error) {
            console.error('Failed to install dependencies:', (error as Error).message);
        }
    }

    console.log('\nAll done! Your project is ready.');
    console.log(`\n  cd ${name}`);
    if (!runNpmInstall) {
        console.log('  npm install');
    }
    console.log('  npm run build');
    console.log('  npm test');
}