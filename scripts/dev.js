/**
 * 这个文件会帮我们打包 `packages` 下的模块，最终打包出js文件
 * 用法:
 *      node dev.js (包名 -f 打包格式) ===> argv
 */

import minimist from 'minimist';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import esbuild from 'esbuild';

// node 中的命令参数通过process来获取 process.argv
const args = minimist(process.argv.slice(2));  // { _: [ 'reactivity' ], f: 'esm' }

// 对cjs做兼容
const __filename = fileURLToPath(import.meta.url);  // C:\...\vue-bilibili\scripts\dev.js
const __dirname = dirname(__filename);  // C:\...\vue-bilibili\scripts
const require = createRequire(import.meta.url);
const target = args._[0] || 'reactivity'; // 包名 (reactivity)
const format = args.f || "iife"; // 打包后的模块化规范 (esm)

// 入口文件，根据命令行提供的路径来进行解析
const entry = resolve(__dirname, `../packages/${target}/src/index.ts`)
const pkg = require(`../packages/${target}/package.json`)


// 根据需要进行打包
esbuild.context({
    entryPoints: [entry],  // 入口
    outfile: resolve(__dirname, `../packages/${target}/dist/${target}.js`),  // 出口
    bundle: true,  // reactivity => shared  会打包到一起
    platform: "browser",  // 打包后给浏览器使用
    sourcemap: true,
    format,  // cjs、esm、iife(立即执行函数的形式)
    globalName: pkg.buildOptions?.name,  // iife 立即执行函数返回结果的名字
})
.then((ctx) => {
    console.log("start dev");
    
    return ctx.watch();  // 监控入口文件持续打包
})
