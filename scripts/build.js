/**
 * Builds dist/ from src/:
 *
 *   dist/aui-components.js        the sources joined in the order of src/sources.json, comments kept
 *   dist/aui-components.css
 *   dist/aui-components.min.js    minified (esbuild); the syntax is held to ES2017, so that older build tools of a
 *   dist/aui-components.min.css   page can process the file too
 *
 *   node scripts/build.js            (npm run build)
 *   node scripts/build.js --check    fails when dist/ differs from a fresh build (used in CI)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const bundle = require('./lib/bundle');

const DIST = path.join(bundle.ROOT, 'dist');

function build() {
    let esbuild;
    try {
        esbuild = require('esbuild');
    } catch (e) {
        throw new Error('esbuild is missing: run npm install first');
    }
    const js = bundle.js();
    const css = bundle.css();
    // the sources keep to ES2017: printed for ES2017 the script must stay what it is (esbuild would lower newer
    // syntax, such as ?. or object spread, without a word)
    const asIs = esbuild.transformSync(js, {loader: 'js', target: 'esnext', charset: 'utf8'}).code;
    const es2017 = esbuild.transformSync(js, {loader: 'js', target: 'es2017', charset: 'utf8'}).code;
    if (asIs !== es2017) {
        const a = asIs.split('\n');
        const b = es2017.split('\n');
        let i = 0;
        while (i < a.length && a[i] === b[i]) i++;
        throw new Error('src/ uses syntax newer than ES2017, near: ' + (a[i] || '').trim().slice(0, 160));
    }
    const minJs = esbuild.transformSync(js, {loader: 'js', minify: true, target: 'es2017', legalComments: 'inline', charset: 'utf8'}).code;
    const minCss = esbuild.transformSync(css, {loader: 'css', minify: true, legalComments: 'inline', charset: 'utf8'}).code;
    return {
        'aui-components.js': js,
        'aui-components.css': css,
        'aui-components.min.js': minJs,
        'aui-components.min.css': minCss
    };
}

function main() {
    const check = process.argv.indexOf('--check') !== -1;
    const files = build();
    const stale = [];
    if (!check) fs.mkdirSync(DIST, {recursive: true});
    Object.keys(files).forEach(function (name) {
        const file = path.join(DIST, name);
        if (check) {
            const now = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
            if (now !== files[name]) stale.push(name);
            return;
        }
        fs.writeFileSync(file, files[name]);
        console.log('dist/' + name + '  ' + (Buffer.byteLength(files[name]) / 1024).toFixed(1) + ' KB');
    });
    if (check) {
        if (stale.length) {
            console.error('dist/ is not up to date (' + stale.join(', ') + '): run npm run build and commit dist/');
            process.exit(1);
        }
        console.log('dist/ is up to date');
    }
}

if (require.main === module) {
    try {
        main();
    } catch (error) {
        console.error(error.message);
        process.exit(1);
    }
}

module.exports = {build: build};
