import * as readline from 'node:readline';

import { PluginManager } from '@libria/plugin-loader';
import {
    ScaffoldTemplatePlugin,
    SCAFFOLD_TEMPLATE_PLUGIN_TYPE,
    ScaffoldTemplatePluginOption,
    ScaffoldTemplatePluginOptions,
    OptionTypeMap,
} from '@libria/scaffold-core';
import { Command, InteractiveCommand, InteractiveOption } from 'interactive-commander';

// ── Prompting helpers (readline-based, zero dependencies) ────────────────────

let rl: readline.Interface | null = null;

function getRL(): readline.Interface {
    if (!rl) rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return rl;
}

function closeRL(): void {
    rl?.close();
    rl = null;
}

function ask(question: string): Promise<string> {
    return new Promise(resolve => getRL().question(question, resolve));
}

async function promptSelect(
    message: string,
    choices: unknown[],
    defaultValue?: unknown
): Promise<string> {
    const items = choices.map(String);
    console.log(`\n  ${message}`);
    items.forEach((c, i) => {
        const marker = c === String(defaultValue) ? ' (default)' : '';
        console.log(`    ${i + 1}) ${c}${marker}`);
    });
    const answer = await ask(`  Choice [${defaultValue ?? items[0]}]: `);
    if (!answer.trim()) return String(defaultValue ?? items[0]);
    const idx = parseInt(answer, 10);
    if (idx >= 1 && idx <= items.length) return items[idx - 1];
    if (items.includes(answer.trim())) return answer.trim();
    return String(defaultValue ?? items[0]);
}

async function promptConfirm(message: string, defaultValue?: unknown): Promise<boolean> {
    const def = defaultValue === false ? 'N' : 'Y';
    const answer = await ask(`  ${message} (Y/n) [${def}]: `);
    if (!answer.trim()) return defaultValue !== false;
    return answer.trim().toLowerCase().startsWith('y');
}

async function promptInput(message: string, defaultValue?: unknown): Promise<string> {
    const suffix = defaultValue !== undefined ? ` [${defaultValue}]` : '';
    const answer = await ask(`  ${message}${suffix}: `);
    return answer.trim() || String(defaultValue ?? '');
}

// ── Option type detection ────────────────────────────────────────────────────

function isBooleanFlag(opt: ScaffoldTemplatePluginOption<keyof OptionTypeMap>): boolean {
    return !opt.flags.includes('<') && !opt.choices?.length;
}

// ── Prompt for a single option ───────────────────────────────────────────────

async function promptForOption(
    key: string,
    def: ScaffoldTemplatePluginOption<keyof OptionTypeMap>
): Promise<unknown> {
    const optType = def.type as string;
    if (optType === 'array') {
        const choices = (def.choices ?? []) as string[];
        const hint = choices.length ? ` (comma-separated, choices: ${choices.join(', ')})` : ' (comma-separated)';
        const defaultStr = Array.isArray(def.defaultValue)
            ? def.defaultValue.join(', ')
            : def.defaultValue !== undefined
              ? String(def.defaultValue)
              : '';
        const answer = await ask(`  ${def.description}${hint} [${defaultStr}]: `);
        const raw = answer.trim() || defaultStr;
        if (!raw) return choices.length ? [] : [];
        const parts = raw.split(',').map(s => s.trim()).filter(Boolean);
        return choices.length ? parts.filter(p => choices.includes(p)) : parts;
    }
    if (def.choices?.length) {
        return promptSelect(def.description, def.choices, def.defaultValue);
    }
    if (isBooleanFlag(def)) {
        return promptConfirm(def.description, def.defaultValue);
    }
    return promptInput(def.description, def.defaultValue);
}

// ── Iterative option resolution ──────────────────────────────────────────────

/**
 * Resolves plugin options iteratively:
 * 1. Call getOptions(collected) to get currently-relevant options
 * 2. Prompt for any unanswered options (or use CLI-provided values)
 * 3. If new options appeared, repeat — the plugin may reveal more
 *    options based on the newly-collected answers
 * 4. Stop when no new unanswered options appear
 */
async function resolveOptions(
    plugin: ScaffoldTemplatePlugin,
    collected: Record<string, unknown>,
    cliOpts: Record<string, unknown>
): Promise<void> {
    while (true) {
        const optionDefs = await plugin.getOptions(
            collected as ScaffoldTemplatePluginOptions & Partial<Record<string, unknown>>
        );

        let hasNewOptions = false;

        for (const [key, def] of Object.entries(optionDefs)) {
            if (def === undefined) continue;
            if (collected[key] !== undefined) continue;

            hasNewOptions = true;

            // Use CLI-provided value if available, otherwise prompt
            if (cliOpts[key] !== undefined) {
                collected[key] = cliOpts[key];
            } else {
                collected[key] = await promptForOption(key, def);
            }
        }

        if (!hasNewOptions) break;
    }
}

// ── Argv pre-parsing ─────────────────────────────────────────────────────────
function castValue(
    type: 'string' | 'boolean' | 'number' | 'array',
    value: string,
    choices?: string[]
): string | number | boolean | string[] {
    if (type === 'array') {
        const parts = value.split(',').map(s => s.trim()).filter(Boolean);
        if (choices?.length) {
            return parts.filter(p => choices.includes(p));
        }
        return parts;
    }
    if (type === 'number') return Number(value);
    if (type === 'boolean') return value === 'true';
    return value;
}

/**
 * Pre-parse process.argv to extract values for a set of option definitions.
 * This is a lightweight scan — no full Commander parse — so we can call
 * getOptions() with the values before Commander registers anything.
 */
function preParseArgv(
    defs: ScaffoldTemplatePluginOption<keyof OptionTypeMap>[]
): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    const args = [...process.argv];
    const remaining: string[] = [];

    // skip first two (node + cli path)
    remaining.push(args[0], args[1]);

    for (let i = 2; i < args.length; i++) {
        const arg = args[i];

        let matched = false;

        for (const def of defs) {
            const flagMatch = def.flags.match(/--([a-z][a-z-]*)/i);
            if (!flagMatch) continue;

            const baseName = flagMatch[1];
            const positive = `--${baseName}`;
            const negative = `--no-${baseName}`;
            const key = baseName.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

            // -----------------------
            // BOOLEAN NEGATION SUPPORT
            // -----------------------
            if (arg === negative) {
                result[key] = false;
                matched = true;
                break;
            }

            // -----------------------
            // BOOLEAN TRUE SUPPORT
            // -----------------------
            if (arg === positive && def.type === 'boolean') {
                result[key] = true;
                matched = true;
                break;
            }

            // -----------------------
            // --flag=value (or --flag=v1,v2 for array)
            // -----------------------
            if (arg.startsWith(`${positive}=`)) {
                const value = arg.split('=').slice(1).join('=').trim();
                if ((def.type as string) === 'array') {
                    result[key] = castValue('array', value, def.choices as string[] | undefined);
                } else {
                    result[key] = castValue(def.type as 'string' | 'boolean' | 'number', value);
                }
                matched = true;
                break;
            }

            // -----------------------
            // --flag value [value ...] (variadic for array)
            // -----------------------
            if (arg === positive && def.type !== 'boolean') {
                if ((def.type as string) === 'array') {
                    const collected: string[] = [];
                    for (let j = i + 1; j < args.length; j++) {
                        const next = args[j];
                        if (next.startsWith('--')) break;
                        if (def.choices?.length && !(def.choices as string[]).includes(next)) break;
                        collected.push(next);
                    }
                    result[key] = def.choices?.length
                        ? collected.filter(c => (def.choices as string[]).includes(c))
                        : collected;
                    i += collected.length;
                } else {
                    result[key] = castValue(def.type as 'string' | 'number', args[i + 1]);
                    i++;
                }
                matched = true;
                break;
            }
        }

        if (!matched) {
            remaining.push(arg);
        }
    }

    return result;
}

// ── Commander option registration ────────────────────────────────────────────

function registerOption(
    cmd: Command,
    def: ScaffoldTemplatePluginOption<keyof OptionTypeMap>
): void {
    const cmdOption = new InteractiveOption(def.flags, def.description);

    if (def.defaultValue !== undefined) {
        // Commander variadic options expect array default; scalar default for non-array
        if ((def.type as string) === 'array' && !Array.isArray(def.defaultValue)) {
            cmdOption.default([]);
        } else {
            cmdOption.default(def.defaultValue);
        }
    }
    if (def.choices?.length) {
        cmdOption.choices(def.choices.map(String));
    }
    if (def.required) {
        cmdOption.makeOptionMandatory();
    }

    cmd.addOption(cmdOption);
}

// ── Plugin command registration helper ────────────────────────────────────────
/**
 * Registers a single command for a plugin (or subcommand), wiring up
 * iterative option resolution and the execute action.
 */
async function registerPluginCommand(
    parentCmd: Command,
    plugin: ScaffoldTemplatePlugin,
    commandName: string,
    description: string,
    subcommand?: string
): Promise<void> {
    const sub = parentCmd
        .command(commandName)
        .description(description)
        .argument('<name>', 'Project name')
        .option('--dry-run', 'Simulate without writing files')
        .option('--no-dry-run')
        .option('--force', 'Overwrite existing files')
        .option('--no-force')
        .allowUnknownOption(true);

    // Iteratively resolve options from argv so --help shows the right set.
    const baseOpts: ScaffoldTemplatePluginOptions = { name: '', subcommand };
    let optionDefs = await plugin.getOptions(
        baseOpts as ScaffoldTemplatePluginOptions & Partial<Record<string, unknown>>
    );
    let preCollected: Record<string, unknown> = { ...baseOpts };
    let previousKeys = new Set<string>();

    while (true) {
        const currentKeys = new Set(Object.keys(optionDefs));
        const newKeys = [...currentKeys].filter(k => !previousKeys.has(k));
        if (newKeys.length === 0) break;

        const parsed = preParseArgv(
            Object.values(optionDefs) as ScaffoldTemplatePluginOption<keyof OptionTypeMap>[]
        );
        preCollected = { ...preCollected, ...parsed };
        previousKeys = currentKeys;

        optionDefs = await plugin.getOptions(
            preCollected as ScaffoldTemplatePluginOptions & Partial<Record<string, unknown>>
        );
    }

    for (const [, def] of Object.entries(optionDefs)) {
        if (def === undefined) continue;
        registerOption(sub, def);
    }

    sub.action(async (name: string, cliOpts: Record<string, unknown>) => {
        const collected: Record<string, unknown> = {
            name,
            subcommand,
            dryRun: cliOpts.dryRun,
            force: cliOpts.force,
        };

        await resolveOptions(plugin, collected, cliOpts);

        closeRL();
        await plugin.execute(collected as ScaffoldTemplatePluginOptions & Record<string, unknown>);
    });
}

// ── Main registration ─────────────────────────────────────────────────────────

export async function registerNewCommand(
    program: InteractiveCommand,
    pluginManager: PluginManager
): Promise<Command> {
    const newCmd = program.command('new').description('Create a new project from a template');

    const templates = pluginManager.getPluginsByType(SCAFFOLD_TEMPLATE_PLUGIN_TYPE);

    for (const meta of templates) {
        const plugin = pluginManager.getPlugin<ScaffoldTemplatePlugin>(meta.id);

        if (plugin.subcommands?.length) {
            // Plugin has subcommands — register a command group with nested subcommands
            const group = newCmd
                .command(plugin.argument)
                .description(`${plugin.argument} commands`);

            for (const subDef of plugin.subcommands) {
                await registerPluginCommand(
                    group,
                    plugin,
                    subDef.name,
                    subDef.description,
                    subDef.name
                );
            }
        } else {
            // No subcommands — register a single command directly
            await registerPluginCommand(
                newCmd,
                plugin,
                plugin.argument,
                `Create a new ${plugin.argument} project`
            );
        }
    }

    return newCmd;
}
