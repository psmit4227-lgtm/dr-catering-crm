'use client';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const NAVY     = '#1B2845';
const TEXT_SEC = '#5C6478';
const BORDER   = '#E5E7EB';

const TABS = [
  { label: 'New Order',      href: '/' },
  { label: 'Orders History', href: '/orders' },
  { label: 'Dashboard',      href: '/dashboard' },
  { label: 'Logistics',      href: '/logistics' },
];

export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  return (
    <nav className="nav-root" style={{
      background: '#FFFFFF',
      display: 'flex',
      alignItems: 'center',
      padding: '0 24px',
      borderBottom: `1px solid ${BORDER}`,
      flexShrink: 0,
    }}>
      <div className="nav-brand" style={{
        fontWeight: 600,
        color: NAVY,
        fontSize: 13,
        marginRight: 28,
        flexShrink: 0,
        letterSpacing: '3px',
        textTransform: 'uppercase',
      }}>
        DR Catering
      </div>

      <div className="nav-tabs" style={{ display: 'flex', flex: 1 }}>
        {TABS.map(tab => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              style={{
                color: active ? NAVY : TEXT_SEC,
                textDecoration: 'none',
                fontSize: 14,
                fontWeight: active ? 600 : 400,
                padding: '14px 16px',
                borderBottom: active ? `2px solid ${NAVY}` : '2px solid transparent',
                display: 'inline-block',
                whiteSpace: 'nowrap',
                transition: 'color 0.15s',
              }}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      <button
        className="nav-signout"
        onClick={handleSignOut}
        style={{
          background: 'transparent',
          border: `1px solid ${NAVY}`,
          borderRadius: 8,
          padding: '6px 14px',
          fontSize: 13,
          fontWeight: 500,
          color: NAVY,
          cursor: 'pointer',
          flexShrink: 0,
          transition: 'background 0.15s',
        }}
      >
        Sign out
      </button>
    </nav>
  );
}
