# jshhookmcp CTF 全量测试报告

**测试目标**: chat.qwen.ai (Qwen 官方授权)
**测试时间**: 2026-02-23
**测试工具**: jshhookmcp MCP Server

---

## 1. 测试概述

### 1.1 目标信息
- **URL**: https://chat.qwen.ai
- **标题**: Qwen Chat
- **用户状态**: 已登录 (Jerry Tomas)

### 1.2 测试工具统计
- **总工具调用**: 40 次
- **Token 使用**: 122,501 / 200,000 (61%)
- **测试工具数**: 25+ 个 MCP 工具

---

## 2. 浏览器自动化测试

### 2.1 浏览器启动
- **状态**: 成功
- **驱动**: Chrome (rebrowse-puppeteer)
- **版本**: Chrome/145.0.7632.76
- **页面数**: 1

### 2.2 反检测注入
- **User-Agent 设置**: Windows 平台
- **状态**: 成功

### 2.3 页面导航
- **目标**: https://chat.qwen.ai
- **状态**: 成功
- **加载时间**: 1.82 秒
- **资源数**: 78 个

---

## 3. 网络监控与 API 探测

### 3.1 网络统计
| 指标 | 数值 |
|------|------|
| 总请求数 | 500 |
| 总响应数 | 500 |
| GET 请求 | 452 |
| POST 请求 | 45 |
| 200 状态码 | 496 |
| 401 状态码 | 1 |
| 脚本数 | 296 |
| XHR 请求 | 43 |
| Fetch 请求 | 18 |

### 3.2 发现的主脚本
```
//assets.alicdn.com/g/qwenweb/qwen-chat-fe/0.2.7/js/main.js
```

### 3.3 XHR 断点设置
- **状态**: 成功
- **模式**: *qwen*
- **断点 ID**: xhr_1

---

## 4. 签名算法分析

### 4.1 发现的签名函数

#### etSign (单参数签名)
```javascript
// 函数定义
function(e){var a;return j(12,e,1,void 0,1,void 0)}

// 参数数量: 1
// 测试调用: etSign('test123')
// 输出: gLlsgMAF_Gj1gW89DG8FVbGu6FFffeRz5ZaxrqCNk5FTcZiqy-UN_FDjdmo_XmgDSrExDmZqQpRrSVV0MnoXaQuiYw_97fNA02FgujQULadrSVqcUMOtaQRX0OIaWonYBk3LrkUODlnY9JU8v1UA6rIpRrqLMtCTB63LorCYDmFvR2E3kSUtDRLIJk4YMoHHggzXulg6lfdWRIWedDECMshQWnq-5ka3-Xa_CueaAs3rOPw62Vh-IIa0JXlQUJ72EW3oLcUQNBWTw2MxVYnDU9VskAn0dcxhdkkKsqEYBZCrR4gteWh2ka2Ivrw8MJ_AM2Nid8GbwQIQ-v3ZHfm1lsUi_bybqJTAi-PKa8H-fZYoJ5Uxm8c2q1qtk4coU7OFB73IH0Mf4sfzVyGOhwwlGyZyRe6cn15bPmPmCtC0By4_OeTCfWeT-yZpRe6cARU35J8BRGwh.
```

#### LTKSign (多参数签名)
```javascript
// 函数定义
function(e,a,r,c){var s;return j(5,e,a,r,c)}

// 参数数量: 4
// 测试调用: LTKSign('test123','param2','param3')
// 输出: aByjj5Q2k7D6cKodC+rbiPzAr
```

### 4.2 Fetch 函数包装分析
```javascript
// fetch 被自定义包装
// 特征:
// - bx-ua 头部检测
// - isEffectUrl URL检查
// - preRequest 预处理
```

### 4.3 加密算法检测结果
在测试代码中检测到:
- **MD5**: Hash 算法 (有安全风险)
- **HMAC-SHA-256**: MAC 算法 (置信度 99%)
- **AES-CBC**: 对称加密算法 (置信度 96%)
- **CryptoJS 库**: 加密库 (置信度 90%)

---

## 5. 调试器功能测试

### 5.1 调试器状态
- **启用状态**: 成功
- **暂停状态**: 未暂停

### 5.2 全局代码执行
成功执行多条 JavaScript 表达式:
- `window.location.href`
- `document.cookie`
- `localStorage` 数据
- 签名函数调用

### 5.3 调试器会话
- **会话保存**: 成功
- **保存路径**: `debugger-sessions/session-1771821868950.json`
- **已有会话**: 2 个

---

## 6. DOM 分析测试

### 6.1 可点击元素
- **总数**: 23 个
- **可见元素**:
  - `#sidebar-toggle-button` - 侧边栏切换
  - `button.user-menu-btn` - 用户菜单 (Jerry Tomas)
  - `#voice-input-button` - 语音输入
  - `button.ant-btn` - 发送按钮

### 6.2 DOM 结构
- **结构大小**: 61.1KB
- **深度**: 2 层 (配置限制)
- **详情 ID**: detail_1771821838752_o2kxh5u

---

## 7. Hook 系统测试

### 7.1 生成的 Hooks
| Hook ID | 类型 | 状态 |
|---------|------|------|
| ai-hook-1-1771821742428 | Fetch API | 生成成功 |
| ai-hook-2-1771821749685 | XMLHttpRequest | 生成成功 |
| ai-hook-3-1771821757895 | crypto.subtle.encrypt | 不支持 |
| ai-hook-4-1771821757912 | atob | 不支持 |
| ai-hook-5-1771821923605 | localStorage.setItem | 不支持 |
| ai-hook-6-1771821923629 | WebSocket | 不支持 |
| ai-hook-7-1771821974018 | eval | 不支持 |

### 7.2 Hook 注入方法
- **方法**: evaluateOnNewDocument
- **存储**: window.__aiHooks

---

## 8. 代码分析测试

### 8.1 混淆检测
**测试代码**:
```javascript
var _0xabc1=['log','Hello','World'];(function(a,b){...}
```

**检测结果**:
- **类型**: javascript-obfuscator
- **置信度**: 90%
- **特征**:
  - String array with rotation
  - Control flow flattening

### 8.2 反混淆测试
- **工具**: deobfuscate, advanced_deobfuscate
- **状态**: 运行成功
- **优化**: AST 优化已应用

---

## 9. CTF 专项功能测试

### 9.1 IndexedDB 导出
- **数据库**: aes-survey
- **数据**: aes-survey-idb (空数组)
- **状态**: 成功

### 9.2 Webpack 模块枚举
- **状态**: 未发现 webpack 模块
- **可能原因**: 自定义打包或代码分割

### 9.3 框架状态提取
- **检测模式**: Auto
- **React/Vue 状态**: 未发现
- **状态**: 未找到框架状态

---

## 10. 安全信息收集

### 10.1 Cookies 数据
```
x-ap=cn-hongkong
cna=lcgiItKkDk8CAXAWUda7c1L5
cnaui=2f1711f0-61f5-4045-8d6f-1920970fe1ee
aui=2f1711f0-61f5-4045-8d6f-1920970fe1ee
atpsida=74e0f1ca4b03f1afb7143a3b_1771821747_4
tfstk=...
isg=...
```

### 10.2 LocalStorage
- **键数量**: 多个
- **包含**: APLUS 分析代码、主题设置、用户引导等

---

## 11. 维护工具测试

### 11.1 缓存统计
- **总条目**: 4
- **总大小**: 0.20 MB
- **命中率**: 0%
- **DetailedDataManager**: 4 条目, 0.20 MB

### 11.2 Token 预算统计
- **当前使用**: 122,501 / 200,000 (61%)
- **工具调用数**: 40 次
- **最高消耗工具**:
  - debugger_evaluate_global: 59,445 tokens (49%)
  - dom_find_by_text: 53,934 tokens (44%)

### 11.3 收集统计
- **缓存文件**: 0
- **缓存大小**: 0.00 KB
- **压缩率**: 0.0%
- **URL 收集**: 0

---

## 12. 关键发现总结

### 12.1 高价值发现
1. **签名函数**: 发现 `etSign` 和 `LTKSign` 两个签名函数
2. **签名算法**: 可以成功调用并获取签名值
3. **Fetch 包装**: 发现自定义 fetch 包装器，包含 bx-ua 检测
4. **用户会话**: 已获取完整 Cookies 和 LocalStorage 数据

### 12.2 安全特征
- bx-ua 头部验证
- URL 有效性检查 (isEffectUrl)
- 请求预处理 (preRequest)

### 12.3 API 发现
- 主脚本: assets.alicdn.com 托管
- 大量 XHR/Fetch 请求被监控
- 500+ 网络请求被捕获

---

## 13. 测试工具清单

### 已测试工具 (25+)
- [x] browser_launch
- [x] browser_status
- [x] stealth_set_user_agent
- [x] page_navigate
- [x] page_get_performance
- [x] captcha_detect
- [x] network_enable
- [x] network_get_stats
- [x] network_get_requests
- [x] debugger_enable
- [x] debugger_get_paused_state
- [x] debugger_evaluate_global
- [x] debugger_save_session
- [x] debugger_list_sessions
- [x] xhr_breakpoint_set
- [x] ai_hook_generate (7次)
- [x] detect_crypto
- [x] detect_obfuscation
- [x] deobfuscate
- [x] advanced_deobfuscate
- [x] dom_find_clickable
- [x] dom_get_structure
- [x] dom_query_all
- [x] dom_find_by_text
- [x] framework_state_extract
- [x] indexeddb_dump
- [x] webpack_enumerate
- [x] get_cache_stats
- [x] get_token_budget_stats
- [x] get_collection_stats

---

## 14. 结论与建议

### 14.1 测试成功项
1. 浏览器自动化 - 完全可用
2. 网络监控 - 捕获 500+ 请求
3. 调试器功能 - 可执行任意代码
4. 签名分析 - 成功发现并调用签名函数
5. DOM 分析 - 完整页面结构获取
6. Hook 系统 - 成功生成网络拦截代码
7. 代码分析 - 混淆检测和反混淆运行正常

### 14.2 限制
1. 部分 API Hook 不支持 (localStorage, WebSocket, crypto)
2. Webpack 模块未检测到
3. 未进行内存操作测试 (需要管理员权限)

### 14.3 CTF 应用价值
- **签名破解**: etSign/LTKSign 可调用分析
- **API 探测**: 完整网络请求捕获
- **代码分析**: 混淆检测和反混淆功能可用
- **动态调试**: 可实时执行 JavaScript

---

**报告生成时间**: 2026-02-23
**报告版本**: 1.0
