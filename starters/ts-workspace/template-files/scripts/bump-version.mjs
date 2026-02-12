import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const bump = process.argv[2];

if (!bump || !['patch', 'minor', 'major'].includes(bump)) {
    console.error('Usage: node scripts/bump-version.mjs <patch|minor|major>');
    process.exit(1);
}

const rootPkg = JSON.parse(readFileSync('package.json', 'utf8'));
const workspaceDirs = rootPkg.workspaces;

// Bump version in all workspaces
execSync(`npm version ${bump} --no-git-tag-version --workspaces`, { stdio: 'inherit' });

// Build a map of workspace package name -> new version
const workspaceVersions = new Map();
for (const dir of workspaceDirs) {
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    workspaceVersions.set(pkg.name, pkg.version);
}

// Update cross-workspace dependency references
const depFields = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'];

for (const dir of workspaceDirs) {
    const pkgPath = join(dir, 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    let changed = false;

    for (const field of depFields) {
        if (!pkg[field]) continue;
        for (const [name, newVersion] of workspaceVersions) {
            if (name in pkg[field]) {
                pkg[field][name] = `^${newVersion}`;
                changed = true;
            }
        }
    }

    if (changed) {
        writeFileSync(pkgPath, JSON.stringify(pkg, null, 4) + '\n');
    }
}

const version = workspaceVersions.values().next().value;
console.log(`All packages bumped to ${version}`);
