import { InteractiveCommand } from 'interactive-commander';

import {
    addPackage,
    addPluginGlob,
    findConfigPath,
    initConfig,
    listPackages,
    listPluginGlobs,
    loadConfig,
    removePackage,
    removePluginGlob,
} from '../config';
import { resolvePackageDir } from '../utils';
import { PluginManager, PluginMetadata } from '@libria/plugin-loader';
import { glob } from 'fast-glob';

async function assertCanRemovePlugins(
    pluginManager: PluginManager,
    pattern: string
): Promise<void> {
    const metadataToRemove = await pluginManager.discoverPlugins(pattern);
    const allMetadata = pluginManager.getAllMetadata();

    const toRemoveSet = new Set(metadataToRemove.map(m => m.id));

    // Check all loaded plugins to see if they depend on any plugin in the removal set
    const blockingPlugins = allMetadata
        .filter(p => !toRemoveSet.has(p.id)) // ignore plugins that are themselves being removed
        .map(p => {
            const blockedDeps = p.dependencies?.filter(d => toRemoveSet.has(d.id)) ?? [];
            return { plugin: p, blockedDeps };
        })
        .filter(x => x.blockedDeps.length > 0);

    if (blockingPlugins.length > 0) {
        // format the message
        const message = [
            `Cannot remove plugins matching pattern "${pattern}" because other plugins depend on them:`,
            ...blockingPlugins.map(
                bp =>
                    `- Plugin "${bp.plugin.id}" depends on: ${bp.blockedDeps.map(d => d.id).join(', ')}`
            ),
        ].join('\n');

        throw new Error(message);
    }
}

async function assertCanAddPlugins(pluginManager: PluginManager, pattern: string) {
    // discover all plugins that would be added by this glob
    const metadataToAdd = await pluginManager.discoverPlugins(pattern);

    // all currently loaded plugins
    const allMetadata = pluginManager.getAllMetadata();
    const allLoadedOrToAdd = new Map<string, PluginMetadata>();
    allMetadata.forEach(p => allLoadedOrToAdd.set(p.id, p));
    metadataToAdd.forEach(p => allLoadedOrToAdd.set(p.id, p)); // include plugins that will be added

    // check dependencies for each plugin we're about to add
    const missingDeps: { plugin: PluginMetadata; missing: string[] }[] = [];

    for (const plugin of metadataToAdd) {
        const deps = plugin.dependencies?.map(d => d.id) ?? [];
        const missing = deps.filter(depId => !allLoadedOrToAdd.has(depId));
        if (missing.length > 0) {
            missingDeps.push({ plugin, missing });
        }
    }

    if (missingDeps.length > 0) {
        const message = [
            `Cannot add plugins matching pattern "${pattern}" because dependencies are missing:`,
            ...missingDeps.map(
                md => `- Plugin "${md.plugin.id}" is missing dependencies: ${md.missing.join(', ')}`
            ),
        ].join('\n');
        throw new Error(message);
    }
}

export async function registerConfigCommand(
    program: InteractiveCommand,
    pluginManager: PluginManager
): Promise<InteractiveCommand> {
    const configCommand = program.command('config').description('Manage lb-scaffold configuration');

    configCommand
        .command('init')
        .description('Initialize a new .lbscaffold.json config file in the current directory')
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
                await assertCanAddPlugins(pluginManager, glob);
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
                await assertCanRemovePlugins(pluginManager, glob);
                await removePluginGlob(glob);
                console.log(`Removed plugin pattern: ${glob}`);
            } catch (error) {
                console.error((error as Error).message);
                process.exit(1);
            }
        });

    configCommand
        .command('list')
        .description('List all plugin patterns and packages in the config')
        .action(async () => {
            const configPath = await findConfigPath();
            if (!configPath) {
                console.log('No .lbscaffold.json config file found.');
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

            const packages = await listPackages();
            if (packages.length > 0) {
                console.log('\nPackages:');
                for (const pkg of packages) {
                    console.log(`  - ${pkg}`);
                }
            }
        });

    configCommand
        .command('show')
        .description('Show the full config file contents')
        .action(async () => {
            const configPath = await findConfigPath();
            if (!configPath) {
                console.log('No .lbscaffold.json config file found.');
                console.log('Run "lb-scaffold config init" to create one.');
                return;
            }

            console.log(`Config file: ${configPath}\n`);
            const config = await loadConfig(configPath);
            console.log(JSON.stringify(config, null, 2));
        });

    configCommand
        .command('add-package <name>')
        .description('Add an npm package as a plugin source')
        .action(async (name: string) => {
            try {
                await assertCanAddPlugins(pluginManager, await resolvePackageDir(name));
                await addPackage(name);
                console.log(`Added package: ${name}`);
            } catch (error) {
                console.error((error as Error).message);
                process.exit(1);
            }
        });

    configCommand
        .command('remove-package <name>')
        .description('Remove an npm package from plugin sources')
        .action(async (name: string) => {
            try {
                await assertCanRemovePlugins(pluginManager, await resolvePackageDir(name));
                await removePackage(name);
                console.log(`Removed package: ${name}`);
            } catch (error) {
                console.error((error as Error).message);
                process.exit(1);
            }
        });

    configCommand
        .command('list-packages')
        .description('List all npm packages configured as plugin sources')
        .action(async () => {
            const configPath = await findConfigPath();
            if (!configPath) {
                console.log('No .lbscaffold.json config file found.');
                console.log('Run "lb-scaffold config init" to create one.');
                return;
            }

            const packages = await listPackages();
            if (packages.length === 0) {
                console.log('No packages configured.');
            } else {
                console.log('Packages:');
                for (const pkg of packages) {
                    console.log(`  - ${pkg}`);
                }
            }
        });

    return configCommand;
}
