# dsh-session-summary

DSH 插件：会话列表的标题用 LLM 生成的「全量总结」，而不是第一句原文。

- 会话创建时自动总结一次（`automatic: "first-prompt"`），生成固定标题
- 之后不随每条新消息自动更新，省 token
- 在输入框发 `/retitle`，可用整个会话重新总结标题

## 安装（单文件插件）

把 `session-summary.mjs` 放到 profile 目录（如 `~/.dsh/profiles/desktop/`），在
`cordis.patch.yml` 追加：

```yaml
- insert:
    - id: session-summary
      name: ./session-summary.mjs
```

重启 DSH 生效。

## 配置

| 键 | 说明 |
|---|---|
| `targetWords` / `targetCjkCharacters` | 标题目标长度（词数 / 中文字数） |
| `maxInputBytes` / `maxOutputTokens` / `timeoutMs` | 输入预算 / 输出上限 / 超时 |
| `provider` / `model` | 指定 LLM（成对出现，或同时省略用默认） |

## License

MIT
