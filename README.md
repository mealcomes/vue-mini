# vue-mini

个人的简化版 Vue3 框架实现，采用 TypeScript 编写(其实还是JavaScript)，内包含大量注释，旨在帮助理解 Vue3 的核心原理与实现机制。项目结构和构建方式借鉴了 Vue3 的 Monorepo 方案，目前包含响应式系统（reactivity）、运行时核心（runtime-core）等模块。

> ⚠️ 本项目仍处于开发中，部分功能在不断完善。

## packages 目录结构

```
packages
├─ shared         # 存放各模块通用的工具函数与类型
├─ runtime-dom    # 实现 DOM 环境下的渲染、操作相关逻辑
├─ runtime-core   # 核心运行时代码，平台无关的逻辑都在这里实现
└─ reactivity     # Vue3 响应式系统的实现，包括响应式对象、依赖收集、Effect 等
```

## 安装与使用

1. 克隆项目：
   ```bash
   git clone https://github.com/mealcomes/vue-mini.git
   cd vue-mini
   ```

2. 安装依赖（需先安装 pnpm）：
   ```bash
   pnpm install
   ```

3. 启动开发调试：  
   - **reactivity 模块**
     ```bash
     pnpm run dev
     ```
   - **runtime-dom 模块**
     ```bash
     pnpm run dom
     ```

## 学习建议

建议启动开发调试后，结合各模块 `dist` 目录下的 `*.html` 文件（同样包含大量注释）学习，帮助更好地理解源码实现。

## 许可协议

ISC

## 感谢

- [Vue.js](https://github.com/vuejs/vue-next)：本项目是对 Vue3.5.14 源码的简化实现，感谢尤雨溪及 Vue 团队的无私贡献。
- [TypeScript](https://www.typescriptlang.org/)
- [pnpm](https://pnpm.io/)
- 以及所有开源社区的开发者们，感谢你们的知识共享。

如有建议或问题，欢迎 issue 交流。