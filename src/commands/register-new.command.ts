import * as readline from 'node:readline';

import { PluginManager } from '@libria/plugin-loader';
import { Command, InteractiveCommand, Option } from 'interactive-commander';

import {
    ScaffoldTemplatePlugin,
    SCAFFOLD_TEMPLATE_PLUGIN_TYPE,
    ScaffoldTemplatePluginOption,
    ScaffoldTemplatePluginOptions,
} from '../core';

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

function isBooleanFlag(opt: ScaffoldTemplatePluginOption): boolean {
    return !opt.flags.includes('<') && !opt.choices?.length;
}

// ── Prompt for a single option ───────────────────────────────────────────────

async function promptForOption(key: string, def: ScaffoldTemplatePluginOption): Promise<unknown> {
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
/**
 * Pre-parse process.argv to extract values for a set of option definitions.
 * This is a lightweight scan — no full Commander parse — so we can call
 * getOptions() with the values before Commander registers anything.
 */
function preParseArgv(
    optionDefs: Record<string, ScaffoldTemplatePluginOption>
): Record<string, string> {
    const args = process.argv.slice(2);
    const result: Record<string, string> = {};

    for (const [key, def] of Object.entries(optionDefs)) {
        if (def === undefined) continue;

        // Extract the --flag-name from the flags string
        const flagMatch = def.flags.match(/--([a-z][a-z-]*)/i);
        if (!flagMatch) continue;
        const flagName = `--${flagMatch[1]}`;

        // Check for --flag value  or  --flag=value
        const eqArg = args.find(a => a.startsWith(`${flagName}=`));
        if (eqArg) {
            result[key] = eqArg.split('=')[1];
            continue;
        }

        const idx = args.indexOf(flagName);
        if (idx !== -1 && idx + 1 < args.length) {
            // Boolean flags (no <value> in flags string) don't consume next arg
            if (!def.flags.includes('<')) continue;
            result[key] = args[idx + 1];
        }
    }

    return result;
}

// ── Commander option registration ────────────────────────────────────────────

function registerOption(cmd: Command, def: ScaffoldTemplatePluginOption): void {
    const cmdOption = new Option(def.flags, def.description);

    if (def.defaultValue !== undefined) {
        cmdOption.default(def.defaultValue);
    }
    if (def.choices?.length) {
        cmdOption.choices(def.choices.map(String));
    }
    if (def.required) {
        cmdOption.makeOptionMandatory();
    }

    cmd.addOption(cmdOption);
}

export async function registerNewCommand(
    program: InteractiveCommand,
    pluginManager: PluginManager
): Promise<Command> {
    const newCmd = program.command('new').description('Create a new project from a template');

    const templates = pluginManager.getPluginsByType(SCAFFOLD_TEMPLATE_PLUGIN_TYPE);

    for (const meta of templates) {
        const plugin = pluginManager.getPlugin<ScaffoldTemplatePlugin>(meta.id);

        const sub = newCmd
            .command(plugin.argument)
            .description(`Create a new ${plugin.argument} project`)
            .argument('<name>', 'Project name')
            .option('--dry-run', 'Simulate without writing files', false)
            .option('--force', 'Overwrite existing files', false)
            .allowUnknownOption(true);

        // Iteratively resolve options from argv so --help shows the right set.
        // Phase 1: get initial options, pre-parse their values from argv
        // Phase N: feed values back into getOptions until options stabilize
        let optionDefs = await plugin.getOptions({ name: '' } as ScaffoldTemplatePluginOptions &
            Partial<Record<string, unknown>>);
        let preCollected: Record<string, unknown> = { name: '' };
        let previousKeys = new Set<string>();

        while (true) {
            const currentKeys = new Set(Object.keys(optionDefs));
            const newKeys = [...currentKeys].filter(k => !previousKeys.has(k));
            if (newKeys.length === 0) break;

            // Pre-parse any new option values from argv
            const parsed = preParseArgv(optionDefs as Record<string, ScaffoldTemplatePluginOption>);
            preCollected = { ...preCollected, ...parsed };
            previousKeys = currentKeys;

            // Ask plugin for options again with the parsed values
            optionDefs = await plugin.getOptions(
                preCollected as ScaffoldTemplatePluginOptions & Partial<Record<string, unknown>>
            );
        }

        // Register the fully-resolved options with Commander
        for (const [, def] of Object.entries(optionDefs)) {
            if (def === undefined) continue;
            registerOption(sub, def);
        }

        sub.action(async (name: string, cliOpts: Record<string, unknown>) => {
            const collected: Record<string, unknown> = {
                name,
                dryRun: cliOpts.dryRun,
                force: cliOpts.force,
            };

            // Iteratively resolve all options (prompt for missing ones)
            await resolveOptions(plugin, collected, cliOpts);

            closeRL();
            await plugin.execute(
                collected as ScaffoldTemplatePluginOptions & Record<string, unknown>
            );
        });
    }

    return newCmd;
}
