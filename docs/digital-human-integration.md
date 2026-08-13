# 真人数字人接入说明

本项目已在学生端 `智能辅导` 页面加入真人数字人助教位。

## 接入位置

- 页面：`web/src/pages/AiAssistantChatPage.tsx`
- 数字人组件：`web/src/components/digital-human/DigitalHumanCoach.tsx`
- 样式：`web/src/components/digital-human/DigitalHumanCoach.css`

## 工作方式

1. 学生在智能辅导页提问。
2. AI 对话组件获得完整回复。
3. `AiChatPanel` 通过 `onAssistantReply` 把最后一条 AI 回复传给数字人组件。
4. 数字人组件调用魔珐星云 SDK 的播报能力，让真人数字人同步讲解。

## 配置方式

在 `web` 目录下复制环境变量示例：

```powershell
cd "<提交包根目录>\02_作品源码\web"
Copy-Item .env.example .env.local
notepad .env.local
```

填写：

```text
VITE_XINGYUN_APP_ID=你的魔珐星云AppID
VITE_XINGYUN_APP_SECRET=你的魔珐星云AppSecret
VITE_XINGYUN_DRIVER_ID=你的数字人形象或驱动应用ID
VITE_XINGYUN_VOICE_ID=你的音色ID
VITE_XINGYUN_EMBED_URL=魔珐星云控制台提供的可嵌入页面地址
```

如果控制台提供的是 SDK 参数，优先填写 `VITE_XINGYUN_APP_ID` 和 `VITE_XINGYUN_APP_SECRET`。形象 ID 和音色 ID 可根据魔珐星云控制台实际提供情况填写。

如果控制台提供的是可嵌入页面地址，填写 `VITE_XINGYUN_EMBED_URL` 即可。页面会优先使用该地址嵌入真人数字人。

## 降级策略

如果没有配置魔珐星云参数，或 SDK 因网络原因加载失败，页面会自动切换为真人助教演示位，不影响智能辅导页面继续使用。

这样做的目的有两个：

- 未配置数字人时页面不会出现空白区域。
- 真正拿到魔珐星云完整参数后，不需要重写前端，只需要填写 `.env.local` 即可启用。
