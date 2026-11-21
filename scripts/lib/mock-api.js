/**
 * The mock catalog API of the examples, served by the dev server under /api/v1/ (GET only). Everything is generated
 * from a fixed seed, so every start answers the same: a category tree, products, stores and their departments.
 *
 * Every answer is {code, message, data}; a page is {items, total, page, size, pages, hasMore}. Answers come after a
 * short delay (150-350 ms, ?delay=<ms> sets it), so that loading states can be seen.
 *
 *   /categories/children?parentId=&page=&size=     the children of a node (the roots without parentId)
 *   /categories/tree?rootId=&maxDepth=              a nested tree (one subtree with rootId)
 *   /categories/flat?limit=                         a flat list with parentId, parents first (limit: up to 100,000
 *                                                   nodes of a larger generated tree)
 *   /categories/search?keyword=&page=&size=         matches with pathIds and pathNames
 *   /categories/search/tree?keyword=&limit=         matches as a pruned tree: {items, total, matched}
 *   /categories/paths?ids=                          root-to-node chains of saved values
 *   /products?keyword=&status=&brand=&categoryId=&storeId=&departmentId=&page=&size=&sort=&order=
 *   /products/all?limit=&status=                    every product in one answer
 *   /products/by-ids?ids=                           products by id, in the order asked
 *   /stores/list?ids=&keyword=&isPaging=&page=&size=
 *   /departments/list?storeId=&ids=&keyword=&isPaging=&page=&size=
 *   /stats                                          the sizes of the data sets
 */
'use strict';

// ------------------------------------------------------------------ data

/** A small seeded random generator (mulberry32): the same data on every start. */
function random(seed) {
    let a = seed >>> 0;
    return function () {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const ROOTS = ['Electronics', 'Home & Kitchen', 'Office', 'Garden & Outdoor', 'Sports', 'Toys & Games', 'Books & Media',
    'Tools & Hardware', 'Health & Beauty', 'Car Care'];
const GROUPS = ['Accessories', 'Essentials', 'Storage', 'Lighting', 'Cleaning', 'Supplies', 'Parts', 'Kits', 'Furniture', 'Care'];
const KINDS = ['Cables', 'Cases', 'Chargers', 'Holders', 'Mounts', 'Stands', 'Covers', 'Adapters', 'Bags', 'Boxes', 'Brushes',
    'Clips', 'Filters', 'Hooks', 'Lamps', 'Mats', 'Organizers', 'Racks', 'Sets', 'Trays'];
const STYLES = ['Compact', 'Classic', 'Large', 'Travel', 'Premium', 'Basic', 'Heavy Duty', 'Slim'];
const BRANDS = ['Brightline', 'Corelite', 'Everpeak', 'Fieldcraft', 'Halcyon', 'Ironleaf', 'Lumio', 'Meridian', 'Northbeam',
    'Oakline', 'Pinecrest', 'Quartzon', 'Redwood Labs', 'Silverfin', 'Tidewell', 'Vantage'];
const ADJECTIVES = ['Compact', 'Wireless', 'Portable', 'Smart', 'Classic', 'Foldable', 'Ergonomic', 'Rechargeable', 'Modular',
    'Adjustable', 'Durable', 'Lightweight'];
const NOUNS = ['Desk Lamp', 'Speaker', 'Keyboard', 'Backpack', 'Water Bottle', 'Kettle', 'Chair', 'Notebook', 'Drill',
    'Headphones', 'Blender', 'Monitor Stand', 'Tent', 'Yoga Mat', 'Shelf', 'Charger', 'Toolbox', 'Planter', 'Mug', 'Clock'];
const DEPARTMENTS = ['Electronics', 'Kitchen', 'Furniture', 'Garden', 'Sports', 'Toys', 'Books', 'Tools', 'Beauty', 'Office',
    'Lighting', 'Storage', 'Outdoor', 'Travel', 'Home Care'];
// some status values of a product: 1 on sale, 2 draft, 3 out of stock, 0 discontinued (only "on sale" can be picked)
const STATUS_WEIGHTS = [[1, 0.82], [3, 0.08], [2, 0.05], [0, 0.05]];

function buildCatalog() {
    const rnd = random(20240611);
    const nodes = [];
    const byId = new Map();
    function add(parent, name, extra) {
        const node = Object.assign({
            id: nodes.length + 1,
            parentId: parent ? parent.id : null,
            code: 'C' + String(nodes.length + 1).padStart(6, '0'),
            name: name,
            level: parent ? parent.level + 1 : 1,
            selectable: true,
            disabled: false,
            productCount: 0,
            childIds: []
        }, extra || {});
        nodes.push(node);
        byId.set(node.id, node);
        if (parent) parent.childIds.push(node.id);
        return node;
    }
    ROOTS.forEach(function (rootName) {
        const root = add(null, rootName, {selectable: false});
        GROUPS.slice(0, 6 + Math.floor(rnd() * 5)).forEach(function (groupName) {
            const group = add(root, rootName.split(' ')[0] + ' ' + groupName, {selectable: false});
            const kinds = KINDS.slice().sort(() => rnd() - 0.5).slice(0, 5 + Math.floor(rnd() * 6));
            kinds.forEach(function (kind) {
                const category = add(group, kind, {disabled: rnd() < 0.05});
                STYLES.slice(0, 3 + Math.floor(rnd() * 5)).forEach(function (style) {
                    add(category, style + ' ' + kind, {disabled: rnd() < 0.04});
                });
            });
        });
    });
    // samples for the examples: a node with 20,000 children, a chain twelve levels deep, names that test the rendering
    const samples = add(null, 'Sample Data', {selectable: false});
    const wide = add(samples, 'Spare Parts');
    for (let i = 1; i <= 20000; i++) add(wide, 'Spare Part ' + String(i).padStart(5, '0'));
    let deep = add(samples, 'Nested Sample');
    for (let level = 3; level <= 12; level++) deep = add(deep, 'Nesting Level ' + level);
    const edge = add(samples, 'Edge Cases', {selectable: false});
    const long = 'A long category name that goes on to show how a label wider than its place is cut with an ellipsis in the ' +
        'field, while the list shows it whole on as many lines as it needs, and the tooltip shows it too';
    [long, long + ', and then some more words to make it longer still: about two hundred and forty characters in all',
        '<b>Markup</b> shown as text, <script>alert(1)</script> never run', 'Quotes "double" and \'single\'',
        'Ampersand & less-than < greater-than >', 'Emoji 🎉 in a label ✅', '‮right-to-left override‬ mark',
        'Duplicate name', 'Duplicate name'].forEach(function (name) { add(edge, name); });
    const off = add(edge, 'Disabled branch', {disabled: true});
    add(off, 'Child of a disabled branch');
    add(edge, 'Group that cannot be picked', {selectable: false});
    nodes.forEach(function (node) {
        node.leaf = node.childIds.length === 0;
        node.childCount = node.childIds.length;
    });

    const leaves = nodes.filter(n => n.leaf && !n.disabled && n.level >= 3 && byId.get(n.parentId).name.indexOf('Spare') !== 0);
    const stores = [];
    const departments = [];
    for (let s = 1; s <= 40; s++) {
        const status = s % 13 === 0 ? 0 : 1;
        const store = {id: s, code: 'S' + String(s).padStart(3, '0'), name: 'Store ' + String(s).padStart(2, '0'), status: status,
            disabled: status !== 1, departmentCount: 0};
        stores.push(store);
        DEPARTMENTS.slice().sort(() => rnd() - 0.5).slice(0, 6 + Math.floor(rnd() * 9)).forEach(function (dept) {
            const dStatus = rnd() < 0.06 ? 0 : 1;
            departments.push({id: departments.length + 1, storeId: s, storeName: store.name, code: 'D' + String(departments.length + 1).padStart(4, '0'),
                name: dept + ' (' + store.name + ')', departmentName: dept, status: dStatus, disabled: dStatus !== 1});
            if (dStatus === 1) store.departmentCount += 1;
        });
    }
    const products = [];
    for (let p = 1; p <= 60000; p++) {
        const category = leaves[Math.floor(rnd() * leaves.length)];
        const department = departments[Math.floor(rnd() * departments.length)];
        let r = rnd();
        let status = 1;
        for (const [value, weight] of STATUS_WEIGHTS) {
            if (r < weight) { status = value; break; }
            r -= weight;
        }
        const name = ADJECTIVES[Math.floor(rnd() * ADJECTIVES.length)] + ' ' + NOUNS[Math.floor(rnd() * NOUNS.length)] + ' ' +
            String.fromCharCode(65 + Math.floor(rnd() * 26)) + '-' + (100 + Math.floor(rnd() * 900));
        products.push({id: p, code: 'P' + String(p).padStart(6, '0'), name: name, brandName: BRANDS[Math.floor(rnd() * BRANDS.length)],
            categoryId: category.id, storeId: department.storeId, departmentId: department.id,
            price: Math.round((2 + rnd() * 498) * 100) / 100, status: status, disabled: status !== 1});
        category.productCount += 1;
    }
    return {nodes: nodes, byId: byId, stores: stores, departments: departments, products: products};
}

// the ids of the larger generated tree start here, apart from the catalog's
const LARGE_BASE = 1000000;

/**
 * A larger generated tree for /categories/flat (up to 100,000 nodes, parents first). The tree of a size is the first
 * nodes of the 100,000-node one, so an id means the same node in each.
 */
function buildLargeTree(size) {
    const out = [];
    const queue = [];
    for (let r = 1; r <= 20 && out.length < size; r++) {
        const node = {id: LARGE_BASE + out.length + 1, parentId: null, name: 'Group ' + r, level: 1};
        out.push(node);
        queue.push(node);
    }
    while (queue.length && out.length < size) {
        const parent = queue.shift();
        const count = parent.level === 1 ? 50 : parent.level === 2 ? 20 : 5;
        for (let i = 1; i <= count && out.length < size; i++) {
            const node = {id: LARGE_BASE + out.length + 1, parentId: parent.id, name: parent.name + '.' + i, level: parent.level + 1};
            out.push(node);
            if (node.level < 5) queue.push(node);
        }
    }
    const childCount = new Map();
    out.forEach(function (node) { if (node.parentId) childCount.set(node.parentId, (childCount.get(node.parentId) || 0) + 1); });
    return out.map(function (node) {
        return {id: node.id, parentId: node.parentId, name: node.name, level: node.level,
            leaf: !childCount.has(node.id), childCount: childCount.get(node.id) || 0, selectable: true, disabled: false};
    });
}

// ------------------------------------------------------------------ answers

function create() {
    let catalog = null;
    const large = new Map();
    let largeIndex = null;
    const data = function () { return catalog || (catalog = buildCatalog()); };
    const largeTree = function (size) {
        if (!large.has(size)) large.set(size, buildLargeTree(size));
        return large.get(size);
    };

    const lean = function (node) {
        return {id: node.id, parentId: node.parentId, code: node.code, name: node.name, level: node.level, leaf: node.leaf,
            childCount: node.childCount, productCount: node.productCount, selectable: node.selectable, disabled: node.disabled};
    };
    const subtree = function (node, depthLeft) {
        const out = lean(node);
        if (!node.leaf && depthLeft !== 1) {
            out.children = node.childIds.map(id => subtree(data().byId.get(id), depthLeft ? depthLeft - 1 : 0));
        }
        return out;
    };
    const chain = function (node) {
        const list = [];
        for (let n = node; n; n = n.parentId ? data().byId.get(n.parentId) : null) list.unshift(lean(n));
        return list;
    };
    const page = function (items, q, defaultSize) {
        const size = Math.min(Math.max(Number(q.size) || defaultSize, 1), 5000);
        const number = Math.max(Number(q.page) || 1, 1);
        const pages = Math.ceil(items.length / size);
        return {items: items.slice((number - 1) * size, number * size), total: items.length, page: number, size: size, pages: pages,
            hasMore: number < pages};
    };
    const ids = function (text) {
        return String(text || '').split(',').map(s => Number(s.trim())).filter(n => n > 0);
    };
    const matches = function (text, keyword) {
        return String(text).toLowerCase().indexOf(keyword) !== -1;
    };

    const routes = {
        '/stats': function () {
            return {categories: data().nodes.length, products: data().products.length, stores: data().stores.length,
                departments: data().departments.length};
        },
        '/categories/children': function (q) {
            const parent = q.parentId ? data().byId.get(Number(q.parentId)) : null;
            if (q.parentId && !parent) throw notFound('category ' + q.parentId);
            const children = (parent ? parent.childIds.map(id => data().byId.get(id)) : data().nodes.filter(n => n.parentId === null)).map(lean);
            return q.size ? page(children, q, 200) : children;
        },
        '/categories/tree': function (q) {
            const depth = Number(q.maxDepth) || 0;
            if (q.rootId) {
                const root = data().byId.get(Number(q.rootId));
                if (!root) throw notFound('category ' + q.rootId);
                return [subtree(root, depth)];
            }
            return data().nodes.filter(n => n.parentId === null).map(n => subtree(n, depth));
        },
        '/categories/flat': function (q) {
            const limit = Math.min(Number(q.limit) || data().nodes.length, 100000);
            if (limit <= data().nodes.length) return data().nodes.slice(0, limit).map(lean);
            return largeTree(limit);
        },
        '/categories/search': function (q) {
            const keyword = String(q.keyword || '').trim().toLowerCase();
            if (!keyword) throw badRequest('keyword is required');
            const hits = data().nodes.filter(n => matches(n.name, keyword) || matches(n.code, keyword)).map(function (node) {
                const path = chain(node);
                return Object.assign(lean(node), {pathIds: path.map(n => n.id), pathNames: path.map(n => n.name)});
            });
            return page(hits, q, 20);
        },
        '/categories/search/tree': function (q) {
            const keyword = String(q.keyword || '').trim().toLowerCase();
            if (!keyword) throw badRequest('keyword is required');
            const limit = Math.min(Number(q.limit) || 100, 1000);
            const all = data().nodes.filter(n => matches(n.name, keyword));
            const hits = all.slice(0, limit);
            // the pruned tree: every node on the way to a match, with only those children; a match lists none
            const keep = new Map();
            hits.forEach(function (hit) {
                chain(hit).forEach(function (node) { if (!keep.has(node.id)) keep.set(node.id, new Set()); });
                let n = hit;
                while (n.parentId) {
                    keep.get(n.parentId).add(n.id);
                    n = data().byId.get(n.parentId);
                }
            });
            const hitIds = new Set(hits.map(h => h.id));
            const build = function (id) {
                const out = lean(data().byId.get(id));
                const kids = keep.get(id);
                if (kids.size && !hitIds.has(id)) out.children = data().byId.get(id).childIds.filter(c => kids.has(c)).map(build);
                return out;
            };
            const roots = data().nodes.filter(n => n.parentId === null && keep.has(n.id)).map(n => build(n.id));
            return {items: roots, total: all.length, matched: hits.length};
        },
        '/categories/paths': function (q) {
            return ids(q.ids).map(function (id) {
                if (id <= LARGE_BASE) {
                    const node = data().byId.get(id);
                    return node ? chain(node) : null;
                }
                // a node of the larger generated tree
                if (!largeIndex) largeIndex = new Map(largeTree(100000).map(n => [n.id, n]));
                const list = [];
                for (let n = largeIndex.get(id); n; n = n.parentId ? largeIndex.get(n.parentId) : null) list.unshift(n);
                return list.length ? list : null;
            }).filter(Boolean);
        },
        '/products': function (q) {
            const keyword = String(q.keyword || '').trim().toLowerCase();
            let list = data().products;
            if (keyword) list = list.filter(p => matches(p.name, keyword) || matches(p.code, keyword) || matches(p.brandName, keyword));
            if (q.status !== undefined && q.status !== '') list = list.filter(p => p.status === Number(q.status));
            if (q.brand) list = list.filter(p => p.brandName === q.brand);
            if (q.storeId) list = list.filter(p => p.storeId === Number(q.storeId));
            if (q.departmentId) list = list.filter(p => p.departmentId === Number(q.departmentId));
            const categoryIds = ids([q.categoryId, q.categoryIds].filter(Boolean).join(','));
            if (categoryIds.length) {
                const wanted = new Set();
                const walk = function (id) {
                    wanted.add(id);
                    data().byId.get(id).childIds.forEach(walk);
                };
                categoryIds.filter(id => data().byId.has(id)).forEach(walk);
                list = list.filter(p => wanted.has(p.categoryId));
            }
            const sort = ['id', 'name', 'price'].indexOf(q.sort) !== -1 ? q.sort : 'id';
            const dir = q.order === 'desc' ? -1 : 1;
            if (sort !== 'id' || dir === -1) {
                list = list.slice().sort((a, b) => (a[sort] < b[sort] ? -1 : a[sort] > b[sort] ? 1 : 0) * dir);
            }
            return page(list, q, 50);
        },
        '/products/all': function (q) {
            let list = data().products;
            if (q.status !== undefined && q.status !== '') list = list.filter(p => p.status === Number(q.status));
            return list.slice(0, Math.min(Number(q.limit) || list.length, 60000));
        },
        '/products/by-ids': function (q) {
            return ids(q.ids).map(id => data().products[id - 1]).filter(Boolean);
        },
        '/stores/list': function (q) {
            return listOf(data().stores, q, ['name', 'code']);
        },
        '/departments/list': function (q) {
            let list = data().departments;
            if (q.storeId) list = list.filter(d => d.storeId === Number(q.storeId));
            return listOf(list, q, ['name', 'code']);
        }
    };

    /** The rows asked by ids (in that order), or filtered by keyword and status: a plain list, or a page with isPaging. */
    function listOf(rows, q, fields) {
        if (q.ids) {
            const byId = new Map(rows.map(r => [r.id, r]));
            return ids(q.ids).map(id => byId.get(id)).filter(Boolean);
        }
        const keyword = String(q.keyword || '').trim().toLowerCase();
        let list = rows;
        if (keyword) list = list.filter(r => fields.some(f => matches(r[f], keyword)));
        if (q.status !== undefined && q.status !== '') list = list.filter(r => r.status === Number(q.status));
        return q.isPaging === 'true' ? page(list, q, 30) : list;
    }

    function handle(req, res) {
        const url = new URL(req.url, 'http://localhost');
        const route = url.pathname.replace(/^\/api\/v1/, '').replace(/\/$/, '');
        const query = Object.fromEntries(url.searchParams);
        const reply = function (status, message, payload) {
            const body = JSON.stringify({code: status, message: message, data: payload});
            res.writeHead(status, {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store'});
            res.end(body);
        };
        if (req.method !== 'GET') return reply(405, 'Method not allowed', null);
        const handler = routes[route];
        if (!handler || !url.pathname.startsWith('/api/v1/')) return reply(404, 'Not found: ' + url.pathname, null);
        const delay = query.delay !== undefined ? Math.min(Math.max(Number(query.delay) || 0, 0), 10000) : 150 + Math.floor(Math.random() * 200);
        const timer = setTimeout(function () {
            let payload;
            try {
                payload = handler(query);
            } catch (error) {
                return reply(error.status || 500, error.message, null);
            }
            reply(200, 'OK', payload);
        }, delay);
        // the page cancelled the request (or navigated away): no answer
        res.on('close', function () { clearTimeout(timer); });
    }

    return {handle: handle};
}

function notFound(what) {
    const error = new Error('Not found: ' + what);
    error.status = 404;
    return error;
}

function badRequest(message) {
    const error = new Error(message);
    error.status = 400;
    return error;
}

module.exports = {create: create};
