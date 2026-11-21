/**
 * A headless Chromium-based browser (Chrome, Chromium or Edge) driven over the DevTools protocol, for the test and
 * perf runners. No dependencies: Node's built-in fetch and WebSocket (Node 22+).
 *
 *   const browser = await launch();                    // BROWSER_PATH picks the browser; otherwise the first one found
 *   const page = await browser.newPage({focus: true});  // cache disabled; focus emulated (focus/blur as for a user)
 *   await page.goto(url);
 *   const value = await page.waitFor('window.__result', 240000);
 *   await page.close();
 *   await browser.close();
 */
'use strict';
const {spawn} = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const sleep = ms => new Promise(r => setTimeout(r, ms));

/** The browser to run: BROWSER_PATH, else the first Chrome, Chromium or Edge installed in a usual place. */
function findBrowser() {
    const given = process.env.BROWSER_PATH || process.env.CHROME_PATH || process.env.EDGE_PATH;
    if (given) return given;
    const env = process.env;
    let candidates;
    if (process.platform === 'win32') {
        const roots = [env.PROGRAMFILES, env['PROGRAMFILES(X86)'], env.LOCALAPPDATA].filter(Boolean);
        candidates = [];
        roots.forEach(function (root) {
            candidates.push(path.join(root, 'Google', 'Chrome', 'Application', 'chrome.exe'));
            candidates.push(path.join(root, 'Chromium', 'Application', 'chrome.exe'));
            candidates.push(path.join(root, 'Microsoft', 'Edge', 'Application', 'msedge.exe'));
        });
    } else if (process.platform === 'darwin') {
        candidates = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            '/Applications/Chromium.app/Contents/MacOS/Chromium',
            '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'];
    } else {
        const names = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge', 'microsoft-edge-stable'];
        const dirs = (env.PATH || '').split(path.delimiter).filter(Boolean);
        candidates = [];
        names.forEach(function (name) { dirs.forEach(function (dir) { candidates.push(path.join(dir, name)); }); });
    }
    const found = candidates.find(function (file) {
        try {
            return fs.statSync(file).isFile();
        } catch (e) {
            return false;
        }
    });
    if (!found) throw new Error('No Chrome, Chromium or Edge found: set BROWSER_PATH to the browser executable.');
    return found;
}

/** A DevTools session: send(method, params) -> the reply; on(handler) receives events. */
function connect(wsUrl) {
    const ws = new WebSocket(wsUrl);
    let id = 0;
    const pending = new Map();
    const handlers = [];
    ws.onmessage = function (event) {
        const msg = JSON.parse(event.data);
        if (msg.id && pending.has(msg.id)) {
            pending.get(msg.id)(msg);
            pending.delete(msg.id);
        } else {
            handlers.forEach(function (handler) { handler(msg); });
        }
    };
    const ready = new Promise(function (resolve, reject) { ws.onopen = resolve; ws.onerror = reject; });
    return {
        ready: ready,
        send: function (method, params) {
            return new Promise(function (resolve) {
                const n = ++id;
                pending.set(n, resolve);
                ws.send(JSON.stringify({id: n, method: method, params: params || {}}));
            });
        },
        on: function (handler) { handlers.push(handler); },
        close: function () { ws.close(); }
    };
}

async function launch(options) {
    const opts = options || {};
    const executable = findBrowser();
    // options.profile: a profile folder kept between launches; by default a new one under .cache/, removed on close
    const cache = path.join(ROOT, '.cache');
    fs.mkdirSync(cache, {recursive: true});
    const profile = opts.profile ? path.resolve(opts.profile) : fs.mkdtempSync(path.join(cache, 'browser-'));
    const port = 9400 + Math.floor(Math.random() * 400);
    const args = ['--headless=new', '--remote-debugging-port=' + port, '--user-data-dir=' + profile,
        '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-sync',
        '--window-size=' + (opts.width || 1400) + ',' + (opts.height || 1000)];
    // CI machines (containers, restricted user namespaces) often cannot start the browser's sandbox
    if (process.env.CI) args.push('--no-sandbox');
    const proc = spawn(executable, args.concat(opts.args || [], ['about:blank']), {stdio: 'ignore'});
    const base = 'http://127.0.0.1:' + port;
    let started = false;
    for (let i = 0; i < 75 && !started; i++) {
        try {
            await (await fetch(base + '/json/version')).json();
            started = true;
        } catch (e) {
            await sleep(200);
        }
    }
    if (!started) {
        proc.kill();
        throw new Error('The headless browser did not start (' + executable + ', DevTools port ' + port + ')');
    }

    async function newPage(pageOptions) {
        const popts = pageOptions || {};
        const target = await (await fetch(base + '/json/new?about:blank', {method: 'PUT'})).json();
        const session = connect(target.webSocketDebuggerUrl);
        await session.ready;
        await session.send('Runtime.enable');
        await session.send('Page.enable');
        await session.send('Network.enable');
        await session.send('Network.setCacheDisabled', {cacheDisabled: true});
        if (popts.focus !== false) await session.send('Emulation.setFocusEmulationEnabled', {enabled: true});
        // uncaught errors of the page (a syntax error in a script, an exception outside Angular)
        const exceptions = [];
        session.on(function (msg) {
            if (msg.method !== 'Runtime.exceptionThrown') return;
            const details = msg.params.exceptionDetails || {};
            const text = details.exception && details.exception.description ? details.exception.description : details.text;
            exceptions.push(String(text).split('\n')[0] + (details.url ? ' (' + details.url.split('/').pop() + ':' + (details.lineNumber + 1) + ')' : ''));
        });

        /** The value of an expression (promises awaited), or undefined. */
        async function evaluate(expression) {
            const answer = await session.send('Runtime.evaluate', {expression: expression, returnByValue: true, awaitPromise: true});
            return answer.result && answer.result.result ? answer.result.result.value : undefined;
        }

        return {
            session: session,
            evaluate: evaluate,
            exceptions: exceptions,
            goto: function (url) { return session.send('Page.navigate', {url: url}); },
            /**
             * Polls until the expression is truthy; resolves with its value, or null after timeoutMs. With
             * failOnException, an uncaught page error ends the wait at once (null; see exceptions).
             */
            waitFor: async function (expression, timeoutMs, failOnException) {
                const startedAt = Date.now();
                while (Date.now() - startedAt < timeoutMs) {
                    await sleep(400);
                    const value = await evaluate(expression + ' || null');
                    if (value) return value;
                    if (failOnException && exceptions.length > 0) return null;
                }
                return null;
            },
            close: async function () {
                session.close();
                await fetch(base + '/json/close/' + target.id);
            }
        };
    }

    async function close() {
        // wait until the browser has exited (it holds files of its profile until then), then remove the profile
        const exited = proc.exitCode !== null ? Promise.resolve() : new Promise(function (resolve) { proc.once('exit', resolve); });
        proc.kill();
        await Promise.race([exited, sleep(5000)]);
        if (opts.profile) return;
        for (let attempt = 0; attempt < 10; attempt++) {
            try {
                fs.rmSync(profile, {recursive: true, force: true, maxRetries: 3, retryDelay: 100});
                return;
            } catch (e) {
                await sleep(300);   // a child process of the browser may still hold a file for a moment
            }
        }
    }

    return {executable: executable, newPage: newPage, close: close};
}

module.exports = {launch: launch, findBrowser: findBrowser, sleep: sleep};
