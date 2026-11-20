exports._I = function(e, a, t, i, r, n, s, l, y, L) {
    require(`${a}${t}.js`), i ? requirePlugin("layaPlugin/laya.core.js") : require(`laya.core${t}.js`), 
    Laya.Config.useRetinalCanvas = !0;
    Laya.Render.prototype.initRender = function(e, a, t) {
        var i = Laya.Config, r = Laya.WebGL, n = Laya.LayaGL.instance = Laya.WebGLContext.mainContext = function(e) {
            var a, t = [ "webgl2", "webgl" ];
            i.useWebGL2 && !Laya.Browser.onBDMiniGame || t.shift();
            for (var n = 0; n < t.length; n++) {
                try {
                    a = e.getContext(t[n], {
                        stencil: i.isStencil,
                        alpha: i.isAlpha,
                        antialias: i.isAntialias,
                        premultipliedAlpha: i.premultipliedAlpha,
                        preserveDrawingBuffer: i.preserveDrawingBuffer
                    });
                } catch (e) {}
                if (a) return "webgl2" === t[n] && (r._isWebGL2 = !0), a;
            }
            return null;
        }(Laya.Render._mainCanvas.source);
        return i.printWebglOrder && this._replaceWebglcall(n), !!n && (Laya.LayaGL.instance = n, 
        Laya.LayaGL.layaGPUInstance = new Laya.LayaGPU(n, r._isWebGL2), e.size(a, t), Laya.Context.__init__(), 
        Laya.SubmitBase.__init__(), (t = new Laya.Context()).isMain = !0, Laya.Render._context = t, 
        e._setContext(t), Laya.ShaderDefines2D.__init__(), Laya.Value2D.__init__(), Laya.Shader2D.__init__(), 
        Laya.Buffer2D.__int__(n), Laya.BlendMode._init_(n), !0);
    }, Laya.init(r, n, Laya.WebGL);
    let o = Laya.stage;
    o.scaleMode = s, y && (o.bgColor = y);
    let d = new class extends Laya.Sprite {
        constructor(e, a, t, i) {
            super();
            let r = this;
            Laya.loader.load(t, Laya.Handler.create(r, t => {
                r.b = t;
                let n = r.graphics;
                n.clear();
                let s = t.width, l = t.height, y = 1;
                8 == i.length ? (y = e / t.width, s = e, l = t.height * y, n.drawTexture(t, 0, 0, s, l), 
                r.size(s, l), r.x = 0, r.y = .5 * (a - l)) : (y = a / t.height, s = t.width * y, 
                l = a, n.drawTexture(t, 0, 0, s, l), r.size(s, l), r.x = .5 * (e - s), r.y = 0), 
                r.event("loaded");
            }));
        }
        destroy(e = !0) {
            super.destroy(e), this.graphics.clear(), this.b && this.b.destroy(), this.b = null;
        }
    }(r, n, e, o.screenMode = l);
    d.zOrder = 3, o.addChild(d), o.splash = d;
    let _ = new Laya.Text();
    o.addChild(_), _.text = " ", setTimeout(() => {
        o.splash && o.splash.destroy(), _.destroy();
    }, 1e4), Laya.timer.frameOnce(6, null, L);
};