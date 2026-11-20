// ===================== 友盟统计 start=====================
// var uma = require('utils/umtrack-tt-game/uma.min.js');
// uma.init({
//   appKey:'6a5de17fcbfa6959517e26a7',//由友盟分配的APP_KEY
//   autoGetOpenid:true,// 是否需要通过友盟后台获取openid或匿名openid，如若需要，请到友盟后台设置appId及secret
//   debug:true,//是否打开调试模式
//   uploadUserInfo:true// 自动上传用户信息，设为false取消上传，默认为false
// })
// ===================== 友盟统计 end=====================
require("weapp-adapter.js");

require("splash2.js")._I("loading/Loading_atlas_k95omf.png", "laya.wxmini", ".min", false, 640, 1386, "fixedwidth", "vertical", "#3187d7", () => {
    try { window.__layaTextureCreate = Laya.Texture.create; } catch (e) {} window.loadLib = require, require("index.js"), window._M_ = !0;
});

GameGlobal.canUseiOSAutoGC && setInterval(() => {
    wx.triggerGC();
}, 1e4);