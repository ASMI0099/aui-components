/**
 * Development server: the examples, the browser test suites and the library built from src/.
 *
 *   node scripts/dev-server.js [port]        (default 5180; PORT can also come from the environment)
 *
 * - Listens on 127.0.0.1 only. Nothing is cached, so a page always runs the current code.
 * - /dist/aui-components.js and .css are built from src/ on every request (scripts/lib/bundle.js). With
 *   {dist: true} (the test runner's --dist) the files in dist/ are served instead, the minified ones under the same
 *   names; AUI_JS / AUI_CSS (paths) serve any other build in their place.
 * - /vendor/* serves AngularJS, jQuery and Floating UI from node_modules (npm install).
 * - /api/* answers from the mock catalog of the examples (scripts/lib/mock-api.js); no backend is needed.
 * - "/" opens the examples.
 *
 * Also used by the test and perf runners: require('./dev-server').start({port: 0}) -> Promise<{server, port, url}>.
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const bundle = require('./lib/bundle');
const mockApi = require('./lib/mock-api');

const ROOT = path.resolve(__dirname, '..');
const HOST = '127.0.0.1';
const DEFAULT_PORT = 5180;
const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.md': 'text/markdown; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
    '.map': 'application/json; charset=utf-8'
};

// the third-party scripts the pages load, from node_modules
const VENDOR = {
    'angular.js': 'angular/angular.js',
    'angular.min.js': 'angular/angular.min.js',
    'jquery.min.js': 'jquery/dist/jquery.min.js',
    'floating-ui.core.min.js': '@floating-ui/core/dist/floating-ui.core.umd.min.js',
    'floating-ui.dom.min.js': '@floating-ui/dom/dist/floating-ui.dom.umd.min.js'
};

/** A file of an installed package: in the project's node_modules, or in a folder of NODE_PATH. */
function findModuleFile(rel) {
    const dirs = [path.join(ROOT, 'node_modules')].concat((process.env.NODE_PATH || '').split(path.delimiter).filter(Boolean));
    for (const dir of dirs) {
        const file = path.join(dir, rel);
        if (fs.existsSync(file)) return file;
    }
    return null;
}

function headers(type) {
    return {'Content-Type': type || 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'};
}

function send(res, status, body, type) {
    res.writeHead(status, headers(type));
    res.end(body);
}

/** The file for a URL path, or null when it would leave the project folder, is hidden or does not exist. */
function resolveFile(urlPath) {
    let decoded;
    try {
        decoded = decodeURIComponent(urlPath);
    } catch (e) {
        return null;
    }
    if (decoded.indexOf('\0') !== -1) return null;
    const file = path.resolve(ROOT, '.' + path.posix.normalize('/' + decoded));
    if (file !== ROOT && !file.startsWith(ROOT + path.sep)) return null;
    // never dot files or dot folders (.git, .cache), never node_modules (only through /vendor/)
    const parts = path.relative(ROOT, file).split(path.sep);
    if (parts.some(part => part.startsWith('.') || part === 'node_modules')) return null;
    let stat;
    try {
        stat = fs.statSync(file);
    } catch (e) {
        return null;
    }
    if (stat.isDirectory()) {
        const index = path.join(file, 'index.html');
        return fs.existsSync(index) ? index : null;
    }
    return stat.isFile() ? file : null;
}

function serveText(req, res, text, type) {
    res.writeHead(200, headers(type));
    res.end(req.method === 'HEAD' ? undefined : text);
}

function serveFile(req, res, file) {
    res.writeHead(200, headers(MIME[path.extname(file).toLowerCase()] || 'application/octet-stream'));
    if (req.method === 'HEAD') res.end();
    else fs.createReadStream(file).pipe(res);
}

/** The library itself: built from src/, or a built file (dist/ with options.dist, or AUI_JS / AUI_CSS). */
function serveLibrary(req, res, kind, options) {
    const override = kind === 'js' ? process.env.AUI_JS : process.env.AUI_CSS;
    const type = MIME['.' + kind];
    if (override) {
        const file = path.resolve(override);
        if (!fs.existsSync(file)) return send(res, 500, 'AUI_' + kind.toUpperCase() + ' not found: ' + file);
        return serveFile(req, res, file);
    }
    if (options.dist) {
        const file = path.join(ROOT, 'dist', 'aui-components.min.' + kind);
        if (!fs.existsSync(file)) return send(res, 500, 'not built: ' + file + ' (npm run build)');
        return serveFile(req, res, file);
    }
    let text;
    try {
        text = kind === 'js' ? bundle.js() : bundle.css();
    } catch (error) {
        return send(res, 500, 'build failed: ' + error.message);
    }
    serveText(req, res, text, type);
}

function start(options) {
    const opts = options || {};
    const port = opts.port !== undefined ? opts.port : Number(process.env.PORT || DEFAULT_PORT);
    const api = mockApi.create();
    const server = http.createServer(function (req, res) {
        const urlPath = req.url.split('?')[0];
        if (urlPath === '/api' || urlPath.startsWith('/api/')) {
            api.handle(req, res);
            return;
        }
        if (req.method !== 'GET' && req.method !== 'HEAD') {
            send(res, 405, 'Method not allowed');
            return;
        }
        if (urlPath === '/') {
            res.writeHead(302, {Location: '/examples/', 'Cache-Control': 'no-store'});
            res.end();
            return;
        }
        if (urlPath === '/dist/aui-components.js' || urlPath === '/dist/aui-components.css') {
            serveLibrary(req, res, path.extname(urlPath).slice(1), opts);
            return;
        }
        if (urlPath.startsWith('/vendor/')) {
            const name = VENDOR[urlPath.slice('/vendor/'.length)];
            const file = name && findModuleFile(name);
            if (!file) return send(res, 404, 'Not found: ' + urlPath + (name ? ' (npm install)' : ''));
            serveFile(req, res, file);
            return;
        }
        // a folder without its trailing slash: redirect, so that relative links in its index.html resolve
        const file = resolveFile(urlPath);
        if (!file) {
            send(res, 404, 'Not found: ' + urlPath);
            return;
        }
        if (path.basename(file) === 'index.html' && !urlPath.endsWith('/') && !urlPath.endsWith('index.html')) {
            res.writeHead(301, {Location: urlPath + '/', 'Cache-Control': 'no-store'});
            res.end();
            return;
        }
        serveFile(req, res, file);
    });
    return new Promise(function (resolve, reject) {
        server.once('error', reject);
        server.listen(port, HOST, function () {
            const actual = server.address().port;
            resolve({server: server, port: actual, url: 'http://' + HOST + ':' + actual});
        });
    });
}

module.exports = {start: start};

if (require.main === module) {
    const port = process.argv[2] ? Number(process.argv[2]) : undefined;
    start({port: port}).then(function (info) {
        console.log('aui-components dev server: ' + info.url + '/');
    }, function (error) {
        console.error('dev server failed to start:', error.message);
        process.exit(1);
    });
}
