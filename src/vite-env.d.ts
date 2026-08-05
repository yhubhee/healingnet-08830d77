/// <reference types="vite/client" />

// MCP tool modules run in a Node/Deno-compatible runtime where `process` exists.
declare const process: { env: Record<string, string | undefined> };
