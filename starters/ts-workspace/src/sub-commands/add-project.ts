import path from 'path';

import { PluginContext } from '@libria/plugin-loader';
import { ExecuteOptions, ScaffoldTemplatePlugin } from '@libria/scaffold-core';
import fs from 'fs-extra';

import ts from 'typescript';

import { AddOptions } from '../types';

/** Minimal tsconfig shape for reading/patching. */
interface TsConfigJson {
    extends?: string;
    compilerOptions?: Record<string, unknown>;
    references?: Array<{ path: string }>;
}

/** Minimal package.json shape with workspaces. */
interface PackageJsonWithWorkspaces {
    workspaces: string[];
    [key: string]: unknown;
}

function parseTsconfig<T = unknown>(fileName: string, text: string): T {
    const { config, error } = ts.parseConfigFileTextToJson(fileName, text);
    if (error) {
        const msg = ts.flattenDiagnosticMessageText(error.messageText, '\n');
        throw new Error(`Failed to parse ${fileName}: ${msg}`);
    }
    return config as T;
}

const TEMPLATES: Record<string, string> = {
    'ts-lib': 'libria:scaffold:ts-lib',
    angular: 'libria:scaffold:angular',
    nestjs: 'libria:scaffold:nestjs',
    nextjs: 'libria:scaffold:nextjs',
};

export const templateChoices = Object.keys(TEMPLATES);

export async function addProject(
    ctx: PluginContext,
    opts: ExecuteOptions<AddOptions>
): Promise<void> {
    const workspaceDir = path.resolve(process.cwd(), opts.workspace);

    // Verify the workspace path is valid
    const pkgPath = path.join(workspaceDir, 'package.json');
    if (await fs.pathExists(pkgPath)) {
        const pkg = await fs.readJson(pkgPath);
        if (!pkg.workspaces) {
            console.error(`"${opts.workspace}" has a package.json but no "workspaces" field.`);
            process.exit(1);
        }
    } else {
        console.error(`No package.json found in "${opts.workspace}". Is this a workspace?`);
        process.exit(1);
    }

    const pluginId = TEMPLATES[opts.template];
    if (!pluginId) {
        console.error(`Unknown template: ${opts.template}`);
        process.exit(1);
    }

    const packagesDir = path.join(workspaceDir, opts.basePath || '');
    await fs.ensureDir(packagesDir);
    const packageDir = path.join(packagesDir, opts.name);

    const templatePlugin = ctx.getPlugin<ScaffoldTemplatePlugin<object>>(pluginId);

    // chdir into packages/ so template plugins create the project with a clean name
    const originalCwd = process.cwd();
    process.chdir(packagesDir);
    try {
        const executeOpts = {
            ...opts,
            name: opts.name,
            gitInit: false,
            install: false,
        };
        await templatePlugin.execute(executeOpts as ExecuteOptions<object>);
    } finally {
        process.chdir(originalCwd);
    }

    await postAdd(workspaceDir, packageDir, opts.dryRun);
}

/**
 * After a template plugin generates a package, patch workspace configs:
 * 1. Package tsconfig.json — set extends to workspace tsconfig.base.json,
 *    remove compilerOptions already covered by the base
 * 2. Workspace root tsconfig.json — add project reference
 * 3. Workspace root package.json — add to workspaces array
 */
async function postAdd(workspaceDir: string, packageDir: string, dryRun?: boolean): Promise<void> {
    const packageRelative = path.relative(workspaceDir, packageDir);

    // 1. Patch package tsconfig.json
    const pkgTsconfigPath = path.join(packageDir, 'tsconfig.json');
    const baseTsconfigPath = path.join(workspaceDir, 'tsconfig.base.json');

    if ((await fs.pathExists(pkgTsconfigPath)) && (await fs.pathExists(baseTsconfigPath))) {
        const extendsPath = path.relative(packageDir, baseTsconfigPath).replace(/\\/g, '/');
        const baseTsconfig = parseTsconfig<TsConfigJson>(baseTsconfigPath, await fs.readFile(baseTsconfigPath, 'utf-8'));
        const baseKeys = new Set(Object.keys(baseTsconfig.compilerOptions ?? {}));

        const pkgTsconfig = parseTsconfig<TsConfigJson>(pkgTsconfigPath, await fs.readFile(pkgTsconfigPath, 'utf-8'));

        // Set extends
        pkgTsconfig.extends = extendsPath;

        // Strip compilerOptions already in base
        if (pkgTsconfig.compilerOptions) {
            for (const key of baseKeys) {
                delete pkgTsconfig.compilerOptions[key];
            }
            if (Object.keys(pkgTsconfig.compilerOptions).length === 0) {
                delete pkgTsconfig.compilerOptions;
            }
        }

        if (dryRun) {
            console.log(`[dry-run] Would patch ${pkgTsconfigPath}`);
            console.log(JSON.stringify(pkgTsconfig, null, 2));
        } else {
            await fs.writeJson(pkgTsconfigPath, pkgTsconfig, { spaces: 2 });
            console.log(`Patched: ${pkgTsconfigPath}`);
        }
    }

    // 2. Add project reference to workspace tsconfig.json
    const wsTsconfigPath = path.join(workspaceDir, 'tsconfig.json');
    if (await fs.pathExists(wsTsconfigPath)) {
        const wsTsconfig = parseTsconfig<TsConfigJson>(wsTsconfigPath, await fs.readFile(wsTsconfigPath, 'utf-8'));
        const refPath = packageRelative.replace(/\\/g, '/');

        if (!wsTsconfig.references) wsTsconfig.references = [];
        const alreadyReferenced = wsTsconfig.references.some(
            (ref: { path: string }) => ref.path === refPath
        );
        if (!alreadyReferenced) {
            wsTsconfig.references.push({ path: refPath });

            if (dryRun) {
                console.log(`[dry-run] Would add reference "${refPath}" to ${wsTsconfigPath}`);
            } else {
                await fs.writeJson(wsTsconfigPath, wsTsconfig, { spaces: 2 });
                console.log(`Added reference "${refPath}" to ${wsTsconfigPath}`);
            }
        }
    }

    // 3. Add to workspace package.json workspaces array
    const wsPkgPath = path.join(workspaceDir, 'package.json');
    const wsPkg = (await fs.readJson(wsPkgPath)) as PackageJsonWithWorkspaces;
    const wsEntry = packageRelative.replace(/\\/g, '/');

    const workspaces = Array.isArray(wsPkg.workspaces) ? wsPkg.workspaces : [];
    if (!workspaces.includes(wsEntry)) {
        workspaces.push(wsEntry);
        wsPkg.workspaces = workspaces;

        if (dryRun) {
            console.log(`[dry-run] Would add "${wsEntry}" to workspaces in ${wsPkgPath}`);
        } else {
            await fs.writeJson(wsPkgPath, wsPkg, { spaces: 4 });
            console.log(`Added "${wsEntry}" to workspaces in ${wsPkgPath}`);
        }
    }
}
