import fs from 'fs-extra';
import path from 'path';

const PROJECT_ROOT = path.resolve(import.meta.dirname, '../..');
const TMP_DIR = path.join(PROJECT_ROOT, '.tmp');

interface TempProjectResult {
    tmp: string;
    cleanup: () => Promise<void>;
}

export async function useTempProject(name?: string): Promise<TempProjectResult> {
    await fs.ensureDir(TMP_DIR);
    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    const tmp = await fs.mkdtemp(path.join(TMP_DIR, `core-${timestamp}-${name ? name + '-' : ''}`));

    const originalCwd = process.cwd();
    process.chdir(tmp);

    return {
        tmp,
        cleanup: async () => {
            process.chdir(originalCwd);
            if (await fs.pathExists(tmp)) {
                await fs.remove(tmp);
            }
        },
    };
}