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

// ── Re-export types for tests ────────────────────────────────────────────────

export type {CliSchema, VersionInfo, MergedProperty, SchemaProperty} from '../shared/types';
export {extractFileFromTgz} from '../shared/tar';
export {fetchJson} from '../shared/fetch';

// ── NestJS-specific constants ────────────────────────────────────────────────

const SKIP_PROPERTIES = new Set([
    'name',
    'version',
    'directory',
    'author',
    'description',
    'dependencies',
    'devDependencies',
]);

const FRIENDLY_MESSAGES: Record<string, string> = {
    packageManager: 'Which package manager would you like to use?',
    language: 'Which programming language?',
    strict: 'Enable TypeScript strict mode?',
    skipGit: 'Skip git initialization?',
    skipInstall: 'Skip installing dependencies?',
};

const SORT_PRIORITY: Record<string, number> = {
    language: 1,
    packageManager: 2,
    strict: 3,
};

const DEFAULT_FALSE_BOOLEANS = new Set([
    'skipGit',
    'skipInstall',
]);

// ── NestJS config objects ────────────────────────────────────────────────────

const MERGE_CONFIG: MergeConfig = {
    skipProperties: SKIP_PROPERTIES,
    friendlyMessages: FRIENDLY_MESSAGES,
    sortPriority: SORT_PRIORITY,
};

const FETCH_SCHEMAS_CONFIG: FetchSchemasConfig = {
    schematicsPackage: '@nestjs/schematics',
    schemaPath: 'lib/application/schema.json',
};

const GENERATE_FILE_CONFIG: GenerateFileConfig = {
    frameworkName: 'nestjs',
    interfaceName: 'NestJSOptions',
    pluginId: 'libria:scaffold:nestjs',
    pluginArgument: 'nestjs',
    cliCommand: 'npx @nestjs/cli@${options.version} new ${name}',
    versionDescription: 'NestJS version:',
    defaultFalseBooleans: DEFAULT_FALSE_BOOLEANS,
};

// ── Convenience wrapper functions ────────────────────────────────────────────

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
    return sharedFetchLatestMajors('@nestjs/cli', count);
}

export async function fetchSchemas(
    versions: VersionInfo[],
): Promise<{ version: VersionInfo; schema: CliSchema }[]> {
    return sharedFetchSchemas(versions, FETCH_SCHEMAS_CONFIG);
}

// ── Plugin Options Type ──────────────────────────────────────────────────────

type NestJSGeneratorOptions = {
    output: TemplateGeneratorPluginOption<string>;
};

// ── Plugin Definition ────────────────────────────────────────────────────────

export default definePlugin<TemplateGeneratorPlugin<NestJSGeneratorOptions>>({
    id: 'libria:scaffold-generators:nestjs',
    name: 'nestjs',
    pluginType: SCAFFOLD_GENERATORS_TYPE,
    async create<C extends PluginContext>(ctx: C): Promise<LibriaPlugin<TemplateGeneratorPlugin<NestJSGeneratorOptions>>> {
        return {
            api: {
                argument: 'nestjs',
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

                    console.log('Fetching NestJS CLI metadata from npm...');
                    const majors = await fetchLatestMajors(2);
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
