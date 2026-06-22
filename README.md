# JP-Typing-Reader

双语轻小说打字阅读器 - 一款专为日语学习者设计的 Web 应用，通过"双语对照阅读+沉浸式打字练习"模式提升阅读能力。

## 功能特性

- 📚 **双书导入** - 同时导入日语原文和中文译文 EPUB 文件
- 🔗 **智能对齐** - 自动段落对齐算法，支持手动微调
- ⌨️ **打字练习** - 罗马音输入转换为假名/汉字，实时反馈
- 📝 **假名注音** - 汉字自动标注平假名读音
- 📖 **双语对照** - 同步滚动的双栏对照阅读界面
- 📊 **进度管理** - 自动保存阅读进度
- 📔 **生词本** - 错词收集与复习功能

## 技术栈

- React 18 + TypeScript
- Vite
- Tailwind CSS
- Zustand (状态管理)
- epub.js + jszip (EPUB 解析)
- idb (IndexedDB 封装)

## 快速开始

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

访问 http://localhost:5173 查看应用。

### 构建生产版本

```bash
npm run build
```

### 代码检查

```bash
# TypeScript 类型检查
npm run check

# ESLint 检查
npm run lint
```

## 使用说明

1. **导入书籍**
   - 点击上传区域，分别选择日语原文 EPUB 和中文译文 EPUB 文件
   - 支持 EPUB 2.0/3.0 格式

2. **对齐调整**
   - 系统自动进行段落对齐
   - 如需手动调整，点击左侧日文段落，再点击右侧对应的中文段落进行关联
   - 支持解除错误关联

3. **开始阅读**
   - 左侧显示日语原文（带注音），右侧显示中文译文
   - 开始输入罗马音即可开始打字练习
   - 输入正确时字符自动转换，错误时显示提示
   - 使用空格键确认当前输入

4. **查看生词**
   - 阅读过程中输入错误的单词会被自动收录
   - 在生词本页面可以查看、搜索和管理生词

## 项目结构

```
src/
├── components/     # UI 组件
├── pages/          # 页面
│   ├── ImportPage.tsx   # 导入页
│   ├── AlignPage.tsx    # 对齐页
│   ├── ReaderPage.tsx   # 阅读练习页
│   └── VocabPage.tsx    # 生词本页
├── stores/         # Zustand 状态管理
├── utils/          # 工具函数
│   ├── epub.ts         # EPUB 解析
│   ├── aligner.ts      # 对齐算法
│   ├── furigana.ts     # 注音处理
│   ├── romaji.ts       # 罗马音转换
│   └── database.ts      # IndexedDB 操作
└── types/          # TypeScript 类型定义
```

## 浏览器兼容性

- Chrome 90+
- Firefox 88+
- Edge 90+
- Safari 14+

## 许可证

MIT
