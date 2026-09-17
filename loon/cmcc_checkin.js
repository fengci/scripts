/**
 * 中国移动 APP / 移动营业厅每日签到（Loon）
 * https://github.com/fengci/scripts
 *
 * 依据官方文档：
 * - https://nsloon.app/docs/Script/script_api
 * - https://nsloon.app/docs/Script/script_v2
 * - https://nsloon.app/docs/Plugin/
 *
 * 关键点：
 * - $httpClient.timeout 单位是毫秒（默认 5000）
 * - 指定直连用 node: "DIRECT"（不是 policy）
 * - $argument 未配置时可能是 undefined / null
 */

var NAME = "中国移动签到";
var BASE = "https://wx.10086.cn/qwhdhub/api/mark";
var STORE_KEY = "CMCC_QWHD_COOKIE";
var TOKEN_KEY = "CMCC_QWHD_TOKEN";
var UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) " +
  "AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148/wkwebview " +
  "leadeon/12.5.4/CMCCIT";

// 文档：timeout 默认 5000ms；这里给足 20s
var HTTP_TIMEOUT_MS = 20000;

if (typeof $request !== "undefined" && $request && $request.headers) {
  captureCookie();
} else {
  checkin();
}

function captureCookie() {
  try {
    var headers = lowerHeaders($request.headers || {});
    var cookie = headers.cookie || "";
    var token = extractToken(cookie);
    if (!token) {
      $done({});
      return;
    }

    var oldCookie = $persistentStore.read(STORE_KEY) || "";
    var oldToken = $persistentStore.read(TOKEN_KEY) || extractToken(oldCookie);

    // Cookie 里统计字段经常变，完整串不相等很常见；只在 TOKEN 变化时通知
    if (cookie !== oldCookie) {
      $persistentStore.write(cookie, STORE_KEY);
    }
    if (token !== oldToken) {
      $persistentStore.write(token, TOKEN_KEY);
      $notification.post(NAME, "Cookie 已更新", "");
      console.log("[" + NAME + "] TOKEN 已更新");
    } else {
      console.log("[" + NAME + "] Cookie 静默刷新（TOKEN 未变）");
    }
  } catch (e) {
    console.log("[" + NAME + "] Cookie 抓取失败：" + e);
  }
  $done({});
}

function extractToken(cookie) {
  if (!cookie) return "";
  var m = String(cookie).match(/(?:^|;\s*)QWHD_SESSION_TOKEN=([^;]+)/);
  return m ? decodeURIComponent(m[1].trim()) : "";
}

function checkin() {
  var cookie = resolveCookie();
  if (!cookie || !extractToken(cookie)) {
    notifyResult("❌ Cookie 失效", "请重新打开移动 APP 活动页");
    return;
  }

  var domarkCls = "unknown";
  var monthCount = "";
  var date = todayYmd();
  var debug = [];

  postJson("/user/info", cookie, {}, function (err, resp) {
    if (err) {
      debug.push("info:" + err);
    } else {
      var cls = classify(resp.body);
      debug.push("info:" + cls);
      if (cls === "invalid" || cls === "html") {
        notifyResult("❌ Cookie 失效", "请重新打开移动 APP 活动页");
        return;
      }
    }

    postJson("/mark31/domark", cookie, { date: date }, function (err2, resp2) {
      if (err2) {
        domarkCls = "error";
        debug.push("domark:" + err2);
      } else {
        domarkCls = classify(resp2.body);
        debug.push("domark:" + domarkCls);
      }

      postJson("/mark31/markstatus", cookie, {}, function (err3, resp3) {
        if (err3) {
          debug.push("status:" + err3);
        } else {
          monthCount = parseMarkCount(resp3.body);
          debug.push("days:" + (monthCount || "?"));
        }
        notifyCheckin(domarkCls, monthCount, debug);
      });
    });
  });
}

function notifyCheckin(domarkCls, monthCount, debug) {
  var days = monthCount || "?";
  var title = NAME;
  var subtitle = "";
  var body = "";

  if (domarkCls === "success") {
    subtitle = "✅ 签到成功";
    body = "本月已签 " + days + " 天";
  } else if (domarkCls === "already") {
    subtitle = "✅ 今日已签到";
    body = "本月已签 " + days + " 天";
  } else if (domarkCls === "invalid" || domarkCls === "html") {
    subtitle = "❌ Cookie 失效";
    body = "请重新打开移动 APP 活动页";
  } else if (domarkCls === "error") {
    subtitle = "❌ 签到失败";
    body = "网络异常，请稍后重试";
  } else {
    subtitle = "❌ 签到失败";
    body = "本月已签 " + days + " 天";
  }

  console.log("[" + NAME + "] " + subtitle + " | " + body + " | " + debug.join("; "));
  $notification.post(title, subtitle, body);
  $done();
}

function notifyResult(subtitle, body) {
  console.log("[" + NAME + "] " + subtitle + " | " + body);
  $notification.post(NAME, subtitle, body || "");
  $done();
}

function resolveCookie() {
  var arg = readArgument();
  // 插件对象参数：{ cookie: "..." }
  if (arg && typeof arg === "object") {
    if (arg.cookie) return String(arg.cookie).trim();
  }
  // 字符串参数：cookie=...
  if (typeof arg === "string" && arg) {
    var parsed = parseCookieArgument(arg);
    if (parsed) return parsed;
  }
  var stored = $persistentStore.read(STORE_KEY);
  return stored ? String(stored).trim() : "";
}

// 文档：$argument 未配置时可能是 undefined 或 null
function readArgument() {
  var argument = typeof $argument === "undefined" ? null : $argument;
  return argument;
}

function parseCookieArgument(text) {
  text = String(text).trim();
  if (!text) return "";
  if (text.charAt(0) === "{") {
    try {
      var obj = JSON.parse(text);
      if (obj && obj.cookie) return String(obj.cookie).trim();
    } catch (e) {}
  }
  var m = text.match(/^cookie\s*=\s*([\s\S]+)$/i);
  if (m) return m[1].trim();
  // 整段直接当 Cookie
  if (text.indexOf("QWHD_SESSION_TOKEN") !== -1) return text;
  return "";
}

function buildHeaders(cookie) {
  return {
    "User-Agent": UA,
    Accept: "*/*",
    "Content-Type": "application/json;charset=UTF-8",
    Origin: "https://wx.10086.cn",
    Referer: "https://wx.10086.cn/",
    "login-check": "1",
    "x-requested-with": "XMLHttpRequest",
    Cookie: cookie,
  };
}

function lowerHeaders(headers) {
  var out = {};
  Object.keys(headers || {}).forEach(function (k) {
    out[k] = headers[k];
    out[String(k).toLowerCase()] = headers[k];
  });
  return out;
}

/**
 * 官方 API：
 * - timeout：毫秒
 * - node：可指定 "DIRECT"
 */
function postJson(path, cookie, body, cb) {
  var opts = {
    url: BASE + path,
    headers: buildHeaders(cookie),
    body: JSON.stringify(body || {}),
    timeout: HTTP_TIMEOUT_MS,
    node: "DIRECT",
    "auto-redirect": true,
  };
  $httpClient.post(opts, function (error, response, data) {
    if (error) {
      cb(stringifyErr(error), null);
      return;
    }
    cb(null, {
      status: (response && response.status) || 0,
      body: data == null ? "" : String(data),
    });
  });
}

function stringifyErr(err) {
  if (err == null) return "(null)";
  if (typeof err === "string") return err;
  if (err.message) return err.message;
  try {
    return JSON.stringify(err);
  } catch (e) {
    return String(err);
  }
}

function todayYmd() {
  var d = new Date();
  var m = String(d.getMonth() + 1);
  if (m.length < 2) m = "0" + m;
  var day = String(d.getDate());
  if (day.length < 2) day = "0" + day;
  return "" + d.getFullYear() + m + day;
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
}

function classify(body) {
  var text = body || "";
  var lower = text.trim().toLowerCase();
  if (lower.indexOf("<!doctype html") === 0 || lower.indexOf("<html") === 0) return "html";

  var obj = safeJson(text);
  if (obj) {
    var code = String(obj.code || obj.retCode || obj.resultCode || "").toUpperCase();
    var status = String(obj.status || "").toUpperCase();
    var msg = String(obj.msg || obj.message || obj.retMsg || "");
    if (
      status === "HAVE_MARKED" ||
      msg.indexOf("已签到") !== -1 ||
      msg.indexOf("今日已签到") !== -1 ||
      msg.indexOf("无法再次签到") !== -1
    ) {
      return "already";
    }
    if (code === "SUCCESS" || code === "0" || code === "0000") return "success";
    var blob = msg + status + code;
    if (
      blob.indexOf("登录") !== -1 ||
      blob.indexOf("失效") !== -1 ||
      blob.indexOf("过期") !== -1 ||
      blob.indexOf("鉴权") !== -1 ||
      blob.indexOf("认证") !== -1 ||
      blob.indexOf("token") !== -1
    ) {
      return "invalid";
    }
    if (code || status || msg) return "failed";
  }
  if (text.indexOf("已签到") !== -1 || text.indexOf("无法再次签到") !== -1) return "already";
  if (text.indexOf("SUCCESS") !== -1 || text.indexOf("签到成功") !== -1) return "success";
  if (text.indexOf("登录") !== -1 || text.indexOf("失效") !== -1 || text.indexOf("过期") !== -1) {
    return "invalid";
  }
  return "unknown";
}

function shortBody(body) {
  var obj = safeJson(body);
  if (obj) {
    var parts = [];
    ["code", "status", "msg", "success"].forEach(function (k) {
      if (Object.prototype.hasOwnProperty.call(obj, k)) parts.push(k + "=" + obj[k]);
    });
    if (parts.length) return parts.join("；");
    try {
      return JSON.stringify(obj).slice(0, 300);
    } catch (e) {
      return "(无法序列化)";
    }
  }
  var t = (body || "").trim();
  return t ? t.slice(0, 300) : "(空响应)";
}

function parseUserInfo(body) {
  var obj = safeJson(body);
  var data = (obj && obj.data) || {};
  if (!data.nickName && !data.activityId) return "";
  return "账号：" + (data.nickName || "未知") + "｜activityId：" + (data.activityId || "未知");
}

function parseMarkCount(body) {
  var obj = safeJson(body);
  var data = (obj && obj.data) || {};
  var user = data.userinfo || {};
  return user.accumulateTimes != null ? String(user.accumulateTimes) : "";
}

function parseMarkStatus(body) {
  var obj = safeJson(body);
  var data = (obj && obj.data) || {};
  var today = todayYmd();
  var markList = data.markstatus || [];
  var hit = null;
  for (var i = 0; i < markList.length; i++) {
    if (markList[i] && markList[i].date === today) {
      hit = markList[i];
      break;
    }
  }
  var count = parseMarkCount(body);
  var parts = [];
  if (hit) parts.push("今日状态=" + hit.status);
  if (count) parts.push("当月签到次数=" + count);
  return parts.length ? parts.join("｜") : shortBody(body);
}
