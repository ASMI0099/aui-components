# Getting started

## Requirements

| | |
|---|---|
| AngularJS | 1.5.3 (the version the test suites run on) |
| Floating UI | `@floating-ui/core` 1.6 and `@floating-ui/dom` 1.6, the UMD builds (`window.FloatingUIDOM`): places the panels of the fields and the popover's card |
| jQuery | optional; the test suites run with jQuery 3.6 loaded before AngularJS, as `angular.element` |
| Browsers | current Chrome, Edge, Firefox and Safari. Older browsers without `@property`, `color-mix()` or `:has()` get the default colours and plainer looks, never broken fields |

## Add the files

Take the four files of `dist/` (or the unminified ones while developing):

```html
<link rel="stylesheet" href="aui-components.min.css">

<script src="angular.min.js"></script>
<script src="floating-ui.core.umd.min.js"></script>
<script src="floating-ui.dom.umd.min.js"></script>
<script src="aui-components.min.js"></script>
```

Load AngularJS and Floating UI before the components. The stylesheet can go anywhere in the head; the components
keep their looks against a page's own general rules (`span`, `label`, `div`, `input`, `*:focus`, `box-sizing`, ...).

## Add the module

```js
angular.module('app', ['aui']);
```

## Use the components

```html
<form name="form" ng-controller="OrderCtrl as vm" novalidate>
    <aui-input ng-model="vm.order.title" name="title" input-style-type="form" show-label label-text="Title"
               value-max-length="60" show-count required show-errors></aui-input>

    <aui-select ng-model="vm.order.status" options="vm.statuses" label-field="name" value-field="id"
                show-label label-text="Status" clearable></aui-select>

    <aui-tree-select ng-model="vm.order.categories" options="vm.categories" multiple
                     show-label label-text="Categories" max-tag-count="responsive"></aui-tree-select>

    <aui-date-picker ng-model="vm.order.period" type="daterange" show-label label-text="Period"></aui-date-picker>

    <aui-checkbox ng-model="vm.order.urgent" label="Urgent"></aui-checkbox>

    <aui-button type="submit" on-click="vm.save()">Save</aui-button>
</form>
```

```js
angular.module('app', ['aui'])
    .controller('OrderCtrl', ['AuiMessage', '$q', function (AuiMessage, $q) {
        const vm = this;
        vm.order = {};
        vm.statuses = [{id: 1, name: 'Open'}, {id: 2, name: 'In progress'}, {id: 3, name: 'Done'}];
        vm.categories = [
            {id: 'a', label: 'Hardware', children: [{id: 'a1', label: 'Cables'}, {id: 'a2', label: 'Adapters'}]},
            {id: 'b', label: 'Software'}
        ];
        vm.save = function () {
            // aui-button shows its loading state until the promise settles
            return $q.when().then(function () { AuiMessage.success('Saved'); });
        };
    }]);
```

The fields take part in the page's form like native inputs: `name`, `required` / `ng-required`, `ng-disabled`,
`$dirty`, `$touched` and `$valid` all work. `show-errors` adds the message line under a field (see
[the field options](fields.md)).

On/off attributes (`disabled`, `readonly`, `multiple`, `clearable`, `show-label`, ...) are on when written bare
(`disabled`) or the HTML way (`disabled="disabled"`); any other value is an expression and the attribute follows it
(`disabled="vm.locked"`, `disabled="false"`).

## Next

* [Fields: label, size, message line](fields.md)
* [Theming with design tokens](theming.md)
* [Texts and languages](texts.md)
* [Options from a server](remote-data.md)
* The components: [select](components/select.md), [tree select](components/tree-select.md),
  [input](components/input.md), [date picker](components/date-picker.md), [checkbox](components/checkbox.md),
  [button](components/button.md), [popover](components/popover.md), [modal](components/modal.md),
  [messages](components/message.md)
