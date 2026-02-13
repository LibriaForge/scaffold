import { ScaffoldTemplatePluginOption } from '@libria/scaffold-core';

export interface InitOptions {
    gitInit: ScaffoldTemplatePluginOption<boolean>;
    packageManager: ScaffoldTemplatePluginOption<string>;
}

export interface AddOptions {
    workspace: ScaffoldTemplatePluginOption<string>;
    template: ScaffoldTemplatePluginOption<string>;
}
