import { createClient }   from '@/lib/supabase/server';
import { redirect }        from 'next/navigation';
import ClientNav           from '@/components/client/ClientNav';
import BugReportButton     from '@/components/pt/BugReportButton';
import ErrorBoundary       from '@/components/ErrorBoundary';

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
      <ErrorBoundary label="Client Portal">
        {children}
      </ErrorBoundary>
      {isOwnPortal && <ClientNav clientId={clientId} />}
      {isOwnPortal && <BugReportButton userId={user.id} userEmail={user.email ?? ''} />}
    </>
  );
}
