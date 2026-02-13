import {describe, it, expect, vi, beforeEach} from 'vitest';
import {Command} from 'commander';
import {registerGenerateCommand} from '../../src/commands/generate.command';
import type {PluginManager, PluginMetadata} from '@libria/plugin-loader';
import {SCAFFOLD_GENERATORS_TYPE} from '../../src/types';

function createMockPluginManager(generators: Array<{
    meta: Partial<PluginMetadata>;
    api: {
        argument: string;
        getOptions: ReturnType<typeof vi.fn>;
        execute: ReturnType<typeof vi.fn>;
    };
}>): PluginManager {
    const plugins = new Map(generators.map(g => [g.meta.id, g.api]));
    return {
        getPluginsByType: vi.fn((type: string) => {
            if (type === SCAFFOLD_GENERATORS_TYPE) {
                return generators.map(g => g.meta);
            }
            return [];
        }),
        getPlugin: vi.fn((id: string) => plugins.get(id)),
    } as unknown as PluginManager;
}

describe('registerGenerateCommand', () => {
    let program: Command;

    beforeEach(() => {
        program = new Command();
        program.exitOverride();
    });

    it('should register a subcommand for each generator plugin', async () => {
        const pm = createMockPluginManager([
            {
                meta: {id: 'gen:angular', name: 'angular', pluginType: SCAFFOLD_GENERATORS_TYPE, version: '1.0.0', dir: ''},
                api: {
                    argument: 'angular',
                    getOptions: vi.fn().mockResolvedValue({}),
                    execute: vi.fn(),
                },
            },
            {
                meta: {id: 'gen:react', name: 'react', pluginType: SCAFFOLD_GENERATORS_TYPE, version: '1.0.0', dir: ''},
                api: {
                    argument: 'react',
                    getOptions: vi.fn().mockResolvedValue({}),
                    execute: vi.fn(),
                },
            },
        ]);

        const generateCmd = await registerGenerateCommand(program, pm);
        const subcommands = generateCmd.commands.map(c => c.name());

        expect(subcommands).toContain('angular');
        expect(subcommands).toContain('react');
    });

    it('should register plugin-defined options on the subcommand', async () => {
        const pm = createMockPluginManager([
            {
                meta: {id: 'gen:angular', name: 'angular', pluginType: SCAFFOLD_GENERATORS_TYPE, version: '1.0.0', dir: ''},
                api: {
                    argument: 'angular',
                    getOptions: vi.fn().mockResolvedValue({
                        ssr: {
                            flags: '--ssr',
                            description: 'Enable server-side rendering',
                            defaultValue: false,
                        },
                        style: {
                            flags: '--style <type>',
                            description: 'Stylesheet format',
                            choices: ['css', 'scss', 'less'],
                            defaultValue: 'css',
                        },
                    }),
                    execute: vi.fn(),
                },
            },
        ]);

        const generateCmd = await registerGenerateCommand(program, pm);
        const angularCmd = generateCmd.commands.find(c => c.name() === 'angular')!;
        const optionLongs = angularCmd.options.map(o => o.long);

        expect(optionLongs).toContain('--ssr');
        expect(optionLongs).toContain('--style');
        expect(optionLongs).toContain('--dry-run');
        expect(optionLongs).toContain('--force');
    });

    it('should call execute with parsed options when the subcommand runs', async () => {
        const executeFn = vi.fn();
        const pm = createMockPluginManager([
            {
                meta: {id: 'gen:angular', name: 'angular', pluginType: SCAFFOLD_GENERATORS_TYPE, version: '1.0.0', dir: ''},
                api: {
                    argument: 'angular',
                    getOptions: vi.fn().mockResolvedValue({
                        ssr: {
                            flags: '--ssr',
                            description: 'Enable server-side rendering',
                        },
                    }),
                    execute: executeFn,
                },
            },
        ]);

        await registerGenerateCommand(program, pm);
        await program.parseAsync(['node', 'test', 'generate', 'angular', '--ssr']);

        expect(executeFn).toHaveBeenCalledOnce();
        expect(executeFn).toHaveBeenCalledWith(
            expect.objectContaining({
                ssr: true,
            }),
        );
    });

    it('should apply default values from plugin options', async () => {
        const executeFn = vi.fn();
        const pm = createMockPluginManager([
            {
                meta: {id: 'gen:angular', name: 'angular', pluginType: SCAFFOLD_GENERATORS_TYPE, version: '1.0.0', dir: ''},
                api: {
                    argument: 'angular',
                    getOptions: vi.fn().mockResolvedValue({
                        style: {
                            flags: '--style <type>',
                            description: 'Stylesheet format',
                            defaultValue: 'scss',
                        },
                    }),
                    execute: executeFn,
                },
            },
        ]);

        await registerGenerateCommand(program, pm);
        await program.parseAsync(['node', 'test', 'generate', 'angular']);

        expect(executeFn).toHaveBeenCalledWith(
            expect.objectContaining({
                style: 'scss',
            }),
        );
    });

    it('should reject invalid choices', async () => {
        const pm = createMockPluginManager([
            {
                meta: {id: 'gen:angular', name: 'angular', pluginType: SCAFFOLD_GENERATORS_TYPE, version: '1.0.0', dir: ''},
                api: {
                    argument: 'angular',
                    getOptions: vi.fn().mockResolvedValue({
                        style: {
                            flags: '--style <type>',
                            description: 'Stylesheet format',
                            choices: ['css', 'scss', 'less'],
                        },
                    }),
                    execute: vi.fn(),
                },
            },
        ]);

        await registerGenerateCommand(program, pm);

        await expect(
            program.parseAsync(['node', 'test', 'generate', 'angular', '--style', 'tailwind']),
        ).rejects.toThrow();
    });

    it('should enforce required options', async () => {
        const pm = createMockPluginManager([
            {
                meta: {id: 'gen:angular', name: 'angular', pluginType: SCAFFOLD_GENERATORS_TYPE, version: '1.0.0', dir: ''},
                api: {
                    argument: 'angular',
                    getOptions: vi.fn().mockResolvedValue({
                        apiKey: {
                            flags: '--api-key <key>',
                            description: 'API key',
                            required: true,
                        },
                    }),
                    execute: vi.fn(),
                },
            },
        ]);

        await registerGenerateCommand(program, pm);

        await expect(
            program.parseAsync(['node', 'test', 'generate', 'angular']),
        ).rejects.toThrow();
    });

    it('should include --dry-run and --force as base options', async () => {
        const executeFn = vi.fn();
        const pm = createMockPluginManager([
            {
                meta: {id: 'gen:angular', name: 'angular', pluginType: SCAFFOLD_GENERATORS_TYPE, version: '1.0.0', dir: ''},
                api: {
                    argument: 'angular',
                    getOptions: vi.fn().mockResolvedValue({}),
                    execute: executeFn,
                },
            },
        ]);

        await registerGenerateCommand(program, pm);
        await program.parseAsync(['node', 'test', 'generate', 'angular', '--dry-run', '--force']);

        expect(executeFn).toHaveBeenCalledWith(
            expect.objectContaining({
                dryRun: true,
                force: true,
            }),
        );
    });

    it('should handle generators with no custom options', async () => {
        const executeFn = vi.fn();
        const pm = createMockPluginManager([
            {
                meta: {id: 'gen:minimal', name: 'minimal', pluginType: SCAFFOLD_GENERATORS_TYPE, version: '1.0.0', dir: ''},
                api: {
                    argument: 'minimal',
                    getOptions: vi.fn().mockResolvedValue({}),
                    execute: executeFn,
                },
            },
        ]);

        await registerGenerateCommand(program, pm);
        await program.parseAsync(['node', 'test', 'generate', 'minimal']);

        expect(executeFn).toHaveBeenCalledOnce();
    });
});
