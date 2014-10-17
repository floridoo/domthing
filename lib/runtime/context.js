function Context(context) {
    for (var i in context)
        this[i] = context[i];
}

Context.prototype.clone = function() {
    return new Context(this);
};
module.exports = Context;
