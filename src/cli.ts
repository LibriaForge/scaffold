#!/usr/bin/env node
import path from 'path';
import { fileURLToPath } from 'url';
import {InteractiveCommand, InteractiveOption, Option} from 'interactive-commander';
import {LibriaPlugin, loadAllPlugins} from "@libria/plugin-loader";
import {SCAFFOLD_TEMPLATE_PLUGIN_TYPE, ScaffoldTemplatePlugin, ScaffoldTemplatePluginOptions} from "./core";
import {
    initConfig,
    addPluginGlob,
    removePluginGlob,
    listPluginGlobs,
    getPluginPaths,
    findConfigPath,
    loadConfig
} from "./config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLUGINS_FOLDER = path.resolve(__dirname, '../templates').replace(/\\/g, '/');

// Load built-in plugins
const builtInPlugins = await loadAllPlugins<ScaffoldTemplatePlugin>(
    `${PLUGINS_FOLDER}/**`,
    SCAFFOLD_TEMPLATE_PLUGIN_TYPE
);

// Load user plugins from config
const userPluginPaths = await getPluginPaths();
const userPlugins: LibriaPlugin<ScaffoldTemplatePlugin>[] = [];

for (const pluginPath of userPluginPaths) {
    try {
        const loaded = await loadAllPlugins<ScaffoldTemplatePlugin>(
            pluginPath,
            SCAFFOLD_TEMPLATE_PLUGIN_TYPE
        );
        userPlugins.push(...loaded);
    } catch (error) {
        console.warn(`Warning: Failed to load plugins from '${pluginPath}': ${(error as Error).message}`);
    }
}

// Merge and deduplicate plugins (user plugins override built-in with same name)
const pluginMap = new Map<string, LibriaPlugin<ScaffoldTemplatePlugin>>();
for (const plugin of builtInPlugins) {
    pluginMap.set(plugin.name, plugin);
}
for (const plugin of userPlugins) {
    pluginMap.set(plugin.name, plugin);
}
const plugins = Array.from(pluginMap.values()).sort((a, b) => a.name.localeCompare(b.name));

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
        new InteractiveOption('--force', 'Overwrite existing project folder if it exists')
            .default(false)
    )
    .action(async (options: ScaffoldTemplatePluginOptions & {template: string}) => {
        const plugin = plugins.find(plugin => plugin.api.argument === options.template);
        if (!plugin) {
            console.error(`Template '${options.template}' not found.`);
            process.exit(1);
        }
        try {
            await plugin.api.execute(options);
        } catch (error) {
            console.error('Error creating project:', error);
            process.exit(1);
        }
    });

// Config command
const configCommand = program
    .command('config')
    .description('Manage lb-scaffold configuration');

configCommand
    .command('init')
    .description('Initialize a new .lbscaffold config file in the current directory')
    .action(async () => {
        try {
            const configPath = await initConfig();
            console.log(`Created config file: ${configPath}`);
        } catch (error) {
            console.error((error as Error).message);
            process.exit(1);
        }
    });

configCommand
    .command('add <glob>')
    .description('Add a plugin glob pattern to the config')
    .action(async (glob: string) => {
        try {
            await addPluginGlob(glob);
            console.log(`Added plugin pattern: ${glob}`);
        } catch (error) {
            console.error((error as Error).message);
            process.exit(1);
        }
    });

configCommand
    .command('remove <glob>')
    .description('Remove a plugin glob pattern from the config')
    .action(async (glob: string) => {
        try {
            await removePluginGlob(glob);
            console.log(`Removed plugin pattern: ${glob}`);
        } catch (error) {
            console.error((error as Error).message);
            process.exit(1);
        }
    });

configCommand
    .command('list')
    .description('List all plugin glob patterns in the config')
    .action(async () => {
        const configPath = await findConfigPath();
        if (!configPath) {
            console.log('No .lbscaffold config file found.');
            console.log('Run "lb-scaffold config init" to create one.');
            return;
        }

        console.log(`Config file: ${configPath}\n`);

        const globs = await listPluginGlobs();
        if (globs.length === 0) {
            console.log('No plugin patterns configured.');
        } else {
            console.log('Plugin patterns:');
            for (const glob of globs) {
                console.log(`  - ${glob}`);
            }
        }
    });

configCommand
    .command('show')
    .description('Show the full config file contents')
    .action(async () => {
        const configPath = await findConfigPath();
        if (!configPath) {
            console.log('No .lbscaffold config file found.');
            console.log('Run "lb-scaffold config init" to create one.');
            return;
        }

        console.log(`Config file: ${configPath}\n`);
        const config = await loadConfig(configPath);
        console.log(JSON.stringify(config, null, 2));
    });

// Enable interactive mode by default
program.addOption(
    new Option('-i, --interactive', 'Run in interactive mode')
        .default(true)
);

await program
    .interactive()
    .parseAsync();
