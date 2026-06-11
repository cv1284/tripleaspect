/**
 * Prints a Cookie header for the test PT/client account, for use with curl-based API audits.
 * Run: npx tsx --env-file=.env.local scripts/audit-session.ts [pt|client]
 */
import { createServerClient } from '@supabase/ssr';

const PT_EMAIL     = 'test.pt@brigid.local';
const CLIENT_EMAIL = 'test.client@brigid.local';
const PASSWORD     = 'TestPass123!';

async function main() {
  const which = process.argv[2] === 'client' ? CLIENT_EMAIL : PT_EMAIL;

  const jar = new Map<string, string>();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll()  { return [...jar.entries()].map(([name, value]) => ({ name, value })); },
        setAll(cookiesToSet: { name: string; value: string }[]) {
          for (const { name, value } of cookiesToSet) jar.set(name, value);
        },
      },
    },
  );

  const { data, error } = await supabase.auth.signInWithPassword({ email: which, password: PASSWORD });
  if (error || !data.session) {
    console.error('Login error:', error?.message);
    process.exit(1);
  }

  console.error(`User ID: ${data.user!.id}`);
  console.log([...jar.entries()].map(([name, value]) => `${name}=${value}`).join('; '));
}

main();
