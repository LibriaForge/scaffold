import { default as angular } from './dist/generators/angular/index.mjs';
import { DefaultPluginContext } from '@libria/plugin-loader';

async function foo() {
    const pc = new DefaultPluginContext();
    const plugin = await angular.create(pc);
    await plugin.api.execute({
        output: './test.ts',
        force: true
    });
}

foo();