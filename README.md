# Game Lab V2

Describe a game. Play it in minutes.

这不是「AI 帮你写 Phaser 代码」。用户描述想要的游戏，系统先选出模板、生成 **Game Spec**，再在浏览器里跑起来。之后每一句对话都是对 Spec 的增量补丁，而不是整盘重写。

## 产品 Loop

1. 首页只做一件事：Create Game
2. 选择类型 / 风格 / 难度，写一句话
3. Planner 生成结构化 Game Spec
4. 对应模板在 Phaser 里运行
5. 右侧聊天修改 Spec（换主角、降难度、加商店…）
6. 版本历史可回退
7. 发布到本机可玩页

## 第一版范围

游戏类型：横版跳跃、俯视 RPG、塔防  
视觉风格：像素、卡通、动漫、黑暗奇幻、赛博朋克  
不做 3D，不让模型从零生成整个项目。

## 和 V1 的关系

[Game Lab](../game-lab) 验证了：Next.js + Phaser 4 浏览器预览、风格切换要整盘重挂、小游戏导出要走 `compileType: "game"`。V2 把这些经验收进创作操作系统，示例站本身不再是首页。

## 开发

```bash
npm install
npm run dev
```

打开 http://localhost:3000
