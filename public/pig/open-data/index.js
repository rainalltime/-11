Object.defineProperty(exports, "__esModule", {
    value: !0
});

var e = require("../open-data/@swc/runtime/_async_to_generator"), r = require("../open-data/@swc/runtime/_interop_require_default"), t = require("../open-data/@swc/runtime/_ts_generator"), n = require("./data/index"), a = /* */ r._(require("./render/tpls/friendRank")), s = /* */ r._(require("./render/tpls/friendPKRank")), i = /* */ r._(require("./render/tpls/ShareFriendRank")), o = /* */ r._(require("./render/styles/friendRank")), l = /* */ r._(require("./render/styles/friendPKRank")), c = /* */ r._(require("./render/tpls/tips")), h = /* */ r._(require("./render/styles/tips")), u = 0, d = "你的排名还没我高！", g = requirePlugin("Layout").default, _ = "achieve", f = wx.getSharedCanvas(), p = f.getContext("2d"), w = function() {
    var e = g.getElementsByClassName("shareToBtn");
    console.log("initShareEvents", e), e && e.forEach(function(e) {
        console.log("initShareEvents forEach"), e.on("click", function(r) {
            console.log("On ShareClick  " + ++u), console.log("On ShareClick 11 ", e), console.log("On ShareClick 11 ", e.idName), 
            "false" == e.dataset.isSelf && wx.shareMessageToFriend({
                openId: e.dataset.id,
                title: d,
                imageUrl: "open-data/render/shareImage/0.png"
            });
        });
    });
};

function k(e, r) {
    g.clear(), console.log("LayoutWithTplAndStyl0e", g), g.init(e, r), console.log("LayoutWithTplAndStyle1", g), 
    g.layout(p), console.log("LayoutWithTplAndStyle2", g);
}

function R() {
    var e = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : "";
    k((0, c.default)({
        tips: e
    }), (0, h.default)({
        width: f.width,
        height: f.height
    }));
}

function y(r) {
    return e._(function() {
        var e;
        return t._(this, function(t) {
            switch (t.label) {
              case 0:
                R("好友数据加载中..."), t.label = 1;

              case 1:
                return t.trys.push([ 1, 3, , 4 ]), [ 4, (0, n.getFriendRankData)(r) ];

              case 2:
                if (!(e = t.sent())) return R("请进入设置页允许获取微信朋友信息"), [ 2 ];
                if (!e.length) return R("暂无好友数据"), [ 2 ];
                return k((0, a.default)({
                    data: e
                }, r), (0, o.default)({
                    width: f.width,
                    height: f.height
                })), w(), [ 3, 4 ];

              case 3:
                return console.error("renderFriendsRank error", t.sent()), 0 == e.length ? R("请进入设置页允许获取微信朋友信息") : R("暂无好友数据"), 
                [ 3, 4 ];

              case 4:
                return [ 2 ];
            }
        });
    })();
}

wx.onMessage(function(r) {
    var a, c;
    if (console.log("[WX OpenData] onMessage", r), "string" == typeof r) try {
        r = JSON.parse(r);
    } catch (e) {
        e = VM2_INTERNAL_STATE_DO_NOT_USE_OR_PROGRAM_WILL_FAIL.handleException(e);
        console.error("[WX OpenData] onMessage data is not a object");
        return;
    }
    switch (r.type) {
      case "WXRender":
        a = r, e._(function() {
            return t._(this, function(e) {
                return g.updateViewPort({
                    x: a.x / a.devicePixelRatio,
                    y: a.y / a.devicePixelRatio,
                    width: a.width / a.devicePixelRatio,
                    height: a.height / a.devicePixelRatio
                }), [ 2 ];
            });
        })();
        break;

      case "WXDestroy":
        g.clearAll();
        break;

      case "showFriendsRank":
        y(_);
        break;

      case "showFriendsPKRank":
        e._(function() {
            var e, r, a, i, o, c, h, u, d, g, _;
            return t._(this, function(t) {
                switch (t.label) {
                  case 0:
                    R("好友数据加载中..."), t.label = 1;

                  case 1:
                    return t.trys.push([ 1, 3, , 4 ]), [ 4, (0, n.getFriendRankData)("ring") ];

                  case 2:
                    if (!(e = t.sent())) return R("请进入设置页允许获取微信朋友信息"), [ 2 ];
                    if (!e.length) return R("暂无好友数据"), [ 2 ];
                    for (a = null, i = null, o = -1, c = e.length - 1, h = 0; o < c; ) {
                        if (h++, (u = e[o += 1]).isSelf) {
                            r = u, a = d, o + 1 <= c && (i = e[o + 1]);
                            break;
                        }
                        d = u;
                    }
                    return g = .38 * f.width, _ = .8 * f.height, k((0, s.default)(r, a, i, h), (0, l.default)({
                        width: g,
                        height: _,
                        canvasWidth1: 0,
                        canvasHeight1: 0,
                        canvasWidthSelf: f.width / 2 - 3 * g / 2,
                        canvasHeightSelf: f.height - _,
                        canvasWidth2: f.width - 3 * g,
                        canvasHeight2: 0
                    })), w(), [ 3, 4 ];

                  case 3:
                    return console.error("renderFriendsRank error", t.sent()), 0 == e.length ? R("请进入设置页允许获取微信朋友信息") : R("暂无好友数据"), 
                    [ 3, 4 ];

                  case 4:
                    return [ 2 ];
                }
            });
        })();
        break;

      case "showFriendsPKAllRank":
        y("ring");
        break;

      case "showGroupFriendsRank":
        c = r.shareTicket, e._(function() {
            var e;
            return t._(this, function(r) {
                switch (r.label) {
                  case 0:
                    R("群同玩好友数据加载中..."), r.label = 1;

                  case 1:
                    return r.trys.push([ 1, 3, , 4 ]), [ 4, (0, n.getGroupFriendsRankData)(c, _) ];

                  case 2:
                    if (!(e = r.sent()).length) return R("暂无群同玩好友数据"), [ 2 ];
                    return console.log(e), k((0, s.default)({
                        data: e
                    }), (0, l.default)({
                        width: f.width,
                        height: f.height
                    })), [ 3, 4 ];

                  case 3:
                    return r.sent(), R("群同玩好友数据加载失败"), [ 3, 4 ];

                  case 4:
                    return [ 2 ];
                }
            });
        })();
        break;

      case "setUserRecord":
        (0, n.setUserRecord)(_, r.score);
        break;

      case "ShareToFriends":
        r.shareIcon && (u = r.shareIcon), r.shareTitle && (d = r.shareTitle), e._(function() {
            var e;
            return t._(this, function(r) {
                switch (r.label) {
                  case 0:
                    R("好友数据加载中..."), r.label = 1;

                  case 1:
                    return r.trys.push([ 1, 5, , 6 ]), [ 4, (0, n.getPotentialFriendData)() ];

                  case 2:
                    if (0 != (e = r.sent()).length) return [ 3, 4 ];
                    return [ 4, (0, n.getFriendRankData)(_) ];

                  case 3:
                    e = r.sent(), r.label = 4;

                  case 4:
                    if (console.log(e), !e) return R("请进入设置页允许获取微信朋友信息"), [ 2 ];
                    return k((0, i.default)({
                        data: e
                    }), (0, o.default)({
                        width: f.width,
                        height: f.height
                    })), w(), [ 3, 6 ];

                  case 5:
                    return console.error("renderPotentialFriendList error", r.sent()), 0 == e.length ? R("请进入设置页允许获取微信朋友信息") : R("暂无好友数据"), 
                    [ 3, 6 ];

                  case 6:
                    return [ 2 ];
                }
            });
        })();
        break;

      default:
        console.error("[WX OpenData] onMessage type 「".concat(r.type, "」 is not supported"));
    }
});