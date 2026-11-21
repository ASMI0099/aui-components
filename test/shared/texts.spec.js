// Texts suite (page: texts.html, fixture: texts.fixture.js): the page defined a language and chose it once - every
// component shows its texts (aui-select, aui-tree-select, aui-input, aui-modal, AuiMessageBox, aui-date-picker with its 12-hour
// value both shown and typed); a text the page set wins; a wrong patch changed nothing; auiFieldMessages is the
// field group of the same table.
(function () {
    const {sleep} = AuiTest;
    const svc = name => angular.element(document.body).injector().get(name);
    const scope = () => angular.element(document.body).scope();
    const host = id => document.getElementById(id);
    const box = (id, i) => host(id).querySelectorAll('input.aui-date-picker__input')[i || 0];
    const panel = id => host(id).querySelector('.aui-date-picker__panel');
    const key = (el, k) => el.dispatchEvent(new KeyboardEvent('keydown', {key: k, code: k, bubbles: true, cancelable: true}));
    async function press(id, i) {
        const b = box(id, i);
        b.focus();
        b.dispatchEvent(new MouseEvent('mousedown', {bubbles: true, cancelable: true, button: 0}));
        await sleep(300);
    }
    async function close(id) {
        for (let n = 0; n < 6 && panel(id).classList.contains('aui-select__panel--open'); n += 1) {
            key(document.activeElement && host(id).contains(document.activeElement) ? document.activeElement : box(id), 'Escape');
            await sleep(250);
        }
    }
    const tests = [];
    const T = (name, expect, fn) => tests.push({name, expect, fn});

    T('X1 the table: the language chosen, the page\'s own text kept, the wrong patch ignored, auiFieldMessages its field group',
        {empty: 'Nothing here', search: 'Find...', nope: false, weekdays: [7, 'S0'], modal: 'object', required: 'Fill it in', same: true},
        async () => {
            const t = svc('auiTexts');
            return {empty: t.list.empty, search: t.list.search, nope: 'nope' in t.list, weekdays: [t.date.weekdays.length, t.date.weekdays[0]],
                modal: typeof t.modal, required: t.field.required, same: svc('auiFieldMessages') === t.field};
        });

    T('X2 aui-select, aui-tree-select and aui-input: their labels and button titles',
        {select: 'Pick one', tree: 'Pick one', clear: 'Wipe'},
        async () => ({
            select: host('t-select').querySelector('[aria-haspopup="listbox"]').getAttribute('aria-label'),
            tree: host('t-tree').querySelector('[aria-controls]').getAttribute('aria-label'),
            clear: host('t-input').querySelector('[role="button"][title]').getAttribute('title')
        }));

    T('X3 aui-modal\'s own buttons and AuiMessageBox\'s title and button',
        {modal: ['Shut', 'Accept'], box: {title: true, ok: true}},
        async () => {
            scope().$apply(s => { s.open.modal = true; });
            await sleep(500);
            const modal = Array.from(host('t-modal').querySelectorAll('.aui-modal__footer aui-button')).map(b => b.textContent.trim());
            scope().$apply(s => { s.open.modal = false; });
            await sleep(400);
            svc('AuiMessageBox').show({message: 'A message', type: 'warning'});
            await sleep(600);
            const dialog = document.querySelector('aui-message-box-host dialog');
            const text = dialog ? dialog.textContent : '';
            const r = {modal, box: {title: text.indexOf('Careful') >= 0, ok: text.indexOf('Fine') >= 0}};
            scope().$apply(() => svc('AuiMessageBox')._cancelCurrent());
            await sleep(600);
            return r;
        });

    T('X4 aui-date-picker: the box\'s name and its built-in hint, Monday\'s short name first, the year in the title; a 12-hour value shown and typed in the language',
        {name: 'Pick a date', placeholder: 'Pick a date', monday: 'M1', year: true, shown: '2026-11-07 03:00 eve', typed: '2026-11-08 04:00:00'},
        async () => {
            const name = box('t-date').getAttribute('aria-label');
            const placeholder = box('t-date').getAttribute('placeholder') || '';
            await press('t-date');
            const monday = panel('t-date').querySelector('.aui-date-picker__calendar th').textContent.trim();
            const year = panel('t-date').textContent.indexOf('Year 2') >= 0;
            await close('t-date');
            const shown = box('t-d12').value;
            const b = box('t-d12');
            b.focus();
            b.value = '2026-11-08 04:00 morn';
            b.dispatchEvent(new Event('input', {bubbles: true}));
            key(b, 'Enter');
            await sleep(300);
            await close('t-d12');
            b.blur();
            return {name, placeholder, monday, year, shown, typed: scope().m.d12};
        });

    T('X5 a date-time range: after the start\'s day the button names the end it goes on to',
        {button: 'On to the end time'},
        async () => {
            await press('t-dtr', 0);
            const day = Array.from(panel('t-dtr').querySelectorAll('.aui-date-picker__calendar')[0].querySelectorAll('.aui-date-picker__day'))
                .find(d => !d.classList.contains('aui-date-picker__day--outside') && d.getAttribute('aria-disabled') !== 'true');
            day.click();
            await sleep(200);
            const button = panel('t-dtr').querySelector('[data-act="ok"]').textContent.trim();
            await close('t-dtr');
            box('t-dtr', 0).blur();
            return {button};
        });

    T('X6 no Angular errors on the page',
        {errors: []},
        async () => ({errors: AuiTest.angularErrors()}));

    AuiTest.run('Texts: a language defined by the page', tests);
})();
