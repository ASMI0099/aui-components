// Unit tests of auiControlKit and auiTreeEngine (the data side of aui-tree-select), without a browser.
//   node --test test/unit/            (npm run test:unit)
// AUI_SOURCE=<path to a built file> runs them against that file, e.g. dist/aui-components.min.js.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// the library as built from src/ (scripts/lib/bundle.js), or AUI_SOURCE: a built file, e.g. dist/aui-components.min.js
const source = process.env.AUI_SOURCE ? fs.readFileSync(process.env.AUI_SOURCE, 'utf8') : require('../../scripts/lib/bundle').js();

// A stand-in for the module 'aui': only the two factories under test (and the texts) are created, every other
// registration (components, directives, ...) is skipped.
const registry = {};
const chain = new Proxy({}, {
    get(target, method) {
        return function (name, def) {
            if (method === 'provider' && name === 'auiTexts') registry.auiTexts = new def().$get();
            if (method === 'factory' && (name === 'auiControlKit' || name === 'auiTreeEngine')) {
                const fn = def[def.length - 1];
                registry[name] = fn.apply(null, def.slice(0, -1).map(dep => registry[dep]));
            }
            return chain;
        };
    }
});
// The shared kit reads window.PointerEvent when it is created: a bare window object is enough here.
new Function('angular', 'window', source)(Object.assign({module: () => chain}, {}), {});
const kit = registry.auiControlKit;
const E = registry.auiTreeEngine;

const F = {value: 'id', label: 'name', children: 'children', parent: null, disabled: 'disabled', leaf: 'isLeaf'};
const FLAT = Object.assign({}, F, {parent: 'pid'});
const none = () => false;
const keys = set => Array.from(set).sort();

function sampleNested() {
    return [
        {id: 1, name: 'Electronics', children: [
            {id: 11, name: 'Phones', children: [{id: 111, name: 'Android'}, {id: 112, name: 'iOS'}]},
            {id: 12, name: 'Laptops'}
        ]},
        {id: 2, name: 'Books', children: []},
        {id: 3, name: 'Garden'}
    ];
}

// ---------------------------------------------------------------- kit
test('kit.isSelectionKey matches the aui-select rule', () => {
    assert.equal(kit.isSelectionKey('a'), true);
    assert.equal(kit.isSelectionKey(0), true);
    assert.equal(kit.isSelectionKey(false), true);
    assert.equal(kit.isSelectionKey(''), false);
    assert.equal(kit.isSelectionKey(NaN), false);
    assert.equal(kit.isSelectionKey(null), false);
    assert.equal(kit.isSelectionKey(undefined), false);
    assert.equal(kit.isSelectionKey({}), false);
});

test('kit.readFlag: bare attribute, expressions, unset values and fallbacks', () => {
    assert.equal(kit.readFlag({}, 'multiple', undefined, false), false);
    assert.equal(kit.readFlag({multiple: ''}, 'multiple', undefined, false), true);
    assert.equal(kit.readFlag({multiple: 'true'}, 'multiple', true, false), true);
    assert.equal(kit.readFlag({multiple: 'false'}, 'multiple', false, true), false);
    assert.equal(kit.readFlag({multiple: 'x'}, 'multiple', undefined, false), false);
    assert.equal(kit.readFlag({rounded: 'x'}, 'rounded', undefined, true), true);
    assert.equal(kit.readFlag({a: 'x'}, 'a', 'false', true), false);
    assert.equal(kit.readFlag({a: 'x'}, 'a', ' OFF ', true), false);
    assert.equal(kit.readFlag({a: 'x'}, 'a', 'yes', false), true);
    assert.equal(kit.readFlag({a: 'x'}, 'a', 0, true), false);
    assert.equal(kit.readFlag({a: 'x'}, 'a', 2, false), true);
});

test('kit.readFlag: the attribute\'s own name as its value (disabled="disabled") is on, unless the scope has that name', () => {
    assert.equal(kit.readFlag({disabled: 'disabled'}, 'disabled', undefined, false), true);
    assert.equal(kit.readFlag({readonly: ' ReadOnly '}, 'readonly', undefined, false), true);
    assert.equal(kit.readFlag({showLabel: 'show-label'}, 'showLabel', undefined, false), true);
    // a scope value by that name wins, as any expression's
    assert.equal(kit.readFlag({disabled: 'disabled'}, 'disabled', false, true), false);
    assert.equal(kit.readFlag({disabled: 'disabled'}, 'disabled', 'false', true), false);
    assert.equal(kit.readFlag({disabled: 'disabled'}, 'disabled', null, false), false);
    // another name is an expression: undefined stays unset
    assert.equal(kit.readFlag({disabled: 'vm.locked'}, 'disabled', undefined, false), false);
    assert.equal(kit.readFlag({disabled: 'readonly'}, 'disabled', undefined, false), false);
    assert.equal(kit.readFlag({showLabel: 'showLabel'}, 'showLabel', undefined, false), false);
});

test('kit.borderRadius follows aui-select precedence, with the theme\'s radius token', () => {
    const r = 'var(--aui-control-radius)';
    assert.equal(kit.borderRadius(false, true, true), '0');
    assert.equal(kit.borderRadius(true, false, false), r);
    assert.equal(kit.borderRadius(true, true, false), '0 ' + r + ' ' + r + ' 0');
    assert.equal(kit.borderRadius(true, true, true), r + ' 0 0 ' + r);
});

test('kit.readLimit', () => {
    assert.equal(kit.readLimit(3), 3);
    assert.equal(kit.readLimit('2'), 2);
    assert.equal(kit.readLimit(0), 0);
    assert.equal(kit.readLimit(2.7), 2);
    assert.equal(kit.readLimit(-1), Infinity);
    assert.equal(kit.readLimit(''), Infinity);
    assert.equal(kit.readLimit('abc'), Infinity);
    assert.equal(kit.readLimit(undefined), Infinity);
    assert.equal(kit.readLimit(true), Infinity);
});

// ---------------------------------------------------------------- build
test('build nested: order, depth, parents, positions, leaves; input untouched', () => {
    const data = sampleNested();
    const before = JSON.stringify(data);
    const index = E.build(data, F, {});
    assert.equal(JSON.stringify(data), before, 'input must not be modified');
    assert.deepEqual(index.nodes.map(n => n.key), ['1', '11', '111', '112', '12', '2', '3']);
    const phones = index.byKey.get('11');
    assert.equal(phones.depth, 1);
    assert.equal(phones.parent.key, '1');
    assert.equal(phones.pos, 1);
    assert.equal(phones.setSize, 2);
    assert.deepEqual(index.byKey.get('2').children, []);
    assert.equal(index.byKey.get('111').label, 'Android');
    assert.equal(index.byKey.get('111').sid, 'k:111');
    assert.deepEqual(index.levels.map(level => level.length), [3, 2, 2]);
    assert.equal(index.warnings.length, 0);
});

test('build flat: parent links, orphans as roots, self-parent, cycles broken with a warning', () => {
    const data = [
        {id: 1, name: 'A', pid: null},
        {id: 2, name: 'A1', pid: 1},
        {id: 3, name: 'Orphan', pid: 99},
        {id: 4, name: 'Self', pid: 4},
        {id: 5, name: 'C1', pid: 6},
        {id: 6, name: 'C2', pid: 5},
        {id: 7, name: 'A1a', pid: '2'}
    ];
    const index = E.build(data, FLAT, {});
    assert.deepEqual(index.roots.map(n => n.key), ['1', '3', '4', '5']);
    assert.deepEqual(index.nodes.map(n => n.key), ['1', '2', '7', '3', '4', '5', '6']);
    assert.equal(index.byKey.get('7').depth, 2, 'string parent value matches numeric id');
    assert.equal(index.byKey.get('6').parent.key, '5');
    assert.ok(index.warnings.some(w => w.indexOf('parent cycle') !== -1));
});

test('build: duplicates, shared objects, nodes without value, labels', () => {
    const shared = {id: 9, name: 'Shared'};
    const data = [
        {id: 1, name: 'One', children: [shared]},
        {id: 1, name: 'Dup', children: [{id: 50, name: 'Lost'}]},
        {name: 'Header', children: [{id: 2, name: 'Under header'}]},
        {id: 3},
        shared,
        null,
        'text',
        {id: '', name: 'Empty id'}
    ];
    const index = E.build(data, F, {});
    assert.deepEqual(index.nodes.map(n => n.key), ['1', '9', null, '2', '3', null]);
    assert.equal(index.byKey.has('50'), false, 'a duplicate keeps its subtree out');
    const header = index.nodes[2];
    assert.equal(header.sid.indexOf('s:'), 0);
    assert.equal(header.label, 'Header');
    assert.equal(index.byKey.get('3').label, '3', 'label falls back to the value');
    assert.equal(index.warnings.length, 2);
});

test('build lazy: unknown children are null; leaf flag and empty arrays are leaves; loaded children attach', () => {
    const data = [{id: 1, name: 'A'}, {id: 2, name: 'B', isLeaf: true}, {id: 3, name: 'C', children: []}];
    let index = E.build(data, F, {lazy: true});
    assert.equal(index.byKey.get('1').children, null);
    assert.deepEqual(index.byKey.get('2').children, []);
    assert.deepEqual(index.byKey.get('3').children, []);
    const loaded = new Map([['k:1', [{id: 10, name: 'A0'}, {id: 11, name: 'A1', isLeaf: true}]]]);
    index = E.build(data, F, {lazy: true, loaded: loaded});
    assert.deepEqual(index.byKey.get('1').children.map(n => n.key), ['10', '11']);
    assert.equal(index.byKey.get('10').children, null, 'loaded child without children is still lazy');
    assert.equal(index.byKey.get('10').depth, 1);
});

test('build: deep chain does not overflow the stack', () => {
    const depth = 20000;
    const root = {id: 0, name: 'n0'};
    let current = root;
    for (let i = 1; i < depth; i += 1) {
        const child = {id: i, name: 'n' + i};
        current.children = [child];
        current = child;
    }
    const index = E.build([root], F, {});
    assert.equal(index.nodes.length, depth);
    assert.equal(index.byKey.get(String(depth - 1)).depth, depth - 1);
    const flat = [];
    for (let i = 0; i < depth; i += 1) flat.push({id: i, name: 'n' + i, pid: i === 0 ? null : i - 1});
    assert.equal(E.build(flat, FLAT, {}).nodes.length, depth);
});

// ---------------------------------------------------------------- linked checking
function state(index, ks, dis) {
    return E.conductCheck(index, new Set(ks), dis || none);
}

test('conduct: checking a parent checks all descendants; all children checked checks the parent', () => {
    const index = E.build(sampleNested(), F, {});
    let s = state(index, ['1']);
    assert.deepEqual(keys(s.checked), ['1', '11', '111', '112', '12']);
    assert.deepEqual(keys(s.half), []);
    s = state(index, ['111', '112']);
    assert.deepEqual(keys(s.checked), ['11', '111', '112']);
    assert.deepEqual(keys(s.half), ['1']);
    s = state(index, ['111', '112', '12']);
    assert.deepEqual(keys(s.checked), ['1', '11', '111', '112', '12']);
});

test('conduct: unchecking a child unchecks its ancestors and leaves them partly checked', () => {
    const index = E.build(sampleNested(), F, {});
    const full = state(index, ['1']);
    const next = E.uncheck(index, full.checked, full.half, index.byKey.get('111'), none);
    assert.deepEqual(keys(next.checked), ['112', '12']);
    assert.deepEqual(keys(next.half), ['1', '11']);
    const back = E.check(index, next.checked, index.byKey.get('111'), none);
    assert.deepEqual(keys(back.checked), ['1', '11', '111', '112', '12']);
    assert.deepEqual(keys(back.half), []);
    const cleared = E.uncheck(index, back.checked, back.half, index.byKey.get('1'), none);
    assert.deepEqual(keys(cleared.checked), []);
    assert.deepEqual(keys(cleared.half), []);
});

test('conduct: disabled nodes keep their own state and are ignored for parent state', () => {
    const index = E.build(sampleNested(), F, {});
    const dis = node => node.key === '112';
    let s = state(index, ['1'], dis);
    assert.deepEqual(keys(s.checked), ['1', '11', '111', '12']);
    s = state(index, ['111', '12'], dis);
    assert.deepEqual(keys(s.checked), ['1', '11', '111', '12'], 'the disabled child does not block the parent');
    const disParent = node => node.key === '11';
    s = state(index, ['111', '112', '12'], disParent);
    // 11 is disabled: it is not checked by its children, and its parent 1 ignores it (only 12 counts).
    assert.deepEqual(keys(s.checked), ['1', '111', '112', '12'], 'a disabled parent is not checked by its children');
    assert.deepEqual(keys(s.half), []);
    s = state(index, ['111', '112'], disParent);
    assert.deepEqual(keys(s.checked), ['111', '112']);
    assert.deepEqual(keys(s.half), [], 'nothing propagates through a disabled parent');
});

test('strategies: all, parent (topmost), child (bottom-most)', () => {
    const index = E.build(sampleNested(), F, {});
    const s = state(index, ['11', '3']);
    const pick = strategy => E.strategyNodes(index, s.checked, strategy, none).map(n => n.key);
    assert.deepEqual(pick('all'), ['11', '111', '112', '3']);
    assert.deepEqual(pick('parent'), ['11', '3']);
    assert.deepEqual(pick('child'), ['111', '112', '3']);
    // Round trip: conducting each strategy's output gives the same state.
    ['all', 'parent', 'child'].forEach(strategy => {
        const again = state(index, pick(strategy));
        assert.deepEqual(keys(again.checked), keys(s.checked), strategy);
    });
});

test('pathLabel', () => {
    const index = E.build(sampleNested(), F, {});
    assert.equal(E.pathLabel(index.byKey.get('112'), ' / '), 'Electronics / Phones / iOS');
});

// ---------------------------------------------------------------- rows and search
test('visibleRows: only expanded branches', () => {
    const index = E.build(sampleNested(), F, {});
    let rows = E.visibleRows(index, new Set(), null, new Set(), new Set());
    assert.deepEqual(rows.map(r => r.node.key), ['1', '2', '3']);
    assert.deepEqual(rows.map(r => r.expandable), [true, false, false]);
    rows = E.visibleRows(index, new Set(['k:1', 'k:11']), null, new Set(), new Set());
    assert.deepEqual(rows.map(r => r.node.key), ['1', '11', '111', '112', '12', '2', '3']);
    rows = E.visibleRows(index, new Set(['k:11']), null, new Set(), new Set());
    assert.deepEqual(rows.map(r => r.node.key), ['1', '2', '3'], 'a child stays hidden while its parent is closed');
});

test('search: matches and ancestors, auto-opened; user close/open during search', () => {
    const index = E.build(sampleNested(), F, {});
    const s = E.search(index, node => node.lower.indexOf('ios') !== -1);
    assert.deepEqual(Array.from(s.matched), ['k:112']);
    assert.deepEqual(Array.from(s.ancestors).sort(), ['k:1', 'k:11']);
    let rows = E.visibleRows(index, new Set(), s, new Set(), new Set());
    assert.deepEqual(rows.map(r => r.node.key), ['1', '11', '112']);
    rows = E.visibleRows(index, new Set(), s, new Set(), new Set(['k:11']));
    assert.deepEqual(rows.map(r => r.node.key), ['1', '11']);
    rows = E.visibleRows(index, new Set(), s, new Set(['k:11']), new Set());
    assert.deepEqual(rows.map(r => r.node.key), ['1', '11', '111', '112'], 'opened by the user: all children');
    const phones = E.search(index, node => node.lower.indexOf('phones') !== -1);
    rows = E.visibleRows(index, new Set(), phones, new Set(), new Set());
    assert.deepEqual(rows.map(r => r.node.key), ['1', '11'], 'a matched branch starts closed');
});

test('descendants', () => {
    const index = E.build(sampleNested(), F, {});
    assert.deepEqual(E.descendants(index.byKey.get('1')).map(n => n.key), ['11', '111', '112', '12']);
});

test('release: every link between nodes and to the data is cut', { skip: typeof E.release !== 'function' }, () => {
    const data = sampleNested();
    const index = E.build(data, F, {});
    const node = index.byKey.get('111');
    E.release(index);
    assert.equal(node.parent, null);
    assert.equal(node.children, null);
    assert.equal(node.raw, null);
    assert.equal(index.nodes.length, 0);
    assert.equal(index.roots.length, 0);
    assert.equal(index.byKey.size, 0);
    assert.equal(index.bySid.size, 0);
    assert.equal(data[0].children.length > 0, true, 'the caller data itself is untouched');
});

test('selectable-field: groups are marked only when the field is set and holds false', () => {
    const data = [
        {id: 1, name: 'A', selectable: false},
        {id: 2, name: 'B', selectable: true},
        {id: 3, name: 'C'},
        {id: 4, name: 'D', selectable: 'false'},
        {id: 5, name: 'E', selectable: 0}
    ];
    const plain = E.build(data, F, {});
    assert.deepEqual(plain.nodes.map(n => n.group), [false, false, false, false, false], 'no selectable field: no groups');
    const grouped = E.build(data, Object.assign({}, F, {selectable: 'selectable'}), {});
    assert.deepEqual(grouped.nodes.map(n => n.group), [true, false, false, false, false], 'only the boolean false');
});

test('strategyNodes: a checked group stands for the nodes under it; parent strategy looks through it', () => {
    const FG = Object.assign({}, F, {selectable: 'selectable'});
    const data = [
        {id: 1, name: 'P', children: [
            {id: 11, name: 'G', selectable: false, children: [{id: 111, name: 'A'}, {id: 112, name: 'B'}]},
            {id: 12, name: 'C'}
        ]},
        {id: 2, name: 'T', selectable: false, children: [{id: 21, name: 'D'}, {id: 22, name: 'E'}]}
    ];
    const index = E.build(data, FG, {});
    const values = (checked, strategy, isDisabled) => E.strategyNodes(index, checked, strategy, isDisabled || none).map(n => n.key);

    // Checking P passes through the group G to its children
    const all = E.conductCheck(index, new Set(['1']), none);
    assert.deepEqual(keys(all.checked), ['1', '11', '111', '112', '12']);
    assert.deepEqual(values(all.checked, 'all'), ['1', '111', '112', '12'], 'the group itself is never a value');
    assert.deepEqual(values(all.checked, 'parent'), ['1']);
    assert.deepEqual(values(all.checked, 'child'), ['111', '112', '12']);

    // Unchecking a child of G: G and P no longer count as fully checked; parent strategy looks through G
    const less = E.uncheck(index, all.checked, all.half, index.byKey.get('111'), none);
    assert.deepEqual(keys(less.checked), ['112', '12']);
    assert.deepEqual(values(less.checked, 'parent'), ['112', '12']);

    // Every child of the top group T checked: T counts as checked, the values are its children
    const top = E.conductCheck(index, new Set(['21', '22']), none);
    assert.ok(top.checked.has('2'));
    assert.deepEqual(values(top.checked, 'parent'), ['21', '22']);
    assert.deepEqual(values(top.checked, 'all'), ['21', '22']);

    // A group nothing passes through (isDisabled says so) stays itself, as a disabled node does
    const kept = new Set(['2']);
    const inert = n => n.key === '2';
    assert.deepEqual(values(kept, 'all', inert), ['2']);
    assert.deepEqual(values(kept, 'parent', inert), ['2']);

    // Without groups the results are the same as before (the look-through never runs)
    const plain = E.build(data, F, {});
    const s = E.conductCheck(plain, new Set(['1']), none);
    assert.deepEqual(E.strategyNodes(plain, s.checked, 'all', none).map(n => n.key), ['1', '11', '111', '112', '12']);
    assert.deepEqual(E.strategyNodes(plain, s.checked, 'parent', none).map(n => n.key), ['1']);
});

test('performance: 20k nodes (20 + 1,000 + 19,000) build, conduct, search, rows', () => {
    const data = [];
    let id = 0;
    for (let a = 0; a < 20; a += 1) {
        const top = {id: ++id, name: 'Group ' + a, children: []};
        for (let b = 0; b < 50; b += 1) {
            const mid = {id: ++id, name: 'Category ' + a + '-' + b, children: []};
            for (let c = 0; c < 19; c += 1) mid.children.push({id: ++id, name: 'Item ' + a + '-' + b + '-' + c});
            top.children.push(mid);
        }
        data.push(top);
    }
    const t0 = Date.now();
    const index = E.build(data, F, {});
    const t1 = Date.now();
    const s = E.conductCheck(index, new Set(['1']), none);
    const next = E.uncheck(index, s.checked, s.half, index.byKey.get('3'), none);
    const t2 = Date.now();
    const found = E.search(index, node => node.lower.indexOf('item 7-3') !== -1);
    const all = new Set(index.nodes.map(n => n.sid));
    const rows = E.visibleRows(index, all, null, new Set(), new Set());
    const t3 = Date.now();
    assert.equal(index.nodes.length, 20020);
    assert.equal(rows.length, 20020);
    assert.ok(next.checked.size > 900);
    assert.ok(found.matched.size > 0);
    console.log(`    20k nodes: build ${t1 - t0} ms, check+uncheck ${t2 - t1} ms, search+rows ${t3 - t2} ms`);
    assert.ok(t3 - t0 < 1500, 'well under a second and a half in total');
});
