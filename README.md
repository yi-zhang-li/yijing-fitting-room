# 衣镜 · AI 试穿工作室

首次进入没有预置图片。上传本人照与衣物图，选择单件分析或两件对比，从场合、轮廓、衬色和明暗四个角度辅助选择。V0.4 支持在人物照片上选取参考色，再按「明暗呼应」或「拉开明暗」更新搭配建议。颜色取样在浏览器内完成，取样效果受照片光线影响。

## Windows 本地运行

安装 Node.js 22.13+ 后，在本目录打开 PowerShell：

```powershell
npm ci
npm run dev
```

浏览器访问 [http://localhost:3000](http://localhost:3000)。照片预览、取色、规则推荐和本机衣橱无需密钥。

## 开启 AI 生成

将 `.env.example` 复制为 `.env.local`，在本机文件或服务器的秘密变量里设置 `FASHN_API_KEY`，然后重启服务。只有确认并发起试穿后，相关照片才会发送给 FASHN。图片预览保留在当前页面会话。部署到公网前，请使用托管平台的访问保护来限制谁能调用付费的生成接口。

## 推送到 GitHub

先在 GitHub 新建私有空仓库，仓库名可用 `yijing-fitting-room`，然后在解压后的项目目录运行：

```powershell
git init -b main
git add .
git commit -m "Publish Yijing fitting room v0.4"
git remote add origin https://github.com/你的用户名/yijing-fitting-room.git
git push -u origin main
```

请替换命令中的用户名，并在 Git 提示时用你自己的 GitHub 账号登录。GitHub 仓库用于保存源码。网站和试穿接口可以部署到支持 Next.js 服务端的平台：

```powershell
npm ci
npm run build
npm start
```

## V0.4 功能
首页空白。支持单件试穿和两件对比，以及六类衣物和七种场景。我的衣橱可主动收藏最多12件衣物，保存于本机浏览器，可搜索、筛选、删除和选入试穿。当前服务端仍需 FASHN_API_KEY 才能生成真实试穿图。
