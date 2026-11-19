Object.defineProperty(exports, "__esModule", {
    value: !0
});

var e = exports, r = {
    get getCurrTime() {
        return n;
    },
    get promisify() {
        return i;
    }
};

for (var t in r) Object.defineProperty(e, t, {
    enumerable: !0,
    get: Object.getOwnPropertyDescriptor(r, t).get
});

function n() {
    return parseInt(new Date() / 1e3, 10);
}

function i(e) {
    return function() {
        var r = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : {};
        return new Promise(function(t, n) {
            e(Object.assign(r, {
                success: t,
                fail: n
            }));
        });
    };
}