import * as fs from 'fs';
import * as path from 'path';
import {
    SCAFFOLD_GENERATORS_TYPE,
    TemplateGeneratorPlugin,
    TemplateGeneratorPluginOption,
} from '../../src/types';
import {definePlugin, LibriaPlugin, PluginContext} from '@libria/plugin-loader';
import {mergeSchemas as sharedMergeSchemas} from '../shared/merge';
import {generateFile as sharedGenerateFile} from '../shared/generate';
import {fetchLatestMajors as sharedFetchLatestMajors, fetchSchemas as sharedFetchSchemas} from '../shared/fetch';
import type {
    CliSchema,
    MergeConfig,
    FetchSchemasConfig,
    GenerateFileConfig,
    VersionInfo,
    MergedProperty,
} from '../shared/types';

// ── Re-export types under old names for backward compat ──────────────────────

export type {CliSchema as NgNewSchema, VersionInfo, MergedProperty, SchemaProperty} from '../shared/types';
export {extractFileFromTgz} from '../shared/tar';
export {fetchJson} from '../shared/fetch';

// ── Angular-specific constants ───────────────────────────────────────────────

const SKIP_PROPERTIES = new Set([
    'name',
    'version',
    'directory',
    'newProjectRoot',
    'createApplication',
    'commit',
]);

const FRIENDLY_MESSAGES: Record<string, string> = {
    routing: 'Add routing?',
    style: 'Which stylesheet format would you like to use?',
    ssr: 'Enable Server-Side Rendering (SSR)?',
    standalone: 'Use standalone components?',
    strict: 'Enable strict mode?',
    skipTests: 'Skip generating test files?',
    skipGit: 'Skip git initialization?',
    skipInstall: 'Skip installing dependencies?',
    inlineStyle: 'Use inline styles?',
    inlineTemplate: 'Use inline templates?',
    minimal: 'Create a minimal project?',
    packageManager: 'Which package manager would you like to use?',
    prefix: 'Component selector prefix:',
    viewEncapsulation: 'Which view encapsulation strategy?',
};

const SORT_PRIORITY: Record<string, number> = {
    style: 1,
    packageManager: 2,
    routing: 3,
    ssr: 4,
    standalone: 5,
    strict: 6,
};

const DEFAULT_FALSE_BOOLEANS = new Set([
    'skipTests',
    'skipGit',
    'skipInstall',
    'inlineStyle',
    'inlineTemplate',
    'minimal',
]);

// ── Angular config objects ───────────────────────────────────────────────────

const MERGE_CONFIG: MergeConfig = {
    skipProperties: SKIP_PROPERTIES,
    friendlyMessages: FRIENDLY_MESSAGES,
    sortPriority: SORT_PRIORITY,
};

const FETCH_SCHEMAS_CONFIG: FetchSchemasConfig = {
    schematicsPackage: '@schematics/angular',
    schemaPath: 'ng-new/schema.json',
};

const GENERATE_FILE_CONFIG: GenerateFileConfig = {
    frameworkName: 'angular',
    interfaceName: 'AngularOptions',
    pluginId: 'libria:scaffold:angular',
    pluginArgument: 'angular',
    cliCommand: 'npx @angular/cli@${options.version} new ${name}',
    versionDescription: 'Angular version:',
    defaultFalseBooleans: DEFAULT_FALSE_BOOLEANS,
};

// ── Backward-compat wrapper functions ────────────────────────────────────────

export function mergeSchemas(
    schemas: { version: VersionInfo; schema: CliSchema }[],
): MergedProperty[] {
    return sharedMergeSchemas(schemas, MERGE_CONFIG);
}

export function generateFile(
    mergedProps: MergedProperty[],
    majors: number[],
): string {
    return sharedGenerateFile(mergedProps, majors, GENERATE_FILE_CONFIG);
}

export async function fetchLatestMajors(count: number): Promise<VersionInfo[]> {
    return sharedFetchLatestMajors('@angular/cli', count);
}

export async function fetchSchemas(
    versions: VersionInfo[],
): Promise<{ version: VersionInfo; schema: CliSchema }[]> {
    return sharedFetchSchemas(versions, FETCH_SCHEMAS_CONFIG);
}

// ── Plugin Options Type ──────────────────────────────────────────────────────

type AngularGeneratorOptions = {
    output: TemplateGeneratorPluginOption<string>;
};

// ── Plugin Definition ────────────────────────────────────────────────────────

export default definePlugin<TemplateGeneratorPlugin<AngularGeneratorOptions>>({
    id: 'libria:scaffold-generators:angular',
    name: 'angular',
    pluginType: SCAFFOLD_GENERATORS_TYPE,
    async create<C extends PluginContext>(ctx: C): Promise<LibriaPlugin<TemplateGeneratorPlugin<AngularGeneratorOptions>>> {
        return {
            api: {
                argument: 'angular',
                getOptions: async () => ({
                    output: {
                        flags: '--output <path>',
                        required: true,
                        description: 'Output path for the generated template file',
                    },
                }),
                execute: async (options) => {
                    const outputPath = options.output as string;
                    const dryRun = options.dryRun ?? false;
                    const force = options.force ?? false;

                    console.log('Fetching Angular CLI metadata from npm...');
                    const majors = await fetchLatestMajors(4);
                    console.log(`Found versions: ${majors.map((m) => `${m.major} (${m.version})`).join(', ')}`);

                    console.log('Fetching schemas from npm tarballs...');
                    const schemas = await fetchSchemas(majors);
                    console.log(`Fetched ${schemas.length} schemas`);

                    console.log('Merging schemas...');
                    const merged = mergeSchemas(schemas);
                    console.log(`Merged ${merged.length} properties`);

                    console.log('Generating output file...');
                    const majorNumbers = majors.map((m) => m.major);
                    const output = generateFile(merged, majorNumbers);

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
