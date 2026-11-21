/**
 * Joins the sources listed in src/sources.json into one script and one stylesheet, in that order. Used by
 * scripts/build.js (dist/), by the dev server (served fresh on every request) and by the unit tests.
 *
 *   const bundle = require('./lib/bundle');
 *   bundle.js();    // -> the text of dist/aui-components.js
 *   bundle.css();   // -> the text of dist/aui-components.css
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const SRC = path.join(ROOT, 'src');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

function sources() {
    return JSON.parse(fs.readFileSync(path.join(SRC, 'sources.json'), 'utf8'));
}

function banner() {
    return '/*!\n' +
        ' * ' + pkg.name + ' v' + pkg.version + '\n' +
        ' * ' + pkg.description + '\n' +
        ' * Copyright (c) The ' + pkg.name + ' authors. Released under the MIT License.\n' +
        ' */\n';
}

function join(files) {
    return banner() + files.map(function (rel) {
        const text = fs.readFileSync(path.join(SRC, rel), 'utf8').replace(/\r\n/g, '\n').replace(/\n+$/, '');
        return '\n/* ---- src/' + rel + ' ---- */\n' + text + '\n';
    }).join('');
}

module.exports = {
    ROOT: ROOT,
    sources: sources,
    js: function () { return join(sources().js); },
    css: function () { return join(sources().css); }
};
