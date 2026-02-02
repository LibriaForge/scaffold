import {ScaffoldTemplatePluginOptions} from "../../src";

export type TsLibOptions = ScaffoldTemplatePluginOptions & {
    packageName: string,
    description: string,
    license: string
};