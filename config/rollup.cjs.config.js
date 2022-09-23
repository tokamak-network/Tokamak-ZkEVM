import fs from "fs";
import { builtinModules as builtin } from "module";
import commonjs from '@rollup/plugin-commonjs';

const pkg = JSON.parse(fs.readFileSync("./package.json"));

export default {
    input: "main.js",
    output: {
        file: "build/main.cjs",
        format: "cjs",
    },
    plugins: [commonjs()],
    external: [
        ...Object.keys(pkg.dependencies),
        ...builtin,
    ]
};
