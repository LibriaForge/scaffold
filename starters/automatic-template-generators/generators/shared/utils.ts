export function escapeQuotes(s: string): string {
    return s.replace(/'/g, "\\'");
}

export function toKebabCase(s: string): string {
    return s.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

export function compareVersions(a: string, b: string): number {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
        if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0);
    }
    return 0;
}

export function parseMajor(version: string): number {
    return parseInt(version.split('.')[0], 10);
}

export function findBestVersionForMajor(versions: string[], major: number): string | undefined {
    const matching = versions
        .filter((v) => parseMajor(v) === major && !v.includes('-'))
        .sort(compareVersions);
    return matching[matching.length - 1];
}
