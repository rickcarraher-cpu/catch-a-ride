import tailwindcss from 'tailwindcss';
import { fileURLToPath } from 'node:url';
export default { plugins: [tailwindcss({
  content: [fileURLToPath(new URL('./src/**/*.{js,ts,jsx,tsx}', import.meta.url))],
  corePlugins: { preflight: false },
  theme: { extend: { fontFamily: { inter: ['Inter', 'system-ui', 'sans-serif'] } } },
})] };
