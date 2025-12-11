// Fix: Removed reference to vite/client to resolve "Cannot find type definition file"
// Fix: Removed process declaration to resolve "Cannot redeclare block-scoped variable 'process'"

interface ImportMetaEnv {
  readonly VITE_FUNCTIONS_BASE_URL: string;
  readonly VITE_GEMINI_API_KEY: string;
  [key: string]: any;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
