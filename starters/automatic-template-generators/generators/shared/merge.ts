import type {CliSchema, MergeConfig, MergedProperty, VersionInfo} from './types';

export function mergeSchemas(
    schemas: { version: VersionInfo; schema: CliSchema }[],
    config: MergeConfig,
): MergedProperty[] {
    const propMap = new Map<string, MergedProperty>();

    for (const {version, schema} of schemas) {
        const props = schema.properties ?? {};
        for (const [name, prop] of Object.entries(props)) {
            if (config.skipProperties.has(name)) continue;
            if (prop.visible === false) continue;
            if (prop['x-deprecated']) continue;
            if (prop.oneOf && !prop.enum) continue;

            const existing = propMap.get(name);
            if (existing) {
                if (!existing.supportedVersions.includes(version.major)) {
                    existing.supportedVersions.push(version.major);
                }
                if (prop.enum) {
                    const currentEnums = new Set(existing.enumValues ?? []);
                    for (const val of prop.enum) currentEnums.add(val);
                    existing.enumValues = [...currentEnums];
                }
            } else {
                const type = prop.type ?? (prop.enum ? 'string' : 'unknown');
                const promptType: 'select' | 'confirm' =
                    type === 'boolean' ? 'confirm' : 'select';

                propMap.set(name, {
                    name,
                    type,
                    description: prop.description ?? '',
                    defaultValue: prop.default,
                    enumValues: prop.enum ? [...prop.enum] : undefined,
                    supportedVersions: [version.major],
                    promptType,
                    friendlyMessage: config.friendlyMessages[name] ?? prop.description ?? name,
                });
            }
        }
    }

    const merged = [...propMap.values()];
    merged.sort((a, b) => {
        const pa = config.sortPriority[a.name] ?? 100;
        const pb = config.sortPriority[b.name] ?? 100;
        if (pa !== pb) return pa - pb;
        if (a.promptType === 'select' && b.promptType !== 'select') return -1;
        if (a.promptType !== 'select' && b.promptType === 'select') return 1;
        return a.name.localeCompare(b.name);
    });

    return merged;
}
