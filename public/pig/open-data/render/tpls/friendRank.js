Object.defineProperty(exports, "__esModule", {
    value: !0
});

var a = exports, e = {
    get CheckTimeToString() {
        return s;
    },
    get default() {
        return c;
    }
};

for (var t in e) Object.defineProperty(a, t, {
    enumerable: !0,
    get: Object.getOwnPropertyDescriptor(e, t).get
});

function r(a) {
    return a.length > 1 ? 40 : " " === a ? 12 : a.charCodeAt(0) > 11903 ? 40 : 22;
}

function n(a, e) {
    var t = function(a) {
        var e = String(null == a ? "" : a);
        if (!e) return [ "" ];
        var t = 0;
        try {
            var n = wx.getSharedCanvas();
            t = n && n.width || 0;
        } catch (a) {
            a = VM2_INTERNAL_STATE_DO_NOT_USE_OR_PROGRAM_WILL_FAIL.handleException(a);
            t = 0;
        }
        if (!t) try {
            t = wx.getSystemInfoSync().windowWidth;
        } catch (a) {
            a = VM2_INTERNAL_STATE_DO_NOT_USE_OR_PROGRAM_WILL_FAIL.handleException(a);
            t = 375;
        }
        for (var c = .3 * Math.ceil(.94 * t), s = function(a) {
            for (var e = [], t = 0; t < a.length; t++) {
                var r = a.charCodeAt(t);
                r >= 55296 && r <= 56319 && t + 1 < a.length ? (e.push(a.charAt(t) + a.charAt(t + 1)), 
                t += 1) : e.push(a.charAt(t));
            }
            return e;
        }(e), i = 0, o = 0; o < s.length; o++) i += r(s[o]);
        if (i <= c) return [ e ];
        for (var g = "", l = 0, m = 0; m < s.length && l + r(s[m]) <= c; ) l += r(s[m]), 
        g += s[m], m += 1;
        return 0 === m && (g = s[0], m = 1), [ g, s.slice(m).join("") ];
    }(a);
    return t.length < 2 ? '<view class="NameBox"><text class="'.concat(e, ' nameLineSingle" value="').concat(t[0], '"></text></view>') : '<view class="NameBox"><text class="'.concat(e, ' nameLine1" value="').concat(t[0], '"></text><text class="').concat(e, ' nameLine2" value="').concat(t[1], '"></text></view>');
}

function c(a, e) {
    var t = "ring" == e, r = '<view class="container" id="main"> <view class="rankList"> <scrollview class="list" scrollY="true"> ', c = a.data, i = -1, o = -1;
    if (c) for (var g, l, m = -1, v = c.length - 1; m < v; ) {
        var d = (l = c[m += 1]).score || 0;
        o++, l.isSelf && (g = l, i = o);
        var u = d;
        t && (u = s(u)), d < 0 && (u = "暂无排名");
        var p = "open-data/render/image/rankBg" + Math.min(3, o) + ".png", h = "", f = "centerRankName";
        o <= 2 && (h = "open-data/render/image/" + (o + 1) + "-1.png", f += o);
        var w = ' <image class="star" src="'.concat("open-data/render/image/star.png", '"></image>');
        t && (w = "");
        var x = "share0", y = "headframe";
        l.isSelf && (x = "me", p = "open-data/render/image/MyRankBg.png", y = "myheadframe"), 
        r += ' <view class="listItem"> <image src="'.concat(p, '" class="rankBg"><image class="RankBase" src="').concat(h, '"></image><text class="rankIndex" value="').concat(o <= 2 ? "" : o + 1, '"></text></image><view class="AvatarBase"><image class="rankAvatar" src="').concat(l.avatarUrl, '"></image><image class="AvatarFrame" src="open-data/render/image/').concat(y, '.png"></image></view> ').concat(n(l.nickname, f), ' <text class="rankScoreTip" value="').concat(u, '"></text> \n      <view class="shareToBtn" data-isSelf="').concat(!!l.isSelf, '" data-id="').concat(l.openid || "", '">\n            <image src="open-data/render/image/').concat(x, '.png" class="shareBtnBg"></image>\n          </view>') + w + "\n        </view> ";
    }
    if (r += " </scrollview></view>", g) {
        var k = g.score || 0, B = k;
        t && (B = s(B));
        var S = '<image class="mystar" src="open-data/render/image/star.png"></image>';
        t && (S = ""), k < 0 && (B = "暂无排名");
        var A = "";
        i <= 2 && (A = "open-data/render/image/" + (i + 1) + "-1.png"), r += ' <view class="MyItem"> <image src="open-data/render/image/MyRankBg.png" class="myRankBg"><image class="myRankBase" src="'.concat(A, '"></image><text class="myRankIndex" value="').concat(i <= 2 ? "" : i + 1, '"></text></image><view class="myAvatarBase"><image class="myRankAvatar" src="').concat(g.avatarUrl, '"></image><image class="myAvatarFrame" src="open-data/render/image/myheadframe.png"></image></view> ').concat(n(g.nickname, "myRankName"), ' <text class="myRankScoreTip" value="').concat(B, '"></text>\n            ') + S + "\n       </view> ";
    }
    return r + "</view>";
}

function s(a) {
    var e, t, r = "";
    return e = Math.floor(a / 60), a %= 60, t = a, a < 10 && (t = "0" + t), r = r + e + ":" + t;
}