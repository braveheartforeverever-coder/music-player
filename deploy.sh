#!/bin/bash

# 推送音乐播放器到 GitHub

cd /Users/heart/opencode/music-player

echo "正在推送代码到 GitHub..."
echo "如果需要认证，请输入你的 GitHub 用户名和密码（或 Personal Access Token）"
echo ""

git push -u origin main

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ 代码推送成功！"
    echo ""
    echo "下一步：启用 GitHub Pages"
    echo "1. 访问: https://github.com/braveheartforeverever-coder/music-player/settings/pages"
    echo "2. 在 'Source' 下拉菜单中选择 'main' 分支"
    echo "3. 点击 'Save'"
    echo "4. 等待 1-2 分钟后，访问你的网站："
    echo "   https://braveheartforeverever-coder.github.io/music-player/"
    echo ""
else
    echo ""
    echo "❌ 推送失败，请检查认证信息"
fi
