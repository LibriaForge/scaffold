import type {CliSchema, FetchSchemasConfig, NpmRegistryData, NpmVersionData, VersionInfo} from './types';
import {extractFileFromTgz} from './tar';
import {findBestVersionForMajor, parseMajor} from './utils';

export async function fetchJson<T>(url: string): Promise<T> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Fetch failed: ${url} (${res.status})`);
    return res.json() as Promise<T>;
}

export async function fetchBuffer(url: string): Promise<Buffer> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Fetch failed: ${url} (${res.status})`);
    const arrayBuf = await res.arrayBuffer();
    return Buffer.from(arrayBuf);
}

export async function fetchLatestMajors(npmPackageName: string, count: number): Promise<VersionInfo[]> {
    const data = await fetchJson<NpmRegistryData>(`https://registry.npmjs.org/${npmPackageName}`);
    const distTags = data['dist-tags'];
    const allVersions = Object.keys(data.versions);

    const latestVersion = distTags['latest'];
    if (!latestVersion) throw new Error('No latest dist-tag found');

    const latestMajor = parseMajor(latestVersion);
    const results: VersionInfo[] = [
        {major: latestMajor, version: latestVersion},
    ];

    for (let i = 1; i < count; i++) {
        const targetMajor = latestMajor - i;
        const ltsTag = distTags[`v${targetMajor}-lts`];
        if (ltsTag) {
            results.push({major: targetMajor, version: ltsTag});
        } else {
            const fallback = findBestVersionForMajor(allVersions, targetMajor);
            if (fallback) {
                results.push({major: targetMajor, version: fallback});
            }
        }
    }

    return results;
}

export async function fetchSchemas(
    versions: VersionInfo[],
    config: FetchSchemasConfig,
): Promise<{ version: VersionInfo; schema: CliSchema }[]> {
    const results: { version: VersionInfo; schema: CliSchema }[] = [];

    for (const vi of versions) {
        try {
            const versionData = await fetchJson<NpmVersionData>(
                `https://registry.npmjs.org/${config.schematicsPackage}/${vi.version}`,
            );
            const tarballUrl = versionData.dist.tarball;
            const tgz = await fetchBuffer(tarballUrl);
            const schemaBuffer = extractFileFromTgz(tgz, config.schemaPath);

            if (schemaBuffer) {
                const schema = JSON.parse(schemaBuffer.toString('utf-8')) as CliSchema;
                results.push({version: vi, schema});
            } else {
                console.warn(`schema.json not found in tarball for ${config.schematicsPackage}@${vi.version}`);
            }
        } catch (err) {
            console.warn(
                `Could not fetch schema for ${config.schematicsPackage}@${vi.version}: ${err instanceof Error ? err.message : err}`,
            );
        }
    }

    return results;
}
