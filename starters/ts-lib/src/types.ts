import {ScaffoldTemplatePluginOption} from "@libria/scaffold-core";

export interface Options {
    packageName: ScaffoldTemplatePluginOption<string>;
    description: ScaffoldTemplatePluginOption<string>;
    version: ScaffoldTemplatePluginOption<string>;
    author: ScaffoldTemplatePluginOption<string>;
    githubRepo: ScaffoldTemplatePluginOption<string>;
    gitInit: ScaffoldTemplatePluginOption<boolean>;
    install: ScaffoldTemplatePluginOption<boolean>;
    packageManager: ScaffoldTemplatePluginOption<string>;
}
