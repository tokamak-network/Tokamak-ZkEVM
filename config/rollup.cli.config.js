import fs from "fs";
import { builtinModules as builtin } from "module";
import commonjs from '@rollup/plugin-commonjs';

const pkg = JSON.parse(fs.readFileSync("./package.json"));

export default {
    input: "interactive-cli.js",
    output: {
        file: "build/cli.cjs",
        format: "cjs",
        banner: "#! /usr/bin/env node\n",
    },
    plugins: [commonjs()],
    external: [
        ...Object.keys(pkg.dependencies),
        ...builtin,
        'chai',
    ]
};
