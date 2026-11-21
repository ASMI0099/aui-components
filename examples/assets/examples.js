/**
 * The shell of the example pages: the module 'auiExamples' (it requires 'aui'), the client of the mock catalog API
 * that the dev server answers under /api/v1/ (scripts/lib/mock-api.js), the request log, and the page layout with its
 * navigation.
 */
(function () {
    'use strict';

    // the project root as a URL path ("/" under scripts/dev-server.js): this file is <root>/examples/assets/
    const ROOT = new URL('../../', document.currentScript.src).pathname;

    // the navigation of every page; a new example page gets its entry here
    const NAV = [
        {title: 'Overview', links: [{href: 'examples/', text: 'Start'}]},
        {title: 'Fields', links: [
            {href: 'examples/select/', text: 'aui-select'},
            {href: 'examples/tree-select/', text: 'aui-tree-select'},
            {href: 'examples/input/', text: 'aui-input'},
            {href: 'examples/date-picker/', text: 'aui-date-picker'},
            {href: 'examples/checkbox/', text: 'aui-checkbox'}
        ]},
        {title: 'Actions and overlays', links: [
            {href: 'examples/button/', text: 'aui-button'},
            {href: 'examples/popover/', text: 'aui-popover'},
            {href: 'examples/modal/', text: 'aui-modal and messages'}
        ]},
        {title: 'Use cases', links: [
            {href: 'examples/search-form/', text: 'A search form'}
        ]}
    ];

    angular.module('auiExamples', ['aui'])

        /** The last requests, newest first: what was asked and how long it took. */
        .factory('requestLog', [function () {
            const entries = [];
            const MAX = 40;
            return {
                entries: entries,
                add: function (entry) {
                    entries.unshift(entry);
                    if (entries.length > MAX) entries.length = MAX;
                },
                clear: function () {
                    entries.length = 0;
                }
            };
        }])

        /**
         * GET /api/v1/<path>: resolves with the answer's `data`, rejects with an Error. options.timeout (a promise)
         * cancels the request, as $http's timeout does; a cancelled request is logged as such.
         */
        .factory('catalogApi', ['$http', '$q', 'requestLog', function ($http, $q, requestLog) {
            function query(params) {
                return Object.keys(params || {})
                    .filter(function (k) { return params[k] !== undefined && params[k] !== null && params[k] !== ''; })
                    .map(function (k) { return k + '=' + params[k]; })
                    .join('&');
            }

            function get(path, params, options) {
                const started = performance.now();
                const entry = {path: path, query: query(params), status: 'pending', totalMs: null, size: null};
                requestLog.add(entry);
                return $http.get(ROOT + 'api/v1' + path, {params: params, timeout: options && options.timeout}).then(function (response) {
                    entry.totalMs = Math.round(performance.now() - started);
                    entry.status = response.status;
                    const data = response.data && response.data.data;
                    entry.size = Array.isArray(data) ? data.length
                        : (data && Array.isArray(data.items) ? data.items.length : null);
                    return data;
                }, function (response) {
                    entry.totalMs = Math.round(performance.now() - started);
                    entry.status = response.status === -1 ? 'cancelled' : (response.status || 'error');
                    const message = response.data && response.data.message ? response.data.message : ('HTTP ' + response.status);
                    return $q.reject(new Error(message));
                });
            }

            return {get: get};
        }])

        /** <ex-request-log>: the shared request log as a table. */
        .component('exRequestLog', {
            controller: ['requestLog', function (requestLog) {
                this.log = requestLog;
            }],
            template: `
                <div class="ex-log">
                    <div class="ex-log__head">
                        <span>Requests</span>
                        <button type="button" class="ex-link" ng-click="$ctrl.log.clear()">Clear</button>
                    </div>
                    <table class="ex-log__table" ng-if="$ctrl.log.entries.length">
                        <thead><tr><th>Request</th><th>Status</th><th>Items</th><th>Time</th></tr></thead>
                        <tbody>
                            <tr ng-repeat="e in $ctrl.log.entries track by $index" ng-class="{'is-error': e.status !== 200 && e.status !== 'pending'}">
                                <td class="ex-log__path">{{ e.path }}<span ng-if="e.query">?{{ e.query }}</span></td>
                                <td>{{ e.status }}</td>
                                <td>{{ e.size === null ? '' : e.size }}</td>
                                <td>{{ e.totalMs === null ? '' : e.totalMs + ' ms' }}</td>
                            </tr>
                        </tbody>
                    </table>
                    <p class="ex-log__empty" ng-if="!$ctrl.log.entries.length">No requests yet.</p>
                </div>`
        })

        /** <ex-api-status>: the size of the mock catalog (GET /api/v1/stats), or that the dev server is not running. */
        .component('exApiStatus', {
            controller: ['$http', function ($http) {
                const $ctrl = this;
                $ctrl.state = 'checking';
                $http.get(ROOT + 'api/v1/stats', {params: {delay: 0}}).then(function (response) {
                    const d = response.data.data;
                    $ctrl.state = 'up';
                    $ctrl.text = d.categories.toLocaleString('en-US') + ' categories, ' + d.products.toLocaleString('en-US') + ' products';
                }, function () {
                    $ctrl.state = 'down';
                    $ctrl.text = 'not reachable: open the examples through npm run dev';
                });
            }],
            template: `<span class="ex-api ex-api--{{ $ctrl.state }}">Mock API {{ $ctrl.state === 'checking' ? '...' : $ctrl.text }}</span>`
        })

        /**
         * <ex-page heading="..." lead="..." request-log="true">content</ex-page>: the top bar, the navigation, the
         * page's heading, its content and, optionally, the request log.
         */
        .component('exPage', {
            transclude: true,
            bindings: {
                heading: '@',
                lead: '@?',
                requestLog: '<?'
            },
            controller: [function () {
                const $ctrl = this;
                const here = location.pathname.replace(/index\.html$/, '');
                $ctrl.root = ROOT;
                $ctrl.nav = NAV.map(function (group) {
                    return {
                        title: group.title,
                        links: group.links.map(function (link) {
                            return {href: ROOT + link.href, text: link.text, current: ROOT + link.href === here};
                        })
                    };
                });
            }],
            template: `
                <header class="ex-top">
                    <a class="ex-top__brand" ng-href="{{ $ctrl.root }}examples/">aui-components</a>
                    <span class="ex-top__spacer"></span>
                    <ex-api-status></ex-api-status>
                </header>
                <div class="ex-shell">
                    <nav class="ex-nav" aria-label="Examples">
                        <div ng-repeat="group in $ctrl.nav">
                            <div class="ex-nav__group">{{ group.title }}</div>
                            <a ng-repeat="link in group.links" ng-href="{{ link.href }}" ng-class="{'is-current': link.current}"
                               ng-attr-aria-current="{{ link.current ? 'page' : undefined }}">{{ link.text }}</a>
                        </div>
                    </nav>
                    <main class="ex-main">
                        <h1>{{ $ctrl.heading }}</h1>
                        <p class="ex-lead" ng-if="$ctrl.lead">{{ $ctrl.lead }}</p>
                        <ng-transclude></ng-transclude>
                        <ex-request-log ng-if="$ctrl.requestLog"></ex-request-log>
                    </main>
                </div>`
        });
})();
