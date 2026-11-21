/**
 * auiTreeEngine: the data side of aui-tree-select (indexes, checked states, search).
 */
angular.module('aui')
    /**
     * Tree data engine for aui-tree-select: indexing, linked (cascade) checking, value strategies, visible rows and
     * search. Pure functions over plain objects: the caller's data is never modified.
     */
    .factory('auiTreeEngine', ['auiControlKit', function (kit) {
        const ROOT_SID = 'r:';

        function keyOf(value) {
            return kit.isSelectionKey(value) ? String(value) : null;
        }

        function isRecord(value) {
            return value !== null && typeof value === 'object' && !Array.isArray(value);
        }

        /**
         * Index nested data (fields.parent unset) or a flat list (fields.parent = the field holding the parent value).
         * opts.lazy: children of a node without a children array stay unknown (null) until loaded.
         * opts.loaded: Map sid -> raw children loaded on demand.
         * Node ids: sid 'k:<value>' for nodes with a valid value, 's:<path>' for nodes without one (not selectable).
         */
        function build(data, fields, opts) {
            const options = opts || {};
            const lazy = !!options.lazy;
            const loaded = options.loaded || new Map();
            const warnings = [];
            const byKey = new Map();
            const bySid = new Map();
            const seenRaw = new Set();
            let seq = 0;

            function makeNode(raw, path) {
                const value = raw[fields.value];
                const key = keyOf(value);
                if (key !== null && byKey.has(key)) {
                    warnings.push('duplicate value "' + key + '" ignored (with its children)');
                    return null;
                }
                const labelValue = raw[fields.label];
                const label = (labelValue !== undefined && labelValue !== null)
                    ? String(labelValue)
                    : (key !== null ? key : '');
                seq += 1;
                const node = {
                    id: seq,
                    key: key,
                    sid: key !== null ? 'k:' + key : 's:' + path,
                    value: key !== null ? value : undefined,
                    label: label,
                    lower: label.toLowerCase(),
                    raw: raw,
                    parent: null,
                    children: [],
                    depth: 0,
                    disabled: !!raw[fields.disabled],
                    // selectable-field: false there marks a group, shown but never picked itself
                    group: !!fields.selectable && raw[fields.selectable] === false,
                    leafHint: raw[fields.leaf] === true,
                    pos: 0,
                    setSize: 0
                };
                if (key !== null) byKey.set(key, node);
                bySid.set(node.sid, node);
                return node;
            }

            function takeRaw(raw) {
                if (!isRecord(raw)) return false;
                if (seenRaw.has(raw)) {
                    warnings.push('the same data object appears twice; the repeat is ignored');
                    return false;
                }
                seenRaw.add(raw);
                return true;
            }

            // Depth-first in document order, without recursion (deep data cannot overflow the stack). For repeated
            // objects or values, the first one a reader meets from top to bottom wins.
            function attachNested(list, parent) {
                const roots = [];
                const stack = [{list: list, i: 0, parent: parent, out: parent ? parent.children : roots}];
                while (stack.length) {
                    const frame = stack[stack.length - 1];
                    if (frame.i >= frame.list.length) {
                        stack.pop();
                        continue;
                    }
                    const i = frame.i;
                    frame.i += 1;
                    const raw = frame.list[i];
                    if (!takeRaw(raw)) continue;
                    const node = makeNode(raw, (frame.parent ? frame.parent.sid : '') + '/' + i);
                    if (!node) continue;
                    node.parent = frame.parent;
                    node.depth = frame.parent ? frame.parent.depth + 1 : 0;
                    frame.out.push(node);
                    const own = raw[fields.children];
                    const fetched = loaded.get(node.sid);
                    if (Array.isArray(own) && own.length > 0) {
                        stack.push({list: own, i: 0, parent: node, out: node.children});
                    } else if (!Array.isArray(own) && fetched) {
                        stack.push({list: fetched, i: 0, parent: node, out: node.children});
                    } else if (lazy && !Array.isArray(own) && !node.leafHint) {
                        node.children = null;
                    }
                }
                return roots;
            }

            function buildFlat(list) {
                const items = [];
                list.forEach(function (raw, i) {
                    if (!takeRaw(raw)) return;
                    const node = makeNode(raw, 'f' + i);
                    if (node) items.push(node);
                });
                const childrenOf = new Map();
                const roots = [];
                items.forEach(function (node) {
                    const parentKey = keyOf(node.raw[fields.parent]);
                    if (parentKey === null || parentKey === node.key || !byKey.has(parentKey)) {
                        roots.push(node);
                        return;
                    }
                    if (!childrenOf.has(parentKey)) childrenOf.set(parentKey, []);
                    childrenOf.get(parentKey).push(node);
                });
                const attached = new Set();
                function attachFrom(root) {
                    root.parent = null;
                    root.depth = 0;
                    const stack = [root];
                    attached.add(root);
                    while (stack.length) {
                        const node = stack.pop();
                        const kids = (node.key !== null && childrenOf.get(node.key)) || [];
                        node.children = [];
                        kids.forEach(function (kid) {
                            if (attached.has(kid)) return;
                            attached.add(kid);
                            kid.parent = node;
                            kid.depth = node.depth + 1;
                            node.children.push(kid);
                            stack.push(kid);
                        });
                    }
                }
                roots.forEach(attachFrom);
                // Nodes still unattached sit in a parent cycle (A -> B -> A): break the cycle at the first of them.
                items.forEach(function (node) {
                    if (attached.has(node)) return;
                    warnings.push('parent cycle at value "' + node.key + '"; shown as a top-level node');
                    roots.push(node);
                    attachFrom(node);
                });
                // Lazy children of flat nodes come from the loader, as nested lists.
                items.forEach(function (node) {
                    if (node.children.length > 0) return;
                    const fetched = loaded.get(node.sid);
                    if (fetched) {
                        attachNested(fetched, node);
                    } else if (lazy && !node.leafHint) {
                        node.children = null;
                    }
                });
                return roots;
            }

            const list = Array.isArray(data) ? data : [];
            const roots = fields.parent ? buildFlat(list) : attachNested(list, null);

            // Pre-order list, nodes per depth, sibling positions.
            const nodes = [];
            const levels = [];
            function numberSiblings(siblings) {
                siblings.forEach(function (node, i) {
                    node.pos = i + 1;
                    node.setSize = siblings.length;
                });
            }
            numberSiblings(roots);
            const stack = roots.slice().reverse();
            while (stack.length) {
                const node = stack.pop();
                nodes.push(node);
                (levels[node.depth] || (levels[node.depth] = [])).push(node);
                if (node.children && node.children.length) {
                    numberSiblings(node.children);
                    for (let i = node.children.length - 1; i >= 0; i -= 1) stack.push(node.children[i]);
                }
            }
            for (let d = 0; d < levels.length; d += 1) {
                if (!levels[d]) levels[d] = [];
            }

            return {roots: roots, nodes: nodes, levels: levels, byKey: byKey, bySid: bySid, warnings: warnings};
        }

        function kidsOf(node) {
            return node.children || [];
        }

        /**
         * Linked checking, adding keys: conduct down to enabled descendants, then up to parents whose enabled
         * children are all checked. Disabled nodes keep their own state and do not pass checks through.
         */
        function conductCheck(index, keys, isDisabled) {
            const checked = new Set(keys);
            const half = new Set();
            const levels = index.levels;
            for (let level = 0; level < levels.length; level += 1) {
                levels[level].forEach(function (node) {
                    if (node.key === null || !checked.has(node.key) || isDisabled(node)) return;
                    kidsOf(node).forEach(function (child) {
                        if (child.key !== null && !isDisabled(child)) checked.add(child.key);
                    });
                });
            }
            conductUp(index, checked, half, isDisabled, true);
            return {checked: checked, half: half};
        }

        /** Linked checking, removing keys: clear enabled descendants of unchecked nodes, then recompute parents. */
        function conductUncheck(index, keys, previousHalf, isDisabled) {
            const checked = new Set(keys);
            const levels = index.levels;
            for (let level = 0; level < levels.length; level += 1) {
                levels[level].forEach(function (node) {
                    if (node.key === null || checked.has(node.key) || previousHalf.has(node.key) || isDisabled(node)) return;
                    kidsOf(node).forEach(function (child) {
                        if (child.key !== null && !isDisabled(child)) checked.delete(child.key);
                    });
                });
            }
            const half = new Set();
            conductUp(index, checked, half, isDisabled, false);
            return {checked: checked, half: half};
        }

        function conductUp(index, checked, half, isDisabled, adding) {
            const levels = index.levels;
            const visited = new Set();
            for (let level = levels.length - 1; level >= 0; level -= 1) {
                levels[level].forEach(function (node) {
                    const parent = node.parent;
                    if (isDisabled(node) || !parent || visited.has(parent)) return;
                    visited.add(parent);
                    if (parent.key === null || isDisabled(parent)) return;
                    let all = true;
                    let partial = false;
                    kidsOf(parent).forEach(function (child) {
                        if (isDisabled(child)) return;
                        const isChecked = child.key !== null && checked.has(child.key);
                        if (!isChecked) all = false;
                        if (isChecked || (child.key !== null && half.has(child.key))) partial = true;
                    });
                    if (adding && all) checked.add(parent.key);
                    if (!adding && !all) checked.delete(parent.key);
                    if (partial) half.add(parent.key);
                });
            }
            checked.forEach(function (key) { half.delete(key); });
        }

        function check(index, checkedKeys, node, isDisabled) {
            const keys = new Set(checkedKeys);
            keys.add(node.key);
            return conductCheck(index, keys, isDisabled);
        }

        function uncheck(index, checkedKeys, halfKeys, node, isDisabled) {
            const keys = new Set(checkedKeys);
            keys.delete(node.key);
            return conductUncheck(index, keys, halfKeys, isDisabled);
        }

        /**
         * Checked nodes in tree order, filtered by strategy: 'all', 'parent' (topmost only), 'child' (bottom-most).
         * A checked group (selectable-field) stands for the nodes under it and is left out, unless isDisabled says
         * nothing passes through it (then it stays itself, as a disabled node does).
         */
        function strategyNodes(index, checked, strategy, isDisabled) {
            return index.nodes.filter(function (node) {
                if (node.key === null || !checked.has(node.key)) return false;
                if (node.group && !isDisabled(node)) return false;
                if (strategy === 'parent') {
                    let parent = node.parent;
                    // Look through checked groups: a checked node above them covers this one.
                    while (parent && parent.group && parent.key !== null && !isDisabled(parent) && checked.has(parent.key)) {
                        parent = parent.parent;
                    }
                    return !(parent && parent.key !== null && !isDisabled(parent) && checked.has(parent.key));
                }
                if (strategy === 'child') {
                    return !kidsOf(node).some(function (child) { return child.key !== null && checked.has(child.key); });
                }
                return true;
            });
        }

        /** Labels from the root down to `node`, joined by `separator`. */
        function pathLabel(node, separator) {
            const parts = [];
            for (let current = node; current; current = current.parent) parts.push(current.label);
            return parts.reverse().join(separator);
        }

        /** Search: matching nodes plus their ancestors. matchFn(node) -> boolean. */
        function search(index, matchFn) {
            const matched = new Set();
            const ancestors = new Set();
            const visible = new Set();
            index.nodes.forEach(function (node) {
                if (!matchFn(node)) return;
                matched.add(node.sid);
                visible.add(node.sid);
                for (let parent = node.parent; parent && !ancestors.has(parent.sid); parent = parent.parent) {
                    ancestors.add(parent.sid);
                    visible.add(parent.sid);
                }
            });
            return {matched: matched, ancestors: ancestors, visible: visible};
        }

        /**
         * Visible rows in display order.
         * Normal mode: a node shows its children when `expanded` has its sid.
         * Search mode: matches and their ancestors only; ancestors open automatically (filtered children) unless the
         * user closed them; a node the user opened during the search shows all of its children.
         */
        function visibleRows(index, expanded, searchState, searchOpen, searchClosed) {
            const rows = [];
            const stack = [];
            for (let i = index.roots.length - 1; i >= 0; i -= 1) stack.push({node: index.roots[i], filtered: !!searchState});
            while (stack.length) {
                const item = stack.pop();
                const node = item.node;
                if (item.filtered && !searchState.visible.has(node.sid)) continue;
                const kids = node.children;
                const expandable = kids === null || kids.length > 0;
                let open;
                let childFiltered = false;
                if (searchState) {
                    if (searchOpen.has(node.sid)) {
                        open = true;
                    } else if (item.filtered && searchState.ancestors.has(node.sid) && !searchClosed.has(node.sid)) {
                        open = true;
                        childFiltered = true;
                    } else {
                        open = false;
                    }
                } else {
                    open = expanded.has(node.sid);
                }
                open = open && expandable && kids !== null;
                rows.push({node: node, expandable: expandable, expanded: open});
                if (open) {
                    for (let i = kids.length - 1; i >= 0; i -= 1) stack.push({node: kids[i], filtered: childFiltered});
                }
            }
            return rows;
        }

        /**
         * Break every link of an index that is no longer used, so that a stray reference to one node (or row)
         * cannot keep the whole tree and its data in memory.
         */
        function release(index) {
            index.nodes.forEach(function (node) {
                node.parent = null;
                node.children = null;
                node.raw = null;
            });
            index.nodes = [];
            index.roots = [];
            index.levels = [];
            index.byKey.clear();
            index.bySid.clear();
        }

        /** Descendants of `node` in pre-order (excluding the node). */
        function descendants(node) {
            const out = [];
            const stack = kidsOf(node).slice().reverse();
            while (stack.length) {
                const current = stack.pop();
                out.push(current);
                const kids = kidsOf(current);
                for (let i = kids.length - 1; i >= 0; i -= 1) stack.push(kids[i]);
            }
            return out;
        }

        return {
            ROOT_SID: ROOT_SID,
            keyOf: keyOf,
            build: build,
            conductCheck: conductCheck,
            check: check,
            uncheck: uncheck,
            strategyNodes: strategyNodes,
            pathLabel: pathLabel,
            search: search,
            visibleRows: visibleRows,
            descendants: descendants,
            release: release
        };
    }]);
