/**
 * Runs the browser test suites in a headless browser and prints a report.
 *
 *   node scripts/test.js                    every suite under test/ (except test/kit, test/unit, test/perf)
 *   node scripts/test.js select             only suites whose path contains "select"
 *   node scripts/test.js --verbose ...      also list the passing checks
 *   node scripts/test.js --dist ...         against the minified files in dist/ (run npm run build first)
 *
 * The runner starts scripts/dev-server.js on a free port, opens each suite page with the HTTP cache disabled and
 * focus emulated (so that focus and blur behave as for a user), waits for the page's window.__result (see
 * test/kit/aui-test-kit.js) and exits with 1 when a check fails, a page reports an Angular error or a page does not
 * finish in time. BROWSER_PATH picks the browser (scripts/lib/browser.js).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const devServer = require('./dev-server');
const browserLib = require('./lib/browser');

const ROOT = path.resolve(__dirname, '..');
const PAGE_TIMEOUT_MS = 240000;
const SKIPPED = ['test/kit', 'test/unit', 'test/perf'];

/**
 * On GitHub Actions a failing suite is also written as an error annotation (its failing checks in it): annotations show
 * on the commit and the run's summary, readable without the run's log.
 */
function annotate(title, lines) {
    if (process.env.GITHUB_ACTIONS !== 'true') return;
    const data = s => String(s).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
    const property = s => data(s).replace(/:/g, '%3A').replace(/,/g, '%2C');
    console.log('::error title=' + property(title) + '::' + data(lines.join('\n').slice(0, 6000)));
}

function findSuites(filters) {
    const out = [];
    (function walk(dir) {
        fs.readdirSync(dir, {withFileTypes: true}).forEach(function (entry) {
            const full = path.join(dir, entry.name);
            const rel = path.relative(ROOT, full).split(path.sep).join('/');
            if (entry.isDirectory()) {
                if (SKIPPED.indexOf(rel) === -1) walk(full);
            } else if (entry.name.endsWith('.html')) {
                out.push(rel);
            }
        });
    })(path.join(ROOT, 'test'));
    return out.sort().filter(rel => filters.length === 0 || filters.some(f => rel.indexOf(f) !== -1));
}

async function main() {
    const args = process.argv.slice(2);
    const verbose = args.indexOf('--verbose') !== -1;
    const dist = args.indexOf('--dist') !== -1;
    const filters = args.filter(a => !a.startsWith('--'));
    const suites = findSuites(filters);
    if (suites.length === 0) {
        console.log('no suite matches ' + JSON.stringify(filters));
        process.exit(1);
    }
    const server = await devServer.start({port: 0, dist: dist});
    const browser = await browserLib.launch();
    console.log('browser: ' + browser.executable + (dist ? '   (dist/*.min.*)' : '   (built from src/)'));
    let failed = 0;
    try {
        for (const suite of suites) {
            const started = Date.now();
            const page = await browser.newPage();
            await page.goto(server.url + '/' + suite);
            const result = await page.waitFor('window.__result', PAGE_TIMEOUT_MS, true);
            await page.close();
            const seconds = Math.round((Date.now() - started) / 1000);
            const title = (dist ? 'dist ' : 'src ') + suite;
            if (!result) {
                failed += 1;
                if (page.exceptions.length > 0) {
                    console.log('ERROR ' + suite + ' (' + seconds + ' s): the page threw before finishing');
                    page.exceptions.forEach(function (text) { console.log('    ' + text); });
                    annotate(title, ['the page threw before finishing'].concat(page.exceptions));
                } else {
                    console.log('TIMEOUT ' + suite + ' (' + seconds + ' s)');
                    annotate(title, ['no result in ' + seconds + ' s']);
                }
                continue;
            }
            const ok = result.pass === result.total && result.errors.length === 0;
            if (!ok) failed += 1;
            console.log((ok ? 'ok   ' : 'FAIL ') + suite + '  ' + result.pass + '/' + result.total +
                (result.errors.length ? '  angular errors: ' + result.errors.length : '') +
                (result.summary ? '  (' + result.summary + ')' : '') + '  ' + seconds + ' s');
            result.lines.forEach(function (line) {
                if (verbose || line.indexOf('FAIL') === 0) console.log('    ' + line);
            });
            result.errors.forEach(function (error) { console.log('    angular error: ' + error); });
            if (!ok) {
                annotate(title, [result.pass + '/' + result.total + ' checks passed'].concat(result.lines.filter(line => line.indexOf('FAIL') === 0),
                    result.errors.map(error => 'angular error: ' + error)));
            }
        }
    } finally {
        await browser.close();
        server.server.close();
    }
    console.log(failed ? failed + ' of ' + suites.length + ' suite(s) failed' : 'all ' + suites.length + ' suite(s) passed');
    process.exitCode = failed ? 1 : 0;
}

main().catch(function (error) {
    console.error(error.message || error);
    process.exit(1);
});
