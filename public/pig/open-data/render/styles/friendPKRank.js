function t(t) {
    var e = t.width / 305;
    return {
        ranksView: {
            flexDirection: "row"
        },
        rankViewSelf: {
            alignItems: "center",
            left: t.canvasWidthSelf,
            top: t.canvasHeightSelf,
            width: t.width,
            height: t.height
        },
        rankView1: {
            alignItems: "center",
            left: t.canvasWidth1,
            top: t.canvasHeight1,
            width: t.width,
            height: t.height
        },
        rankView2: {
            alignItems: "center",
            left: t.canvasWidth2,
            top: t.canvasHeight2,
            width: t.width,
            height: t.height
        },
        score: {
            marginTop: 20 * e / 2,
            width: "100%",
            fontSize: 40,
            color: "#FFFFFF",
            textAlign: "center"
        },
        nick_bg: {
            marginTop: -(41 * e),
            width: 305 * e,
            height: 41 * e
        },
        nickname: {
            width: "100%",
            lineHeight: 41 * e,
            verticalAlign: "middle",
            fontSize: 30,
            color: "#FFFFFF",
            textAlign: "center",
            textOverflow: "ellipsis",
            fontWeight: "bold"
        },
        stage_bg: {
            marginTop: 192.5 * e,
            width: 220 * e,
            height: 107 * e
        },
        stage_bg_container: {
            alignItems: "center"
        },
        avatar_bg: {
            marginTop: -85.5 * e,
            width: 137 * e,
            height: 139 * e
        },
        avatar_bg_container: {
            alignItems: "center",
            justifyContent: "center"
        },
        avatar: {
            width: 120 * e,
            height: 120 * e
        },
        rank: {
            marginTop: -(292.5 * e),
            width: "100%",
            fontSize: 70,
            color: "#FFFFFF",
            textAlign: "center",
            fontWeight: "bold"
        },
        textStroke: {
            textStrokeWidth: 1,
            textStrokeColor: "black"
        }
    };
}

Object.defineProperty(exports, "__esModule", {
    value: !0
}), Object.defineProperty(exports, "default", {
    enumerable: !0,
    get: function() {
        return t;
    }
});