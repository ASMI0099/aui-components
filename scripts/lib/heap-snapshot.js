/**
 * Reads a V8 heap snapshot (HeapProfiler.takeHeapSnapshot) for scripts/perf.js: the largest kinds of objects,
 * and the shortest strong retainer path from the GC roots to one object of interest.
 */
'use strict';

/**
 * targetKind 'index': an aui-tree-select index node (own properties sid and raw).
 * targetKind 'data': a generated data item (an "Item ..." name and no sid).
 * Returns the report as text.
 */
function analyze(snap, targetKind) {
    const m = snap.snapshot.meta;
    const NF = m.node_fields.length;
    const EF = m.edge_fields.length;
    const nType = m.node_fields.indexOf('type');
    const nName = m.node_fields.indexOf('name');
    const nSelf = m.node_fields.indexOf('self_size');
    const nEdges = m.node_fields.indexOf('edge_count');
    const eType = m.edge_fields.indexOf('type');
    const eName = m.edge_fields.indexOf('name_or_index');
    const eTo = m.edge_fields.indexOf('to_node');
    const nodeTypes = m.node_types[0];
    const edgeTypes = m.edge_types[0];
    const nodes = snap.nodes;
    const edges = snap.edges;
    const strings = snap.strings;
    const count = nodes.length / NF;

    const firstEdge = new Uint32Array(count + 1);
    for (let i = 0, e = 0; i < count; i++) {
        firstEdge[i] = e;
        e += nodes[i * NF + nEdges] * EF;
    }
    firstEdge[count] = edges.length;
    const edgeName = ei => {
        const t = edgeTypes[edges[ei + eType]];
        const v = edges[ei + eName];
        return (t === 'element' || t === 'hidden') ? '[' + v + ']' : strings[v];
    };
    const nodeLabel = ni => nodeTypes[nodes[ni * NF + nType]] + ':' + strings[nodes[ni * NF + nName]];

    // the largest kinds by self size
    const bySize = new Map();
    let total = 0;
    for (let i = 0; i < count; i++) {
        const name = nodeTypes[nodes[i * NF + nType]] + ':' + (strings[nodes[i * NF + nName]] || '').slice(0, 40);
        const size = nodes[i * NF + nSelf];
        total += size;
        const entry = bySize.get(name) || {size: 0, n: 0};
        entry.size += size;
        entry.n += 1;
        bySize.set(name, entry);
    }
    const top = Array.from(bySize.entries()).sort((a, b) => b[1].size - a[1].size).slice(0, 12)
        .map(([k, v]) => '  ' + (v.size / 1048576).toFixed(2) + ' MB  ' + v.n + '  ' + k).join('\n');
    const lines = ['heap ' + (total / 1048576).toFixed(1) + ' MB; largest kinds:', top];

    let target = -1;
    for (let i = 0; i < count && target < 0; i++) {
        if (nodeTypes[nodes[i * NF + nType]] !== 'object') continue;
        let hasSid = false;
        let hasRaw = false;
        let itemName = false;
        for (let e = firstEdge[i]; e < firstEdge[i + 1]; e += EF) {
            if (edgeTypes[edges[e + eType]] !== 'property') continue;
            const name = strings[edges[e + eName]];
            if (name === 'sid') hasSid = true;
            if (name === 'raw') hasRaw = true;
            if (name === 'name' && /^Item /.test(strings[nodes[edges[e + eTo] + nName]] || '')) itemName = true;
        }
        if (targetKind === 'data' ? (itemName && !hasSid) : (hasSid && hasRaw)) target = i;
    }
    const what = targetKind === 'data' ? 'data item' : 'index node';
    if (target < 0) {
        lines.push('no ' + what + ' retained');
        return lines.join('\n');
    }

    // breadth-first from the root over strong edges
    const parent = new Int32Array(count).fill(-1);
    const via = new Int32Array(count).fill(-1);
    const queue = new Int32Array(count);
    let head = 0;
    let tail = 0;
    queue[tail++] = 0;
    parent[0] = 0;
    while (head < tail) {
        const ni = queue[head++];
        if (ni === target) break;
        for (let e = firstEdge[ni]; e < firstEdge[ni + 1]; e += EF) {
            const t = edgeTypes[edges[e + eType]];
            if (t === 'weak' || t === 'shortcut') continue;
            const to = edges[e + eTo] / NF;
            if (parent[to] !== -1) continue;
            parent[to] = ni;
            via[to] = e;
            queue[tail++] = to;
        }
    }
    if (parent[target] === -1) {
        lines.push('a ' + what + ' is in the snapshot but not reachable over strong edges (garbage not yet collected)');
        return lines.join('\n');
    }
    const chain = [];
    for (let ni = target; ni !== 0; ni = parent[ni]) {
        chain.push(nodeLabel(parent[ni]) + ' --' + edgeName(via[ni]) + '--> ' + nodeLabel(ni));
    }
    lines.push('retainer path to a ' + what + ':\n  ' + chain.reverse().join('\n  '));
    return lines.join('\n');
}

module.exports = {analyze: analyze};
