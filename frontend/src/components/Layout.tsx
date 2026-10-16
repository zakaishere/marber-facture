import { ReactNode, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Package, ShoppingCart, FileText, LayoutDashboard, Users, Truck, LogOut, User as UserIcon, Menu, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from './ui/button';
import StoneBrand from './StoneBrand';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from './ui/sheet';

interface LayoutProps {
  children: ReactNode;
}

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Tableau de bord' },
  { path: '/products', icon: Package, label: 'Stock' },
  { path: '/bon-achat', icon: ShoppingCart, label: 'Bon d\'achat' },
  { path: '/factures', icon: FileText, label: 'Factures' },
  { path: '/suppliers', icon: Truck, label: 'Fournisseurs' },
  { path: '/clients', icon: Users, label: 'Clients' },
  { path: '/accounts', icon: Users, label: 'Comptes' },
];

const Layout = ({ children }: LayoutProps) => {
  const location = useLocation();
  const { user, logout } = useAuth();
  const restricted = user?.role === 'ROLE_INVOICING';
  const visibleNav = restricted ? navItems.filter(item => item.path === '/factures') : navItems;
  const mobileTabs = restricted ? [{ path: '/factures', icon: FileText, label: 'Factures' }, { path: '/factures/new', icon: Plus, label: 'Créer' }] : navItems.filter(item => ['/', '/products', '/factures', '/bon-achat'].includes(item.path));
  const showMobileTabs = !/\/(new|edit)$/.test(location.pathname);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const SidebarContent = () => (
    <>
      <div className="p-6 border-b border-sidebar-border flex-shrink-0">
        <Link to="/" aria-label="Arabic Stone, accueil"><StoneBrand light /></Link>
      </div>
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {visibleNav.map((item) => {
          const Icon = item.icon;
          const isActive = item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setMobileMenuOpen(false)}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 relative',
                isActive
                  ? 'stone-nav-active text-sidebar-primary font-medium'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="px-7 pb-7 stone-sidebar-quote"><span /><p>La beauté naturelle<br />au service de vos projets.</p></div>

    </>
  );

  return (
    <div className="app-shell min-h-screen w-full max-w-full bg-background overflow-x-hidden">
      {/* Mobile Navbar */}
      <div className="mobile-app-header lg:hidden fixed top-0 left-0 right-0 h-14 bg-gradient-to-r from-[#211b16] to-[#141211] border-b border-sidebar-border z-50 flex items-center gap-4 px-4 shadow-lg">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setMobileMenuOpen(true)}
          aria-label="Ouvrir le menu"
          className="text-sidebar-foreground p-0 h-10 w-10"
        >
          <Menu className="h-6 w-6" />
        </Button>
        <div className="w-[150px]"><StoneBrand light /></div><Link to={restricted ? "/factures" : "/profile"} aria-label={restricted ? "Factures" : "Mon entreprise et profil"} className="ml-auto text-sidebar-foreground"><UserIcon size={19} /></Link><Button variant="ghost" size="icon" onClick={logout} aria-label="Déconnexion" className="text-sidebar-foreground"><LogOut size={18} /></Button>
      </div>

      {/* Mobile Sidebar - Sheet */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="stone-sidebar w-64 p-0 border-sidebar-border">
          <SheetHeader className="sr-only">
            <SheetTitle>Menu</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col h-full">
            <SidebarContent />
          </div>
        </SheetContent>
      </Sheet>

      {/* Desktop Sidebar - Fixed (original behavior) */}
      <aside className="stone-sidebar hidden lg:block fixed left-0 top-0 h-screen w-64 border-r border-sidebar-border z-10 shadow-xl">
        <div className="flex flex-col h-full">
          <SidebarContent />
        </div>
      </aside>

      {/* Main content - Original desktop layout with margin-left */}
      <main className="app-main w-full lg:w-[calc(100%-16rem)] lg:ml-64 pb-24 lg:pb-0 pt-14 lg:pt-0 min-h-screen overflow-x-hidden">
        <header className="stone-topbar hidden lg:flex"><span className="text-xs tracking-[.16em] uppercase text-muted-foreground">Espace professionnel <span className="mx-3 text-primary">/</span> {navItems.find(item => item.path !== '/' && location.pathname.startsWith(item.path))?.label || 'Tableau de bord'}</span><Link to={restricted ? "/factures" : "/profile"} className="ml-auto flex items-center gap-3 rounded-lg hover:bg-muted px-3 py-1.5"><span className="stone-avatar">{(user?.username || 'A').slice(0, 1).toUpperCase()}</span><span><strong className="block text-xs">{user?.username}</strong><span className="block text-[10px] text-muted-foreground">{restricted ? 'Facturation' : 'Mon entreprise & profil'}</span></span></Link><Button variant="ghost" size="icon" onClick={logout} aria-label="Déconnexion"><LogOut size={17} /></Button></header>
        <div className="w-full max-w-full overflow-x-hidden box-border">
          {children}
        </div>
      </main>
      {showMobileTabs && <nav aria-label="Navigation rapide" className="mobile-tabbar lg:hidden">{mobileTabs.map(item => { const Icon = item.icon; const active = item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path); return <Link key={item.path} to={item.path} aria-current={active ? 'page' : undefined} className={active ? 'is-active' : ''}><Icon size={21} /><span>{item.path === '/' ? 'Accueil' : item.path === '/bon-achat' ? 'Achats' : item.label}</span></Link>; })}</nav>}
    </div>
  );
};

export default Layout;
