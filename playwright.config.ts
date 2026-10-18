import { defineConfig } from '@playwright/test';
import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());
export default defineConfig({testDir:'./tests/browser',fullyParallel:false,workers:1,timeout:45000,reporter:'list',use:{baseURL:process.env.BASE_URL||'http://localhost:3018',channel:'chrome',headless:true,trace:'off',screenshot:'only-on-failure'},webServer:process.env.BASE_URL?undefined:{command:'npm run dev -- --port 3018',url:'http://localhost:3018',reuseExistingServer:true,timeout:60000}});
