import { default as plugin } from './nestjs';
import {PluginManager} from "@libria/plugin-loader";

const pc = new PluginManager();

const pl = await plugin.create(pc.getContext());

await pl.api.execute({
    output: 'DELETE.ts',
    dryRun: true,
    name: 'delete',
    force: false
});