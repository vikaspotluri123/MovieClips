// @ts-expect-error
import {env} from 'node:process';
import {defineConfig} from 'vite';

export default defineConfig({
  base: env.BASE_URL,
});
