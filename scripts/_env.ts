// Load .env / .env.local the same way `next dev` does. Import this FIRST in any script.
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");
