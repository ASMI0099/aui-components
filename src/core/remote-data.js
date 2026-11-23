/**
 * auiRemoteData: options from a server - pages, search, saved values, cancelled and stale requests.
 */
angular.module('aui')
    /**
     * Remote data of the aui-* dropdowns: the option list (all at once, or page by page with a search query) and the
     * lookup of selected values that are not loaded. No DOM: answers and timeouts arrive through $q and $timeout,
     * so they are handled inside normal digests.
     *
     * The page's function receives one request object and answers with an array of items, or {items} with an
     * optional total / hasMore / nextCursor (used only when present). Every answer is checked: anything else counts
     * as a failure, and items without a usable value are skipped.
     */
    .factory('auiRemoteData', ['$q', '$timeout', '$rootScope', function ($q, $timeout, $rootScope) {
        const KEPT_PARAMS_LISTS = 5;     // lists without a query, one per params key (switching back is instant)
        const KEPT_SEARCH_LISTS = 3;     // lists of the latest queries, kept while the panel is open
        const LOOKUP_CHUNK = 100;        // values per lookup request when no page size says otherwise
        const GROUP_WINDOW_MS = 10;      // lookup-group: how long a group request waits for the other members
        // Reasons a list loads by itself (labels of saved values, preload): they never ask again for a page that
        // failed, so a failure cannot start the next request (a server that is down would get a request loop).
        const AUTOMATIC_REASONS = Object.freeze({values: true, preload: true});
        let clock = 0;                   // order of use, for dropping the least recently used lists

        /** JSON-like copy with sorted keys and without functions, undefined values and $-prefixed keys. */
        function stable(value, depth) {
            if (value === null) return null;
            const type = typeof value;
            if (type === 'undefined' || type === 'function' || type === 'symbol') return undefined;
            if (type === 'number') return isFinite(value) ? value : String(value);
            if (type === 'bigint') return String(value);   // JSON.stringify cannot write a BigInt
            if (type !== 'object') return value;
            if (depth > 8) return null;
            if (value instanceof Date) return isNaN(value.getTime()) ? null : value.toISOString();
            if (Array.isArray(value)) {
                return value.map(function (item) {
                    const copy = stable(item, depth + 1);
                    return copy === undefined ? null : copy;
                });
            }
            const out = {};
            Object.keys(value).sort().forEach(function (key) {
                if (key.charAt(0) === '$') return;
                const copy = stable(value[key], depth + 1);
                if (copy !== undefined) out[key] = copy;
            });
            return out;
        }

        /** Identity of load-params: equal values give equal keys (key order, undefined fields and functions ignored). */
        function paramsKey(params) {
            return JSON.stringify(stable(params === undefined || params === null ? {} : params, 0));
        }

        /** An answer read into {items, total, hasMore, hasCursor, cursor}, or null when it is not an array or {items}. */
        function readAnswer(answer) {
            if (Array.isArray(answer)) return {items: answer, total: null, hasMore: null, hasCursor: false, cursor: undefined};
            if (!answer || typeof answer !== 'object' || !Array.isArray(answer.items)) return null;
            return {
                items: answer.items,
                total: typeof answer.total === 'number' && isFinite(answer.total) && answer.total >= 0 ? answer.total : null,
                hasMore: typeof answer.hasMore === 'boolean' ? answer.hasMore : null,
                hasCursor: Object.prototype.hasOwnProperty.call(answer, 'nextCursor'),
                cursor: answer.nextCursor
            };
        }

        /**
         * Whether a paged list ends with this page. An empty page always ends it. Otherwise hasMore, nextCursor or
         * total decide when the answer has them; without them, a page shorter than the page size is the last.
         */
        function pageEnds(read, pageSize, loadedCount) {
            if (read.items.length === 0) return true;
            if (read.hasMore !== null) return !read.hasMore;
            if (read.hasCursor) return read.cursor === null || read.cursor === undefined || read.cursor === '';
            if (read.total !== null) return loadedCount >= read.total;
            return read.items.length < pageSize;
        }

        function newTicket() {
            return {
                cancel: $q.defer(),
                controller: typeof window.AbortController === 'function' ? new window.AbortController() : null,
                stopped: false,
                timedOut: false,
                timer: null
            };
        }

        function clearTimer(ticket) {
            if (ticket.timer) {
                $timeout.cancel(ticket.timer);
                ticket.timer = null;
            }
        }

        function abortTicket(ticket) {
            clearTimer(ticket);
            if (ticket.controller) {
                try { ticket.controller.abort(); } catch (e) { /* already settled */ }
            }
            ticket.cancel.resolve();
        }

        /** Stop a request: abort its $signal, resolve its $cancel. Its answer is ignored from then on. */
        function stopTicket(ticket) {
            if (!ticket || ticket.stopped) return;
            ticket.stopped = true;
            abortTicket(ticket);
        }

        /**
         * Call the page's function with request (+ signal and cancel of the ticket). A function that throws counts as
         * a failure. With timeoutMs > 0 the request is aborted and fails after that long; an answer in time clears
         * the timer, so a finished request is never aborted afterwards.
         */
        function send(fn, request, ticket, timeoutMs) {
            request.signal = ticket.controller ? ticket.controller.signal : null;
            request.cancel = ticket.cancel.promise;
            const done = $q.defer();
            let result;
            try {
                result = fn(request);
            } catch (e) {
                result = $q.reject(e);
            }
            $q.when(result).then(function (value) {
                clearTimer(ticket);
                done.resolve(value);
            }, function (error) {
                clearTimer(ticket);
                done.reject(error);
            });
            if (timeoutMs > 0) {
                ticket.timer = $timeout(function () {
                    ticket.timer = null;
                    ticket.timedOut = true;
                    abortTicket(ticket);
                    done.reject(new Error('no answer within ' + timeoutMs + ' ms'));
                }, timeoutMs);
            }
            return done.promise;
        }

        function logFailure(what, error) {
            if (typeof console !== 'undefined' && console.warn) console.warn('aui: ' + what + ' failed', error);
        }

        /**
         * The option list of one component, kept per params key and query.
         * cfg: {
         *   load(request): the page's function,
         *   keyOf(item): the item's value as a string, or null when it has none,
         *   pageSize(): items per page, 0 to load everything at once,
         *   timeoutMs(): 0 for none,
         *   ttlMs(): how long a list without a query is reused before it is refreshed in the background,
         *   canReplace(session): whether a background refresh may replace the rows now (else at the next open),
         *   onUpdate(session, info): after each change of a list (inside a digest),
         *   deliver(fn): optional; runs an answer's change (and its onUpdate) - kit.createDelivery: after the page's
         *     digest it arrives in; by default at once,
         *   warn(text)
         * }
         * Session fields read by components: query, items, byKey, status ('empty' | 'loading' | 'ready' | 'error'),
         * error ('failed' | 'timeout' | null), page (pages loaded), ended, total, refreshing, loadedAt.
         *
         * A failure never starts the next request by itself: a page 1 that failed is asked again only for a reason a
         * person causes (open, search, retry, reload, params), never for an automatic one (AUTOMATIC_REASONS), and a
         * failed background refresh counts as a refresh (the next one waits a whole ttl again).
         */
        function createList(cfg) {
            const deliver = typeof cfg.deliver === 'function' ? cfg.deliver : function (fn) { fn(); };
            const sessions = new Map();
            let paramsId = null;     // params key of the current list; null while loading is not enabled
            let params = null;
            let query = '';
            let destroyed = false;

            function keyFor(id, q) {
                return id + '\n' + q;
            }

            function stopSession(session) {
                if (session.ticket) {
                    stopTicket(session.ticket);
                    session.ticket = null;
                    session.status = session.page > 0 ? 'ready' : 'empty';
                }
                stopRefresh(session);
            }

            function stopRefresh(session) {
                if (session.refreshTicket) {
                    stopTicket(session.refreshTicket);
                    session.refreshTicket = null;
                }
                session.refreshing = false;
            }

            /** Keep the current list, the latest lists without a query and the latest searches; drop the rest. */
            function prune() {
                const current = paramsId === null ? null : keyFor(paramsId, query);
                const plain = [];
                const searches = [];
                sessions.forEach(function (session) {
                    if (session.key === current) return;
                    (session.query === '' ? plain : searches).push(session);
                });
                const drop = function (list, keep) {
                    list.sort(function (a, b) { return b.usedAt - a.usedAt; });
                    list.slice(keep).forEach(function (session) {
                        stopSession(session);
                        sessions.delete(session.key);
                    });
                };
                drop(plain, KEPT_PARAMS_LISTS - 1);
                drop(searches, KEPT_SEARCH_LISTS);
            }

            function current(create) {
                if (paramsId === null || destroyed) return null;
                const key = keyFor(paramsId, query);
                let session = sessions.get(key);
                if (!session && create) {
                    session = {
                        key: key, paramsId: paramsId, query: query, params: angular.copy(params), pageSize: cfg.pageSize(),
                        items: [], byKey: new Map(), page: 0, cursor: undefined, total: null, ended: false,
                        status: 'empty', error: null, ticket: null, refreshing: false, refreshTicket: null,
                        fresh: null, loadedAt: 0, refreshFailedAt: 0, usedAt: 0
                    };
                    sessions.set(key, session);
                    prune();
                }
                if (session) session.usedAt = ++clock;
                return session;
            }

            /** Stop the load of the current list; with searchesOnly, only when it is a search (its rows are dropped). */
            function stopCurrentLoad(searchesOnly) {
                if (paramsId === null || (searchesOnly && query === '')) return;
                const session = sessions.get(keyFor(paramsId, query));
                if (session && session.ticket) {
                    stopTicket(session.ticket);
                    session.ticket = null;
                    session.status = session.page > 0 ? 'ready' : 'empty';
                }
            }

            /** Put an answer into the list: page 1 replaces the items, later pages add the new ones. */
            function accept(session, page, read) {
                if (page === 1) {
                    session.items = [];
                    session.byKey = new Map();
                }
                let added = 0;
                let invalid = 0;
                read.items.forEach(function (item) {
                    const key = item !== null && typeof item === 'object' ? cfg.keyOf(item) : null;
                    if (key === null) {
                        invalid += 1;
                        return;
                    }
                    if (session.byKey.has(key)) return;
                    session.byKey.set(key, item);
                    session.items.push(item);
                    added += 1;
                });
                if (invalid > 0) cfg.warn(invalid + ' item(s) without a usable value were skipped');
                session.page = page;
                session.total = read.total;
                session.cursor = read.hasCursor ? read.cursor : undefined;
                if (!session.pageSize) {
                    session.ended = true;
                } else {
                    session.ended = pageEnds(read, session.pageSize, session.items.length);
                    if (!session.ended && page > 1 && added === 0) {
                        // A full page of items that are all loaded already: the server most likely ignores the page.
                        session.ended = true;
                        cfg.warn('page ' + page + ' brought only items that were already loaded; check that the page ' +
                            'parameter reaches the server');
                    }
                }
                session.status = 'ready';
                session.error = null;
                if (page === 1) session.loadedAt = Date.now();
            }

            function request(session, page, reason) {
                const pageSize = session.pageSize || null;
                return {
                    reason: reason,
                    query: session.query,
                    page: page,
                    pageSize: pageSize,
                    offset: pageSize ? (page - 1) * pageSize : 0,
                    cursor: page > 1 ? session.cursor : undefined,
                    values: null,
                    params: angular.copy(session.params)
                };
            }

            function loadPage(session, page, reason) {
                const ticket = newTicket();
                session.ticket = ticket;
                session.status = 'loading';
                send(cfg.load, request(session, page, reason), ticket, cfg.timeoutMs()).then(function (answer) {
                    deliver(function () {
                        if (destroyed || ticket.stopped || session.ticket !== ticket) return;
                        session.ticket = null;
                        const read = readAnswer(answer);
                        if (!read) {
                            cfg.warn('load-options answered neither an array nor {items: [...]}');
                            session.status = 'error';
                            session.error = 'failed';
                        } else {
                            accept(session, page, read);
                        }
                        cfg.onUpdate(session, {reason: reason, page: page});
                    });
                }, function (error) {
                    deliver(function () {
                        if (destroyed || ticket.stopped || session.ticket !== ticket) return;
                        session.ticket = null;
                        session.status = 'error';
                        session.error = ticket.timedOut ? 'timeout' : 'failed';
                        logFailure('loading options', error);
                        cfg.onUpdate(session, {reason: reason, page: page, error: session.error});
                    });
                });
            }

            /** Page 1 again in the background; the rows stay visible meanwhile. */
            function refresh(session) {
                const ticket = newTicket();
                session.refreshTicket = ticket;
                session.refreshing = true;
                send(cfg.load, request(session, 1, 'refresh'), ticket, cfg.timeoutMs()).then(function (answer) {
                    deliver(function () {
                        if (destroyed || ticket.stopped || session.refreshTicket !== ticket) return;
                        session.refreshTicket = null;
                        session.refreshing = false;
                        const read = readAnswer(answer);
                        if (!read) {
                            cfg.warn('load-options answered neither an array nor {items: [...]}');
                        } else if (cfg.canReplace(session)) {
                            accept(session, 1, read);
                        } else {
                            session.fresh = read;   // the rows are in use: swap at the next open
                        }
                        cfg.onUpdate(session, {reason: 'refresh', page: 1});
                    });
                }, function (error) {
                    deliver(function () {
                        if (destroyed || ticket.stopped || session.refreshTicket !== ticket) return;
                        session.refreshTicket = null;
                        session.refreshing = false;
                        session.refreshFailedAt = Date.now();   // the next refresh waits a whole ttl, as after a good one
                        logFailure('refreshing options', error);
                        cfg.onUpdate(session, {reason: 'refresh', page: 1, error: 'failed'});
                    });
                });
            }

            /**
             * Start what the current list needs: page 1 when it has none, a background refresh when it is old.
             * A page 1 that failed is asked again only for a reason a person causes, never for an automatic one.
             */
            function ensure(reason) {
                const session = current(true);
                if (!session || session.ticket) return session;
                if (session.fresh) {
                    accept(session, 1, session.fresh);
                    session.fresh = null;
                }
                const load = loadFor(session, reason);
                if (load === 'page') loadPage(session, 1, reason);
                else if (load === 'refresh') refresh(session);
                return session;
            }

            /**
             * What ensure(reason) starts for a list (no load running, no fresh rows waiting): 'page' (page 1, or page 1
             * again after it failed, for a reason a person causes), 'refresh' (in the background, the rows are old), or
             * null. (ensure and wouldLoad share it.)
             */
            function loadFor(session, reason) {
                const failed = session.status === 'error' && session.page === 0;
                if (session.status === 'empty' || (failed && !AUTOMATIC_REASONS[reason])) return 'page';
                if (session.query === '' && session.status === 'ready' && !session.refreshing
                    && Date.now() - Math.max(session.loadedAt, session.refreshFailedAt) > cfg.ttlMs()) return 'refresh';
                return null;
            }

            function drop() {
                if (paramsId === null) return;
                const id = paramsId;
                sessions.forEach(function (session) {
                    if (session.paramsId !== id) return;
                    stopSession(session);
                    sessions.delete(session.key);
                });
            }

            return {
                /** Set the params (null id: loading not enabled). Returns whether the current list changed. */
                configure: function (id, value) {
                    if (id === paramsId) return false;
                    stopCurrentLoad();
                    if (paramsId !== null) {
                        const old = sessions.get(keyFor(paramsId, query));
                        if (old) stopRefresh(old);
                    }
                    paramsId = id;
                    params = value;
                    if (id !== null) prune();
                    return true;
                },
                /**
                 * Switch to the list of another query. A search that is still loading is stopped; the list without a
                 * query keeps loading (the next open needs it).
                 */
                setQuery: function (q) {
                    if (q === query) return false;
                    stopCurrentLoad(true);
                    query = q;
                    return true;
                },
                query: function () {
                    return query;
                },
                /** The list without a query for the current params, if it exists (never created here). */
                plain: function () {
                    return paramsId === null ? null : (sessions.get(keyFor(paramsId, '')) || null);
                },
                /** The current list (created when missing), or null while loading is not enabled. */
                current: function () {
                    return current(true);
                },
                /** The current list if it exists (never created here: rendering must not leave empty lists behind). */
                peek: function () {
                    return current(false) || null;
                },
                ensure: ensure,
                /**
                 * Whether ensure(reason) would ask the page's function now (a list it has not loaded, a retry, a
                 * refresh of old rows). Changes nothing: an opening that asks nothing of the page needs no digest of it.
                 */
                wouldLoad: function (reason) {
                    if (paramsId === null || destroyed) return false;
                    const session = sessions.get(keyFor(paramsId, query));
                    if (!session) return true;   // ensure creates it and loads page 1
                    if (session.ticket || session.fresh) return false;   // loading already; fresh rows are taken in here
                    return loadFor(session, reason) !== null;
                },
                /** The next page, if there is one and nothing is loading. Returns whether one was asked for. */
                more: function () {
                    const session = current(false);
                    if (!session || !session.pageSize || session.ended || session.ticket || session.status !== 'ready') return false;
                    if (session.refreshing) stopRefresh(session);   // the user is paging through these rows: keep them
                    loadPage(session, session.page + 1, 'more');
                    return true;
                },
                /** Ask again after a failure (page 1, or the page that failed). */
                retry: function () {
                    const session = current(false);
                    if (!session || session.ticket || session.status !== 'error') return false;
                    loadPage(session, session.page === 0 ? 1 : session.page + 1, 'retry');
                    return true;
                },
                /** Forget every list of the current params; the next ensure loads again. */
                drop: drop,
                /** Drop every list of the current params and load again. */
                reload: function () {
                    if (paramsId === null) return null;
                    drop();
                    return ensure('reload');
                },
                /** The panel closed: stop and drop the searches (a list without a query keeps loading: it is kept). */
                stop: function () {
                    stopCurrentLoad(true);
                    sessions.forEach(function (session) {
                        if (session.query === '') return;
                        stopSession(session);
                        sessions.delete(session.key);
                    });
                },
                /** Whether a list of these params is loading (a lookup waits for it: the list may have the value). */
                busy: function () {
                    let busy = false;
                    sessions.forEach(function (session) {
                        if (session.paramsId === paramsId && session.ticket) busy = true;
                    });
                    return busy;
                },
                /** An item with this key in any kept list (labels do not depend on the list they came with). */
                find: function (key) {
                    let found;
                    sessions.forEach(function (session) {
                        if (found === undefined && session.byKey.has(key)) found = session.byKey.get(key);
                    });
                    return found;
                },
                destroy: function () {
                    destroyed = true;
                    sessions.forEach(stopSession);
                    sessions.clear();
                }
            };
        }

        // ------------------------------------------------------------------ lookups

        /** Default reading of a lookup answer: items (array or {items}) by key. */
        function scanItems(answer, keyOf) {
            const read = readAnswer(answer);
            if (!read) return null;
            const out = new Map();
            read.items.forEach(function (item) {
                const key = item !== null && typeof item === 'object' ? keyOf(item) : null;
                if (key !== null && !out.has(key)) out.set(key, {item: item, chain: null});
            });
            return out;
        }

        // lookup-group: lookups of several components with the same group (and params) go out together.
        const groups = new Map();

        function runChunks(runner, values, deliver, tickets) {
            const keys = Array.from(values.keys());
            const size = Math.max(1, Math.floor(runner.chunkSize()) || LOOKUP_CHUNK);
            let chain = $q.when();
            for (let i = 0; i < keys.length; i += size) {
                const chunk = keys.slice(i, i + size);
                chain = chain.then(function () {
                    return runChunk(runner, chunk, values, deliver, tickets);
                }).then(null, function (error) {
                    logFailure('looking up values', error);
                    chunk.forEach(function (key) { deliver(key, 'failed'); });
                });
            }
            return chain;
        }

        function runChunk(runner, chunk, values, deliver, tickets) {
            const ticket = newTicket();
            tickets.add(ticket);
            const request = {
                reason: 'lookup',
                query: '',
                page: 1,
                pageSize: chunk.length,
                offset: 0,
                cursor: undefined,
                values: chunk.map(function (key) { return values.get(key); }),
                params: runner.paramsFor()
            };
            return send(runner.run, request, ticket, runner.timeoutMs()).then(function (answer) {
                tickets.delete(ticket);
                if (ticket.stopped) return;
                let found = null;
                try {
                    found = runner.scan(answer);
                } catch (e) {
                    logFailure('reading the lookup answer', e);
                }
                if (!found) {
                    runner.warn('the lookup answered neither an array nor {items: [...]}');
                    chunk.forEach(function (key) { deliver(key, 'failed'); });
                    return;
                }
                chunk.forEach(function (key) { deliver(key, found.has(key) ? found.get(key) : null); });
            }, function (error) {
                tickets.delete(ticket);
                if (ticket.stopped) return;
                logFailure('looking up values', error);
                chunk.forEach(function (key) { deliver(key, 'failed'); });
            });
        }

        /**
         * Lookups of selected values that no loaded data knows.
         * cfg: {
         *   run(request): the lookup function (request.values = the values to find),
         *   keyOf(item), scan(answer) (optional: answer -> Map key -> {item, chain}),
         *   chunkSize(), timeoutMs(), paramsFor(): params for the request,
         *   blocked(): true while lookups must wait (loading not enabled, or the list is loading),
         *   group(): lookup-group key, or '' for none,
         *   onUpdate(): after answers arrived (inside a digest),
         *   warn(text)
         * }
         * A value is asked once per round. Found items are kept while the value stays selected (retain); "not found"
         * and failures last only until the next round (newRound), so there is never a request loop.
         */
        function createLookup(cfg) {
            const entries = new Map();   // key -> {state: 'queued' | 'pending' | 'found' | 'missing' | 'failed', value, item, chain}
            let scheduled = false;
            let destroyed = false;
            const runner = {
                run: cfg.run,
                chunkSize: cfg.chunkSize,
                timeoutMs: cfg.timeoutMs,
                paramsFor: cfg.paramsFor,
                scan: cfg.scan || function (answer) { return scanItems(answer, cfg.keyOf); },
                warn: cfg.warn
            };
            const tickets = new Set();   // this component's own lookups, stopped when it is destroyed
            let touched = false;
            // Each asking of a value has its number (entry.ask): an answer counts only for the asking it belongs to. An
            // earlier one that comes late (the value picked again since, or asked again for new params) is dropped.
            let asks = 0;

            function deliver(key, result, ask) {
                if (destroyed) return;
                const entry = entries.get(key);
                if (!entry || entry.state !== 'pending') return;   // no longer selected
                if (entry.ask !== ask) return;                      // the answer of an earlier asking
                if (result === 'failed') {
                    entry.state = 'failed';
                } else if (result) {
                    entry.state = 'found';
                    entry.item = result.item;
                    entry.chain = result.chain;
                } else {
                    entry.state = 'missing';
                }
                touched = true;
            }

            function notify() {
                if (destroyed || !touched) return;
                touched = false;
                cfg.onUpdate();
            }

            function flush() {
                scheduled = false;
                if (destroyed || cfg.blocked()) return;
                const batch = new Map();
                const asked = new Map();   // key -> the number of this asking
                entries.forEach(function (entry, key) {
                    if (entry.state !== 'queued') return;
                    entry.state = 'pending';
                    entry.ask = ++asks;
                    batch.set(key, entry.value);
                    asked.set(key, entry.ask);
                });
                if (batch.size === 0) return;
                const groupKey = cfg.group();
                if (!groupKey) {
                    runChunks(runner, batch, function (key, result) { deliver(key, result, asked.get(key)); }, tickets).then(notify);
                    return;
                }
                let group = groups.get(groupKey);
                if (!group) {
                    group = {values: new Map(), members: new Map(), scheduled: false};
                    groups.set(groupKey, group);
                }
                batch.forEach(function (value, key) {
                    group.values.set(key, value);
                    if (!group.members.has(key)) group.members.set(key, new Map());   // member -> its asking's number
                    group.members.get(key).set(api, asked.get(key));
                });
                if (!group.scheduled) {
                    group.scheduled = true;
                    // Components created together (e.g. the rows of a table) render over a few digests: the request
                    // waits a moment for all of them.
                    $timeout(function () {
                        groups.delete(groupKey);
                        // The group's requests belong to no single member: destroying one member does not stop them.
                        // They run with the function of a member that is still alive.
                        let live = null;
                        group.members.forEach(function (members) {
                            members.forEach(function (ask, member) {
                                if (!live && member.alive()) live = member.runner;
                            });
                        });
                        if (!live) return;
                        const listeners = new Set();
                        runChunks(live, group.values, function (key, result) {
                            (group.members.get(key) || new Map()).forEach(function (ask, member) {
                                member.receive(key, result, ask);
                                listeners.add(member);
                            });
                        }, new Set()).then(function () {
                            listeners.forEach(function (member) { member.notify(); });
                        });
                    }, GROUP_WINDOW_MS);
                }
            }

            function schedule() {
                if (scheduled || destroyed) return;
                scheduled = true;
                $rootScope.$$postDigest(function () {
                    $rootScope.$evalAsync(flush);
                });
            }

            const api = {
                /**
                 * The values that are unknown now (Map key -> value): each is asked unless known, waiting or already
                 * asked this round. A queued value missing from the map became known meanwhile: it is not sent.
                 */
                want: function (values) {
                    let added = false;
                    entries.forEach(function (entry, key) {
                        if (entry.state === 'queued' && !values.has(key)) entries.delete(key);
                    });
                    values.forEach(function (value, key) {
                        if (entries.has(key)) return;
                        entries.set(key, {state: 'queued', value: value, item: null, chain: null});
                        added = true;
                    });
                    if (added) schedule();
                },
                /** Forget everything about values that are no longer selected. */
                retain: function (keys) {
                    entries.forEach(function (entry, key) {
                        if (!keys.has(key)) entries.delete(key);
                    });
                },
                /** A new round: values not found (or failed) may be asked again. */
                newRound: function () {
                    entries.forEach(function (entry, key) {
                        if (entry.state === 'missing' || entry.state === 'failed') entries.delete(key);
                    });
                },
                /**
                 * The params changed: a value still being asked is asked again with the new ones (the answer for the old
                 * data set is dropped when it comes). A value found before keeps its record until new data replaces it.
                 */
                askAgain: function () {
                    let queued = false;
                    entries.forEach(function (entry) {
                        if (entry.state !== 'pending' && entry.state !== 'queued') return;
                        entry.state = 'queued';
                        entry.ask = 0;
                        queued = true;
                    });
                    if (queued) schedule();
                },
                /** reload(): everything is asked again, found values too (their answers before are dropped). */
                forget: function () {
                    entries.clear();
                },
                /** Run what waited for blocked() to become false. */
                kick: function () {
                    let queued = false;
                    entries.forEach(function (entry) {
                        if (entry.state === 'queued') queued = true;
                    });
                    if (queued) schedule();
                },
                found: function (key) {
                    const entry = entries.get(key);
                    return entry && entry.state === 'found' ? entry : null;
                },
                /** Being looked up: asked, or waiting to be asked. A value that waits for blocked() is not shown as busy. */
                pending: function (key) {
                    const entry = entries.get(key);
                    return !!entry && (entry.state === 'pending' || (entry.state === 'queued' && !cfg.blocked()));
                },
                receive: deliver,
                notify: notify,
                runner: runner,
                alive: function () { return !destroyed; },
                destroy: function () {
                    destroyed = true;
                    tickets.forEach(stopTicket);
                    tickets.clear();
                    entries.clear();
                }
            };
            return api;
        }

        /**
         * reset-on-params="clear": a watch that calls clear() when the params change while the value stays. Params and
         * value are read straight from the page's data, so both change in one digest when a record is loaded, and a
         * record's own value is never cleared. readKey() returns the params key, readEnabled() whether loading is
         * enabled (load-enabled), readValue() the model value. Params that change as loading turns off clear the value
         * like any other change (the field it depends on emptied: load-enabled="!!vm.form.mallId"); loading turned off
         * or on alone (the same params) clears nothing, nor do params that change while loading was off (a record
         * filled in steps: its value first, the field it depends on later). Returns {watch, listener} for
         * scope.$watch.
         */
        function paramsResetWatch(readKey, readEnabled, readValue, clear) {
            const SEPARATOR = '\u0001';     // never in the JSON of the key or the value (escaped there)
            const parts = function (state) {
                const a = state.indexOf(SEPARATOR);
                const b = state.indexOf(SEPARATOR, a + 1);
                return {enabled: state.slice(0, a), params: state.slice(a + 1, b), value: state.slice(b + 1)};
            };
            return {
                watch: function () {
                    return (readEnabled() ? 'on' : 'off') + SEPARATOR + readKey() + SEPARATOR + angular.toJson(readValue());
                },
                listener: function (now, before) {
                    if (now === before) return;
                    const was = parts(before);
                    const is = parts(now);
                    if (was.enabled === 'off' || is.params === was.params || is.value !== was.value) return;
                    const value = is.value;
                    if (value === 'undefined' || value === 'null' || value === '""' || value === '[]' || value === '') return;
                    clear();
                }
            };
        }

        /**
         * One request outside a list (e.g. the children of a tree node): fn(request) gets request.signal and
         * request.cancel. Returns {promise, stop, timedOut}; after stop() the promise rejects with {stopped: true}.
         */
        function call(fn, request, timeoutMs) {
            const ticket = newTicket();
            const promise = send(fn, request, ticket, timeoutMs || 0).then(function (answer) {
                return ticket.stopped ? $q.reject({stopped: true}) : answer;
            }, function (error) {
                return $q.reject(ticket.stopped ? {stopped: true} : error);
            });
            return {
                promise: promise,
                stop: function () { stopTicket(ticket); },
                timedOut: function () { return ticket.timedOut; }
            };
        }

        return {
            paramsKey: paramsKey,
            readAnswer: readAnswer,
            pageEnds: pageEnds,
            paramsResetWatch: paramsResetWatch,
            call: call,
            createList: createList,
            createLookup: createLookup
        };
    }]);
