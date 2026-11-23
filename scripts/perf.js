/**
 * Performance and memory checks of aui-tree-select on large generated trees (test/perf), in a headless browser with
 * window.gc exposed.
 *
 *   node scripts/perf.js bench [kind ...] [--size RxCxL]
 *       Times mount, open, expand all, scroll, search, selection and destroy. kind: single, single-flat, multi,
 *       multi-strict, multi-strict-limited (default: all of them). --size 30x30x100 (default) is 90,930 nodes.
 *   node scripts/perf.js leak [--kind single|multi|select] [--steps open,close,expand,search,check] [--retainers index|data]
 *       Mounts a 90k tree, runs the steps, destroys the component and drops the data, then compares the heap with
 *       a page that never mounted it. --retainers prints what still holds an index node or a data item.
 *   node scripts/perf.js select [--n 100000] [--mode single|multiple] [--count 1]
 *       Times aui-select with a big static option list: mount, open, scroll, keys, search, selection, destroy
 *       (test/perf/select-bench.html). --count mounts that many selects on the same list.
 *   node scripts/perf.js open [--field select,multi,tree] [--rows 0,600] [--opts 50] [--cpu 1,4] [--runs 4] [--fx panel,trigger,chevron,search]
 *       Opens a small field on a page shaped like a list page (test/perf/open-cost.html) with a real click and
 *       measures the opening: full-page digests, long tasks, style / layout / script time, and the open animation
 *       as drawn (frames with the panel between hidden and fully shown). The first opening and the median of the
 *       next ones are shown per case.
 */
'use strict';
const devServer = require('./dev-server');
const browserLib = require('./lib/browser');
const heapSnapshot = require('./lib/heap-snapshot');

const BENCH_KINDS = ['single', 'single-flat', 'multi', 'multi-strict', 'multi-strict-limited'];
const PAGE_TIMEOUT_MS = 240000;

function option(args, name, fallback) {
    const i = args.indexOf('--' + name);
    return i !== -1 && args[i + 1] !== undefined ? args[i + 1] : fallback;
}

function positional(args) {
    const out = [];
    for (let i = 0; i < args.length; i++) {
        if (args[i].indexOf('--') === 0) i += 1;
        else out.push(args[i]);
    }
    return out;
}

async function heapMB(page) {
    await page.session.send('HeapProfiler.collectGarbage');
    await page.session.send('HeapProfiler.collectGarbage');
    const usage = await page.session.send('Runtime.getHeapUsage');
    return +(usage.result.usedSize / 1048576).toFixed(1);
}

/** Objects still alive that look like the generated data, and aui-tree-select index nodes. */
async function survivors(page) {
    // every object handed out here belongs to one object group, released at the end so nothing stays alive for it
    const group = 'aui-perf-survivors';
    const proto = await page.session.send('Runtime.evaluate', {expression: 'Object.prototype', objectGroup: group});
    const query = await page.session.send('Runtime.queryObjects', {prototypeObjectId: proto.result.result.objectId, objectGroup: group});
    const counted = await page.session.send('Runtime.callFunctionOn', {
        objectId: query.result.objects.objectId,
        returnByValue: true,
        // a getter of some built-in prototypes throws when read on the prototype itself: skip those objects
        functionDeclaration: 'function () { let items = 0, nodes = 0; for (const o of this) { try {' +
            ' if (o && typeof o.name === "string" && /^(Item|Section|Group) /.test(o.name)) items++;' +
            ' if (o && o.sid !== undefined && o.raw !== undefined) nodes++; } catch (e) { /* not readable */ } }' +
            ' return {dataItems: items, indexNodes: nodes}; }'
    });
    await page.session.send('Runtime.releaseObjectGroup', {objectGroup: group});
    return counted.result && counted.result.result ? counted.result.result.value : null;
}

async function takeSnapshot(page) {
    const chunks = [];
    page.session.on(function (msg) {
        if (msg.method === 'HeapProfiler.addHeapSnapshotChunk') chunks.push(msg.params.chunk);
    });
    await page.session.send('HeapProfiler.takeHeapSnapshot', {reportProgress: false});
    return JSON.parse(chunks.join(''));
}

async function bench(browser, server, args) {
    const kinds = positional(args).length ? positional(args) : BENCH_KINDS;
    const size = option(args, 'size', '30x30x100');
    let failed = 0;
    for (const kind of kinds) {
        const page = await browser.newPage();
        await page.goto(server.url + '/test/perf/bench.html?kind=' + encodeURIComponent(kind) + '&size=' + encodeURIComponent(size));
        const result = await page.waitFor('window.__bench', PAGE_TIMEOUT_MS);
        await page.close();
        if (!result || result.error) {
            failed += 1;
            console.log('FAIL bench ' + kind + ': ' + (result ? result.error : 'timeout'));
            continue;
        }
        if (result.errors.length) failed += 1;
        console.log(result.lines.join('\n') + '\n');
    }
    return failed;
}

async function selectBench(browser, server, args) {
    const query = 'n=' + encodeURIComponent(option(args, 'n', '100000')) + '&mode=' + encodeURIComponent(option(args, 'mode', 'single')) +
        '&count=' + encodeURIComponent(option(args, 'count', '1'));
    const page = await browser.newPage();
    await page.goto(server.url + '/test/perf/select-bench.html?' + query);
    const result = await page.waitFor('window.__bench', PAGE_TIMEOUT_MS, true);
    await page.close();
    if (!result || result.error) {
        console.log('FAIL select bench: ' + (result ? result.error : (page.exceptions[0] || 'timeout')));
        return 1;
    }
    console.log(result.lines.join('\n') + '\n');
    return result.errors.length ? 1 : 0;
}

/** One opening and closing of the field, measured. */
async function measureOpen(page) {
    const metrics = async function () {
        const answer = await page.session.send('Performance.getMetrics');
        const out = {};
        (answer.result ? answer.result.metrics : []).forEach(function (m) { out[m.name] = m.value; });
        return out;
    };
    const point = await page.evaluate("(function () { const r = document.querySelector('#field .aui-select__trigger').getBoundingClientRect();" +
        " return {x: Math.round(r.right - 30), y: Math.round(r.top + r.height / 2)}; })()");
    const before = await metrics();
    await page.evaluate('window.__openCost.begin()');
    const mouse = function (type) {
        return page.session.send('Input.dispatchMouseEvent', {type: type, x: point.x, y: point.y, button: 'left',
            buttons: type === 'mousePressed' ? 1 : 0, clickCount: 1});
    };
    await mouse('mouseMoved');
    await mouse('mousePressed');
    await mouse('mouseReleased');
    await browserLib.sleep(900);
    const result = await page.evaluate('window.__openCost.end()');
    const after = await metrics();
    const delta = function (name, scale) { return +(((after[name] || 0) - (before[name] || 0)) * (scale || 1)).toFixed(1); };
    result.layouts = delta('LayoutCount');
    result.styleRecalcs = delta('RecalcStyleCount');
    result.layoutMs = delta('LayoutDuration', 1000);
    result.styleMs = delta('RecalcStyleDuration', 1000);
    result.scriptMs = delta('ScriptDuration', 1000);
    result.taskMs = delta('TaskDuration', 1000);
    // close with Escape (the search box or the trigger has the focus) and let the fade-out end
    await page.session.send('Input.dispatchKeyEvent', {type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27});
    await page.session.send('Input.dispatchKeyEvent', {type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27});
    await browserLib.sleep(600);
    result.closed = await page.evaluate("!document.querySelector('#field .aui-select--open')");
    return result;
}

async function openCost(browser, server, args) {
    const list = function (name, fallback) { return String(option(args, name, fallback)).split(',').filter(Boolean); };
    const fields = list('field', 'select,multi,tree');
    const rowsList = list('rows', '0,600');
    const cpus = list('cpu', '1,4');
    const opts = option(args, 'opts', '50');
    const fx = option(args, 'fx', '');   // measurement switches of open-cost.html (CSS only)
    const runs = Math.max(2, parseInt(option(args, 'runs', '4'), 10));
    const show = function (r) {
        return 'root digests ' + r.rootDigests + ' (' + r.rootDigestMs + ' ms: ' + r.rootDigestList.join(' ') + ')' +
            ' | long tasks ' + (r.longTasks.join(' ') || '-') + ' | script ' + r.scriptMs + ' style ' + r.styleMs + ' (' + r.styleRecalcs +
            'x) layout ' + r.layoutMs + ' (' + r.layouts + 'x) task ' + r.taskMs + ' ms | frames ' + r.frames + ', max gap ' + r.maxFrameGap +
            ' ms | visible at ' + r.firstVisible + ', fully at ' + r.fullyShown + ', animation frames ' + r.animationFrames +
            (r.closed ? '' : ' | NOT CLOSED');
    };
    let failed = 0;
    for (const cpu of cpus) {
        for (const rows of rowsList) {
            for (const field of fields) {
                {
                    const page = await browser.newPage();
                    await page.session.send('Performance.enable');
                    await page.goto(server.url + '/test/perf/open-cost.html?field=' + field + '&rows=' + rows + '&opts=' + opts + (fx ? '&fx=' + encodeURIComponent(fx) : ''));
                    const ready = await page.waitFor("window.__openCost && window.__openCost.watchers() > 0 && document.querySelector('#field .aui-select__trigger') && 'ready'", 60000, true);
                    if (!ready) {
                        console.log('FAIL ' + field + ' rows=' + rows + ': ' + (page.exceptions[0] || 'not ready'));
                        failed += 1;
                        await page.close();
                        continue;
                    }
                    if (cpu !== '1') await page.session.send('Emulation.setCPUThrottlingRate', {rate: parseFloat(cpu)});
                    const watchers = await page.evaluate('window.__openCost.watchers()');
                    const results = [];
                    for (let i = 0; i < runs; i++) results.push(await measureOpen(page));
                    const errors = await page.evaluate('window.__ngErrors.length');
                    const next = results.slice(1).sort(function (a, b) { return a.taskMs - b.taskMs; });
                    const pick = next[Math.floor(next.length / 2)];
                    console.log('cpu x' + cpu + ' rows=' + rows + ' (' + watchers + ' watchers) ' + field + (errors ? ' ANGULAR ERRORS ' + errors : ''));
                    console.log('   first: ' + show(results[0]));
                    console.log('   again: ' + show(pick) + ' [median of ' + next.length + ']');
                    console.log('   opacity (first / again): ' + (results[0].opacityTrace.join(' ') || '-') + '  /  ' + (pick.opacityTrace.join(' ') || '-'));
                    await page.close();
                }
            }
        }
    }
    return failed;
}

async function leak(browser, server, args) {
    const kind = option(args, 'kind', 'single');
    const steps = option(args, 'steps', 'open,expand,search,check');
    const retainers = option(args, 'retainers', '');

    const measure = async function (query) {
        const page = await browser.newPage();
        await page.session.send('HeapProfiler.enable');
        await page.goto(server.url + '/test/perf/leak.html?' + query);
        const done = await page.waitFor('window.__bench', PAGE_TIMEOUT_MS);
        return {page: page, done: done, heap: await heapMB(page)};
    };

    const baseline = await measure('mount=0');
    await baseline.page.close();
    const run = await measure('kind=' + encodeURIComponent(kind) + '&steps=' + encodeURIComponent(steps));
    if (!run.done || run.done.error) {
        console.log('FAIL leak: ' + (run.done ? run.done.error : 'timeout'));
        await run.page.close();
        return 1;
    }
    // a step that failed inside Angular (caught by $exceptionHandler) did not run: the measure would not be the one asked
    if (run.done.errors && run.done.errors.length) {
        console.log('FAIL leak: angular errors in the steps: ' + JSON.stringify(run.done.errors.slice(0, 3)));
        await run.page.close();
        return 1;
    }
    // the snapshot first: counting the survivors below creates references of its own
    const report = retainers ? heapSnapshot.analyze(await takeSnapshot(run.page), retainers) : '';
    const left = await survivors(run.page);
    const elements = await run.page.evaluate("document.querySelectorAll('aui-tree-select, aui-select').length");
    console.log('kind=' + kind + ' steps=' + steps);
    console.log('  heap without the component: ' + baseline.heap + ' MB; after mount, steps, destroy and dropping the data: ' +
        run.heap + ' MB (+' + (run.heap - baseline.heap).toFixed(1) + ' MB)');
    console.log('  component elements left: ' + elements + '; objects left: ' + JSON.stringify(left));
    if (report) console.log(report);
    await run.page.close();
    return 0;
}

async function main() {
    const args = process.argv.slice(2);
    const mode = args.shift();
    if (mode !== 'bench' && mode !== 'leak' && mode !== 'select' && mode !== 'open') {
        console.log('usage: node scripts/perf.js bench [kind ...] [--size RxCxL]\n' +
            '       node scripts/perf.js select [--n 100000] [--mode single|multiple] [--count 1]\n' +
            '       node scripts/perf.js leak [--kind single|multi|select] [--steps open,close,expand,search,check] [--retainers index|data]');
        process.exit(1);
    }
    const server = await devServer.start({port: 0});
    const browser = await browserLib.launch({args: ['--js-flags=--expose-gc', '--enable-precise-memory-info']});
    let failed = 0;
    try {
        if (mode === 'bench') failed = await bench(browser, server, args);
        else if (mode === 'select') failed = await selectBench(browser, server, args);
        else if (mode === 'open') failed = await openCost(browser, server, args);
        else failed = await leak(browser, server, args);
    } finally {
        await browser.close();
        server.server.close();
    }
    process.exitCode = failed ? 1 : 0;
}

main().catch(function (error) {
    console.error(error);
    process.exit(1);
});
