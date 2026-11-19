Object.defineProperty(exports, "__esModule", {
    value: !0
}), Object.defineProperty(exports, "showLoading", {
    enumerable: !0,
    get: function() {
        return i;
    }
});

var e = requirePlugin("Layout").default, t = wx.getSharedCanvas().getContext("2d"), n = {
    container: {
        width: "100%",
        height: "100%",
        justifyContent: "center",
        alignItems: "center"
    },
    loading: {
        width: 150,
        height: 150,
        borderRadius: 75
    }
};

function i() {
    e.clear(), e.init('\n<view id="container">\n  <image src="open-data/render/image/loading.png" id="loading"></image>\n</view>\n', n), 
    e.layout(t);
    var i = e.getElementById("loading"), a = 0;
    e.ticker.add(function() {
        a = (a + 2) % 360, i.style.transform = "rotate(".concat(a, "deg)");
    });
}