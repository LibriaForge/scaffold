import {ScaffoldTemplatePluginOptions} from "../../src";

export type AngularVersion = 'latest' | '20' | '19' | '18' | '17' | '16';

export type AngularOptions = ScaffoldTemplatePluginOptions & {
    version: AngularVersion;
    style: 'css' | 'scss' | 'sass' | 'less';
    routing: boolean;
    ssr: boolean;
    skipGit: boolean;
    skipInstall: boolean;
};
