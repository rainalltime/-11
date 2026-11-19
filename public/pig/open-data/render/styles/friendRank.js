Object.defineProperty(exports, "__esModule", {
    value: !0
}), Object.defineProperty(exports, "default", {
    enumerable: !0,
    get: function() {
        return e;
    }
});

var t = require("../../../open-data/@swc/runtime/_define_property");

function e(e) {
    e.height = .95 * e.height;
    var i, o, h = Math.ceil(.94 * e.width), n = 100 * h / 550, l = .16 * h, r = .18 * h, a = .3 * h, g = n / 2 - 24 + 5, s = Math.min(40, n / 2), f = (n - 2 * s) / 2;
    return {
        container: {
            width: e.width,
            height: e.height,
            borderRadius: 12,
            paddingLeft: .03 * e.width,
            paddingRight: .03 * e.width
        },
        Sharecontainer: {
            width: e.width,
            height: e.height,
            borderRadius: 0,
            paddingLeft: .03 * e.width,
            paddingRight: .03 * e.width
        },
        ShareList: {
            width: Math.ceil(.94 * e.width),
            height: e.height
        },
        friendList: {
            width: Math.ceil(.94 * e.width),
            height: e.height
        },
        rankList: {
            width: Math.ceil(.94 * e.width),
            height: e.height - n
        },
        list: {
            width: Math.ceil(.94 * e.width),
            height: e.height - 1.5 * n
        },
        SharelistItem: {
            position: "relative",
            width: h,
            height: n,
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 0,
            marginTop: 20
        },
        listItem: {
            position: "relative",
            width: h,
            height: n,
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 20
        },
        rankBg: {
            position: "absolute",
            top: 0,
            left: 0,
            width: h,
            height: n
        },
        AvatarBase: {
            position: "relative",
            marginLeft: r,
            width: l,
            height: l
        },
        AvatarFrame: {
            position: "absolute",
            left: 0,
            top: 0,
            width: l,
            height: l
        },
        myAvatarBase: {
            position: "relative",
            marginLeft: r,
            width: l,
            height: l
        },
        myAvatarFrame: {
            position: "absolute",
            left: 0,
            top: 0,
            width: l,
            height: l
        },
        SharerankAvatar: {
            marginLeft: -(.16 * h),
            width: .13 * h,
            height: .13 * h
        },
        myRankAvatar: {
            position: "absolute",
            left: .015 * h,
            top: .015 * h,
            width: .13 * h,
            height: .13 * h
        },
        rankAvatar: {
            position: "absolute",
            left: .015 * h,
            top: .015 * h,
            width: .13 * h,
            height: .13 * h
        },
        rankName: {
            top: .4 * n,
            left: .02 * h,
            width: .3 * h,
            height: n,
            textAlign: "left",
            fontWeight: "bold",
            fontSize: 40,
            textOverflow: "ellipsis",
            color: "#c983b6"
        },
        rankName0: {
            top: .4 * n,
            left: .02 * h,
            width: .3 * h,
            height: n,
            textAlign: "left",
            fontWeight: "bold",
            fontSize: 40,
            textOverflow: "ellipsis",
            color: "#b47810"
        },
        rankName1: {
            top: .4 * n,
            left: .02 * h,
            width: .3 * h,
            height: n,
            textAlign: "left",
            fontWeight: "bold",
            fontSize: 40,
            textOverflow: "ellipsis",
            color: "#6986c2"
        },
        rankName2: {
            top: .4 * n,
            left: .02 * h,
            width: .3 * h,
            height: n,
            textAlign: "left",
            fontWeight: "bold",
            fontSize: 40,
            textOverflow: "ellipsis",
            color: "#bb853e"
        },
        centerRankName: {
            width: a,
            textAlign: "center",
            fontWeight: "bold",
            fontSize: 40,
            textOverflow: "ellipsis",
            color: "#c983b6"
        },
        centerRankName0: {
            width: a,
            textAlign: "center",
            fontWeight: "bold",
            fontSize: 40,
            textOverflow: "ellipsis",
            color: "#b47810"
        },
        centerRankName1: {
            width: a,
            textAlign: "center",
            fontWeight: "bold",
            fontSize: 40,
            textOverflow: "ellipsis",
            color: "#6986c2"
        },
        centerRankName2: {
            width: a,
            textAlign: "center",
            fontWeight: "bold",
            fontSize: 40,
            textOverflow: "ellipsis",
            color: "#bb853e"
        },
        NameBox: {
            position: "relative",
            width: a,
            height: n
        },
        nameLineSingle: {
            position: "absolute",
            left: 0,
            top: (n - s) / 2,
            width: a,
            height: s,
            lineHeight: s
        },
        nameLine1: {
            position: "absolute",
            left: 0,
            top: f,
            width: a,
            height: s,
            lineHeight: s
        },
        nameLine2: {
            position: "absolute",
            left: 0,
            top: f + s,
            width: a,
            height: s,
            lineHeight: s
        },
        rankIndex: {
            position: "absolute",
            top: .4 * n,
            left: .038 * h,
            width: .1 * h,
            height: n / 2,
            textAlign: "center",
            fontSize: 45,
            fontWeight: "bold",
            textOverflow: "ellipsis",
            strokeStyle: "black",
            color: "#ffffff"
        },
        rankScoreTip: {
            position: "absolute",
            top: g,
            right: .3 * h,
            width: .35 * h,
            height: n,
            lineHeight: 48,
            textAlign: "right",
            fontSize: 40,
            fontWeight: "bold",
            textOverflow: "ellipsis",
            strokeStyle: "black",
            color: "#000"
        },
        star: {
            top: 0,
            left: .06 * h,
            width: .05 * h,
            height: .05 * h
        },
        MyItem: {
            position: "relative",
            width: h,
            height: n,
            flexDirection: "row",
            alignItems: "center",
            marginTop: -(.1 * h)
        },
        myRankBg: {
            position: "absolute",
            top: 0,
            left: -(h - h) / 2,
            width: h,
            height: n
        },
        RankBase: {
            marginLeft: .03 * h,
            marginTop: .04 * h,
            width: .1 * h,
            height: .1 * h
        },
        myRankBase: {
            marginLeft: .03 * h,
            marginTop: .04 * h,
            width: .1 * h,
            height: .1 * h
        },
        myRankName: {
            width: a,
            textAlign: "center",
            fontWeight: "bold",
            fontSize: 40,
            textOverflow: "ellipsis",
            color: "#c983b6"
        },
        myRankIndex: {
            position: "absolute",
            top: 2 * n / 5,
            left: .035 * h,
            width: .1 * h,
            height: n / 3,
            textAlign: "center",
            fontSize: 45,
            fontWeight: "bold",
            stroke: "#000",
            textOverflow: "ellipsis",
            strokeLinejoin: "round",
            strokeWidth: 3,
            color: "#ffffff"
        },
        myRankScoreTip: {
            position: "absolute",
            top: g,
            right: .1 * h,
            width: .35 * h,
            height: n,
            lineHeight: 48,
            textAlign: "right",
            fontSize: 40,
            fontWeight: "bold",
            textOverflow: "ellipsis",
            strokeStyle: "black",
            color: "#000"
        },
        mystar: {
            top: 0,
            left: .264 * h,
            width: .05 * h,
            height: .05 * h
        },
        shareToBtn: (i = {
            position: "relative"
        }, t._(i, "position", "absolute"), t._(i, "right", .03 * h), t._(i, "top", n / 2 - .05 * h), 
        t._(i, "width", .2 * h), t._(i, "height", .1 * h), i),
        shareBtnBg: (o = {
            position: "relative"
        }, t._(o, "position", "absolute"), t._(o, "right", 0), t._(o, "top", 0), t._(o, "width", .2 * h), 
        t._(o, "height", .1 * h), o),
        shareText: {
            position: "absolute",
            right: 0,
            top: .16 * e.height * .25,
            width: .21 * e.width,
            height: .16 * e.height * .5,
            lineHeight: .16 * e.height * .5,
            textAlign: "center",
            fontSize: .043 * e.width,
            color: "#fff"
        }
    };
}