# scripts

各 APP 自动化 / 签到脚本合集（可公开订阅）。

> Cookie / Token 属于个人凭证，请勿提交到本仓库。仅供学习交流。

## 目录

```text
scripts/
├── README.md
├── LICENSE
└── loon/
    ├── cmcc_checkin.plugin
    └── cmcc_checkin.js
```

后续新脚本按「一个功能一对文件」放进 `loon/`（或其他平台目录）。

---

## 中国移动签到（Loon）

### 订阅

```text
https://raw.githubusercontent.com/fengci/scripts/main/loon/cmcc_checkin.plugin
```

### 使用

1. 安装并信任 Loon CA，确认 MitM 含 `wx.10086.cn`
2. 打开 **中国移动 APP** 活动页 → 自动抓 Cookie（仅 TOKEN 变化才通知）
3. 定时默认每天 `8:10`；也可在脚本 `中国移动签到` 里点运行

插件内仅 2 个脚本：

| 脚本 | 作用 |
|------|------|
| 中国移动签到Cookie | 自动抓 Cookie |
| 中国移动签到 | 定时 / 手动签到 |

### 通知

| 情况 | 通知 |
|------|------|
| 新签成功 | `✅ 签到成功` · `本月已签 N 天` |
| 今日已签 | `✅ 今日已签到` · `本月已签 N 天` |
| Cookie 失效 | `❌ Cookie 失效` |
| 网络失败 | `❌ 签到失败` |

### 说明

- `$httpClient.timeout` 单位为**毫秒**；直连使用 `node: "DIRECT"`
- 插件已配置 `10086.cn` 直连与 `real-ip`，减少 Fake-IP 超时

## 免责声明

与各 APP / 服务商无关联。使用后果自负。
