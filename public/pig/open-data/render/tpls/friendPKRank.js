Object.defineProperty(exports, "__esModule", {
    value: !0
});

var a = exports, e = {
    get CheckTimeToString() {
        return n;
    },
    get default() {
        return r;
    }
};

for (var t in e) Object.defineProperty(a, t, {
    enumerable: !0,
    get: Object.getOwnPropertyDescriptor(e, t).get
});

function r(a, e, t, r) {
    var c = '<view class="ranksView">';
    return c += '<view class="rankView1">', c += '<image class="stage_bg stage_bg_container" src="open-data/render/image/pk/stage_bg.png">', 
    null != e && (c += '<image class="avatar_bg avatar_bg_container" src="open-data/render/image/pk/avatar_bg.png">', 
    c += '<image class="avatar" src="'.concat(e.avatarUrl, '"></image>'), c += "</image>"), 
    c += "</image>", null != e && (c += '<image class="nick_bg" src="open-data/render/image/pk/nick_bg.png">', 
    c += '<text class="nickname textStroke" value="'.concat(e.nickname, '"></text>'), 
    c += "</image>", c += '<text class="score textStroke" value="'.concat(n(e.score), '"></text>'), 
    c += '<text class="rank textStroke" value="'.concat(r - 1, '"></text>')), c += "</view>", 
    c += '<view class="rankViewSelf">', c += '<image class="stage_bg stage_bg_container" src="open-data/render/image/pk/my_stage_bg.png">', 
    c += '<image class="avatar_bg avatar_bg_container" src="open-data/render/image/pk/avatar_bg.png">', 
    c += '<image class="avatar" src="'.concat(a.avatarUrl, '"></image>'), c += "</image>", 
    c += "</image>", c += '<image class="nick_bg" src="open-data/render/image/pk/nick_bg.png">', 
    c += '<text class="nickname textStroke" value="'.concat(a.nickname, '"></text>'), 
    c += "</image>", c += '<text class="score textStroke" value="'.concat(n(a.score), '"></text>'), 
    c += '<text class="rank textStroke" value="'.concat(r, '"></text>'), c += "</view>", 
    c += '<view class="rankView2">', c += '<image class="stage_bg stage_bg_container" src="open-data/render/image/pk/stage_bg.png">', 
    null != t && (c += '<image class="avatar_bg avatar_bg_container" src="open-data/render/image/pk/avatar_bg.png">', 
    c += '<image class="avatar" src="'.concat(t.avatarUrl, '"></image>'), c += "</image>"), 
    c += "</image>", null != t && (c += '<image class="nick_bg" src="open-data/render/image/pk/nick_bg.png">', 
    c += '<text class="nickname textStroke" value="'.concat(t.nickname, '"></text>'), 
    c += "</image>", c += '<text class="score textStroke" value="'.concat(n(t.score), '"></text>'), 
    c += '<text class="rank textStroke" value="'.concat(r + 1, '"></text>')), c += "</view>", 
    c += "</view>";
}

function n(a) {
    var e, t, r = "";
    return e = Math.floor(a / 60), a %= 60, t = a, a < 10 && (t = "0" + t), r = r + e + ":" + t;
}