import {ScaffoldTemplatePluginOptions} from "../../src";

export type TsLibInitialOptions = ScaffoldTemplatePluginOptions & {
    packageName: string,
    description: string,
    version: string,
    githubRepo: string,
    author: string,
};