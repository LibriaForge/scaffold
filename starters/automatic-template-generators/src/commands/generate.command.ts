import {Command, Option} from 'commander';
import {PluginManager} from "@libria/plugin-loader";
import {SCAFFOLD_GENERATORS_TYPE, TemplateGeneratorPlugin, TemplateGeneratorPluginOption} from "../types";

export async function registerGenerateCommand(program: Command, pluginManager: PluginManager): Promise<Command> {
    const generateCmd = program
        .command('generate')
        .description('Generate an automatic scaffold template plugin');

    const generatorsList = pluginManager.getPluginsByType(SCAFFOLD_GENERATORS_TYPE);

    for (const meta of generatorsList) {
        const generator = pluginManager.getPlugin<TemplateGeneratorPlugin>(meta.id);
        const optionDefs = generator.getOptions ? await generator.getOptions({name: ''}) : {};

        const sub = generateCmd
            .command(generator.argument)
            .description(`Generate a ${generator.argument} project`)
            .option('--dry-run', 'Simulate without writing files', false)
            .option('--force', 'Overwrite existing files', false);

        for (const [, opt] of Object.entries(optionDefs) as [string, TemplateGeneratorPluginOption][]) {
            const cmdOption = new Option(opt.flags, opt.description);

            if (opt.defaultValue !== undefined) {
                cmdOption.default(opt.defaultValue);
            }

            if (opt.choices?.length) {
                cmdOption.choices(opt.choices.map(String));
            }

            if (opt.required) {
                cmdOption.makeOptionMandatory();
            }

            sub.addOption(cmdOption);
        }

        sub.action(async (opts: Record<string, unknown>) => {
            await generator.execute({...opts} as any);
        });
    }

    return generateCmd;
}