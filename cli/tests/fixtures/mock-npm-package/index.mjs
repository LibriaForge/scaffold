import { definePlugin } from '@libria/plugin-loader';
import fs from 'fs/promises';
import path from 'path';

export default definePlugin('scaffold-template', 'mock-npm-template', {
    argument: 'mock-npm-template',
    async execute(options) {
        const { name, dryRun } = options;

        if (dryRun) {
            console.log(`[DRY RUN] Would create project: ${name}`);
            return;
        }

        const projectDir = path.join(process.cwd(), name);
        await fs.mkdir(projectDir, { recursive: true });

        await fs.writeFile(
            path.join(projectDir, 'mock-npm-template.marker'),
            `Created by mock-npm-template plugin\nProject: ${name}\n`
        );

        console.log(`Mock npm template project "${name}" created successfully!`);
    }
});
