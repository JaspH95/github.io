import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // Only the public Supabase address and anon key reach the app. The service role key never does.
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
  return {
    build: { outDir: 'dist', target: 'es2020' },
    define: {
      __SUPABASE_URL__: JSON.stringify((env.SUPABASE_URL || '').trim()),
      __SUPABASE_ANON_KEY__: JSON.stringify((env.SUPABASE_ANON_KEY || '').trim()),
      // Set to 1 once Supabase sends email through your own SMTP and the template includes {{ .Token }}
      // Web push: the public half of the VAPID key pair (the private half stays in GitHub secrets)
      __VAPID_PUBLIC_KEY__: JSON.stringify((env.VAPID_PUBLIC_KEY || '').trim()),
      __SUPABASE_EMAIL_CODES__: JSON.stringify(env.SUPABASE_EMAIL_CODES === '1'),
    },
  };
});
