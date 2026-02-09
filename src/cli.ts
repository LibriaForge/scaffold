import path from 'path';
import { fileURLToPath } from 'url';

import { PluginManager } from '@libria/plugin-loader';
import { InteractiveCommand, Option } from 'interactive-commander';

import { registerConfigCommand, registerNewCommand } from './commands';
import { getPluginPaths, listPackages } from './config';
import { resolvePackageDir } from './utils';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLUGINS_FOLDER = path.resolve(__dirname, '../templates').replace(/\\/g, '/');

// Load user plugins from config
const userPluginPaths = await getPluginPaths();

// Load plugins from npm packages
const packageNames = await listPackages();

const packagePaths = await Promise.all(
    packageNames.map(async name => {
        const dir = await resolvePackageDir(name);
        return dir;
    })
);

console.log(packagePaths);
const pluginManager = new PluginManager();
await pluginManager.loadPlugins([PLUGINS_FOLDER, ...userPluginPaths, ...packagePaths]);

const program = new InteractiveCommand();
program.name('lb-scaffold').description('Scaffold new projects from templates');

await registerNewCommand(program, pluginManager);
await registerConfigCommand(program);

// Enable interactive mode by default
program.addOption(new Option('-i, --interactive', 'Run in interactive mode').default(true));

await program.interactive().parseAsync();
