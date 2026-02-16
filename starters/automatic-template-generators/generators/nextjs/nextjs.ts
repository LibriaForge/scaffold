import * as fs from 'fs';
import * as path from 'path';
import {
    SCAFFOLD_GENERATORS_TYPE,
    TemplateGeneratorPlugin,
    TemplateGeneratorPluginOption,
    ExecuteOptions,
} from '../../src/types';
import { definePlugin, LibriaPlugin, PluginContext } from '@libria/plugin-loader';

// ── Next.js CLI Schema (manual definition since Next.js doesn't have a JSON schema) ──

type NextJSSchemaProperty = {
    type: string;
    description: string;
    default?: unknown;
    enum?: string[];
    alias?: string;
    items?: { type?: string; enum?: string[] };
};

const NEXTJS_SCHEMA: Record<string, NextJSSchemaProperty> = {
    ts: {
        type: 'boolean',
        description: 'Initialize as a TypeScript project',
        default: true,
    },
    typescript: {
        type: 'boolean',
        description: 'Initialize as a TypeScript project (alias for ts)',
        default: true,
    },
    js: {
        type: 'boolean',
        description: 'Initialize as a JavaScript project',
    },
    javascript: {
        type: 'boolean',
        description: 'Initialize as a JavaScript project (alias for js)',
    },
    tailwind: {
        type: 'boolean',
        description: 'Initialize with Tailwind CSS config',
        default: true,
    },
    reactCompiler: {
        type: 'boolean',
        description: 'Initialize with React Compiler enabled',
    },
    eslint: {
        type: 'boolean',
        description: 'Initialize with ESLint config',
    },
    biome: {
        type: 'boolean',
        description: 'Initialize with Biome config',
    },
    app: {
        type: 'boolean',
        description: 'Initialize as an App Router project',
    },
    srcDir: {
        type: 'boolean',
        description: 'Initialize inside a src/ directory',
    },
    turbopack: {
        type: 'boolean',
        description: 'Enable Turbopack as the bundler',
    },
    webpack: {
        type: 'boolean',
        description: 'Enable Webpack as the bundler',
    },
    rspack: {
        type: 'boolean',
        description: 'Enable Rspack as the bundler',
    },
    importAlias: {
        type: 'string',
        description: 'Specify import alias to use',
        default: '@/*',
    },
    api: {
        type: 'boolean',
        description: 'Initialize a headless API using the App Router',
    },
    empty: {
        type: 'boolean',
        description: 'Initialize an empty project',
    },
    useNpm: {
        type: 'boolean',
        description: 'Explicitly tell the CLI to bootstrap the application using npm',
    },
    usePnpm: {
        type: 'boolean',
        description: 'Explicitly tell the CLI to bootstrap the application using pnpm',
    },
    useYarn: {
        type: 'boolean',
        description: 'Explicitly tell the CLI to bootstrap the application using Yarn',
    },
    useBun: {
        type: 'boolean',
        description: 'Explicitly tell the CLI to bootstrap the application using Bun',
    },
    skipInstall: {
        type: 'boolean',
        description: 'Explicitly tell the CLI to skip installing packages',
    },
    reset: {
        type: 'boolean',
        description: 'Reset the preferences saved for create-next-app',
    },
    resetPreferences: {
        type: 'boolean',
        description: 'Reset the preferences saved for create-next-app',
    },
    yes: {
        type: 'boolean',
        description: 'Use saved preferences or defaults for unprovided options',
    },
    example: {
        type: 'string',
        description: 'An example to bootstrap the app with. You can use an example name from the official Next.js repo or a public GitHub URL',
    },
    examplePath: {
        type: 'string',
        description: 'In a rare case, your GitHub URL might contain a branch name with a slash and the path to the example separately',
    },
    disableGit: {
        type: 'boolean',
        description: 'Skip initializing a git repository',
    },
};

// ── Skip properties ──

const SKIP_PROPERTIES = new Set([
    'version',
    'typescript', // alias for ts
    'javascript', // alias for js
    'useNpm', // handled by package manager
    'usePnpm', // handled by package manager
    'useYarn', // handled by package manager
    'useBun', // handled by package manager
    'reset', // reset preferences - not a project option
    'resetPreferences', // alias for reset
    'yes', // use defaults - not a project option
]);

// ── Friendly messages ──

const FRIENDLY_MESSAGES: Record<string, string> = {
    ts: 'Would you like to use TypeScript?',
    tailwind: 'Would you like to use Tailwind CSS?',
    reactCompiler: 'Would you like to use React Compiler?',
    eslint: 'Would you like to use ESLint?',
    biome: 'Would you like to use Biome?',
    app: 'Would you like to use the App Router?',
    srcDir: 'Would you like to use a src directory?',
    turbopack: 'Would you like to use Turbopack as the bundler?',
    webpack: 'Would you like to use Webpack as the bundler?',
    rspack: 'Would you like to use Rspack as the bundler?',
    importAlias: 'What import alias would you like to use?',
    api: 'Would you like to initialize a headless API?',
    empty: 'Would you like to create an empty project?',
    skipInstall: 'Skip installing dependencies?',
    disableGit: 'Skip git initialization?',
    example: 'Which example would you like to use?',
};

// ── Sort priority ──

const SORT_PRIORITY: Record<string, number> = {
    ts: 1,
    tailwind: 2,
    eslint: 3,
    app: 4,
    srcDir: 5,
};

// ── Generate the template file ──

function generateNextJSTemplate(majors: number[]): string {
    const lines: string[] = [];

    // Header
    lines.push('// This file was auto-generated. Do not edit manually.');
    lines.push(`// Generated with Next.js versions: ${majors.map(m => `v${m}`).join(', ')}`);
    lines.push('');
    lines.push('import type { CliOptions, CliQuestion } from \'@libria/scaffold-plugin-types\';');
    lines.push('');

    // Interface
    lines.push('export interface NextJSOptions extends CliOptions {');
    lines.push('    version?: string;');
    lines.push('    ts?: boolean;');
    lines.push('    tailwind?: boolean;');
    lines.push('    reactCompiler?: boolean;');
    lines.push('    eslint?: boolean;');
    lines.push('    biome?: boolean;');
    lines.push('    app?: boolean;');
    lines.push('    srcDir?: boolean;');
    lines.push('    turbopack?: boolean;');
    lines.push('    webpack?: boolean;');
    lines.push('    rspack?: boolean;');
    lines.push('    importAlias?: string;');
    lines.push('    api?: boolean;');
    lines.push('    empty?: boolean;');
    lines.push('    skipInstall?: boolean;');
    lines.push('    disableGit?: boolean;');
    lines.push('    example?: string;');
    lines.push('}');
    lines.push('');

    // Version info
    lines.push(`export const NEXTJS_VERSIONS = [${majors.map(m => `'${m}'`).join(', ')}];`);
    lines.push('');

    // Questions
    lines.push('export const NEXTJS_QUESTIONS: CliQuestion<NextJSOptions>[] = [');

    // Helper function to create a question entry
    const createQuestion = (name: string, prop: NextJSSchemaProperty, versionRanges: string) => {
        const question: string[] = [];
        const supportedVersions = versionRanges || majors.map(m => `'${m}'`).join(', ');

        question.push('    {');
        question.push(`        name: '${name}',`);
        question.push(`        type: ${prop.type === 'boolean' ? "'confirm'" : "'input'"},`);
        if (FRIENDLY_MESSAGES[name]) {
            question.push(`        message: '${FRIENDLY_MESSAGES[name]}',`);
        }
        if (prop.default !== undefined) {
            question.push(`        default: ${typeof prop.default === 'string' ? `'${prop.default}'` : prop.default},`);
        }
        question.push(`        versions: [${supportedVersions}],`);
        question.push('    },');

        return question.join('\n');
    };

    // Sort properties by priority and add questions
    const properties = Object.entries(NEXTJS_SCHEMA)
        .filter(([name]) => !SKIP_PROPERTIES.has(name))
        .sort((a, b) => {
            const priorityA = SORT_PRIORITY[a[0]] ?? 999;
            const priorityB = SORT_PRIORITY[b[0]] ?? 999;
            return priorityA - priorityB;
        });

    for (const [name, prop] of properties) {
        lines.push(createQuestion(name, prop, majors.map(m => `'${m}'`).join(', ')));
    }

    lines.push('];');
    lines.push('');

    // CLI command template
    lines.push('export function getNextJSCliCommand(name: string, options: NextJSOptions): string {');
    lines.push('    const parts = [`npx create-next-app@${options.version || \'latest\'}`, name];');
    lines.push('');
    lines.push('    if (options.ts) parts.push(\'--ts\');');
    lines.push('    if (options.js) parts.push(\'--js\');');
    lines.push('    if (options.tailwind) parts.push(\'--tailwind\');');
    lines.push('    if (options.reactCompiler) parts.push(\'--react-compiler\');');
    lines.push('    if (options.eslint) parts.push(\'--eslint\');');
    lines.push('    if (options.biome) parts.push(\'--biome\');');
    lines.push('    if (options.app) parts.push(\'--app\');');
    lines.push('    if (options.srcDir) parts.push(\'--src-dir\');');
    lines.push('    if (options.turbopack) parts.push(\'--turbopack\');');
    lines.push('    if (options.webpack) parts.push(\'--webpack\');');
    lines.push('    if (options.rspack) parts.push(\'--rspack\');');
    lines.push('    if (options.importAlias) parts.push(`--import-alias ${options.importAlias}`);');
    lines.push('    if (options.api) parts.push(\'--api\');');
    lines.push('    if (options.empty) parts.push(\'--empty\');');
    lines.push('    if (options.skipInstall) parts.push(\'--skip-install\');');
    lines.push('    if (options.disableGit) parts.push(\'--disable-git\');');
    lines.push('    if (options.example) parts.push(`--example ${options.example}`);');
    lines.push('');
    lines.push('    return parts.join(\' \');');
    lines.push('}');

    return lines.join('\n');
}

// ── Fetch latest Next.js versions ──

async function fetchLatestNextJSVersions(count: number): Promise<number[]> {
    try {
        const res = await fetch('https://registry.npmjs.org/create-next-app');
        if (!res.ok) throw new Error('Failed to fetch Next.js versions');
        const data = await res.json();

        const latest = data['dist-tags']['latest'];
        const latestMajor = parseInt(latest.split('.')[0], 10);

        const results: number[] = [latestMajor];
        const allVersions = Object.keys(data.versions);

        for (let i = 1; i < count; i++) {
            const targetMajor = latestMajor - i;
            const ltsTag = data['dist-tags'][`next-${targetMajor}`];
            if (ltsTag) {
                results.push(targetMajor);
            } else {
                const fallback = allVersions
                    .map(v => parseInt(v.split('.')[0], 10))
                    .filter(m => m === targetMajor)
                    .pop();
                if (fallback) {
                    results.push(targetMajor);
                }
            }
        }

        return results;
    } catch (err) {
        console.warn(`Could not fetch Next.js versions: ${err instanceof Error ? err.message : err}`);
        return [16, 15]; // fallback
    }
}

// ── Plugin Options Type ──

type NextJSGeneratorOptions = {
    output: TemplateGeneratorPluginOption<string>;
};

// ── Plugin Definition ──

export default definePlugin<TemplateGeneratorPlugin<NextJSGeneratorOptions>>({
    id: 'libria:scaffold-generators:nextjs',
    name: 'nextjs',
    pluginType: SCAFFOLD_GENERATORS_TYPE,
    async create<C extends PluginContext>(_ctx: C): Promise<LibriaPlugin<TemplateGeneratorPlugin<NextJSGeneratorOptions>>> {
        return {
            api: {
                argument: 'nextjs',
                getOptions: async () => ({
                    output: {
                        flags: '--output <path>',
                        required: true,
                        description: 'Output path for the generated template file',
                    },
                }),
                execute: async (options: ExecuteOptions<NextJSGeneratorOptions>) => {
                    const outputPath = options.output as string;
                    const dryRun = options.dryRun ?? false;
                    const force = options.force ?? false;

                    console.log('Fetching Next.js CLI metadata from npm...');
                    const majors = await fetchLatestNextJSVersions(3);
                    console.log(`Found versions: ${majors.map(m => `v${m}`).join(', ')}`);

                    console.log('Generating Next.js template file...');
                    const output = generateNextJSTemplate(majors);

                    if (dryRun) {
                        console.log('\n--- DRY RUN: Generated file content ---\n');
                        console.log(output);
                        console.log('\n--- END DRY RUN ---');
                        return;
                    }

                    const resolvedPath = path.resolve(outputPath);
                    const dir = path.dirname(resolvedPath);
                    if (!fs.existsSync(dir)) {
                        if (!force) {
                            throw new Error(`Directory does not exist: ${dir}. Use --force to create it.`);
                        }
                        fs.mkdirSync(dir, {recursive: true});
                    }

                    if (fs.existsSync(resolvedPath) && !force) {
                        throw new Error(`File already exists: ${resolvedPath}. Use --force to overwrite.`);
                    }

                    fs.writeFileSync(resolvedPath, output, 'utf-8');
                    console.log(`Generated template written to: ${resolvedPath}`);
                },
            },
        };
    },
});