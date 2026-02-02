import { exec } from 'child_process';
import { promisify } from 'util';
import {definePlugin} from "@libria/plugin-loader";
import {SCAFFOLD_TEMPLATE_PLUGIN_TYPE, ScaffoldTemplatePlugin, ScaffoldTemplatePluginOptions} from "../../src";
import {select, confirm} from "@inquirer/prompts";
import {AngularOptions, AngularVersion} from "./types";

const execAsync = promisify(exec);

export default definePlugin<ScaffoldTemplatePlugin>(SCAFFOLD_TEMPLATE_PLUGIN_TYPE, 'angular', {
    argument: 'angular',
    async execute(options: ScaffoldTemplatePluginOptions): Promise<void> {
        const userOptions = await getUserOptions(options);
        await generateProject(userOptions);
    }
});

async function getUserOptions(options: ScaffoldTemplatePluginOptions): Promise<AngularOptions> {
    const version = await select({
        message: 'Angular version:',
        choices: [
            { value: 'latest', name: 'Latest (recommended)' },
            { value: '20', name: 'Angular 20' },
            { value: '19', name: 'Angular 19' },
            { value: '18', name: 'Angular 18' },
            { value: '17', name: 'Angular 17' },
            { value: '16', name: 'Angular 16' },
        ],
        default: 'latest',
    }) as AngularVersion;

    const style = await select({
        message: 'Stylesheet format:',
        choices: [
            { value: 'scss', name: 'SCSS' },
            { value: 'css', name: 'CSS' },
            { value: 'sass', name: 'Sass' },
            { value: 'less', name: 'Less' },
        ],
        default: 'scss',
    }) as AngularOptions['style'];

    const routing = await confirm({
        message: 'Add routing?',
        default: true,
    });

    const ssr = await confirm({
        message: 'Enable Server-Side Rendering (SSR)?',
        default: false,
    });

    const skipGit = await confirm({
        message: 'Skip git initialization?',
        default: false,
    });

    const skipInstall = await confirm({
        message: 'Skip npm install? (faster, run manually later)',
        default: false,
    });

    return {
        version,
        style,
        routing,
        ssr,
        skipGit,
        skipInstall,
        ...options,
    };
}

async function generateProject(options: AngularOptions): Promise<void> {
    const { name, dryRun, version, style, routing, ssr, skipGit, skipInstall } = options;

    // Build the Angular CLI command
    const cliVersion = version === 'latest' ? 'latest' : version;
    const args: string[] = [
        'npx',
        `@angular/cli@${cliVersion}`,
        'new',
        name,
        `--style=${style}`,
        routing ? '--routing' : '--routing=false',
        ssr ? '--ssr' : '--ssr=false',
        '--skip-tests=false',
        '--package-manager=npm',
    ];

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

    console.log(`\nCreating Angular project "${name}"...`);
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
            console.log(`\nAngular project "${name}" created successfully!`);
            console.log(`\nNext steps:`);
            console.log(`  cd ${name}`);
            if (skipInstall) {
                console.log('  npm install');
            }
            console.log('  ng serve');
        }
    } catch (error) {
        const err = error as Error & { stdout?: string; stderr?: string };
        if (err.stdout) {
            console.log(err.stdout);
        }
        if (err.stderr) {
            console.error(err.stderr);
        }
        console.error(`\nFailed to create Angular project: ${err.message}`);
        process.exit(1);
    }
}
