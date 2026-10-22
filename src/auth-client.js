import { createAuthClient } from "@neondatabase/neon-js/auth";
export const neonAuth = import.meta.env.VITE_NEON_AUTH_URL
  ? createAuthClient(import.meta.env.VITE_NEON_AUTH_URL, {
      fetchOptions: { credentials: "include" },
    })
  : null;
