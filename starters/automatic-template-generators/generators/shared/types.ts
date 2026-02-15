// ── Generic schema types ─────────────────────────────────────────────────────

export type SchemaProperty = {
    type?: string;
    description?: string;
    default?: unknown;
    enum?: string[];
    /** For type "array", allowed values per element (e.g. Angular items.enum). */
    items?: { type?: string; enum?: string[] };
    visible?: boolean;
    'x-deprecated'?: string;
    'x-user-analytics'?: unknown;
    oneOf?: unknown[];
    alias?: string;
};

export type CliSchema = {
    properties?: Record<string, SchemaProperty>;
    required?: string[];
};

export type VersionInfo = {
    major: number;
    version: string;
};

export type MergedProperty = {
    name: string;
    type: string;
    description: string;
    defaultValue?: unknown;
    enumValues?: string[];
    supportedVersions: number[];
    promptType: 'select' | 'confirm';
    friendlyMessage: string;
};

// ── npm types ────────────────────────────────────────────────────────────────

export type NpmRegistryData = {
    'dist-tags': Record<string, string>;
    versions: Record<string, { version: string }>;
};

export type NpmVersionData = {
    dist: { tarball: string };
};

// ── Config types ─────────────────────────────────────────────────────────────

export type MergeConfig = {
    skipProperties: Set<string>;
    friendlyMessages: Record<string, string>;
    sortPriority: Record<string, number>;
};

export type FetchSchemasConfig = {
    schematicsPackage: string;
    schemaPath: string;
};

export type GenerateFileConfig = {
    frameworkName: string;
    interfaceName: string;
    pluginId: string;
    pluginArgument: string;
    cliCommand: string;
    versionDescription: string;
    defaultFalseBooleans: Set<string>;
};
