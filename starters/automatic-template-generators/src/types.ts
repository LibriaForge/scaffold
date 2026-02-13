export const SCAFFOLD_GENERATORS_TYPE = 'scaffold-automatic-generators';

export type TemplateGeneratorPluginOptions = {
    name: string;
    dryRun?: boolean;
    force?: boolean;
};

export type TemplateGeneratorPluginOption<TValue = string | boolean | number> = {
    readonly flags: string; // ex: --git-init
    readonly required?: boolean;
    readonly description: string;
    readonly defaultValue?: TValue | TValue[];
    readonly choices?: TValue[];
};

export type ExecuteOptions<TOpt extends object> = TemplateGeneratorPluginOptions & {
    [k in keyof TOpt]: TOpt[k] extends TemplateGeneratorPluginOption<infer TValue> ? TValue : never;
};

export interface TemplateGeneratorPlugin<TOpt extends Record<string, TemplateGeneratorPluginOption> = {}> {
    readonly argument: string;

    getOptions?(initialOptions: TemplateGeneratorPluginOptions): Promise<{
        [k in keyof TOpt]: TemplateGeneratorPluginOption;
    }>;

    execute(options: ExecuteOptions<TOpt>): Promise<void>;
}