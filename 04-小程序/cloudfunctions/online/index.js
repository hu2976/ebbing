/* 在场人数。产品里唯一需要后端、也唯一会自己变的数字。

   为什么要真的：这个数字是「你不是一个人在这儿」的唯一证据，
   凌晨三点它是屏上最重要的一行。假的数字骗得过眼睛，骗不过第二次打开
   ——她会发现昨晚和今晚的走势一模一样。

   ⚠️ 不存 openid 明文：只存它的哈希。这个集合里不该有任何能回指到人的东西。
   连"谁在线"都不该知道，只需要知道"有几个"。 */
const cloud = require('wx-server-sdk');
const crypto = require('crypto');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;
const COL = 'online';
const WINDOW = 90 * 1000;   // 90 秒内心跳过的算在场（前端 30 秒一次，容得下两次丢包）

exports.main = async () => {
  const now = Date.now();
  try {
    const id = crypto.createHash('sha256')
      .update((cloud.getWXContext().OPENID || '') + 'ebbing')   // 加盐，防彩虹表反查
      .digest('hex').slice(0, 32);
    /* 用哈希当 _id：同一个人反复心跳只占一行，不用先查再写 */
    await db.collection(COL).doc(id).set({ data: { t: now } });
    const r = await db.collection(COL).where({ t: _.gt(now - WINDOW) }).count();
    return { ok: true, n: r.total };
  } catch (e) {
    /* 集合没建、权限没开、网络抖——都不该让调用方拿到脏数据。
       返回 ok:false，前端自己决定显示什么。 */
    return { ok: false, err: String((e && e.errMsg) || e) };
  }
};
