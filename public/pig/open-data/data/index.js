Object.defineProperty(exports, "__esModule", {
    value: !0
});

var e = exports, t = {
    get getFriendRankData() {
        return d;
    },
    get getGroupFriendsRankData() {
        return D;
    },
    get getPotentialFriendData() {
        return p;
    },
    get getSelfData() {
        return g;
    },
    get setUserRecord() {
        return h;
    }
};

for (var n in t) Object.defineProperty(e, n, {
    enumerable: !0,
    get: Object.getOwnPropertyDescriptor(t, n).get
});

var r, a = require("../../open-data/@swc/runtime/_object_spread"), o = require("./utils"), i = (0, 
o.promisify)(wx.getFriendCloudStorage), s = (0, o.promisify)(wx.getGroupCloudStorage), u = (0, 
o.promisify)(wx.setUserCloudStorage), c = (0, o.promisify)(wx.getUserInfo), l = (0, 
o.promisify)(wx.getPotentialFriendList);

function g() {
    return c({
        openIdList: [ "selfOpenId" ]
    }).then(function(e) {
        return e.data[0] || {};
    });
}

function f(e) {
    var t = arguments.length > 1 && void 0 !== arguments[1] && arguments[1], n = !(arguments.length > 2) || void 0 === arguments[2] || arguments[2];
    return (e.data || []).filter(function(e) {
        return e.KVDataList && e.KVDataList.length;
    }).map(function(e) {
        var n = function(e) {
            var t;
            try {
                t = JSON.parse(e.KVDataList[0].value);
            } catch (e) {
                e = VM2_INTERNAL_STATE_DO_NOT_USE_OR_PROGRAM_WILL_FAIL.handleException(e);
                t = {
                    wxgame: {
                        score: 0,
                        update_time: (0, o.getCurrTime)()
                    }
                };
            }
            return t.wxgame;
        }(e), r = n.score, a = n.update_time;
        return e.score = r, e.update_time = a, t && t.avatarUrl === e.avatarUrl && (e.isSelf = !0), 
        e;
    }).sort(function(e, t) {
        return n ? t.score - e.score : e.score - t.score;
    });
}

function d(e) {
    var t = !(arguments.length > 1) || void 0 === arguments[1] || arguments[1];
    return console.log("[WX OpenData] getFriendRankData with key: ", e), i({
        keyList: [ e ]
    }).then(function(n) {
        console.log("[WX OpenData] getFriendRankData success: ", n);
        var a = "ring" != e;
        return t ? (r = r || g()).then(function(e) {
            return f(n, e, a);
        }) : f(n, !1, a);
    }).catch(function(e) {
        return console.log("[WX OpenData] getFriendRankData fail: ", e), null;
    });
}

function p() {
    return l().then(function(e) {
        return console.log("[WX OpenData] getPotentialFriendData success: ", e), e.list;
    }).catch(function(e) {
        return console.log("[WX OpenData] getPotentialFriendData fail: ", e), null;
    });
}

function D(e, t) {
    var n = !(arguments.length > 2) || void 0 === arguments[2] || arguments[2];
    return console.log("[WX OpenData] getGroupFriendsRankData with shareTicket and key: ", e, t), 
    s({
        shareTicket: e,
        keyList: [ t ]
    }).then(function(e) {
        return (console.log("[WX OpenData] getGroupFriendsRankData success: ", e), n) ? (r = r || g()).then(function(t) {
            return f(e, t);
        }) : f(e);
    });
}

function h(e) {
    var t = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : 0, n = arguments.length > 2 && void 0 !== arguments[2] ? arguments[2] : {};
    wx.getUserCloudStorage({
        keyList: [ e ],
        success: function(r) {
            if (console.log("[WX OpenData] getUserCloudStorage: success", e, r), t < 1e4 || 0 == r.KVDataList.length) return u({
                KVDataList: [ {
                    key: e,
                    value: JSON.stringify(a._({
                        wxgame: {
                            score: t,
                            update_time: (0, o.getCurrTime)()
                        }
                    }, n))
                } ]
            }).then(function(e) {
                console.log("[WX OpenData] setUserRecord success: ", e);
            });
        },
        fail: function(r) {
            return console.log("[WX OpenData] getUserCloudStorage: fail", e, r), u({
                KVDataList: [ {
                    key: e,
                    value: JSON.stringify(a._({
                        wxgame: {
                            score: t,
                            update_time: (0, o.getCurrTime)()
                        }
                    }, n))
                } ]
            }).then(function(e) {
                console.log("[WX OpenData] setUserRecord success: ", e);
            });
        }
    });
}