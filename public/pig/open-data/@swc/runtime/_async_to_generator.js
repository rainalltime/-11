function asyncGeneratorStep(n, r, e, t, o, a, c) {
    try {
        var s = n[a](c), i = s.value;
    } catch (n) {
        n = VM2_INTERNAL_STATE_DO_NOT_USE_OR_PROGRAM_WILL_FAIL.handleException(n);
        e(n);
        return;
    }
    s.done ? r(i) : Promise.resolve(i).then(t, o);
}

function _async_to_generator(n) {
    return function() {
        var r = this, e = arguments;
        return new Promise(function(t, o) {
            var a = n.apply(r, e);
            function c(n) {
                asyncGeneratorStep(a, t, o, c, s, "next", n);
            }
            function s(n) {
                asyncGeneratorStep(a, t, o, c, s, "throw", n);
            }
            c(void 0);
        });
    };
}

exports._ = _async_to_generator;