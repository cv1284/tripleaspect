import { createClient } from '@/lib/supabase/server';
import { redirect }     from 'next/navigation';
import ClientNav        from '@/components/client/ClientNav';

interface Props {
  children:  React.ReactNode;
  params:    Promise<{ clientId: string }>;
}

export default async function PortalLayout({ children, params }: Props) {
  const { clientId } = await params;
  const supabase     = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const isOwnPortal = user.id === clientId;

  return (
    <>
      {children}
      {isOwnPortal && <ClientNav clientId={clientId} />}
    </>
  );
}
