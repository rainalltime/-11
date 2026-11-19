var _define_property = require("./_define_property.js");

function _object_spread(e) {
    for (var r = 1; r < arguments.length; r++) {
        var t = null != arguments[r] ? arguments[r] : {}, n = Object.keys(t);
        "function" == typeof Object.getOwnPropertySymbols && (n = n.concat(Object.getOwnPropertySymbols(t).filter(function(e) {
            return Object.getOwnPropertyDescriptor(t, e).enumerable;
        }))), n.forEach(function(r) {
            _define_property._(e, r, t[r]);
        });
    }
    return e;
}

exports._ = _object_spread;