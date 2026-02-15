export const SCAFFOLD_TEMPLATE_PLUGIN_TYPE = 'scaffold-template';

export type OptionTypeMap = {
    string: string;
    boolean: boolean;
    number: number;
};

export type ScaffoldTemplatePluginOption<TType extends keyof OptionTypeMap> = {
    readonly type: TType;
    readonly flags: string; // ex: --git-init
    readonly required?: boolean;
    readonly description: string;
    readonly defaultValue?: OptionTypeMap[TType] | OptionTypeMap[TType][];
    readonly choices?: OptionTypeMap[TType][];
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
            [k in keyof TOpt]: ScaffoldTemplatePluginOption<keyof OptionTypeMap>;
        }>
    >;

    execute(options: ExecuteOptions<TOpt>): Promise<void>;
}
