import { getAssetFromKV } from '@cloudflare/kv-asset-handler';

export default {
  async fetch(request, env, ctx) {
    try {
      return await getAssetFromKV(
        { request, waitUntil: p => ctx.waitUntil(p) },
        {
          ASSET_NAMESPACE: env.__STATIC_CONTENT,
          ASSET_MANIFEST: __STATIC_CONTENT_MANIFEST,
        }
      );
    } catch (e) {
      // kalau file tidak ketemu, bisa lanjut ke logic API kamu
      return new Response("Not found", { status: 404 });
    }
  },
};
