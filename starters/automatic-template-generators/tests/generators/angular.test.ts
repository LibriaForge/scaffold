import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import {gunzipSync} from 'zlib';
import type {NgNewSchema, VersionInfo, MergedProperty} from '../../generators/angular/angular';
import {
    mergeSchemas,
    generateFile,
    fetchLatestMajors,
    extractFileFromTgz,
} from '../../generators/angular/angular';

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
    // Checksum field: offset 148, 8 bytes
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

const SCHEMA_V21: NgNewSchema = {
    properties: {
        name: {type: 'string', description: 'The name of the new workspace'},
        style: {
            type: 'string',
            description: 'The file extension to use for style files.',
            default: 'css',
            enum: ['css', 'scss', 'sass', 'less'],
        },
        routing: {
            type: 'boolean',
            description: 'Generate a routing module.',
            default: true,
        },
        ssr: {
            type: 'boolean',
            description: 'Creates an application with Server-Side Rendering.',
            default: false,
        },
        standalone: {
            type: 'boolean',
            description: 'Creates an application based upon the standalone API.',
            default: true,
        },
        strict: {
            type: 'boolean',
            description: 'Creates a workspace with stricter type checking.',
            default: true,
        },
        skipTests: {
            type: 'boolean',
            description: 'Skip creating spec files.',
            default: false,
        },
        skipGit: {
            type: 'boolean',
            description: 'Skip initializing a git repository.',
            default: false,
        },
        skipInstall: {
            type: 'boolean',
            description: 'Skip installing dependency packages.',
            default: false,
        },
        packageManager: {
            type: 'string',
            description: 'The package manager to use.',
            enum: ['npm', 'yarn', 'pnpm', 'cnpm'],
        },
        prefix: {type: 'string', description: 'The prefix for the component.'},
        commit: {type: 'object', oneOf: [{type: 'object'}, {const: false}]},
        directory: {type: 'string'},
        createApplication: {type: 'boolean'},
        version: {type: 'string', visible: false},
        newProjectRoot: {type: 'string'},
        inlineStyle: {
            type: 'boolean',
            description: 'Include styles inline.',
            default: false,
        },
        inlineTemplate: {
            type: 'boolean',
            description: 'Include template inline.',
            default: false,
        },
        minimal: {
            type: 'boolean',
            description: 'Create a minimal project.',
            default: false,
        },
    },
};

const SCHEMA_V20: NgNewSchema = {
    properties: {
        name: {type: 'string'},
        style: {
            type: 'string',
            default: 'css',
            enum: ['css', 'scss', 'sass', 'less'],
        },
        routing: {
            type: 'boolean',
            default: true,
        },
        ssr: {
            type: 'boolean',
            description: 'Creates an application with Server-Side Rendering.',
            default: false,
        },
        standalone: {
            type: 'boolean',
            default: true,
        },
        strict: {
            type: 'boolean',
            default: true,
        },
        skipTests: {type: 'boolean', default: false},
        skipGit: {type: 'boolean', default: false},
        packageManager: {
            type: 'string',
            enum: ['npm', 'yarn', 'pnpm'],
        },
        prefix: {type: 'string'},
        commit: {type: 'object', oneOf: [{type: 'object'}, {const: false}]},
        directory: {type: 'string'},
        newProjectRoot: {type: 'string'},
    },
};

const SCHEMA_V18: NgNewSchema = {
    properties: {
        name: {type: 'string'},
        style: {
            type: 'string',
            default: 'css',
            enum: ['css', 'scss', 'less'],
        },
        routing: {type: 'boolean', default: false},
        strict: {type: 'boolean', default: true},
        skipTests: {type: 'boolean', default: false},
        viewEncapsulation: {
            type: 'string',
            description: 'The view encapsulation strategy.',
            enum: ['Emulated', 'None', 'ShadowDom'],
        },
        prefix: {type: 'string'},
        commit: {type: 'object', oneOf: [{type: 'object'}, {const: false}]},
        directory: {type: 'string'},
        deprecatedOption: {
            type: 'boolean',
            'x-deprecated': 'Use something else',
        },
    },
};

// ── extractFileFromTgz ───────────────────────────────────────────────────────

describe('extractFileFromTgz', () => {
    it('should extract a file from a .tgz by suffix path', () => {
        const content = JSON.stringify({hello: 'world'});
        const tgz = buildTgz('package/ng-new/schema.json', content);

        const result = extractFileFromTgz(tgz, 'ng-new/schema.json');

        expect(result).not.toBeNull();
        expect(JSON.parse(result!.toString('utf-8'))).toEqual({hello: 'world'});
    });

    it('should return null when file is not in the archive', () => {
        const tgz = buildTgz('package/other-file.txt', 'some content');

        const result = extractFileFromTgz(tgz, 'ng-new/schema.json');

        expect(result).toBeNull();
    });

    it('should handle JSON schema content correctly', () => {
        const schema: NgNewSchema = {
            properties: {
                style: {type: 'string', enum: ['css', 'scss']},
            },
        };
        const tgz = buildTgz('package/ng-new/schema.json', JSON.stringify(schema));

        const result = extractFileFromTgz(tgz, 'ng-new/schema.json');

        expect(result).not.toBeNull();
        const parsed = JSON.parse(result!.toString('utf-8')) as NgNewSchema;
        expect(parsed.properties?.style?.enum).toEqual(['css', 'scss']);
    });
});

// ── mergeSchemas ─────────────────────────────────────────────────────────────

describe('mergeSchemas', () => {
    const schemas = [
        {version: {major: 21, version: '21.1.3'} as VersionInfo, schema: SCHEMA_V21},
        {version: {major: 20, version: '20.2.1'} as VersionInfo, schema: SCHEMA_V20},
        {version: {major: 18, version: '18.2.0'} as VersionInfo, schema: SCHEMA_V18},
    ];

    let merged: MergedProperty[];

    beforeEach(() => {
        merged = mergeSchemas(schemas);
    });

    it('should exclude skip properties (name, version, directory, etc.)', () => {
        const names = merged.map((p) => p.name);
        expect(names).not.toContain('name');
        expect(names).not.toContain('version');
        expect(names).not.toContain('directory');
        expect(names).not.toContain('newProjectRoot');
        expect(names).not.toContain('createApplication');
        expect(names).not.toContain('commit');
    });

    it('should include prefix as a valid option', () => {
        const prefix = merged.find((p) => p.name === 'prefix');
        expect(prefix).toBeDefined();
        expect(prefix!.type).toBe('string');
    });

    it('should exclude visible: false properties', () => {
        const names = merged.map((p) => p.name);
        expect(names).not.toContain('version');
    });

    it('should exclude deprecated properties', () => {
        const names = merged.map((p) => p.name);
        expect(names).not.toContain('deprecatedOption');
    });

    it('should include valid properties', () => {
        const names = merged.map((p) => p.name);
        expect(names).toContain('style');
        expect(names).toContain('routing');
        expect(names).toContain('ssr');
        expect(names).toContain('strict');
        expect(names).toContain('skipTests');
    });

    it('should union enum values across versions', () => {
        const style = merged.find((p) => p.name === 'style')!;
        expect(style.enumValues).toContain('css');
        expect(style.enumValues).toContain('scss');
        expect(style.enumValues).toContain('sass');
        expect(style.enumValues).toContain('less');
    });

    it('should union packageManager enum values across versions', () => {
        const pm = merged.find((p) => p.name === 'packageManager')!;
        expect(pm.enumValues).toContain('npm');
        expect(pm.enumValues).toContain('yarn');
        expect(pm.enumValues).toContain('pnpm');
        expect(pm.enumValues).toContain('cnpm');
    });

    it('should track supported versions per property', () => {
        const style = merged.find((p) => p.name === 'style')!;
        expect(style.supportedVersions).toContain(21);
        expect(style.supportedVersions).toContain(20);
        expect(style.supportedVersions).toContain(18);

        const ssr = merged.find((p) => p.name === 'ssr')!;
        expect(ssr.supportedVersions).toContain(21);
        expect(ssr.supportedVersions).toContain(20);
        expect(ssr.supportedVersions).not.toContain(18);
    });

    it('should set correct promptType for enums and booleans', () => {
        const style = merged.find((p) => p.name === 'style')!;
        expect(style.promptType).toBe('select');

        const routing = merged.find((p) => p.name === 'routing')!;
        expect(routing.promptType).toBe('confirm');
    });

    it('should sort enums before booleans, with priority keys first', () => {
        const names = merged.map((p) => p.name);
        const styleIdx = names.indexOf('style');
        const packageManagerIdx = names.indexOf('packageManager');
        const routingIdx = names.indexOf('routing');
        const ssrIdx = names.indexOf('ssr');

        expect(styleIdx).toBeLessThan(routingIdx);
        expect(packageManagerIdx).toBeLessThan(routingIdx);
        expect(routingIdx).toBeLessThan(ssrIdx);
    });

    it('should include properties unique to some versions', () => {
        const viewEnc = merged.find((p) => p.name === 'viewEncapsulation');
        expect(viewEnc).toBeDefined();
        expect(viewEnc!.supportedVersions).toEqual([18]);
        expect(viewEnc!.enumValues).toEqual(['Emulated', 'None', 'ShadowDom']);
    });

    it('should use friendly messages when available', () => {
        const routing = merged.find((p) => p.name === 'routing')!;
        expect(routing.friendlyMessage).toBe('Add routing?');

        const ssr = merged.find((p) => p.name === 'ssr')!;
        expect(ssr.friendlyMessage).toBe('Enable Server-Side Rendering (SSR)?');
    });
});

// ── generateFile ─────────────────────────────────────────────────────────────

describe('generateFile', () => {
    const sampleMerged: MergedProperty[] = [
        {
            name: 'style',
            type: 'string',
            description: 'Stylesheet format',
            defaultValue: 'css',
            enumValues: ['css', 'scss', 'sass', 'less'],
            supportedVersions: [21, 20, 18],
            promptType: 'select',
            friendlyMessage: 'Which stylesheet format would you like to use?',
        },
        {
            name: 'packageManager',
            type: 'string',
            description: 'Package manager',
            enumValues: ['npm', 'yarn', 'pnpm', 'cnpm'],
            supportedVersions: [21, 20],
            promptType: 'select',
            friendlyMessage: 'Which package manager would you like to use?',
        },
        {
            name: 'routing',
            type: 'boolean',
            description: 'Add routing',
            defaultValue: true,
            supportedVersions: [21, 20, 18],
            promptType: 'confirm',
            friendlyMessage: 'Add routing?',
        },
        {
            name: 'ssr',
            type: 'boolean',
            description: 'Enable SSR',
            defaultValue: false,
            supportedVersions: [21, 20],
            promptType: 'confirm',
            friendlyMessage: 'Enable Server-Side Rendering (SSR)?',
        },
        {
            name: 'skipTests',
            type: 'boolean',
            description: 'Skip test files',
            defaultValue: false,
            supportedVersions: [21, 20, 18],
            promptType: 'confirm',
            friendlyMessage: 'Skip generating test files?',
        },
    ];

    const majors = [21, 20, 18];
    let output: string;

    beforeEach(() => {
        output = generateFile(sampleMerged, majors);
    });

    it('should contain required imports', () => {
        expect(output).toContain("import {execSync} from 'child_process';");
        expect(output).toContain("import {definePlugin, PluginContext} from '@libria/plugin-loader';");
        expect(output).toContain("import type {ScaffoldTemplatePlugin, ScaffoldTemplatePluginOption, ExecuteOptions} from '@libria/scaffold';");
    });

    it('should generate AngularOptions interface using ScaffoldTemplatePluginOption', () => {
        expect(output).toContain('export interface AngularOptions {');
        expect(output).toContain('    version: ScaffoldTemplatePluginOption<string>;');
        expect(output).toContain('    style: ScaffoldTemplatePluginOption<string>;');
        expect(output).toContain('    routing: ScaffoldTemplatePluginOption<boolean>;');
        expect(output).toContain('    ssr: ScaffoldTemplatePluginOption<boolean>;');
        expect(output).toContain('    skipTests: ScaffoldTemplatePluginOption<boolean>;');
    });

    it('should generate plugin definition with scaffold-template type', () => {
        expect(output).toContain("id: 'libria:scaffold:angular',");
        expect(output).toContain('pluginType: SCAFFOLD_TEMPLATE_PLUGIN_TYPE,');
        expect(output).toContain("argument: 'angular',");
    });

    // ── getOptions tests (iterative: version-first, then all options) ──

    it('should generate getOptions with version-first phase', () => {
        expect(output).toContain('if (!options.version)');
        expect(output).toContain("description: 'Angular version:',");
        expect(output).toContain("choices: ['21', '20', '18'],");
        expect(output).toContain("defaultValue: '21',");
    });

    it('should generate getOptions returning enum option definitions with choices', () => {
        expect(output).toContain("description: 'Which stylesheet format would you like to use?',");
        expect(output).toContain("choices: ['css', 'scss', 'sass', 'less'],");
    });

    it('should generate getOptions returning boolean option definitions', () => {
        expect(output).toContain("description: 'Add routing?',");
        expect(output).toContain('defaultValue: true,');
    });

    it('should generate getOptions with version filtering via SUPPORTED_VERSIONS', () => {
        expect(output).toContain('const major = Number(options.version);');
        expect(output).toContain('delete allOptions[key];');
    });

    it('should not use Record<string, unknown> cast for options', () => {
        expect(output).not.toContain('as Record<string, unknown>');
    });

    // ── SUPPORTED_VERSIONS map ──

    it('should generate SUPPORTED_VERSIONS for version-specific options', () => {
        // ssr and packageManager are only in [21, 20]
        expect(output).toContain('SUPPORTED_VERSIONS');
        expect(output).toContain('ssr: [21, 20],');
        expect(output).toContain('packageManager: [21, 20],');
    });

    it('should not include universally-supported options in SUPPORTED_VERSIONS', () => {
        // style and routing are in all versions — should not appear
        expect(output).not.toMatch(/SUPPORTED_VERSIONS[^}]*style:/s);
        expect(output).not.toMatch(/SUPPORTED_VERSIONS[^}]*routing:/s);
    });

    // ── execute tests ──

    it('should generate execute with CLI arg construction for enums', () => {
        expect(output).toContain('args.push(`--style=${options.style}`);');
        expect(output).toContain('args.push(`--package-manager=${options.packageManager}`);');
    });

    it('should generate execute with conditional CLI args for default-false booleans', () => {
        expect(output).toContain("if (options.skipTests) args.push('--skip-tests');");
    });

    it('should generate execute with ternary CLI args for booleans without default false', () => {
        expect(output).toContain("args.push(options.routing ? '--routing' : '--routing=false');");
    });

    it('should generate execute with SUPPORTED_VERSIONS guards for version-specific options', () => {
        expect(output).toContain('SUPPORTED_VERSIONS.ssr.includes(major)');
        expect(output).toContain('SUPPORTED_VERSIONS.packageManager.includes(major)');
    });

    it('should generate npx command with version interpolation', () => {
        expect(output).toContain('npx @angular/cli@${options.version} new ${name}');
    });

    it('should generate dry-run guard in execute', () => {
        expect(output).toContain('[dry-run] Would run:');
    });

    it('should produce valid-looking TypeScript output', () => {
        const openBraces = (output.match(/{/g) ?? []).length;
        const closeBraces = (output.match(/}/g) ?? []).length;
        expect(openBraces).toBe(closeBraces);
    });
});

// ── fetchLatestMajors (integration with mock) ───────────────────────────────

describe('fetchLatestMajors', () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
        globalThis.fetch = originalFetch;
    });

    it('should extract latest and LTS versions from npm registry', async () => {
        const mockRegistry = {
            'dist-tags': {
                latest: '21.1.3',
                'v20-lts': '20.2.1',
                'v19-lts': '19.1.0',
                'v18-lts': '18.2.12',
            },
            versions: {
                '18.0.0': {version: '18.0.0'},
                '18.2.12': {version: '18.2.12'},
                '19.0.0': {version: '19.0.0'},
                '19.1.0': {version: '19.1.0'},
                '20.0.0': {version: '20.0.0'},
                '20.2.1': {version: '20.2.1'},
                '21.0.0': {version: '21.0.0'},
                '21.1.3': {version: '21.1.3'},
            },
        };

        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve(mockRegistry),
        }) as unknown as typeof fetch;

        const result = await fetchLatestMajors(4);

        expect(result).toHaveLength(4);
        expect(result[0]).toEqual({major: 21, version: '21.1.3'});
        expect(result[1]).toEqual({major: 20, version: '20.2.1'});
        expect(result[2]).toEqual({major: 19, version: '19.1.0'});
        expect(result[3]).toEqual({major: 18, version: '18.2.12'});
    });

    it('should fall back to scanning versions when dist-tag is missing', async () => {
        const mockRegistry = {
            'dist-tags': {
                latest: '21.1.3',
                'v20-lts': '20.2.1',
            },
            versions: {
                '18.0.0': {version: '18.0.0'},
                '18.2.0': {version: '18.2.0'},
                '18.2.12': {version: '18.2.12'},
                '19.0.0-rc.1': {version: '19.0.0-rc.1'},
                '19.0.0': {version: '19.0.0'},
                '19.1.0': {version: '19.1.0'},
                '20.0.0': {version: '20.0.0'},
                '20.2.1': {version: '20.2.1'},
                '21.0.0': {version: '21.0.0'},
                '21.1.3': {version: '21.1.3'},
            },
        };

        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve(mockRegistry),
        }) as unknown as typeof fetch;

        const result = await fetchLatestMajors(4);

        expect(result).toHaveLength(4);
        expect(result[0]).toEqual({major: 21, version: '21.1.3'});
        expect(result[1]).toEqual({major: 20, version: '20.2.1'});
        expect(result[2]).toEqual({major: 19, version: '19.1.0'});
        expect(result[3]).toEqual({major: 18, version: '18.2.12'});
    });

    it('should handle missing major gracefully', async () => {
        const mockRegistry = {
            'dist-tags': {
                latest: '21.1.3',
            },
            versions: {
                '21.0.0': {version: '21.0.0'},
                '21.1.3': {version: '21.1.3'},
            },
        };

        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve(mockRegistry),
        }) as unknown as typeof fetch;

        const result = await fetchLatestMajors(4);

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({major: 21, version: '21.1.3'});
    });
});

// ── Snapshot test ────────────────────────────────────────────────────────────

describe('generateFile snapshot', () => {
    it('should match snapshot for standard merged properties', () => {
        const schemas = [
            {version: {major: 21, version: '21.1.3'} as VersionInfo, schema: SCHEMA_V21},
            {version: {major: 20, version: '20.2.1'} as VersionInfo, schema: SCHEMA_V20},
            {version: {major: 18, version: '18.2.0'} as VersionInfo, schema: SCHEMA_V18},
        ];

        const merged = mergeSchemas(schemas);
        const output = generateFile(merged, [21, 20, 18]);

        expect(output).toMatchSnapshot();
    });
});
