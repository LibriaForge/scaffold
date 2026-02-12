import path from "path";
import {fileURLToPath} from "url";
import {Command} from 'commander';
import {PluginManager} from '@libria/plugin-loader';
import {registerGenerateCommand} from './commands';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLUGINS_FOLDER = path.resolve(__dirname, '../generators').replace(/\\/g, '/');
const pluginManager = new PluginManager();
await pluginManager.loadPlugins([`${PLUGINS_FOLDER}/**`]);

const program = new Command()
    .name('scaffold')
    .description('Scaffold starter project generators')
    .version('0.0.0');

await registerGenerateCommand(program, pluginManager);

program.parse();