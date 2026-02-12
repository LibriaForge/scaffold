import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import type {CliSchema, VersionInfo, MergedProperty} from '../../generators/nestjs/nestjs';
import {
    mergeSchemas,
    generateFile,
    fetchLatestMajors,
    extractFileFromTgz,
} from '../../generators/nestjs/nestjs';

// ── Tar helper: build a minimal .tgz with a single file ─────────────────────

function buildTgz(filePath: string, content: string): Buffer {
    const contentBuf = Buffer.from(content, 'utf-8');
    const headerBuf = Buffer.alloc(512);

    // Write filename (up to 100 bytes)
    headerBuf.write(filePath, 0, Math.min(filePath.length, 100), 'utf-8');

    // File mode (octal, 8 bytes at offset 100)
    headerBuf.write('0000644\0', 100, 8, 'utf-8');

    // Owner/group IDs (8 bytes each at 108, 116)
    headerBuf.write('0000000\0', 108, 8, 'utf-8');
    headerBuf.write('0000000\0', 116, 8, 'utf-8');

    // File size in octal (12 bytes at offset 124)
    const sizeOctal = contentBuf.length.toString(8).padStart(11, '0') + '\0';
    headerBuf.write(sizeOctal, 124, 12, 'utf-8');

    // Modification time (12 bytes at offset 136)
    headerBuf.write('00000000000\0', 136, 12, 'utf-8');

    // Type flag '0' for regular file (offset 156)
    headerBuf.write('0', 156, 1, 'utf-8');

    // Compute header checksum (sum of all bytes, treating checksum field as spaces)
    headerBuf.write('        ', 148, 8, 'utf-8');
    let checksum = 0;
    for (let i = 0; i < 512; i++) checksum += headerBuf[i];
    const checksumStr = checksum.toString(8).padStart(6, '0') + '\0 ';
    headerBuf.write(checksumStr, 148, 8, 'utf-8');

    // Content padded to 512-byte boundary
    const paddedSize = Math.ceil(contentBuf.length / 512) * 512;
    const contentBlock = Buffer.alloc(paddedSize);
    contentBuf.copy(contentBlock);

    // End-of-archive marker (two zero blocks)
    const endMarker = Buffer.alloc(1024);

    const tar = Buffer.concat([headerBuf, contentBlock, endMarker]);

    // gzip the tar
    const {gzipSync} = require('zlib');
    return gzipSync(tar);
}

// ── Fixtures ─────────────────────────────────────────────────────────────────

const SCHEMA_V11: CliSchema = {
    properties: {
        name: {type: 'string', description: 'The name of the new project'},
        version: {type: 'string', visible: false},
        directory: {type: 'string'},
        author: {type: 'string'},
        description: {type: 'string'},
        dependencies: {type: 'string'},
        devDependencies: {type: 'string'},
        language: {
            type: 'string',
            description: 'Programming language to be used.',
            enum: ['TypeScript', 'JavaScript'],
        },
        packageManager: {
            type: 'string',
            description: 'The package manager to use.',
            enum: ['npm', 'yarn', 'pnpm'],
        },
        strict: {
            type: 'boolean',
            description: 'Enable TypeScript strict mode.',
            default: false,
        },
        skipGit: {
            type: 'boolean',
            description: 'Skip git initialization.',
            default: false,
        },
        skipInstall: {
            type: 'boolean',
            description: 'Skip installing dependencies.',
            default: false,
        },
    },
};

const SCHEMA_V10: CliSchema = {
    properties: {
        name: {type: 'string'},
        version: {type: 'string', visible: false},
        directory: {type: 'string'},
        author: {type: 'string'},
        description: {type: 'string'},
        dependencies: {type: 'string'},
        devDependencies: {type: 'string'},
        language: {
            type: 'string',
            description: 'Programming language to be used.',
            enum: ['TypeScript', 'JavaScript'],
        },
        packageManager: {
            type: 'string',
            description: 'The package manager to use.',
            enum: ['npm', 'yarn', 'pnpm'],
        },
        strict: {
            type: 'boolean',
            description: 'Enable TypeScript strict mode.',
            default: false,
        },
        skipGit: {
            type: 'boolean',
            description: 'Skip git initialization.',
            default: false,
        },
        skipInstall: {
            type: 'boolean',
            description: 'Skip installing dependencies.',
            default: false,
        },
    },
};

// ── extractFileFromTgz ───────────────────────────────────────────────────────

describe('extractFileFromTgz (nestjs)', () => {
    it('should extract a file from a .tgz by NestJS schema path', () => {
        const content = JSON.stringify({hello: 'nestjs'});
        const tgz = buildTgz('package/lib/application/schema.json', content);

        const result = extractFileFromTgz(tgz, 'lib/application/schema.json');

        expect(result).not.toBeNull();
        expect(JSON.parse(result!.toString('utf-8'))).toEqual({hello: 'nestjs'});
    });

    it('should return null when file is not in the archive', () => {
        const tgz = buildTgz('package/other-file.txt', 'some content');

        const result = extractFileFromTgz(tgz, 'lib/application/schema.json');

        expect(result).toBeNull();
    });
});

// ── mergeSchemas ─────────────────────────────────────────────────────────────

describe('mergeSchemas (nestjs)', () => {
    const schemas = [
        {version: {major: 11, version: '11.0.0'} as VersionInfo, schema: SCHEMA_V11},
        {version: {major: 10, version: '10.4.0'} as VersionInfo, schema: SCHEMA_V10},
    ];

    let merged: MergedProperty[];

    beforeEach(() => {
        merged = mergeSchemas(schemas);
    });

    it('should exclude skip properties (name, version, directory, author, etc.)', () => {
        const names = merged.map((p) => p.name);
        expect(names).not.toContain('name');
        expect(names).not.toContain('version');
        expect(names).not.toContain('directory');
        expect(names).not.toContain('author');
        expect(names).not.toContain('description');
        expect(names).not.toContain('dependencies');
        expect(names).not.toContain('devDependencies');
    });

    it('should exclude visible: false properties', () => {
        const names = merged.map((p) => p.name);
        // version has visible: false in fixture
        expect(names).not.toContain('version');
    });

    it('should include valid properties', () => {
        const names = merged.map((p) => p.name);
        expect(names).toContain('language');
        expect(names).toContain('packageManager');
        expect(names).toContain('strict');
        expect(names).toContain('skipGit');
        expect(names).toContain('skipInstall');
    });

    it('should track supported versions per property', () => {
        const language = merged.find((p) => p.name === 'language')!;
        expect(language.supportedVersions).toContain(11);
        expect(language.supportedVersions).toContain(10);
    });

    it('should use friendly messages when available', () => {
        const pm = merged.find((p) => p.name === 'packageManager')!;
        expect(pm.friendlyMessage).toBe('Which package manager would you like to use?');

        const lang = merged.find((p) => p.name === 'language')!;
        expect(lang.friendlyMessage).toBe('Which programming language?');

        const strict = merged.find((p) => p.name === 'strict')!;
        expect(strict.friendlyMessage).toBe('Enable TypeScript strict mode?');
    });

    it('should sort by priority (language, packageManager, strict first)', () => {
        const names = merged.map((p) => p.name);
        const langIdx = names.indexOf('language');
        const pmIdx = names.indexOf('packageManager');
        const strictIdx = names.indexOf('strict');
        const skipGitIdx = names.indexOf('skipGit');

        expect(langIdx).toBeLessThan(pmIdx);
        expect(pmIdx).toBeLessThan(strictIdx);
        expect(strictIdx).toBeLessThan(skipGitIdx);
    });
});

// ── generateFile ─────────────────────────────────────────────────────────────

describe('generateFile (nestjs)', () => {
    const sampleMerged: MergedProperty[] = [
        {
            name: 'language',
            type: 'string',
            description: 'Programming language',
            enumValues: ['TypeScript', 'JavaScript'],
            supportedVersions: [11, 10],
            promptType: 'select',
            friendlyMessage: 'Which programming language?',
        },
        {
            name: 'packageManager',
            type: 'string',
            description: 'Package manager',
            enumValues: ['npm', 'yarn', 'pnpm'],
            supportedVersions: [11, 10],
            promptType: 'select',
            friendlyMessage: 'Which package manager would you like to use?',
        },
        {
            name: 'strict',
            type: 'boolean',
            description: 'Enable strict mode',
            defaultValue: false,
            supportedVersions: [11, 10],
            promptType: 'confirm',
            friendlyMessage: 'Enable TypeScript strict mode?',
        },
        {
            name: 'skipGit',
            type: 'boolean',
            description: 'Skip git init',
            defaultValue: false,
            supportedVersions: [11, 10],
            promptType: 'confirm',
            friendlyMessage: 'Skip git initialization?',
        },
        {
            name: 'skipInstall',
            type: 'boolean',
            description: 'Skip installing deps',
            defaultValue: false,
            supportedVersions: [11, 10],
            promptType: 'confirm',
            friendlyMessage: 'Skip installing dependencies?',
        },
    ];

    const majors = [11, 10];
    let output: string;

    beforeEach(() => {
        output = generateFile(sampleMerged, majors);
    });

    it('should contain required imports', () => {
        expect(output).toContain("import {execSync} from 'child_process';");
        expect(output).toContain("import {definePlugin, PluginContext} from '@libria/plugin-loader';");
        expect(output).toContain("import type {ScaffoldTemplatePlugin, ScaffoldTemplatePluginOption, ExecuteOptions} from '@libria/scaffold';");
    });

    it('should generate NestJSOptions interface', () => {
        expect(output).toContain('export interface NestJSOptions {');
        expect(output).toContain('    version: ScaffoldTemplatePluginOption<string>;');
        expect(output).toContain('    language: ScaffoldTemplatePluginOption<string>;');
        expect(output).toContain('    strict: ScaffoldTemplatePluginOption<boolean>;');
    });

    it('should generate plugin definition with nestjs IDs', () => {
        expect(output).toContain("id: 'libria:scaffold:nestjs',");
        expect(output).toContain('pluginType: SCAFFOLD_TEMPLATE_PLUGIN_TYPE,');
        expect(output).toContain("argument: 'nestjs',");
    });

    // ── Iterative getOptions tests ──

    it('should generate getOptions with version-first phase', () => {
        expect(output).toContain('if (!options.version)');
        expect(output).toContain('return {');
        expect(output).toContain("description: 'NestJS version:',");
        expect(output).toContain("choices: ['11', '10'],");
        expect(output).toContain("defaultValue: '11',");
    });

    it('should generate getOptions phase 2 with all options', () => {
        expect(output).toContain('const major = Number(options.version);');
        expect(output).toContain("description: 'Which programming language?',");
        expect(output).toContain("choices: ['TypeScript', 'JavaScript'],");
    });

    it('should not use Record<string, unknown> cast for options', () => {
        expect(output).not.toContain('as Record<string, unknown>');
    });

    // ── execute tests ──

    it('should generate npx command with NestJS CLI', () => {
        expect(output).toContain('npx @nestjs/cli@${options.version} new ${name}');
    });

    it('should generate conditional CLI args for default-false booleans', () => {
        expect(output).toContain("if (options.skipGit) args.push('--skip-git');");
        expect(output).toContain("if (options.skipInstall) args.push('--skip-install');");
    });

    it('should generate ternary CLI args for booleans without default false', () => {
        expect(output).toContain("args.push(options.strict ? '--strict' : '--strict=false');");
    });

    it('should generate dry-run guard in execute', () => {
        expect(output).toContain('[dry-run] Would run:');
    });

    it('should produce valid-looking TypeScript output', () => {
        const openBraces = (output.match(/{/g) ?? []).length;
        const closeBraces = (output.match(/}/g) ?? []).length;
        expect(openBraces).toBe(closeBraces);
    });

    it('should not generate SUPPORTED_VERSIONS when all options are universal', () => {
        // All options in sampleMerged support both [11, 10]
        expect(output).not.toContain('SUPPORTED_VERSIONS');
    });
});

// ── fetchLatestMajors (integration with mock) ───────────────────────────────

describe('fetchLatestMajors (nestjs)', () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
        globalThis.fetch = originalFetch;
    });

    it('should extract latest and previous major versions from @nestjs/cli', async () => {
        const mockRegistry = {
            'dist-tags': {
                latest: '11.0.0',
                'v10-lts': '10.4.0',
            },
            versions: {
                '10.0.0': {version: '10.0.0'},
                '10.4.0': {version: '10.4.0'},
                '11.0.0': {version: '11.0.0'},
            },
        };

        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve(mockRegistry),
        }) as unknown as typeof fetch;

        const result = await fetchLatestMajors(2);

        expect(result).toHaveLength(2);
        expect(result[0]).toEqual({major: 11, version: '11.0.0'});
        expect(result[1]).toEqual({major: 10, version: '10.4.0'});

        expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledWith(
            'https://registry.npmjs.org/@nestjs/cli',
        );
    });

    it('should fall back to scanning versions when dist-tag is missing', async () => {
        const mockRegistry = {
            'dist-tags': {
                latest: '11.0.0',
            },
            versions: {
                '10.0.0': {version: '10.0.0'},
                '10.3.0': {version: '10.3.0'},
                '10.4.0': {version: '10.4.0'},
                '11.0.0': {version: '11.0.0'},
            },
        };

        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve(mockRegistry),
        }) as unknown as typeof fetch;

        const result = await fetchLatestMajors(2);

        expect(result).toHaveLength(2);
        expect(result[0]).toEqual({major: 11, version: '11.0.0'});
        expect(result[1]).toEqual({major: 10, version: '10.4.0'});
    });
});

// ── Snapshot test ────────────────────────────────────────────────────────────

describe('generateFile snapshot (nestjs)', () => {
    it('should match snapshot for standard NestJS merged properties', () => {
        const schemas = [
            {version: {major: 11, version: '11.0.0'} as VersionInfo, schema: SCHEMA_V11},
            {version: {major: 10, version: '10.4.0'} as VersionInfo, schema: SCHEMA_V10},
        ];

        const merged = mergeSchemas(schemas);
        const output = generateFile(merged, [11, 10]);

        expect(output).toMatchSnapshot();
    });
});
