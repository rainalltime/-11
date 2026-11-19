function e(e) {
    return console.log(e), {
        container: {
            flexDirection: "row",
            width: e.width,
            height: e.height,
            justifyContent: "center",
            alignItems: "center"
        },
        tips: {
            color: "#000000",
            width: e.width,
            height: 50,
            fontSize: 30,
            textAlign: "center"
        }
    };
}

Object.defineProperty(exports, "__esModule", {
    value: !0
}), Object.defineProperty(exports, "default", {
    enumerable: !0,
    get: function() {
        return e;
    }
});