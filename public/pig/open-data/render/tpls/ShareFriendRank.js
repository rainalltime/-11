function e(e) {
    var a = '<view class="Sharecontainer" id="main"> <view class="ShareList"> <scrollview class="friendList" scrollY="false"> ', r = e.data;
    if (r) for (var n, s = -1, t = r.length - 1; s < t; ) n = r[s += 1], a += ' <view class="SharelistItem"> <image src="open-data/render/image/headframe.png" class="AvatarBase"></image><image class="SharerankAvatar" src="'.concat(n.avatarUrl, '"></image> <text class="rankName" value="').concat(n.nickname, '"></text>\n        <view class="shareToBtn"  idName="').concat(n.openid || "", '">\n      \n       <image src="open-data/render/image/fenx.png"\n      class="shareBtnBg"></image> </view>\n      </view> ');
    return a + " </scrollview> </view></view>";
}

Object.defineProperty(exports, "__esModule", {
    value: !0
}), Object.defineProperty(exports, "default", {
    enumerable: !0,
    get: function() {
        return e;
    }
});