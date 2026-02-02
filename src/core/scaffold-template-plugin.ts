import { ScaffoldTemplatePluginOptions } from './types';

export const SCAFFOLD_TEMPLATE_PLUGIN_TYPE = 'scaffold-template';

export interface ScaffoldTemplatePlugin {
    argument: string;

    execute(options: ScaffoldTemplatePluginOptions): Promise<void>;
}
