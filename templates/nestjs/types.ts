import { ScaffoldTemplatePluginOptions } from '../../src';

export type NestJSPackageManager = 'npm' | 'yarn' | 'pnpm';

export type NestJSOptions = ScaffoldTemplatePluginOptions & {
    packageManager: NestJSPackageManager;
    strict: boolean;
    skipGit: boolean;
    skipInstall: boolean;
};
