/* ⚠️ 云开发只用在一个地方：四个人真的开口说话（cloudfunctions/talk）。
   其余全部本机——记录、情绪、滋味、四个人的兜底语料，一律 wx.setStorageSync。
   初始化失败也不能崩：那一层会退回 data/mentor.js 里人写的那段，产品照常用。 */
App({
  globalData: { cloudOK: false, cloudErr: '' },
  onLaunch() {
    if (!wx.cloud) { this.globalData.cloudErr = '基础库没有 wx.cloud'; return; }
    try {
      /* ⚠️ 用 DYNAMIC_CURRENT_ENV，不写死环境名。
         写死要填的是**环境 ID**（形如 cloud1-1g2xxxxx），不是控制台上那个显示名，
         填错了 callFunction 会静默失败——这一处踩过。 */
      wx.cloud.init({ env: wx.cloud.DYNAMIC_CURRENT_ENV, traceUser: false });
      this.globalData.cloudOK = true;
    } catch (e) {
      this.globalData.cloudErr = String(e && e.message || e);
    }
  },
});
