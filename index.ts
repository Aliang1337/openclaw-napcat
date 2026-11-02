import type { OpenClawPluginApi } from "openclaw/plugin-sdk/core";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk/core";
import { napCatPlugin } from "./src/channel.js";
import { setNapCatRuntime } from "./src/runtime.js";

const plugin = {
  id: "napcat",
  name: "QQ (NapCat)",
  description: "QQ channel plugin via NapCat (OneBot 11 reverse WebSocket)",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    setNapCatRuntime(api.runtime);
    api.registerChannel({ plugin: napCatPlugin });
  },
};

export default plugin;
