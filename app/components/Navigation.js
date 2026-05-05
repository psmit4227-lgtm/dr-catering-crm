'use client';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const FONT = 'Georgia, serif';

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
      background: '#f5f0e8',
      display: 'flex',
      alignItems: 'center',
      padding: '0 24px',
      borderBottom: '1px solid #c9a84c',
      flexShrink: 0,
    }}>
      <div className="nav-brand" style={{
        fontFamily: FONT,
        fontWeight: 700,
        color: '#1e1008',
        fontSize: 13,
        marginRight: 28,
        flexShrink: 0,
        letterSpacing: '4px',
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
                color: active ? '#1e1008' : '#8b6914',
                textDecoration: 'none',
                fontFamily: FONT,
                fontSize: 13,
                fontWeight: active ? 700 : 400,
                padding: '14px 16px',
                borderBottom: active ? '2px solid #c9a84c' : '2px solid transparent',
                display: 'inline-block',
                whiteSpace: 'nowrap',
                transition: 'color 0.15s',
                letterSpacing: '0.03em',
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
          border: '1px solid #c9a84c',
          borderRadius: 8,
          padding: '6px 14px',
          fontSize: 12,
          fontWeight: 600,
          color: '#8b6914',
          cursor: 'pointer',
          fontFamily: FONT,
          flexShrink: 0,
          letterSpacing: '0.04em',
          transition: 'background 0.15s',
        }}
      >
        Sign out
      </button>
    </nav>
  );
}
