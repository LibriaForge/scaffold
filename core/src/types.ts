export const SCAFFOLD_TEMPLATE_PLUGIN_TYPE = 'scaffold-template';

export type ScaffoldTemplatePluginOption<TValue = string | boolean | number> = {
    readonly flags: string; // ex: --git-init
    readonly required?: boolean;
    readonly description: string;
    readonly defaultValue?: TValue | TValue[];
    readonly choices?: TValue[];
};

export type SubcommandDefinition = {
    readonly name: string;
    readonly description: string;
};

export type ResolvedOptions<TOpt extends object> = {
    [k in keyof TOpt]: TOpt[k] extends ScaffoldTemplatePluginOption<infer TValue> ? TValue : never;
};

export type ExecuteOptions<TOpt extends object> = ScaffoldTemplatePluginOptions & {
    [k in keyof TOpt]: TOpt[k] extends ScaffoldTemplatePluginOption<infer TValue> ? TValue : never;
};

export type ScaffoldTemplatePluginOptions = {
    name: string;
    subcommand?: string;
    dryRun?: boolean;
    force?: boolean;
};

export interface ScaffoldTemplatePlugin<TOpt extends object = object> {
    readonly argument: string;
    readonly subcommands?: SubcommandDefinition[];

    getOptions(options: ScaffoldTemplatePluginOptions & Partial<ResolvedOptions<TOpt>>): Promise<
        Partial<{
            [k in keyof TOpt]: ScaffoldTemplatePluginOption;
        }>
    >;

    execute(options: ExecuteOptions<TOpt>): Promise<void>;
}
