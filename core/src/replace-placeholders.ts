import path from 'path';

import fs from 'fs-extra';

export async function replacePlaceholders<T extends Record<string, string>>(
    targetDir: string,
    replacements: T
): Promise<void> {
    async function replaceInFiles(folder: string): Promise<void> {
        const entries = await fs.readdir(folder);
        for (const entry of entries) {
            const fullPath = path.join(folder, entry);
            const stat = await fs.stat(fullPath);
            if (stat.isDirectory()) {
                await replaceInFiles(fullPath);
            } else if (/\.(ts|js|json|md|txt)$/i.test(entry)) {
                let content = await fs.readFile(fullPath, 'utf-8');
                for (const [placeholder, value] of Object.entries(replacements)) {
                    content = content.replaceAll(placeholder, value);
                }
                await fs.writeFile(fullPath, content, 'utf-8');
            }
        }
    }

    await replaceInFiles(targetDir);
}
