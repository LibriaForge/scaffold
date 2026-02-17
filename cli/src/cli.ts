#!/usr/bin/env node

import path from 'path';
import { fileURLToPath } from 'url';

import { PluginManager } from '@libria/plugin-loader';
import { InteractiveCommand, Option } from 'interactive-commander';

import { registerConfigCommand, registerNewCommand } from './commands';
import { getPluginPaths, listPackages } from './config';
import { resolvePackageDir } from './utils';

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

const pluginManager = new PluginManager();
await pluginManager.loadPlugins([...userPluginPaths, ...packagePaths]);
await pluginManager.unloadPlugin('libria:scaffold:ts-lib');
const program = new InteractiveCommand();
program.name('lb-scaffold').description('Scaffold new projects from templates');

await registerNewCommand(program, pluginManager);
await registerConfigCommand(program, pluginManager);

// Enable interactive mode by default
program.addOption(new Option('-i, --interactive', 'Run in interactive mode').default(true));

await program.interactive().parseAsync();
