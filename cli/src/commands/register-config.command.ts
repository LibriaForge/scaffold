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

export async function registerConfigCommand(
    program: InteractiveCommand
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
                await resolvePackageDir(name);
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
