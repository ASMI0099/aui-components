/**
 * aui-if: a lighter ng-if for the parts of the component templates.
 */
angular.module('aui')
    /**
     * aui-if="expression": ng-if for the aui-* templates, without its animation promise. ng-if removes its content
     * with $animate.leave(...).then(...): that promise resolves a frame later through $q, which starts a digest of the
     * whole page after every removal (a closed panel's list, a placeholder replaced by a value, a spacer of a scrolled
     * list, an error text that goes): on a large page, a long task each time, often right in an animation. aui-if adds
     * and removes its content at once and starts nothing (the aui-* templates use no ng-animate classes). Otherwise as
     * ng-if: a comment keeps its place, and the content and its child scope are new each time the expression turns
     * true.
     */
    .directive('auiIf', function () {
        return {
            restrict: 'A',
            transclude: 'element',
            priority: 600,
            terminal: true,
            $$tlb: true,
            link: function (scope, element, attrs, ctrl, transclude) {
                let block = null;
                let childScope = null;
                scope.$watch(attrs.auiIf, function (value) {
                    if (value) {
                        if (childScope) return;
                        transclude(function (clone, newScope) {
                            childScope = newScope;
                            clone[clone.length++] = document.createComment(' end auiIf: ' + attrs.auiIf + ' ');
                            block = clone;
                            element.after(clone);
                        });
                        return;
                    }
                    if (childScope) {
                        childScope.$destroy();
                        childScope = null;
                    }
                    if (block) {
                        block.remove();
                        block = null;
                    }
                });
            }
        };
    });
