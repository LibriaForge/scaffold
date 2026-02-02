#!/usr/bin/env node
import path from 'path';
import { fileURLToPath } from 'url';
import {InteractiveCommand, InteractiveOption, Option} from 'interactive-commander';
import {loadAllPlugins} from "@libria/plugin-loader";
import {SCAFFOLD_TEMPLATE_PLUGIN_TYPE, ScaffoldTemplatePlugin, ScaffoldTemplatePluginOptions} from "./core";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLUGINS_FOLDER = path.resolve(__dirname, '../templates').replace(/\\/g, '/');
const plugins = (await loadAllPlugins<ScaffoldTemplatePlugin>(
    `${PLUGINS_FOLDER}/**`,
    SCAFFOLD_TEMPLATE_PLUGIN_TYPE
)).sort((a, b) => a.name.localeCompare(b.name));

const templateChoices = plugins.map(plugin => plugin.name);

const program = new InteractiveCommand();

program
    .name('lb-scaffold')
    .description('Scaffold new projects from templates');

// Create subcommand to enable interactive hooks
program
    .command('create')
    .description('Create a new project from a template')
    .addOption(
        new InteractiveOption('-t, --template <name>', 'Template to use')
            .choices(templateChoices)
    )
    .addOption(
        new InteractiveOption('-n, --name <project-name>', 'Name of the new project folder')
            .makeOptionMandatory(true)
    )
    .addOption(
        new Option('--dry-run', 'Show what would be generated without writing files')
            .default(false)
    )
    .addOption(
        new Option('--force', 'Overwrite existing project folder if it exists')
            .default(false)
    )
    .action(async (options: ScaffoldTemplatePluginOptions & {template: string}) => {
        const plugin = plugins.find(plugin => plugin.api.argument === options.template);
        if (!plugin) {
            console.error(`Template '${options.template}' not found.`);
            process.exit(1);
        }
        await plugin.api.execute(options);
    });

// Enable interactive mode by default
program.addOption(
    new Option('-i, --interactive', 'Run in interactive mode')
        .default(true)
);

await program
    .interactive()
    .parseAsync();
