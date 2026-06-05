/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Django/DRF API base, e.g. http://localhost:8000/api */
  readonly VITE_API_BASE_URL?: string
  /** Optional WebSocket base override. */
  readonly VITE_WS_BASE_URL?: string
  /** Restaurant the root storefront serves (overridable per-URL with ?r=). */
  readonly VITE_DEFAULT_RESTAURANT_ID?: string
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  readonly VITE_RAZORPAY_KEY_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
