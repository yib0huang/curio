import type { ModelSettings } from "../../shared/types";

const DEFAULT_SETTINGS: ModelSettings = {
  apiUrl: "https://api.openai.com/v1/responses",
  apiKey: "",
  model: "gpt-5.6-sol"
};

/** 封装模型设置的浏览器本地持久化。 */
export class SettingsRepository {
  /** 读取设置并用默认值补齐缺失字段。 */
  async load(): Promise<ModelSettings> {
    return {
      ...DEFAULT_SETTINGS,
      ...(await chrome.storage.local.get(DEFAULT_SETTINGS))
    };
  }

  /** 保存经过界面校验的完整设置。 */
  async save(settings: ModelSettings): Promise<void> {
    await chrome.storage.local.set(settings);
  }
}
