var isBooleanAttribute = require('./is-boolean-attribute');
var FileWriter = require('./file-writer');

function compile(ast) {
    var compiler = new Compiler();
    return compiler.compile(ast);
}

function Compiler () {
    this.writer = new FileWriter();
}

Compiler.prototype.write = function () {
    this.writer.write.apply(this.writer, arguments);
};
Compiler.prototype.indent = function () {
    this.writer.indent.apply(this.writer, arguments);
};
Compiler.prototype.outdent = function () {
    this.writer.outdent.apply(this.writer, arguments);
};

Compiler.prototype.compile = function (ast) {
    this.write(
        'function (data, runtime) {',
        '  runtime = runtime || this._runtime;',
        '  var context = new runtime.Context({',
        '    runtime: runtime,',
        '    template: new runtime.Template(),',
        '    path: \'\',',
        '    data: data',
        '  });',
        '',
        '  (function (parent, context) {'
    );

    this.indent(2);
    ast.children.forEach(this.compileNode.bind(this));
    this.outdent(2);

    this.write(
        '  })(context.template.html, context);',
        '  var firstChild = context.template.html.firstChild;',
        '  firstChild.update = context.template.update.bind(context.template);',
        '  return firstChild;',
        '}'
    );

    return this.writer.toString();
};

Compiler.prototype.compileNode = function (node) {
    if (node.type === 'Element') return this.compileElement(node);
    if (node.type === 'TextNode') return this.compileTextNode(node);
    if (node.type === 'BlockStatement') return this.compileBlock(node);
    if (node.type === 'DocumentFragment') return this.compileDocumentFragment(node);
};

Compiler.prototype.compileExpression = function (ast) {
    if (ast.type === 'Literal') {
        this.write(
            "context.runtime.hooks.EVENTIFY_LITERAL.call(context.template, " + JSON.stringify(ast.value) + ")"
        );
    }

    if (ast.type === 'Binding') {
        this.write(
            "context.runtime.hooks.EVENTIFY_BINDING.call(context.template, context.data, (context.path || '') + '" + ast.keypath + "')"
        );
    }

    if (ast.type === 'Expression') {
        var name = ast.name;

        this.write(
            "runtime.hooks.EXPRESSION('" + name + "', ["
        );

        this.indent(1);
        ast.arguments.map(function (expr) {
            this.compileExpression(expr);
            this.writer.appendToLastLine(',');
        }.bind(this));
        this.outdent(1);

        this.write("])");
    }
};

Compiler.prototype.compileTextNode = function(element, o) {
    o = o || {};

    this.write(
        "(function (parent, context) {",
        "  var expr = ("
    );

    this.indent(2);
    this.compileExpression(element.content);
    this.outdent(2);

    this.write(
        "  );",
        "  var node = document.createTextNode((expr.value||expr.value===0) ? expr.value : '');",
        "  expr.on('change', function (text) { node.data = (text||text===0) ? text : ''; });",
        "  parent.appendChild(node);",
        "})(parent, context);"
    );
};

Compiler.prototype.compileElement = function(element, o) {
    o = o || {};

    this.write(
        "(function (parent, context) {",
        "  var element = document.createElement('" + element.tagName + "');",
        "  var expr;"
    );

    this.indent(1);
    this.compileElementAttributes(element);
    this.outdent(1);

    this.indent(1);
    if (element.children.length) {
        this.write(
            "(function (parent, context) {"
        );

        this.indent(1);
        element.children.forEach(this.compileNode.bind(this));
        this.outdent(1);

        this.write(
            "})(element, context);"
        );
    }
    this.outdent(1);

    this.write(
        "  parent.appendChild(element);",
        "})(parent, context);"
    );
};

Compiler.prototype.compileElementAttributes = function (element) {
    Object.keys(element.attributes).forEach(function (attrName) {
        var attr = element.attributes[attrName];

        this.compileAttribute(attrName, attr);

    }.bind(this));
};

Compiler.prototype.compileAttribute = function (attrName, attr) {
    if (attr.type === 'Literal') {
        this.write(
            "element.setAttribute('" + attrName + "', '" + attr.value.replace(/\n/g, '') + "');"
        );
        return;
    }

    this.write("expr = (");
    this.indent(1);
    this.compileExpression(attr);
    this.outdent(1);
    this.write(");");

    if (isBooleanAttribute(attrName)) {
        this.compileBooleanAttribute(attrName);
    } else {
        this.compileStandardAttribute(attrName);
    }
};

Compiler.prototype.compileBooleanAttribute = function (attrName) {
    this.write(
        "element[ expr.value ? 'setAttribute' : 'removeAttribute']('" + attrName + "', '');",
        "expr.on('change', function (v) {",
        "  element[ v ? 'setAttribute' : 'removeAttribute']('" + attrName + "', '');",
        "});"
    );
};

Compiler.prototype.compileStandardAttribute = function (attrName) {
    this.write(
        "element.setAttribute('" + attrName + "', expr.value ? context.runtime.hooks.ESCAPE_FOR_ATTRIBUTE('" + attrName + "', expr.value) : '');",
        "expr.on('change', function (v) {",
        "  element.setAttribute('" + attrName + "', v ? context.runtime.hooks.ESCAPE_FOR_ATTRIBUTE('" + attrName + "', v) : '');",
        "});"
    );
};

Compiler.prototype.compileDocumentFragment = function (node) {
    this.compileBlock({
        blockType: 'documentFragment',
        blockExpression: node.content,
        body: [],
        alternate: []
    });
};

Compiler.prototype.compileBlock = function (node) {
    this.write(
        "runtime.hooks.HELPER('" + node.blockType + "', [",
        "  parent,",
        "  context,",
        "  ("
    );

    this.indent(2);
    this.compileExpression(node.blockExpression);
    this.outdent(2);

    this.write(
        "  ),",
        "  function (parent, context) {"
    );

    this.indent(2);
    node.body.forEach(this.compileNode.bind(this));
    this.outdent(2);

    this.write(
        "  },",
        "  function (parent, context) {"
    );

    this.indent(2);
    node.alternate.forEach(this.compileNode.bind(this));
    this.outdent(2);

    this.write(
        "}, context]);"
    );
};

module.exports.compile = compile;
