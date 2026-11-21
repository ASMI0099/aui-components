// open-cost.html: the page's module and data, and the recorder that scripts/perf.js open reads.
//   window.__openCost.begin()  starts recording (digests, long tasks, a sample of the panel on every frame)
//   window.__openCost.end()    stops and returns the summary
(function () {
    const params = new URLSearchParams(location.search);
    const cfg = window.OPEN_COST = {
        rows: Math.max(0, parseInt(params.get('rows') || '600', 10)),
        field: ['select', 'multi', 'tree'].indexOf(params.get('field')) !== -1 ? params.get('field') : 'select',
        opts: Math.max(1, parseInt(params.get('opts') || '50', 10))
    };

    // ?fx=panel,trigger,chevron,search: measurement switches that take one kind of transition out (CSS only), to see what it costs
    //   panel    the panel animates opacity and transform only (no border-radius)
    //   trigger  the trigger has no transition (border-radius, box-shadow, border-color, background)
    const fx = (params.get('fx') || '').split(',');
    const fxCss = [];
    if (fx.indexOf('panel') !== -1) {
        fxCss.push('.aui-select__panel { transition: opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1), transform 0.22s cubic-bezier(0.16, 1, 0.3, 1) !important; }');
    }
    if (fx.indexOf('trigger') !== -1) fxCss.push('.aui-select__trigger { transition: none !important; }');
    //   chevron  the chevron has no transition;  search  the search box and its icon have none
    if (fx.indexOf('chevron') !== -1) fxCss.push('.aui-select__chevron { transition: none !important; }');
    if (fx.indexOf('search') !== -1) fxCss.push('.aui-select__search-input, .aui-select__search-icon { transition: none !important; }');
    //   chevronlayer  the chevron keeps its own compositor layer (will-change);  noshadow  the panel has no box-shadow
    //   nochevronturn  the chevron does not turn
    if (fx.indexOf('chevronlayer') !== -1) fxCss.push('.aui-select__chevron { will-change: transform; }');
    if (fx.indexOf('noshadow') !== -1) fxCss.push('.aui-select__panel { box-shadow: none !important; }');
    if (fx.indexOf('nochevronturn') !== -1) fxCss.push('.aui-select--open .aui-select__chevron { transform: none !important; }');
    if (fxCss.length) document.write('<style>' + fxCss.join('\n') + '</style>');

    window.__ngErrors = [];

    let rec = null;   // the recording, while begin() .. end()

    angular.module('auiTest', ['aui'])
        .config(['$provide', function ($provide) {
            $provide.decorator('$exceptionHandler', ['$delegate', function ($delegate) {
                return function (exception, cause) {
                    window.__ngErrors.push(String(exception && exception.message || exception));
                    $delegate(exception, cause);
                };
            }]);
        }])
        .run(['$rootScope', function ($rootScope) {
            // Every $digest, the page's (root: every watcher of the page) and a component's own (local) apart.
            const proto = Object.getPrototypeOf($rootScope);
            const digest = proto.$digest;
            proto.$digest = function () {
                const started = performance.now();
                try {
                    return digest.apply(this, arguments);
                } finally {
                    if (rec) {
                        const ms = performance.now() - started;
                        if (this === $rootScope) rec.root.push({at: started - rec.t0, ms: ms});
                        else rec.local.push(ms);
                    }
                }
            };
            window.__openCost.watchers = function () { return $rootScope.$$watchersCount; };
        }])
        .controller('PageCtrl', [function () {
            const vm = this;
            vm.field = cfg.field;
            vm.form = {single: null, many: [], node: null, keyword: '', code: ''};
            vm.options = [];
            for (let i = 1; i <= cfg.opts; i++) vm.options.push({id: i, label: 'Option ' + i + (i % 7 === 0 ? ' with a longer label' : '')});
            vm.nodes = [];
            for (let g = 0; g * 10 < cfg.opts; g++) {
                const children = [];
                for (let i = 1; i <= 9 && g * 10 + i <= cfg.opts; i++) children.push({id: 'n' + g + '-' + i, label: 'Node ' + g + '.' + i});
                vm.nodes.push({id: 'g' + g, label: 'Group ' + g, children: children});
            }
            const halls = {};
            for (let i = 0; i < 20; i++) halls[i] = 'Hall ' + i;
            vm.hallName = function (id) { return halls[id] || ''; };
            vm.rows = [];
            for (let i = 0; i < cfg.rows; i++) {
                vm.rows.push({id: i, code: 'P' + (100000 + i), name: 'Product number ' + i, active: i % 3 !== 0, hall: i % 20,
                    price: 10 + (i * 7.3) % 900, created: new Date(2026, i % 12, 1 + i % 28), tags: ['t' + (i % 5), 'k' + (i % 3)]});
            }
            vm.search = angular.noop;
            vm.edit = angular.noop;
        }]);

    function panel() {
        return document.querySelector('#field .aui-select__panel') || document.querySelector('#field [class*="dropdown"]');
    }

    function scaleY(transform) {
        if (!transform || transform === 'none') return 1;
        const m = transform.match(/matrix\(([^)]+)\)/);
        return m ? parseFloat(m[1].split(',')[3]) : 1;
    }

    window.__openCost = {
        watchers: function () { return 0; },
        begin: function () {
            rec = {t0: performance.now(), root: [], local: [], long: [], frames: [], observer: null, stop: false};
            if (typeof PerformanceObserver === 'function') {
                try {
                    rec.observer = new PerformanceObserver(function (list) {
                        list.getEntries().forEach(function (e) { rec.long.push({at: e.startTime - rec.t0, ms: e.duration}); });
                    });
                    rec.observer.observe({entryTypes: ['longtask']});
                } catch (e) { rec.observer = null; }
            }
            const frame = function (now) {
                if (!rec || rec.stop) return;
                const el = panel();
                const style = el ? getComputedStyle(el) : null;
                rec.frames.push({at: now - rec.t0, shown: !!style && style.display !== 'none',
                    opacity: style ? parseFloat(style.opacity) : 0, scale: style ? scaleY(style.transform) : 1});
                requestAnimationFrame(frame);
            };
            requestAnimationFrame(frame);
            return true;
        },
        end: function () {
            const r = rec;
            r.stop = true;
            if (r.observer) r.observer.disconnect();
            rec = null;
            const frames = r.frames;
            let maxGap = 0;
            for (let i = 1; i < frames.length; i++) maxGap = Math.max(maxGap, frames[i].at - frames[i - 1].at);
            // The open animation as drawn: frames between hidden (opacity 0) and fully shown (1)
            const visible = frames.filter(function (f) { return f.shown && f.opacity > 0.02; });
            const firstVisible = visible.length ? visible[0].at : null;
            const full = frames.filter(function (f) { return f.shown && f.opacity >= 0.98 && Math.abs(f.scale - 1) < 0.01; });
            const midFrames = frames.filter(function (f) { return f.shown && f.opacity > 0.02 && f.opacity < 0.98; });
            const sum = function (list) { return list.reduce(function (a, b) { return a + (b.ms !== undefined ? b.ms : b); }, 0); };
            return {
                rootDigests: r.root.length, rootDigestMs: +sum(r.root).toFixed(1),
                rootDigestList: r.root.map(function (d) { return Math.round(d.at) + 'ms:' + d.ms.toFixed(1); }),
                localDigests: r.local.length, localDigestMs: +sum(r.local).toFixed(1),
                longTasks: r.long.map(function (t) { return Math.round(t.at) + 'ms:' + Math.round(t.ms); }),
                longTaskMs: Math.round(sum(r.long)),
                frames: frames.length, maxFrameGap: Math.round(maxGap),
                firstVisible: firstVisible === null ? null : Math.round(firstVisible),
                fullyShown: full.length ? Math.round(full[0].at) : null,
                animationFrames: midFrames.length,
                opacityTrace: midFrames.map(function (f) { return Math.round(f.at) + ':' + f.opacity.toFixed(2); }).slice(0, 14)
            };
        }
    };
})();
