// Unit tests of auiRemoteData (lists, pages, searches, lookups) without a browser.
//   node --test test/unit/            (npm run test:unit)
// $q, $timeout and $rootScope are small stand-ins on native promises and timers; AUI_SOURCE=<file> tests another copy.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// the library as built from src/ (scripts/lib/bundle.js), or AUI_SOURCE: a built file, e.g. dist/aui-components.min.js
const source = process.env.AUI_SOURCE ? fs.readFileSync(process.env.AUI_SOURCE, 'utf8') : require('../../scripts/lib/bundle').js();

const sleep = ms => new Promise(r => setTimeout(r, ms));
/** Wait until cond() is true (timers are coarse on some systems; fixed waits would make the tests flaky). */
async function until(cond, ms) {
    const end = Date.now() + (ms || 1000);
    while (!cond()) {
        if (Date.now() > end) throw new Error('timed out waiting for ' + cond);
        await sleep(5);
    }
}

// ---------------------------------------------------------------- AngularJS stand-ins
function defer() {
    const d = {};
    d.promise = new Promise((resolve, reject) => { d.resolve = resolve; d.reject = reject; });
    d.promise.catch(() => {});
    return d;
}
const $q = {
    when: value => Promise.resolve(value),
    reject: error => { const p = Promise.reject(error); p.catch(() => {}); return p; },
    defer: defer
};
function $timeout(fn, ms) {
    const d = defer();
    const id = setTimeout(() => {
        try { d.resolve(fn()); } catch (e) { d.reject(e); }
    }, ms || 0);
    d.promise.$$id = id;
    d.promise.$$reject = d.reject;
    return d.promise;
}
$timeout.cancel = function (promise) {
    if (!promise) return false;
    clearTimeout(promise.$$id);
    promise.$$reject(new Error('canceled'));
    return true;
};
const $rootScope = {
    $$postDigest: fn => setTimeout(fn, 0),
    $evalAsync: fn => setTimeout(fn, 0)
};
const angularStub = {
    copy: value => (value === undefined || value === null ? value : JSON.parse(JSON.stringify(value))),
    toJson: value => JSON.stringify(value)
};

const registry = {};
const deps = {$q: $q, $timeout: $timeout, $rootScope: $rootScope};
const chain = new Proxy({}, {
    get(target, method) {
        return function (name, def) {
            if (method === 'factory' && name === 'auiRemoteData') {
                const fn = def[def.length - 1];
                registry[name] = fn.apply(null, def.slice(0, -1).map(dep => deps[dep]));
            }
            return chain;
        };
    }
});
new Function('angular', 'window', source)(Object.assign({module: () => chain}, angularStub), {});
const R = registry.auiRemoteData;

// ---------------------------------------------------------------- a scriptable server
function makeServer(data) {
    const server = {calls: [], delay: 5, answer: null, fail: 0};
    server.load = function (req) {
        const call = Object.assign({}, req, {cancelled: false});
        delete call.cancel;
        delete call.signal;
        server.calls.push(call);
        req.cancel.then(() => { call.cancelled = true; });
        const fail = server.fail > 0 ? (server.fail--, true) : false;
        return $timeout(() => {
            if (fail) throw new Error('boom');
            if (server.answer) return server.answer(req);
            if (req.values) return data.filter(d => req.values.indexOf(d.id) !== -1);
            const list = data.filter(d => !req.query || d.name.indexOf(req.query) !== -1);
            return req.pageSize ? list.slice(req.offset, req.offset + req.pageSize) : list;
        }, server.delay);
    };
    return server;
}
const items = n => Array.from({length: n}, (x, i) => ({id: i + 1, name: 'item ' + (i + 1)}));
const keyOf = item => (item && item.id !== undefined ? String(item.id) : null);

function makeList(server, options) {
    const opts = Object.assign({pageSize: 10, ttl: 60000, timeout: 0, canReplace: true}, options || {});
    const updates = [];
    const warnings = [];
    const list = R.createList({
        load: server.load,
        keyOf: keyOf,
        pageSize: () => opts.pageSize,
        timeoutMs: () => opts.timeout,
        ttlMs: () => opts.ttl,
        canReplace: () => opts.canReplace,
        onUpdate: (session, info) => updates.push(info),
        warn: text => warnings.push(text)
    });
    return {list, updates, warnings, opts};
}

// ---------------------------------------------------------------- pure parts
test('paramsKey: equal values give equal keys; order, undefined, functions and $ keys do not matter', () => {
    assert.equal(R.paramsKey({a: 1, b: 2}), R.paramsKey({b: 2, a: 1}));
    assert.equal(R.paramsKey({a: 1, b: undefined, f: () => 1, $$hashKey: 'x'}), R.paramsKey({a: 1}));
    assert.equal(R.paramsKey(undefined), R.paramsKey({}));
    assert.equal(R.paramsKey(null), R.paramsKey({}));
    assert.notEqual(R.paramsKey({a: 1}), R.paramsKey({a: '1'}));
    assert.notEqual(R.paramsKey({ids: [1, 2]}), R.paramsKey({ids: [2, 1]}));
    assert.equal(R.paramsKey({d: new Date('2026-01-02T00:00:00Z')}), '{"d":"2026-01-02T00:00:00.000Z"}');
    assert.equal(R.paramsKey({n: NaN}), '{"n":"NaN"}');
});

test('readAnswer and pageEnds: arrays, {items, total | hasMore | nextCursor}, anything else is invalid', () => {
    assert.equal(R.readAnswer({rows: []}), null);
    assert.equal(R.readAnswer(null), null);
    assert.equal(R.readAnswer('x'), null);
    const plain = R.readAnswer([1, 2]);
    assert.equal(R.pageEnds(plain, 2, 2), false);   // a full page: maybe more
    assert.equal(R.pageEnds(plain, 3, 2), true);    // short page: the end
    assert.equal(R.pageEnds(R.readAnswer([]), 3, 0), true);
    assert.equal(R.pageEnds(R.readAnswer({items: [1], hasMore: true}), 1, 1), false);
    assert.equal(R.pageEnds(R.readAnswer({items: [1, 2], hasMore: false}), 2, 2), true);
    assert.equal(R.pageEnds(R.readAnswer({items: [1, 2], nextCursor: 'c'}), 2, 2), false);
    assert.equal(R.pageEnds(R.readAnswer({items: [1, 2], nextCursor: null}), 2, 2), true);
    assert.equal(R.pageEnds(R.readAnswer({items: [1, 2], total: 4}), 2, 2), false);
    assert.equal(R.pageEnds(R.readAnswer({items: [1, 2], total: 4}), 2, 4), true);
    assert.equal(R.pageEnds(R.readAnswer({items: [], hasMore: true}), 2, 4), true);   // an empty page ends it anyway
});

// ---------------------------------------------------------------- lists
test('list: page 1, one request at a time, next pages, a short page ends it', async () => {
    const server = makeServer(items(25));
    const {list} = makeList(server);
    list.configure('k', {brand: 'A'});
    list.ensure('open');
    list.ensure('open');
    assert.equal(server.calls.length, 1);
    assert.deepEqual(server.calls[0], {reason: 'open', query: '', page: 1, pageSize: 10, offset: 0, cursor: undefined, values: null,
        params: {brand: 'A'}, cancelled: false});
    await sleep(20);
    assert.equal(list.current().items.length, 10);
    assert.equal(list.more(), true);
    assert.equal(list.more(), false);   // still loading
    await sleep(20);
    assert.equal(server.calls[1].offset, 10);
    list.more();
    await sleep(20);
    const s = list.current();
    assert.equal(s.items.length, 25);
    assert.equal(s.ended, true);
    assert.equal(list.more(), false);
    assert.equal(server.calls.length, 3);
});

test('list: load everything at once without a page size', async () => {
    const server = makeServer(items(25));
    const {list} = makeList(server, {pageSize: 0});
    list.configure('k', {});
    list.ensure('open');
    await sleep(20);
    assert.equal(server.calls[0].pageSize, null);
    assert.equal(list.current().items.length, 25);
    assert.equal(list.current().ended, true);
});

test('list: a server that ignores the page stops after page 2 with a warning; moved items are deduplicated', async () => {
    const server = makeServer(items(30));
    server.answer = req => items(30).slice(0, 10);
    const {list, warnings} = makeList(server);
    list.configure('k', {});
    list.ensure('open');
    await sleep(20);
    list.more();
    await sleep(20);
    assert.equal(list.current().ended, true);
    assert.equal(list.current().items.length, 10);
    assert.equal(list.more(), false);
    assert.ok(warnings.some(w => w.indexOf('page parameter') !== -1));

    const shifted = makeServer(items(30));
    shifted.answer = req => items(30).slice(Math.max(0, req.offset - 3), Math.max(0, req.offset - 3) + 10);
    const b = makeList(shifted);
    b.list.configure('k', {});
    b.list.ensure('open');
    await sleep(20);
    b.list.more();
    await sleep(20);
    assert.equal(b.list.current().items.length, 17);
    assert.equal(new Set(b.list.current().items.map(i => i.id)).size, 17);
});

test('list: a new query stops the running search; the late answer is dropped; the plain list keeps loading', async () => {
    const server = makeServer(items(30));
    server.delay = 30;
    const {list} = makeList(server);
    list.configure('k', {});
    list.ensure('open');           // plain list loading
    list.setQuery('item 1');
    list.ensure('search');
    list.setQuery('item 2');
    list.ensure('search');
    assert.equal(server.calls[0].cancelled, false);   // the plain list is not stopped by a search
    await sleep(5);
    assert.equal(server.calls[1].cancelled, true);
    await sleep(60);
    assert.ok(list.current().items.every(i => i.name.indexOf('item 2') !== -1));
    assert.equal(list.plain().items.length, 10);
});

test('list: params change stops the running load; the last 5 plain lists are kept, older ones dropped', async () => {
    const server = makeServer(items(30));
    const {list} = makeList(server);
    list.configure('k1', {});
    list.ensure('open');
    list.configure('k2', {});
    await sleep(2);
    assert.equal(server.calls[0].cancelled, true);
    for (let i = 2; i <= 7; i += 1) {
        list.configure('k' + i, {});
        list.ensure('open');
        await sleep(15);
    }
    const before = server.calls.length;
    list.configure('k3', {});   // within the last 5: kept
    list.ensure('open');
    assert.equal(server.calls.length, before);
    list.configure('k2', {});   // older: dropped, loaded again
    list.ensure('open');
    assert.equal(server.calls.length, before + 1);
});

test('list: stop() drops the searches but keeps the plain list; drop() forgets the lists of the params', async () => {
    const server = makeServer(items(30));
    const {list} = makeList(server);
    list.configure('k', {});
    list.ensure('open');
    await sleep(15);
    list.setQuery('item 1');
    list.ensure('search');
    await sleep(15);
    list.stop();
    list.setQuery('item 1');
    list.ensure('search');
    assert.equal(server.calls.filter(c => c.query === 'item 1').length, 2);
    list.setQuery('');
    list.ensure('open');
    assert.equal(server.calls.filter(c => c.query === '').length, 1);
    list.drop();
    list.ensure('open');
    assert.equal(server.calls.filter(c => c.query === '').length, 2);
});

test('list: after the ttl, a background refresh; held while the rows are in use, swapped in at the next ensure', async () => {
    const server = makeServer(items(30));
    const {list, opts, updates} = makeList(server, {ttl: 10, canReplace: false});
    list.configure('k', {});
    list.ensure('open');
    await until(() => list.current().status === 'ready');   // page 1 answered
    await sleep(25);                                          // now older than the ttl
    server.answer = () => [{id: 99, name: 'fresh'}];
    list.ensure('open');
    assert.equal(server.calls[1].reason, 'refresh');
    assert.equal(list.current().refreshing, true);
    await until(() => updates.some(u => u.reason === 'refresh'));
    assert.equal(list.current().items[0].id, 1);          // held
    opts.ttl = 60000;
    list.ensure('open');
    assert.equal(list.current().items[0].id, 99);         // swapped in, no new request
    assert.equal(server.calls.length, 2);
});

test('list: wouldLoad tells what ensure would ask of the page (page 1, a retry, a refresh), and changes nothing', async () => {
    const server = makeServer(items(30));
    const {list} = makeList(server, {ttl: 10});
    assert.equal(list.wouldLoad('open'), false);            // loading not enabled
    list.configure('k', {});
    assert.equal(list.wouldLoad('open'), true);             // nothing loaded: page 1
    assert.equal(list.peek(), null);                        // and no list was created for it
    list.ensure('open');
    assert.equal(list.wouldLoad('open'), false);            // page 1 on its way
    await until(() => list.current().status === 'ready');
    assert.equal(list.wouldLoad('open'), false);            // loaded and recent: an opening asks nothing
    await sleep(25);
    assert.equal(list.wouldLoad('open'), true);             // older than the ttl: a background refresh
    assert.equal(server.calls.length, 1);                   // wouldLoad itself never asked
    list.ensure('open');
    assert.equal(server.calls[1].reason, 'refresh');
    assert.equal(list.wouldLoad('open'), false);            // the refresh runs

    const failing = makeServer(items(3));
    failing.fail = 1;
    const f = makeList(failing).list;
    f.configure('k', {});
    f.ensure('open');
    await until(() => f.current().status === 'error');
    assert.equal(f.wouldLoad('values'), false);             // a failed page 1: not again for an automatic reason
    assert.equal(f.wouldLoad('open'), true);                // a person's reason asks again, as ensure does
    assert.equal(failing.calls.length, 1);
});

test('list: timeout, failure, an answer that is not a list, a function that throws: all failures, no loop', async () => {
    const server = makeServer(items(30));
    server.delay = 40;
    const {list, warnings} = makeList(server, {timeout: 10});
    list.configure('k', {});
    list.ensure('open');
    await sleep(25);
    assert.equal(list.current().status, 'error');
    assert.equal(list.current().error, 'timeout');
    assert.equal(server.calls[0].cancelled, true);

    const bad = makeServer(items(3));
    bad.answer = () => ({rows: []});
    const b = makeList(bad);
    b.list.configure('k', {});
    b.list.ensure('open');
    await sleep(15);
    assert.equal(b.list.current().status, 'error');
    assert.ok(b.warnings.some(w => w.indexOf('neither an array') !== -1));

    const thrower = R.createList({
        load: () => { throw new Error('sync'); }, keyOf: keyOf, pageSize: () => 10, timeoutMs: () => 0, ttlMs: () => 1000,
        canReplace: () => true, onUpdate: () => {}, warn: () => {}
    });
    thrower.configure('k', {});
    thrower.ensure('open');
    await sleep(5);
    assert.equal(thrower.current().status, 'error');
    assert.equal(thrower.retry(), true);
    assert.equal(warnings.length >= 0, true);
});

// A component reacts to every update of its list; for labels it asks for the list again ('values'). Wired like that,
// a failure that started the next request would loop: these tests count the requests a failure leads to.
function makeReactingList(load, options) {
    const opts = Object.assign({pageSize: 0, ttl: 60000}, options || {});
    const list = R.createList({
        load: load, keyOf: keyOf, pageSize: () => opts.pageSize, timeoutMs: () => 0, ttlMs: () => opts.ttl,
        canReplace: () => true, warn: () => {},
        onUpdate: () => list.ensure('values')   // what aui-select / aui-tree-select do for an unresolved label
    });
    return list;
}

test('list: a page 1 that failed is never asked again by itself (labels, preload); a person (open, retry) asks again', async () => {
    const server = makeServer(items(5));
    server.fail = 1000;
    const list = makeReactingList(server.load);
    list.configure('k', {});
    list.ensure('values');
    await sleep(100);
    assert.equal(server.calls.length, 1, 'one request, no loop');
    list.ensure('values');
    list.ensure('preload');
    await sleep(30);
    assert.equal(server.calls.length, 1, 'automatic reasons do not retry a failed list');
    list.ensure('open');
    await sleep(30);
    assert.equal(server.calls.length, 2, 'opening asks once more');
    assert.deepEqual(server.calls.map(c => c.reason), ['values', 'open']);
    server.fail = 0;
    list.ensure('open');
    await until(() => list.current().status === 'ready');
    assert.equal(server.calls.length, 3);
});

test('list: a load function that throws at once does not loop either (no request storm, no endless digest)', async () => {
    let calls = 0;
    const list = makeReactingList(() => { calls += 1; throw new Error('not ready'); });
    list.configure('k', {});
    list.ensure('values');
    await sleep(50);
    assert.equal(calls, 1);
    assert.equal(list.current().status, 'error');
});

test('list: a failed background refresh waits a whole ttl before the next one', async () => {
    const server = makeServer(items(5));
    // a ttl long enough that a slow machine's timers still land well inside it
    const list = makeReactingList(server.load, {ttl: 250});
    list.configure('k', {});
    list.ensure('open');
    await until(() => list.current().status === 'ready');
    await sleep(270);                   // older than the ttl
    server.fail = 1000;
    list.ensure('open');                // starts a background refresh, which fails
    await until(() => !list.current().refreshing && server.calls.length === 2);
    await sleep(15);
    list.ensure('values');
    list.ensure('open');
    await sleep(10);
    assert.equal(server.calls.length, 2, 'no refresh right after a failed one');
    await sleep(260);                   // a whole ttl later
    list.ensure('open');
    await sleep(10);
    assert.equal(server.calls.length, 3, 'then one more refresh');
    assert.equal(list.current().items.length, 5, 'the rows stay while refreshes fail');
});

// ---------------------------------------------------------------- lookups
function makeLookup(server, options) {
    const opts = Object.assign({chunk: 100, blocked: false, group: ''}, options || {});
    const updates = [];
    const lookup = R.createLookup({
        run: server.load,
        keyOf: keyOf,
        chunkSize: () => opts.chunk,
        timeoutMs: () => 0,
        paramsFor: () => ({tag: 'x'}),
        blocked: () => opts.blocked,
        group: () => opts.group,
        onUpdate: () => updates.push(1),
        warn: () => {}
    });
    return {lookup, updates, opts};
}
const want = (lookup, ids) => lookup.want(new Map(ids.map(id => [String(id), id])));

test('lookup: values asked together go out in one request; chunks of the chunk size; found / missing', async () => {
    const server = makeServer(items(50));
    const {lookup, updates} = makeLookup(server, {chunk: 4});
    want(lookup, [1, 2, 3]);
    want(lookup, [1, 2, 3, 4, 5, 999]);
    await until(() => !lookup.pending('999') && !lookup.pending('1'));
    assert.deepEqual(server.calls.map(c => c.values), [[1, 2, 3, 4], [5, 999]]);
    assert.deepEqual(server.calls.map(c => c.pageSize), [4, 2]);
    assert.equal(server.calls[0].reason, 'lookup');
    assert.equal(lookup.found('2').item.name, 'item 2');
    assert.equal(lookup.found('999'), null);
    assert.equal(lookup.pending('999'), false);
    assert.equal(updates.length, 1);
    want(lookup, [999]);
    await sleep(20);
    assert.equal(server.calls.length, 2);   // not asked again in this round
    lookup.newRound();
    want(lookup, [999]);
    await until(() => server.calls.length === 3);   // a new round asks again
});

test('lookup: waits while blocked; a queued value that became known is not sent; retain forgets', async () => {
    const server = makeServer(items(50));
    const {lookup, opts} = makeLookup(server, {blocked: true});
    want(lookup, [1, 2]);
    await sleep(20);
    assert.equal(server.calls.length, 0);
    want(lookup, [2]);          // 1 became known meanwhile
    opts.blocked = false;
    lookup.kick();
    await until(() => !lookup.pending('2'));
    assert.deepEqual(server.calls.map(c => c.values), [[2]]);
    lookup.retain(new Set());
    assert.equal(lookup.found('2'), null);
});

test('lookup: only asked values are taken from the answer; a failure is retried in the next round only', async () => {
    const server = makeServer(items(50));
    server.answer = () => items(50);   // ignores the ids
    const {lookup} = makeLookup(server);
    want(lookup, [7]);
    await until(() => !lookup.pending('7'));
    assert.equal(lookup.found('7').item.id, 7);
    assert.equal(lookup.found('8'), null);
    const failing = makeServer(items(5));
    failing.fail = 1;
    const b = makeLookup(failing);
    want(b.lookup, [1]);
    await until(() => !b.lookup.pending('1'));
    want(b.lookup, [1]);
    await sleep(30);
    assert.equal(failing.calls.length, 1);
    b.lookup.newRound();
    want(b.lookup, [1]);
    await until(() => !b.lookup.pending('1'));
    assert.equal(failing.calls.length, 2);
    assert.equal(b.lookup.found('1').item.id, 1);
});

test('lookup-group: members with the same group share one request; destroying one does not stop it', async () => {
    const server = makeServer(items(50));
    server.delay = 20;
    const a = makeLookup(server, {group: 'g'});
    const b = makeLookup(server, {group: 'g'});
    const c = makeLookup(server, {group: 'other'});
    want(a.lookup, [1, 2]);
    want(b.lookup, [2, 3]);
    want(c.lookup, [4]);
    await until(() => server.calls.length === 2);   // the shared request is out
    a.lookup.destroy();
    await until(() => !b.lookup.pending('3') && !c.lookup.pending('4'));
    assert.deepEqual(server.calls.map(x => x.values).sort((x, y) => x.length - y.length), [[4], [1, 2, 3]]);
    assert.equal(b.lookup.found('3').item.id, 3);
    assert.equal(b.lookup.found('2').item.id, 2);
    assert.equal(c.lookup.found('4').item.id, 4);
});

// ---------------------------------------------------------------- review round
test('a request answered in time is never aborted afterwards by its timeout', async () => {
    const server = makeServer(items(30));
    const {list} = makeList(server, {timeout: 30});
    list.configure('k', {});
    list.ensure('open');
    await until(() => list.current().status === 'ready');
    await sleep(60);   // past the timeout
    assert.equal(server.calls[0].cancelled, false);
    assert.equal(list.current().status, 'ready');
});

test('a lookup waiting for blocked() is not shown as busy; once unblocked it is', async () => {
    const server = makeServer(items(10));
    const {lookup, opts} = makeLookup(server, {blocked: true});
    want(lookup, [3]);
    assert.equal(lookup.pending('3'), false);
    opts.blocked = false;
    assert.equal(lookup.pending('3'), true);
    lookup.kick();
    await until(() => !lookup.pending('3'));
    assert.equal(lookup.found('3').item.id, 3);
});

test('an answer that cannot be read fails its chunk only; the other chunks still arrive', async () => {
    const server = makeServer(items(10));
    let reads = 0;
    const updates = [];
    const lookup = R.createLookup({
        run: server.load, keyOf: keyOf, chunkSize: () => 2, timeoutMs: () => 0, paramsFor: () => ({}),
        blocked: () => false, group: () => '', onUpdate: () => updates.push(1), warn: () => {},
        scan: function (answer) {
            reads += 1;
            if (reads === 1) throw new Error('broken answer');
            const out = new Map();
            answer.forEach(item => out.set(String(item.id), {item: item, chain: null}));
            return out;
        }
    });
    want(lookup, [1, 2, 3]);
    await until(() => !lookup.pending('1') && !lookup.pending('3'));
    assert.equal(lookup.found('1'), null);        // its chunk failed
    assert.equal(lookup.found('3').item.id, 3);   // the next chunk arrived
    assert.equal(updates.length, 1);
    lookup.newRound();
    want(lookup, [1, 2, 3]);
    await until(() => !lookup.pending('1'));
    assert.equal(lookup.found('1').item.id, 1);   // failed values are asked again in the next round
});

test('lookup-group: a member destroyed before the request goes out does not stop it', async () => {
    const server = makeServer(items(10));
    const joined = {a: 0, b: 0};
    const member = name => R.createLookup({
        run: server.load, keyOf: keyOf, chunkSize: () => 100, timeoutMs: () => 0, paramsFor: () => ({}),
        blocked: () => { joined[name] += 1; return false; },   // asked when the member flushes into the group
        group: () => 'g2', onUpdate: () => {}, warn: () => {}
    });
    const a = {lookup: member('a')};
    const b = {lookup: member('b')};
    want(a.lookup, [1]);
    want(b.lookup, [2]);
    await until(() => joined.a > 0 && joined.b > 0);   // both joined; the request waits for its collection window
    a.lookup.destroy();
    await until(() => !b.lookup.pending('2'));
    assert.equal(server.calls.length, 1);
    assert.deepEqual(server.calls[0].values.slice().sort(), [1, 2]);
    assert.equal(b.lookup.found('2').item.id, 2);
});

test('paramsKey accepts BigInt values; peek() never creates a list', () => {
    assert.equal(R.paramsKey({n: BigInt(5)}), '{"n":"5"}');
    const {list} = makeList(makeServer(items(3)));
    list.configure('k', {});
    assert.equal(list.peek(), null);
    list.current();
    assert.notEqual(list.peek(), null);
});

test('paramsResetWatch: clears when the params change under the value, never when both change or on the first params', () => {
    let key = '{}';
    let enabled = false;
    let value = 5;
    let cleared = 0;
    const w = R.paramsResetWatch(() => key, () => enabled, () => value, () => { cleared += 1; });
    let last = w.watch();
    const step = function () {
        const now = w.watch();
        w.listener(now, last);
        last = now;
    };
    enabled = true; key = 'a'; step();  // loading enabled: first params, nothing to clear
    assert.equal(cleared, 0);
    key = 'b'; step();                  // params changed, value stayed: clear
    assert.equal(cleared, 1);
    key = 'c'; value = 6; step();       // both changed together (a record): keep
    assert.equal(cleared, 1);
    value = null; key = 'd'; step();    // nothing selected: nothing to clear
    assert.equal(cleared, 1);
});

test('paramsResetWatch with load-enabled: the params emptied as loading turns off clear; loading off or on alone, or params changed while off, do not', () => {
    let key = 'a';
    let enabled = true;
    let value = 5;
    let cleared = 0;
    const w = R.paramsResetWatch(() => key, () => enabled, () => value, () => { cleared += 1; });
    let last = w.watch();
    const step = function () {
        const now = w.watch();
        w.listener(now, last);
        last = now;
    };
    enabled = false; step();            // loading paused, the same params: keep
    assert.equal(cleared, 0);
    enabled = true; step();             // and on again: keep
    assert.equal(cleared, 0);
    enabled = false; key = '{}'; step();  // the field the params come from emptied (load-enabled="!!hallId"): clear
    assert.equal(cleared, 1);
    value = 7; step();                  // a record's value while loading is off: keep
    key = 'b'; step();                  // its params filled in later, loading still off: keep
    enabled = true; key = 'c'; step();  // loading on with new params, after being off: keep (a record filled in steps)
    assert.equal(cleared, 1);
    key = 'd'; step();                  // a change under the value once on again: clear
    assert.equal(cleared, 2);
});
