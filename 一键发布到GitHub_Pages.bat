@echo off
chcp 65001 >nul
title 发布到 GitHub Pages

echo ========================================================
echo        ✨ PDF 划词翻译器 - 一键发布到 GitHub Pages
echo ========================================================
echo.
echo 准备将当前目录发布到你的 GitHub 仓库。
echo.
set /p REPO_URL="请输入你的 GitHub 仓库地址 (例如 https://github.com/your-name/pdf-translator.git): "

if "%REPO_URL%"=="" (
    echo 错误：未输入仓库地址！
    pause
    exit /b
)

echo.
echo [1/4] 初始化本地 Git 仓库...
git init
git branch -M main

echo [2/4] 添加文件...
git add .

echo [3/4] 提交变更...
git commit -m "Deploy PDF AI Translator to GitHub Pages"

echo [4/4] 推送到远程仓库...
git remote remove origin 2>nul
git remote add origin %REPO_URL%
git push -u origin main --force

echo.
echo ========================================================
echo ✅ 推送成功！
echo.
echo 接下来只需最后一步：
echo 1. 打开你的 GitHub 仓库网页
echo 2. 点击「Settings」-> 左侧「Pages」
echo 3. 在「Branch」处选择「main」分支，点击「Save」
echo 4. 等待 1 分钟即可访问：
echo    https://<你的用户名>.github.io/<仓库名>/
echo ========================================================
pause
