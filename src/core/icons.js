/**
 * auiIcons: the SVG icons of the components, by name.
 */
angular.module('aui')
    /**
     * The family's line icons (24 grid, drawn with the CSS's line: stroke currentColor, round): aui-popover's trigger,
     * aui-button. has(name); draw(name, className): an <svg> hidden from assistive technology (its name is the
     * control's: auiTexts.icons).
     */
    .factory('auiIcons', [function () {
        const PATHS = {
            edit: 'M4 20l1-4.2L15.6 5.2a2 2 0 0 1 2.9 0l.3.3a2 2 0 0 1 0 2.9L8.2 19 4 20zM13.5 7.3l3.2 3.2M14 20h6',
            pencil: 'M4 20l1-4.2L15.6 5.2a2 2 0 0 1 2.9 0l.3.3a2 2 0 0 1 0 2.9L8.2 19 4 20zM13.5 7.3l3.2 3.2',
            'square-pen': 'M11 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5M18.4 3.6a2 2 0 0 1 2.9 2.9L12 15.8l-3.9 1 1-3.9 9.3-9.3z',
            delete: 'M4 7h16M9 7V4.5h6V7M6.5 7l.9 12.1a2 2 0 0 0 2 1.9h5.2a2 2 0 0 0 2-1.9L17.5 7M10 11v6M14 11v6',
            // two sheets: the one behind shows its top and left edges only
            copy: 'M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3M11 9h7a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z',
            info: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM12 11v5.5M12 7.6v.1',
            help: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM9.6 9.4a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.4M12 16.6v.1',
            more: 'M4 12a1 1 0 1 0 2 0a1 1 0 1 0-2 0zM11 12a1 1 0 1 0 2 0a1 1 0 1 0-2 0zM18 12a1 1 0 1 0 2 0a1 1 0 1 0-2 0z',
            filter: 'M4 5h16l-6.2 7.4V19l-3.6 1.6v-8.2L4 5z',
            settings: 'M4 7h9M17 7h3M4 17h3M11 17h9M13 7a2 2 0 1 0 4 0a2 2 0 1 0-4 0zM7 17a2 2 0 1 0 4 0a2 2 0 1 0-4 0z',
            add: 'M12 5v14M5 12h14',
            search: 'M4 11a7 7 0 1 0 14 0a7 7 0 1 0-14 0zM20 20l-3.5-3.5',
            refresh: 'M20.5 12a8.5 8.5 0 1 1-2.5-6l2.5 2.5M20.5 3.5v5h-5',
            download: 'M20 15v3.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5V15M8 10.5l4 4 4-4M12 14.5V4',
            upload: 'M20 15v3.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5V15M16 8l-4-4-4 4M12 4v10.5',
            check: 'M5 12.5l4.5 4.5L19 7.5',
            close: 'M6 6l12 12M18 6L6 18',
            // a ring with a check or a cross, the mark filling much of the ring (it is what reads at 16px): two paths, the
            // ring first (aui-button's feedback draws the ring, then the check)
            'circle-check': [{d: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z'}, {d: 'M7.6 12.4l3 3 5.8-6.1'}],
            'circle-close': [{d: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z'}, {d: 'M8.8 8.8l6.4 6.4M15.2 8.8l-6.4 6.4'}],
            expand: 'M6 9l6 6 6-6',   // a chevron down; aui-button's expanded turns it to point right while collapsed
            // two chevrons down, each as wide as the one (show-more-double: more of a whole section; turned up while open)
            'expand-double': 'M6 6.25l6 6 6-6M6 11.75l6 6 6-6',
            // aui-button's expand-icon looks: a filled triangle (down; turned as the chevron), a box with a plus whose
            // vertical bar fades out when open (a minus)
            'expand-caret': [{d: 'M7 9h10l-5 6z', cls: 'aui-icon-fill'}],   // as tall as the chevron (12 of 24 with its line)
            'expand-plus': [{d: 'M7 4h10a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3zM8.5 12h7'},
                {d: 'M12 8.5v7', cls: 'aui-icon-plus-bar'}]
        };
        const SVG = 'http://www.w3.org/2000/svg';
        return {
            has: function (name) { return Object.prototype.hasOwnProperty.call(PATHS, name); },
            draw: function (name, className) {
                const svg = document.createElementNS(SVG, 'svg');
                svg.setAttribute('class', className);
                svg.setAttribute('viewBox', '0 0 24 24');
                svg.setAttribute('aria-hidden', 'true');
                svg.setAttribute('focusable', 'false');
                // one path, or several with a class each (a filled part, a part that fades)
                (Array.isArray(PATHS[name]) ? PATHS[name] : [{d: PATHS[name]}]).forEach(function (part) {
                    const path = document.createElementNS(SVG, 'path');
                    path.setAttribute('d', part.d);
                    if (part.cls) path.setAttribute('class', part.cls);
                    svg.appendChild(path);
                });
                return svg;
            }
        };
    }]);
