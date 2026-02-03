import { exec } from 'child_process';
import { promisify } from 'util';
import { definePlugin } from '@libria/plugin-loader';
import {
    SCAFFOLD_TEMPLATE_PLUGIN_TYPE,
    ScaffoldTemplatePlugin,
    ScaffoldTemplatePluginOptions,
} from '../../src';
import { select, confirm } from '@inquirer/prompts';
import { NestJSOptions, NestJSPackageManager } from './types';

const execAsync = promisify(exec);

export default definePlugin<ScaffoldTemplatePlugin>(SCAFFOLD_TEMPLATE_PLUGIN_TYPE, 'nestjs', {
    argument: 'nestjs',
    async execute(options: ScaffoldTemplatePluginOptions): Promise<void> {
        const userOptions = await getUserOptions(options);
        await generateProject(userOptions);
    },
});

async function getUserOptions(options: ScaffoldTemplatePluginOptions): Promise<NestJSOptions> {
    const packageManager = (await select({
        message: 'Package manager:',
        choices: [
            { value: 'npm', name: 'npm' },
            { value: 'yarn', name: 'Yarn' },
            { value: 'pnpm', name: 'pnpm' },
        ],
        default: 'npm',
    })) as NestJSPackageManager;

    const strict = await confirm({
        message: 'Enable strict mode? (stricter TypeScript compiler options)',
        default: true,
    });

    const skipGit = await confirm({
        message: 'Skip git initialization?',
        default: false,
    });

    const skipInstall = await confirm({
        message: 'Skip package installation? (faster, run manually later)',
        default: false,
    });

    return {
        packageManager,
        strict,
        skipGit,
        skipInstall,
        ...options,
    };
}

async function generateProject(options: NestJSOptions): Promise<void> {
    const { name, dryRun, packageManager, strict, skipGit, skipInstall } = options;

    // Build the NestJS CLI command
    const args: string[] = ['npx', '@nestjs/cli@latest', 'new', name, `--package-manager=${packageManager}`];

    if (strict) {
        args.push('--strict');
    }

    if (skipGit) {
        args.push('--skip-git');
    }

    if (skipInstall) {
        args.push('--skip-install');
    }

    if (dryRun) {
        args.push('--dry-run');
    }

    const command = args.join(' ');

    console.log(`\nCreating NestJS project "${name}"...`);
    console.log(`Running: ${command}\n`);

    try {
        const { stdout, stderr } = await execAsync(command, {
            cwd: process.cwd(),
            maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large output
        });

        if (stdout) {
            console.log(stdout);
        }

        if (stderr && !stderr.includes('npm warn')) {
            console.error(stderr);
        }

        if (!dryRun) {
            console.log(`\nNestJS project "${name}" created successfully!`);
            console.log(`\nNext steps:`);
            console.log(`  cd ${name}`);
            if (skipInstall) {
                console.log(`  ${packageManager} install`);
            }
            console.log(`  ${packageManager}${packageManager === 'npm' ? ' run' : ''} start:dev`);
        }
    } catch (error) {
        const err = error as Error & { stdout?: string; stderr?: string };
        if (err.stdout) {
            console.log(err.stdout);
        }
        if (err.stderr) {
            console.error(err.stderr);
        }
        console.error(`\nFailed to create NestJS project: ${err.message}`);
        process.exit(1);
    }
}
