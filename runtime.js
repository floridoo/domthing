var Template = require('./lib/runtime/template');
var Context = require('./lib/runtime/context');
var hooks = require('./lib/runtime/hooks');
var helpers = require('./lib/runtime/helpers');
var expressions = require('./lib/runtime/expressions');

module.exports = {
    Template: Template,
    Context: Context,
    hooks: hooks,

    registerHelper: helpers.registerHelper,
    registerExpression: expressions.registerExpression
};
