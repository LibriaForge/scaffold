import {definePlugin} from "@libria/plugin-loader";
import {SCAFFOLD_TEMPLATE_PLUGIN_TYPE, ScaffoldTemplatePlugin, ScaffoldTemplatePluginOptions} from "../../src";
import {input, select} from "@inquirer/prompts";
import {TsLibOptions} from "./types";

export default definePlugin<ScaffoldTemplatePlugin>(SCAFFOLD_TEMPLATE_PLUGIN_TYPE, 'ts-lib', {
    argument: 'ts-lib',
    async execute(options: ScaffoldTemplatePluginOptions): Promise<void> {
        console.log('Executing ts-lib plugin with options:', options);

        const {packageName, description, license} = await getUserOptions(options);

        console.log('Creating project with:', {
            packageName,
            description,
            license,
            ...options,
        });
    }
})

async function getUserOptions(options: ScaffoldTemplatePluginOptions): Promise<TsLibOptions> {
    // Use @inquirer/prompts directly for interactive questions
    const packageName = await input({
        message: 'Package name:',
        default: options.name,
    });

    const description = await input({
        message: 'Description:',
    });

    const license = await select({
        message: 'License:',
        choices: [
            {value: 'MIT'},
            {value: 'Apache-2.0'},
            {value: 'ISC'},
            {value: 'UNLICENSED'},
        ],
        default: 'MIT',
    });

    return {
        packageName,
        description,
        license,
        ...options,
    };
}