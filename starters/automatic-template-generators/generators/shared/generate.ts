import type { GenerateFileConfig, MergedProperty } from './types';
import { escapeQuotes, toKebabCase } from './utils';

function generateVersionOption(
    I: (d: number) => string,
    config: GenerateFileConfig,
    sortedMajors: number[],
    depth: number
): string[] {
    const lines: string[] = [];
    lines.push(`${I(depth)}version: {`);
    lines.push(`${I(depth + 1)}type: 'string',`);
    lines.push(`${I(depth + 1)}flags: '--version <version>',`);
    lines.push(`${I(depth + 1)}description: '${config.versionDescription}',`);
    lines.push(`${I(depth + 1)}choices: [${sortedMajors.map(m => `'${m}'`).join(', ')}],`);
    lines.push(`${I(depth + 1)}defaultValue: '${sortedMajors[0]}',`);
    lines.push(`${I(depth)}},`);
    return lines;
}

function generateOptionDef(
    I: (d: number) => string,
    prop: MergedProperty,
    depth: number
): string[] {
    const lines: string[] = [];
    const flag = toKebabCase(prop.name);
    lines.push(`${I(depth)}${prop.name}: {`);
    lines.push(`${I(depth + 1)}type: '${prop.type === 'boolean' ? 'boolean' : 'string'}',`);
    if (prop.type === 'boolean') {
        lines.push(`${I(depth + 1)}flags: '--${flag}',`);
    } else {
        const isArray = prop.type === 'array';
        lines.push(`${I(depth + 1)}flags: '--${flag} <value${isArray ? '...' : ''}>',`);
    }

    lines.push(`${I(depth + 1)}description: '${escapeQuotes(prop.friendlyMessage)}',`);

    if (prop.enumValues) {
        lines.push(`${I(depth + 1)}choices: [${prop.enumValues.map(v => `'${v}'`).join(', ')}],`);
    }

    if (prop.defaultValue !== undefined) {
        if (typeof prop.defaultValue === 'string') {
            lines.push(`${I(depth + 1)}defaultValue: '${prop.defaultValue}',`);
        } else {
            lines.push(`${I(depth + 1)}defaultValue: ${prop.defaultValue},`);
        }
    }

    lines.push(`${I(depth)}},`);
    return lines;
}

export function generateFile(
    mergedProps: MergedProperty[],
    majors: number[],
    config: GenerateFileConfig
): string {
    const lines: string[] = [];
    const sortedMajors = [...majors].sort((a, b) => b - a);
    const I = (depth: number) => '    '.repeat(depth);

    // ── Imports
    lines.push(`import {execSync} from 'child_process';`);
    lines.push(`import {definePlugin, PluginContext} from '@libria/plugin-loader';`);
    lines.push(
        `import {ScaffoldTemplatePlugin, ScaffoldTemplatePluginOption, ExecuteOptions, SCAFFOLD_TEMPLATE_PLUGIN_TYPE, OptionTypeMap} from '@libria/scaffold-core';`
    );
    lines.push(``);

    // ── Options interface (union of all options across all versions)
    lines.push(`export interface ${config.interfaceName} {`);
    lines.push(`${I(1)}version: ScaffoldTemplatePluginOption<'string'>;`);
    for (const prop of mergedProps) {
        const valueType = prop.type === 'boolean' ? 'boolean' : 'string';
        lines.push(`${I(1)}${prop.name}: ScaffoldTemplatePluginOption<'${valueType}'>;`);
    }
    lines.push(`}`);
    lines.push(``);

    // ── Supported versions per option (used in execute to skip irrelevant flags)
    const versionSpecificProps = mergedProps.filter(
        p => !sortedMajors.every(m => p.supportedVersions.includes(m))
    );
    if (versionSpecificProps.length > 0) {
        lines.push(`const SUPPORTED_VERSIONS: Record<string, number[]> = {`);
        for (const prop of versionSpecificProps) {
            const sorted = [...prop.supportedVersions].sort((a, b) => b - a);
            lines.push(`${I(1)}${prop.name}: [${sorted.join(', ')}],`);
        }
        lines.push(`};`);
        lines.push(``);
    }

    // ── Plugin definition
    lines.push(`export default definePlugin<ScaffoldTemplatePlugin<${config.interfaceName}>>({`);
    lines.push(`${I(1)}id: '${config.pluginId}',`);
    lines.push(`${I(1)}name: '${config.pluginArgument}',`);
    lines.push(`${I(1)}pluginType: SCAFFOLD_TEMPLATE_PLUGIN_TYPE,`);
    lines.push(``);
    lines.push(`${I(1)}async create(_: PluginContext) {`);
    lines.push(`${I(2)}return {`);
    lines.push(`${I(3)}api: {`);
    lines.push(`${I(4)}argument: '${config.pluginArgument}',`);

    // ── getOptions: iterative resolution (version-first, then all options)
    lines.push(`${I(4)}getOptions: async (options) => {`);

    // Phase 1: return only version if not yet selected
    lines.push(`${I(5)}if (!options.version) {`);
    lines.push(`${I(6)}return {`);
    lines.push(...generateVersionOption(I, config, sortedMajors, 7));
    lines.push(`${I(6)}};`);
    lines.push(`${I(5)}}`);
    lines.push(``);

    // Phase 2: return all options for the selected version
    lines.push(
        `${I(5)}const allOptions: Record<string, ScaffoldTemplatePluginOption<keyof OptionTypeMap>> = {`
    );

    // Version option (included in phase 2 so it stays visible)
    lines.push(...generateVersionOption(I, config, sortedMajors, 6));

    // All merged options
    for (const prop of mergedProps) {
        lines.push(...generateOptionDef(I, prop, 6));
    }

    lines.push(`${I(5)}};`);
    lines.push(``);

    // Version filtering logic
    if (versionSpecificProps.length > 0) {
        lines.push(`${I(5)}const major = Number(options.version);`);
        lines.push(`${I(5)}for (const [key, versions] of Object.entries(SUPPORTED_VERSIONS)) {`);
        lines.push(`${I(6)}if (!versions.includes(major)) {`);
        lines.push(`${I(7)}delete allOptions[key];`);
        lines.push(`${I(6)}}`);
        lines.push(`${I(5)}}`);
        lines.push(``);
    }

    lines.push(`${I(5)}return allOptions;`);
    lines.push(`${I(4)}},`);

    // ── execute: builds the CLI command, skipping version-irrelevant flags
    lines.push(`${I(4)}execute: async (options: ExecuteOptions<${config.interfaceName}>) => {`);
    lines.push(`${I(5)}const {name, dryRun} = options;`);
    lines.push(`${I(5)}const major = Number(options.version);`);
    lines.push(`${I(5)}console.log('Executing for version:', major);`);

    lines.push(`${I(5)}const args: string[] = [];`);
    lines.push(``);

    for (const prop of mergedProps) {
        const flag = toKebabCase(prop.name);
        const optAccess = `options.${prop.name}`;
        const allMajorsSupported = sortedMajors.every(m => prop.supportedVersions.includes(m));

        // Version-specific options: check SUPPORTED_VERSIONS before adding flag
        if (!allMajorsSupported) {
            lines.push(`${I(5)}if (SUPPORTED_VERSIONS.${prop.name}.includes(major)) {`);
        }

        const indent = allMajorsSupported ? I(5) : I(6);

        if (prop.enumValues) {
            lines.push(`${indent}args.push(\`--${flag}=\${${optAccess}}\`);`);
        } else if (prop.type === 'boolean') {
            if (config.defaultFalseBooleans.has(prop.name)) {
                lines.push(`${indent}if (${optAccess}) args.push('--${flag}');`);
            } else {
                lines.push(`${indent}args.push(${optAccess} ? '--${flag}' : '--${flag}=false');`);
            }
        } else {
            lines.push(`${indent}if (${optAccess}) args.push(\`--${flag}=\${${optAccess}}\`);`);
        }

        if (!allMajorsSupported) {
            lines.push(`${I(5)}}`);
        }
    }

    lines.push(``);
    lines.push(`${I(5)}const cmd = \`${config.cliCommand} \${args.join(' ')}\`;`);
    lines.push(``);
    lines.push(`${I(5)}if (dryRun) {`);
    lines.push(`${I(6)}console.log('[dry-run] Would run:', cmd);`);
    lines.push(`${I(6)}return;`);
    lines.push(`${I(5)}}`);
    lines.push(``);
    lines.push(`${I(5)}console.log('Running:', cmd);`);
    lines.push(`${I(5)}execSync(cmd, {stdio: 'inherit'});`);
    lines.push(`${I(4)}},`);

    lines.push(`${I(3)}},`);
    lines.push(`${I(2)}};`);
    lines.push(`${I(1)}},`);
    lines.push(`});`);
    lines.push(``);

    return lines.join('\n');
}
