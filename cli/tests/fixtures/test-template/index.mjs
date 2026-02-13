import { definePlugin } from '@libria/plugin-loader';
import fs from 'fs/promises';
import path from 'path';

export default definePlugin('scaffold-template', 'test-template', {
    argument: 'test-template',
    async execute(options) {
        const { name, dryRun } = options;

        if (dryRun) {
            console.log(`[DRY RUN] Would create project: ${name}`);
            return;
        }

        const projectDir = path.join(process.cwd(), name);
        await fs.mkdir(projectDir, { recursive: true });

        // Create a simple marker file to verify the template ran
        await fs.writeFile(
            path.join(projectDir, 'test-template.marker'),
            `Created by test-template plugin\nProject: ${name}\n`
        );

        console.log(`Test template project "${name}" created successfully!`);
    }
});
