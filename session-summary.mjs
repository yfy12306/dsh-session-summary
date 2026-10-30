/**
 * DSH 插件：会话「全量总结」标题 + /retitle 手动刷新命令。
 *
 * 需求：让会话列表显示的标题是本次对话的「简单总结」，而不是让人第一句的生硬原文。
 * 策略（用户选择「手动刷新才更新」）：
 *   - 会话创建时用 LLM 自动总结一次（automatic: "first-prompt"），生成一个固定标题；
 *   - 之后不随每条新消息自动更新，省 token；
 *   - 用户在输入框发 `/retitle` 即可用「整个会话」重新总结标题。
 */
import z from "@deepseek-ai/schemastery";
import { SessionTitleLlmConfigFields, registerSessionTitleLlmProvider } from "@deepseek-ai/dsh-session-title-llm";

const name = "session-summary";
const inject = ["sessionTitle", "llm", "commands"];

/** 与 first-prompt-llm 相同的必填/可选配置（provider/model 成对出现或同时省略）。 */
const Config = z.object({
  targetWords: SessionTitleLlmConfigFields.targetWords,
  targetCjkCharacters: SessionTitleLlmConfigFields.targetCjkCharacters,
  maxInputBytes: SessionTitleLlmConfigFields.maxInputBytes,
  maxOutputTokens: SessionTitleLlmConfigFields.maxOutputTokens,
  timeoutMs: SessionTitleLlmConfigFields.timeoutMs,
  provider: SessionTitleLlmConfigFields.provider,
  model: SessionTitleLlmConfigFields.model
});

/**
 * 最终输入预算策略：按字节预算从「最近的消息」往前取，尽量覆盖整个会话，同时不超 maxInputBytes。
 * generateSessionTitleWithLlm 会再按 maxInputBytes 做硬校验，这里先做软预算，避免超限直接报错。
 */
function recentMessages(messages) {
  const budget = 30000;
  const chosen = [];
  let used = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    const size = Buffer.byteLength(JSON.stringify(messages[i]), "utf8");
    if (chosen.length > 0 && used + size > budget) break;
    chosen.unshift(messages[i]);
    used += size;
  }
  return chosen;
}

function apply(ctx, config) {
  // 1) 标题提供方：首次创建时总结一次，之后不自动更新（手动 /retitle）。
  registerSessionTitleLlmProvider(ctx, config, name, "first-prompt", recentMessages);

  // 2) 手动刷新命令：/retitle —— 用整个会话重新生成标题。
  const active = new Set();
  const handler = (invocation) => {
    const operation = (async () => {
      try {
        await ctx.sessionTitle.refresh(invocation.agent.session, invocation.signal);
        const title = ctx.sessionTitle.get(invocation.agent.session);
        return {
          kind: "success",
          text: title ? `标题已更新：${title}` : "标题已更新"
        };
      } catch (error) {
        if (invocation.signal.aborted) return { kind: "error", text: "已取消。" };
        return {
          kind: "error",
          text: `重新总结失败：${error?.message ?? String(error)}`
        };
      }
    })();
    active.add(operation);
    const retire = () => active.delete(operation);
    operation.then(retire, retire);
    return operation;
  };

  ctx.effect(function* () {
    yield async () => {
      await Promise.allSettled([...active]);
    };
    yield ctx.commands.register({
      name: "retitle",
      description: "重新总结当前对话的标题",
      handler
    });
  }, "session-summary: retitle command");
}

export { Config, apply, inject, name };