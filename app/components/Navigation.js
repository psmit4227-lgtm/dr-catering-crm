'use client';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const FONT = 'Calibri, Georgia, serif';

const TABS = [
  { label: 'New Order',      href: '/' },
  { label: 'Orders History', href: '/orders' },
  { label: 'Dashboard',      href: '/dashboard' },
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
      background: '#0f1214',
      display: 'flex',
      alignItems: 'center',
      padding: '0 20px',
      borderBottom: '1px solid #1e2226',
      flexShrink: 0,
    }}>
      <div className="nav-brand" style={{
        fontFamily: FONT, fontWeight: 700, color: '#fff',
        fontSize: 15, marginRight: 20, flexShrink: 0, letterSpacing: 0.3,
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
                color: active ? '#fff' : '#777',
                textDecoration: 'none',
                fontFamily: FONT,
                fontSize: 13,
                fontWeight: active ? 600 : 400,
                padding: '13px 14px',
                borderBottom: active ? '2px solid #c0392b' : '2px solid transparent',
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
          border: '1px solid #2e3336',
          borderRadius: 7,
          padding: '5px 12px',
          fontSize: 12,
          fontWeight: 600,
          color: '#666',
          cursor: 'pointer',
          fontFamily: FONT,
          flexShrink: 0,
        }}
      >
        Sign out
      </button>
    </nav>
  );
}
