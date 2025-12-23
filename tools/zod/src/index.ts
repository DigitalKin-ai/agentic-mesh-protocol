/**
 * protoc-gen-zod - Buf plugin for generating Zod schemas from Protocol Buffers
 *
 * This plugin generates TypeScript files containing Zod schemas that mirror
 * the structure of Protocol Buffer messages, with validation rules derived
 * from buf.validate annotations.
 */

import { createEcmaScriptPlugin, runNodeJs } from "@bufbuild/protoplugin";
import { generateZodSchemas, type PluginOptions } from "./generator.js";

/**
 * Plugin definition
 */
const protocGenZod = createEcmaScriptPlugin<PluginOptions>({
  name: "protoc-gen-zod",
  version: "v0.1.0",
  generateTs: generateZodSchemas,
  parseOptions(rawOptions): PluginOptions {
    const options: PluginOptions = {
      includeResponses: false,
    };

    for (const opt of rawOptions) {
      if (opt.key === "include_responses" && opt.value === "true") {
        options.includeResponses = true;
      }
      // Ignore target option (handled by protoplugin)
    }

    return options;
  },
});

// Run the plugin
runNodeJs(protocGenZod);
