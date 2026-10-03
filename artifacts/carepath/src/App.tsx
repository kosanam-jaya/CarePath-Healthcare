import { type FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ClerkProvider, SignIn, SignUp, useAuth, useClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import {
  useAdminCreateDoctor, useAdminCreateHospital, useAdminCreateSpecialty, useAdminDeleteDoctor,
  useAdminDeleteHospital, useAdminDeleteSpecialty, useAdminListAppointments, useAdminListDoctors,
  useAdminListHospitals, useAdminListReviews, useAdminListSpecialties, useAdminListUsers,
  useAdminModerateReview, useAdminUpdateDoctor, useAdminUpdateHospital, useAdminUpdateSpecialty,
  useCancelAppointment, useCreateAppointment, useCreateReview, useCreateToken, useCreateVisitPlan,
  useDeleteVisitPlan, useGetDashboard, useGetHospital, useGetProfile, useHealthCheck,
  useListAppointments, useListEmergencyFacilities, useListHospitals, useListSpecialties,
  useListTokens, useListVisitPlans, useUpdateProfile, useUpdateVisitPlan,
  getAdminListDoctorsQueryKey, getAdminListHospitalsQueryKey, getAdminListReviewsQueryKey,
  getAdminListAppointmentsQueryKey, getAdminListUsersQueryKey,
  getAdminListSpecialtiesQueryKey, getGetDashboardQueryKey, getGetHospitalQueryKey,
  getGetProfileQueryKey, getListAppointmentsQueryKey, getListHospitalsQueryKey,
  getListSpecialtiesQueryKey, getListTokensQueryKey, getListVisitPlansQueryKey,
} from '@workspace/api-client-react';
import type { Appointment, Doctor, EmergencyFacility, Hospital, Review, Specialty, VisitPlan } from '@workspace/api-client-react';
import {
  Activity, ArrowDownRight, ArrowLeft, ArrowRight, BadgeCheck, BookmarkPlus, CalendarDays,
  Check, Clock3, Compass, Cross, HeartPulse, Hospital as HospitalIcon, MapPin, Menu,
  Navigation, Phone, Plus, Search, ShieldAlert, ShieldCheck, Star, Stethoscope, UserRound,
  X,
} from 'lucide-react';
import { Link, Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 20_000 } } });
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
function stripBase(path: string) { return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path; }
if (!clerkPubKey) throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: { logoPlacement: 'inside' as const, logoLinkUrl: basePath || '/', logoImageUrl: `${window.location.origin}${basePath}/logo.svg` },
  variables: {
    colorPrimary: '#425d31', colorForeground: '#213022', colorMutedForeground: '#667160', colorDanger: '#a83b35',
    colorBackground: '#fffefa', colorInput: '#fffefa', colorInputForeground: '#213022', colorNeutral: '#d5dccb',
    fontFamily: 'DM Sans, sans-serif', borderRadius: '0.75rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#fffefa] rounded-2xl w-[440px] max-w-full overflow-hidden border border-[#dfe4d5]',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none', footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[#213022] font-semibold', headerSubtitle: 'text-[#667160]',
    socialButtonsBlockButtonText: 'text-[#263929]', formFieldLabel: 'text-[#314130]',
    footerActionLink: 'text-[#425d31] font-semibold', footerActionText: 'text-[#667160]',
    dividerText: 'text-[#667160]', identityPreviewEditButton: 'text-[#425d31]',
    formFieldSuccessText: 'text-[#425d31]', alertText: 'text-[#6d302b]',
    logoBox: 'rounded-xl', logoImage: 'rounded-xl', socialButtonsBlockButton: 'border-[#dfe4d5] bg-[#fffefa]',
    formButtonPrimary: 'bg-[#425d31] hover:bg-[#344b28]', formFieldInput: 'border-[#d5dccb] bg-[#fffefa]',
    footerAction: 'text-[#667160]', dividerLine: 'bg-[#dfe4d5]', alert: 'bg-[#fff4f0]',
    otpCodeFieldInput: 'border-[#d5dccb]', formFieldRow: 'text-[#314130]', main: 'text-[#213022]',
  },
};
function invalidateFacilityCaches(client: QueryClient) {
  client.invalidateQueries({ queryKey: getListHospitalsQueryKey() });
  client.invalidateQueries({ queryKey: getListSpecialtiesQueryKey() });
  client.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
  client.invalidateQueries({ queryKey: ['/api/hospitals'] });
}

function Brand({ inverse = false }: { inverse?: boolean }) {
  return <Link href="/" className={`flex items-center gap-2.5 ${inverse ? 'text-[#f8f8ef]' : 'text-[#243a28]'}`} data-testid="link-brand">
    <img src={`${basePath}/logo.svg`} alt="" className="h-9 w-9 rounded-xl" />
    <span className="font-display text-[18px] font-extrabold tracking-[-.04em]">carepath<span className="text-[#8c9c61]">.</span></span>
  </Link>;
}
const navItems = [
  ['/hospitals', 'Find care'], ['/appointments', 'Appointments'], ['/my-plan', 'My plan'], ['/emergency', 'Emergency'],
];
function Header() {
  const [location] = useLocation();
  const { isSignedIn } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { signOut } = useClerk();
  return <header className="topbar">
    <div className="page-wrap flex h-[72px] items-center justify-between">
      <Brand />
      <nav className="desktop-nav flex items-center gap-8" aria-label="Main navigation">
        {navItems.map(([href, title]) => <Link key={href} href={href} className={`nav-link ${location === href ? 'active' : ''}`} data-testid={`link-nav-${href.slice(1)}`}>{title}</Link>)}
      </nav>
      <div className="desktop-nav flex items-center gap-3">
        {isSignedIn ? <>
          <Link href="/profile" className="btn-secondary !min-h-[39px]" data-testid="link-profile"><UserRound size={15} /> Profile</Link>
          <button onClick={() => signOut({ redirectUrl: basePath || '/' })} className="nav-link px-2" data-testid="button-sign-out">Sign out</button>
        </> : <Link href="/sign-in" className="btn-secondary !min-h-[39px]" data-testid="link-sign-in">Sign in</Link>}
      </div>
      <button className="mobile-nav rounded-lg p-2 text-[#344b28]" aria-label="Toggle menu" onClick={() => setMobileOpen(!mobileOpen)} data-testid="button-mobile-menu">{mobileOpen ? <X size={22} /> : <Menu size={22} />}</button>
    </div>
    {mobileOpen && <div className="mobile-nav page-wrap flex-col gap-1 border-t border-[#e2e5d9] py-3">
      {navItems.map(([href, title]) => <Link key={href} onClick={() => setMobileOpen(false)} href={href} className="rounded-xl px-3 py-3 text-sm font-semibold text-[#344b28]" data-testid={`mobile-nav-${href.slice(1)}`}>{title}</Link>)}
      <Link href={isSignedIn ? '/profile' : '/sign-in'} onClick={() => setMobileOpen(false)} className="rounded-xl px-3 py-3 text-sm font-semibold text-[#344b28]" data-testid="mobile-profile-link">{isSignedIn ? 'Your profile' : 'Sign in'}</Link>
    </div>}
  </header>;
}
function Footer() {
  return <footer className="mt-20 border-t border-[#e2e5d9] bg-[#f0f1e8] py-8">
    <div className="page-wrap flex flex-col justify-between gap-5 sm:flex-row sm:items-center"><Brand />
      <p className="disclaimer max-w-2xl">CarePath is a discovery and visit-planning prototype. Listings, ratings, wait estimates and appointment options may be sample data and are not live medical availability. Confirm directly with a facility.</p>
    </div>
  </footer>;
}
function Shell({ children }: { children: ReactNode }) {
  return <div className="app-shell"><Header /><main className="mobile-bottom-space">{children}</main><Footer />
    <nav className="mobile-nav fixed bottom-0 left-0 right-0 z-40 items-center justify-around border-t border-[#dfe4d5] bg-[#fffefa]/95 px-2 py-2 backdrop-blur">
      {navItems.map(([href, title], i) => {
        const Icon = [Compass, CalendarDays, BookmarkPlus, ShieldAlert][i];
        return <Link key={href} href={href} className="flex min-w-[60px] flex-col items-center gap-1 py-1 text-[10px] font-semibold text-[#59674f]" data-testid={`bottom-nav-${href.slice(1)}`}><Icon size={18} />{title}</Link>;
      })}
    </nav>
  </div>;
}
function ErrorState({ retry }: { retry: () => void }) { return <div className="panel p-8 text-center">
  <p className="font-display text-lg font-bold text-[#243a28]">We couldn't load this right now</p><p className="mt-2 text-sm text-[#6b7564]">Please try again in a moment.</p>
  <button className="btn-secondary mt-5" onClick={retry} data-testid="button-retry">Try again</button>
</div>; }
function LoadingCards({ count = 3 }: { count?: number }) { return <div className="grid gap-4 md:grid-cols-2">{Array.from({ length: count }, (_, i) => <div key={i} className="panel p-5"><div className="skeleton mb-4 h-5 w-2/3 rounded" /><div className="skeleton mb-3 h-4 w-1/2 rounded" /><div className="skeleton h-10 w-full rounded-xl" /></div>)}</div>; }
function PrototypeNote({ children = 'Sample listing — not live medical availability.' }: { children?: string }) { return <div className="disclaimer flex items-start gap-2 rounded-xl bg-[#eff1e8] px-3 py-2.5"><BadgeCheck size={14} className="mt-0.5 shrink-0 text-[#687c43]" />{children}</div>; }
function AuthGate({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <div className="page-wrap py-16"><LoadingCards count={1} /></div>;
  if (!isSignedIn) return <div className="page-wrap py-16"><div className="panel mx-auto max-w-xl p-8 text-center">
    <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-[#eaf0df] text-[#425d31]"><UserRound /></div>
    <p className="eyebrow">Your CarePath</p><h1 className="font-display mt-2 text-3xl font-bold">Sign in to continue</h1>
    <p className="mt-3 text-sm text-[#6b7564]">Keep your visit plans, appointments and profile together in one place.</p>
    <Link href="/sign-in" className="btn-primary mt-6" data-testid="link-gate-sign-in">Sign in</Link>
    <p className="mt-4 text-xs text-[#6b7564]">New to CarePath? <Link href="/sign-up" className="font-bold text-[#425d31]">Create an account</Link></p>
  </div></div>;
  return <>{children}</>;
}
function PageTitle({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="eyebrow">{eyebrow}</p><h1 className="font-display mt-2 text-3xl font-extrabold tracking-[-.04em] sm:text-4xl">{title}</h1>{description && <p className="mt-2 max-w-2xl text-sm leading-6 text-[#677161]">{description}</p>}</div>{action}</div>;
}
function HospitalCard({ hospital, compact = false }: { hospital: Hospital; compact?: boolean }) {
  return <article className="panel group p-5 transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(45,64,38,.08)]" data-testid={`card-hospital-${hospital.id}`}>
    <div className="flex items-start justify-between gap-3">
      <div className="flex gap-3"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-[#eaf0df] text-[#425d31]"><HospitalIcon size={20} /></div>
        <div><Link href={`/hospitals/${hospital.id}`} className="font-display text-[16px] font-bold leading-5 tracking-[-.02em] text-[#263728] hover:text-[#425d31]" data-testid={`link-hospital-${hospital.id}`}>{hospital.name}</Link>
          <p className="mt-1 text-xs text-[#70796b]">{hospital.type === 'clinic' ? 'Clinic' : 'Hospital'} · {hospital.locality}, {hospital.city}</p>
        </div></div>
      <span className="flex items-center gap-1 text-xs font-bold text-[#3e4e36]"><Star size={14} fill="#bd9a42" stroke="#bd9a42" />{hospital.rating.toFixed(1)}</span>
    </div>
     {!compact && <p className="mt-4 line-clamp-1 text-xs text-[#70796b]"><MapPin size={13} className="mr-1 inline" />{hospital.address}</p>}
     {hospital.distanceKm !== null && <p className={`${compact ? 'mt-3' : 'mt-2'} flex items-center gap-1.5 text-[11px] text-[#687262]`}><Navigation size={12} className="text-[#758751]" />Approx. {hospital.distanceKm.toFixed(1)} km · sample estimate</p>}
    <div className="mt-4 flex flex-wrap gap-1.5">{hospital.specialties.slice(0, compact ? 2 : 3).map(s => <span key={s} className="rounded-full bg-[#f0f2e9] px-2.5 py-1 text-[10px] font-semibold text-[#56634d]">{s}</span>)}</div>
    <div className="mt-4 flex items-center justify-between border-t border-[#edf0e8] pt-3 text-xs">
      <span className={`flex items-center gap-1.5 font-semibold ${hospital.isOpen ? 'text-[#4d7135]' : 'text-[#8b5c50]'}`}><span className={`h-1.5 w-1.5 rounded-full ${hospital.isOpen ? 'bg-[#76a24f]' : 'bg-[#bc7564]'}`} />{hospital.isOpen ? 'Listed as open' : 'Listed as closed'}</span>
      <span className="text-[#70796b]">{hospital.waitingMinutes} min est. wait</span>
    </div>
    <div className="mt-3 flex items-center justify-between"><span className="disclaimer">{hospital.isDemo ? 'Prototype data' : 'Facility information'}</span><Link href={`/hospitals/${hospital.id}`} className="flex items-center gap-1 text-xs font-bold text-[#425d31]" data-testid={`link-hospital-details-${hospital.id}`}>Details <ArrowRight size={13} /></Link></div>
  </article>;
}
function Home() {
  const [query, setQuery] = useState('');
  const [city, setCity] = useState('Hyderabad');
  const [geoNotice, setGeoNotice] = useState('');
  const [coordinates, setCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);
  const [, setLocation] = useLocation();
  const dashboard = useGetDashboard();
  const { data: hospitals, isLoading, isError, refetch } = useListHospitals({ q: query || undefined, city: city || undefined, latitude: coordinates?.latitude, longitude: coordinates?.longitude });
  const specialties = useListSpecialties();
  useHealthCheck();
  const searchHref = () => {
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (city) params.set('city', city);
    if (coordinates) {
      params.set('latitude', String(coordinates.latitude));
      params.set('longitude', String(coordinates.longitude));
    }
    const searchParams = params.toString();
    return searchParams ? `/hospitals?${searchParams}` : '/hospitals';
  };
  const search = () => setLocation(searchHref());
  const locate = () => {
    if (!navigator.geolocation) { setGeoNotice('Location is unavailable here. Choose a city or enter an area to search.'); return; }
    navigator.geolocation.getCurrentPosition(position => {
      setCoordinates({ latitude: position.coords.latitude, longitude: position.coords.longitude });
      setCity('');
      setGeoNotice('Showing nearby sample facilities, ordered by distance from your location.');
    }, () => {
      setCoordinates(null);
      setGeoNotice('Location permission was not granted. Search by city or locality instead.');
    }, { timeout: 7000 });
  };
  const featured = coordinates ? hospitals?.slice(0, 3) ?? [] : dashboard.data?.featuredHospitals?.length ? dashboard.data.featuredHospitals : hospitals?.slice(0, 3) ?? [];
  const specList = specialties.data ?? dashboard.data?.specialties ?? [];
  return <Shell><section className="relative overflow-hidden pb-12 pt-10 sm:pb-16 sm:pt-14">
    <div className="page-wrap relative grid items-center gap-9 lg:grid-cols-[1.12fr_.88fr]">
      <div className="reveal">
        <span className="inline-flex items-center gap-2 rounded-full border border-[#dde3d2] bg-[#fffefa] px-3 py-1.5 text-[11px] font-bold text-[#546a3b]"><span className="h-1.5 w-1.5 rounded-full bg-[#849951]" /> Care, made easier to find</span>
        <h1 className="font-display hero-title mt-6 max-w-[650px] text-[60px] font-extrabold leading-[.99] tracking-[-.065em] text-[#213526] sm:text-[76px]">A clearer way<br />to find <span className="text-[#657e43]">care.</span></h1>
        <p className="mt-5 max-w-lg text-[15px] leading-7 text-[#657060]">Explore hospitals and specialties across Hyderabad and Vijayawada. Plan your next visit with a little more confidence.</p>
        <div className="hero-field mt-8 rounded-2xl p-2.5 shadow-[0_14px_38px_rgba(39,57,31,.06)]">
          <div className="grid gap-2 sm:grid-cols-[1fr_170px_auto]">
            <label className="flex items-center gap-2 rounded-xl bg-[#fffefa] px-3"><Search size={17} className="text-[#73845a]" /><input className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-[#8d9587]" placeholder="Hospital, specialty or locality" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && search()} data-testid="input-home-search" /></label>
            <label className="flex items-center gap-2 rounded-xl bg-[#fffefa] px-3"><MapPin size={16} className="text-[#73845a]" /><select className="h-12 w-full bg-transparent text-sm outline-none" value={city} onChange={e => setCity(e.target.value)} data-testid="select-home-city"><option value="">All cities</option><option>Hyderabad</option><option>Vijayawada</option></select></label>
            <button className="btn-primary !min-h-12" onClick={search} data-testid="button-home-search">Find care <ArrowRight size={15} /></button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 px-2 pt-2"><button onClick={locate} className="flex items-center gap-1.5 text-[11px] font-bold text-[#52663c]" data-testid="button-use-location"><Navigation size={13} /> Use my location</button><span className="disclaimer">{geoNotice || 'Search results include sample facility information.'}</span></div>
        </div>
        <div className="mt-6 flex flex-wrap gap-2">{['Cardiology', 'Pediatrics', 'Orthopedics'].map(label => <Link href={`/hospitals?specialty=${encodeURIComponent(label)}`} key={label} className="rounded-full border border-[#dfe4d5] px-3 py-1.5 text-[11px] font-semibold text-[#5c6953] hover:bg-[#edf0e6]" data-testid={`link-specialty-shortcut-${label.toLowerCase()}`}>{label}</Link>)}</div>
      </div>
      <div className="relative mx-auto w-full max-w-[470px] reveal" style={{ animationDelay: '.1s' }}>
        <div className="absolute -right-3 top-5 h-44 w-44 rounded-full bg-[#e6ead9]" />
        <div className="relative overflow-hidden rounded-[34px] bg-[#284130] p-7 text-[#f6f5e9] shadow-[0_25px_60px_rgba(37,59,42,.18)] sm:p-9">
          <div className="soft-grid absolute inset-0 opacity-[.12]" />
          <div className="relative">
            <div className="flex items-center justify-between"><span className="eyebrow !text-[#c5d0a7]">Your next step</span><span className="rounded-full border border-white/20 px-2.5 py-1 text-[10px] text-[#e5e9d7]">HYD · VJA</span></div>
            <div className="mt-12 flex h-44 items-center justify-center">
              <div className="relative grid h-40 w-40 place-items-center rounded-full border border-[#97a779]/35">
                <div className="grid h-28 w-28 place-items-center rounded-full border border-[#97a779]/35 bg-[#3e5b3f]"><Cross size={50} strokeWidth={1.1} className="text-[#d5ddb7]" /></div>
                <span className="absolute left-0 top-7 h-3 w-3 rounded-full bg-[#d7bf75]" /><span className="absolute bottom-3 right-3 h-2.5 w-2.5 rounded-full bg-[#a2b37e]" />
                 <div className="absolute -right-16 top-9 rounded-xl bg-[#f4f2e5] px-3 py-2 text-[10px] font-bold text-[#344a35] shadow-md"><span className="block text-[#71804f]">SPECIALTIES</span> {dashboard.data?.specialtyCount ?? 0} to explore</div>
              </div>
            </div>
            <div className="mt-8 flex items-end justify-between border-t border-white/15 pt-4"><div><p className="font-display text-2xl font-bold tracking-[-.04em]">Care, close by.</p><p className="mt-1 text-xs text-[#ced5bd]">Start with what matters to you.</p></div><ArrowDownRight className="text-[#d7bf75]" size={22} /></div>
          </div>
        </div>
       <div className="absolute -bottom-14 left-0 z-20 rounded-2xl border border-[#e0e4d7] bg-[#fffefa] px-4 py-3 shadow-lg"><p className="text-[10px] font-semibold text-[#748064]">A note before you go</p><p className="mt-1 text-xs font-bold text-[#344b28]">Confirm details with the facility</p></div>
      </div>
    </div>
  </section>
  <section className="page-wrap pb-12">
    <div className="mb-5 flex items-end justify-between"><div><p className="eyebrow">A good place to begin</p><h2 className="font-display mt-1 text-2xl font-bold tracking-[-.04em]">Popular specialties</h2></div><Link href="/hospitals" className="text-xs font-bold text-[#52683b]" data-testid="link-all-specialties">See all care <ArrowRight size={13} className="ml-1 inline" /></Link></div>
    {specialties.isLoading && <div className="skeleton h-24 rounded-2xl" />}
    {specialties.isError && <ErrorState retry={() => specialties.refetch()} />}
    {!specialties.isLoading && <div className="flex gap-3 overflow-x-auto pb-3">{specList.slice(0, 8).map((s: Specialty) => <Link href={`/hospitals?specialty=${encodeURIComponent(s.name)}`} key={s.id} className="panel min-w-[168px] p-4 transition hover:bg-[#f0f2e8]" data-testid={`specialty-${s.id}`}><div className="mb-4 grid h-9 w-9 place-items-center rounded-xl bg-[#edf1e4] text-[#536b3d]"><Activity size={18} /></div><p className="font-display text-sm font-bold">{s.name}</p><p className="mt-1 line-clamp-1 text-[10px] text-[#76806e]">{s.description}</p></Link>)}</div>}
  </section>
  <section className="bg-[#eef0e7] py-12">
    <div className="page-wrap">
      <div className="mb-5 flex items-end justify-between"><div><p className="eyebrow">Explore nearby</p><h2 className="font-display mt-1 text-2xl font-bold tracking-[-.04em]">Hospitals & clinics</h2><p className="mt-1 text-xs text-[#717b6c]">{coordinates ? 'Nearest to you · sample facilities' : `${city || 'Hyderabad & Vijayawada'} · curated sample listings`}</p></div><Link href={searchHref()} className="btn-secondary !min-h-[38px]" data-testid="link-browse-hospitals">Browse all <ArrowRight size={14} /></Link></div>
      {isLoading && <LoadingCards />}
      {isError && <ErrorState retry={() => refetch()} />}
      {!isLoading && !isError && <div className="grid gap-4 md:grid-cols-3">{featured.slice(0, 3).map((h: Hospital) => <HospitalCard hospital={h} key={h.id} compact />)}{featured.length === 0 && <div className="panel p-8 text-sm text-[#6b7564]">No facilities matched this search. Try another city or specialty.</div>}</div>}
      <PrototypeNote />
    </div>
  </section>
  <section className="page-wrap grid gap-5 py-12 md:grid-cols-[1fr_1.2fr]">
    <div className="rounded-[22px] bg-[#dfe6d2] p-6 sm:p-8"><p className="eyebrow">Plan at your pace</p><h2 className="font-display mt-2 max-w-sm text-3xl font-extrabold tracking-[-.05em]">A visit starts before you arrive.</h2><p className="mt-3 max-w-sm text-sm leading-6 text-[#58634f]">Save a facility, jot down questions, and keep appointment details in one simple plan.</p><Link href="/my-plan" className="btn-primary mt-6" data-testid="link-start-plan">Make a visit plan <ArrowRight size={15} /></Link></div>
    <div className="panel flex flex-col justify-between p-6 sm:p-8"><div><p className="eyebrow">Need urgent help?</p><h2 className="font-display mt-2 text-2xl font-bold tracking-[-.04em]">Emergency services come first.</h2><p className="mt-2 max-w-lg text-sm leading-6 text-[#6b7564]">For an emergency in India, call 108. CarePath sample listings are not an emergency dispatch service.</p></div><div className="mt-6 flex flex-wrap gap-3"><a href="tel:108" className="btn-primary bg-[#8f3e32] hover:bg-[#793127]" data-testid="link-call-emergency"><Phone size={15} /> Call 108</a><Link href="/emergency" className="btn-secondary" data-testid="link-emergency-directory">View emergency directory</Link></div></div>
  </section>
  </Shell>;
}
function HospitalsPage() {
  const [location] = useLocation();
  const initial = new URLSearchParams(location.split('?')[1] || '');
  const [q, setQ] = useState(initial.get('q') || '');
  const [city, setCity] = useState(initial.get('city') || '');
  const [locality, setLocality] = useState(initial.get('locality') || '');
  const [specialty, setSpecialty] = useState(initial.get('specialty') || '');
  const [type, setType] = useState('');
  const [open, setOpen] = useState(false);
  const [coordinates, setCoordinates] = useState<{ latitude: number; longitude: number } | null>(() => {
    const latitude = Number(initial.get('latitude'));
    const longitude = Number(initial.get('longitude'));
    return initial.has('latitude') && initial.has('longitude') && Number.isFinite(latitude) && Number.isFinite(longitude)
      ? { latitude, longitude }
      : null;
  });
  const params = useMemo(() => ({ q: q || undefined, city: city || undefined, locality: locality || undefined, specialty: specialty || undefined, type: type ? type as 'hospital' | 'clinic' : undefined, open: open || undefined, latitude: coordinates?.latitude, longitude: coordinates?.longitude }), [q, city, locality, specialty, type, open, coordinates]);
  const result = useListHospitals(params);
  const specialties = useListSpecialties();
  return <Shell><div className="page-wrap py-10"><PageTitle eyebrow="Find the right place" title="Hospitals & clinics" description="Search sample facility listings in Hyderabad and Vijayawada. Always verify services, hours and availability directly." />
    <div className="panel mb-7 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr_auto]">
      <label className="relative"><Search size={16} className="absolute left-3 top-4 text-[#79856b]" /><input className="field pl-10" value={q} onChange={e => setQ(e.target.value)} placeholder="Name, area or keyword" data-testid="input-hospital-search" /></label>
      <select className="field" value={city} onChange={e => setCity(e.target.value)} data-testid="filter-city"><option value="">All cities</option><option>Hyderabad</option><option>Vijayawada</option></select>
      <input className="field" placeholder="Locality" value={locality} onChange={e => setLocality(e.target.value)} data-testid="filter-locality" />
      <select className="field" value={specialty} onChange={e => setSpecialty(e.target.value)} data-testid="filter-specialty"><option value="">All specialties</option>{(specialties.data ?? []).map((s: Specialty) => <option key={s.id} value={s.name}>{s.name}</option>)}</select>
      <select className="field" value={type} onChange={e => setType(e.target.value)} data-testid="filter-type"><option value="">All facilities</option><option value="hospital">Hospitals</option><option value="clinic">Clinics</option></select>
      <label className="flex items-center gap-2 px-1 text-xs font-semibold text-[#53604d] lg:col-span-5"><input type="checkbox" checked={open} onChange={e => setOpen(e.target.checked)} className="accent-[#536b3d]" data-testid="filter-open" /> Listed as open</label>
    </div>
     <div className="mb-4 flex items-center justify-between"><p className="text-sm font-semibold text-[#53604d]">{result.data?.length ?? 0} sample facilities{coordinates ? ' · sorted by approximate distance' : ''}</p><span className="disclaimer">Availability is not live</span></div>
    {result.isLoading && <LoadingCards />}
    {result.isError && <ErrorState retry={() => result.refetch()} />}
    {!result.isLoading && !result.isError && (result.data?.length ? <div className="grid gap-4 md:grid-cols-2">{result.data.map((h: Hospital) => <HospitalCard key={h.id} hospital={h} />)}</div> : <div className="panel py-14 text-center"><div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#edf1e4] text-[#596f40]"><Search /></div><h2 className="font-display mt-4 text-xl font-bold">No facilities found</h2><p className="mt-2 text-sm text-[#6b7564]">Try widening your search or choosing a different city.</p><button className="btn-secondary mt-5" onClick={() => { setQ(''); setCity(''); setLocality(''); setSpecialty(''); setType(''); setOpen(false); setCoordinates(null); }} data-testid="button-clear-filters">Clear filters</button></div>)}
    <div className="mt-5"><PrototypeNote /></div>
  </div></Shell>;
}
function HospitalDetailPage({ id }: { id?: string }) {
  const hospitalId = Number(id);
  const { isSignedIn } = useAuth();
  const detail = useGetHospital(hospitalId);
  const queryClient = useQueryClient();
  const review = useCreateReview({ mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetHospitalQueryKey(hospitalId) }) } });
  const [rating, setRating] = useState('5');
  const [text, setText] = useState('');
  const hospital = detail.data;
  const sendReview = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    (review.mutate as (v: any) => void)({ hospitalId, data: { rating: Number(rating), text } });
    setText('');
  };
  if (detail.isLoading) return <Shell><div className="page-wrap py-12"><LoadingCards count={1} /></div></Shell>;
  if (detail.isError || !hospital) return <Shell><div className="page-wrap py-12"><ErrorState retry={() => detail.refetch()} /></div></Shell>;
  return <Shell><div className="page-wrap py-8">
    <Link href="/hospitals" className="mb-6 inline-flex items-center gap-2 text-xs font-bold text-[#61724b]" data-testid="link-back-hospitals"><ArrowLeft size={14} /> All facilities</Link>
    <div className="panel overflow-hidden">
      <div className="relative bg-[#294231] px-6 py-8 text-[#f8f7ef] sm:px-10 sm:py-10">
        <div className="soft-grid absolute inset-0 opacity-[.12]" /><div className="relative flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div><p className="eyebrow !text-[#d5ddb7]">{hospital.type} · {hospital.city}</p><h1 className="font-display mt-2 text-3xl font-extrabold tracking-[-.04em] sm:text-4xl">{hospital.name}</h1><p className="mt-3 flex items-center gap-2 text-sm text-[#d7dfcd]"><MapPin size={15} />{hospital.address}</p></div>
          <div className="flex flex-wrap gap-2"><a href={`tel:${hospital.contactPhone}`} className="btn-secondary !border-white/20 !bg-white/10 !text-white" data-testid="link-hospital-call"><Phone size={15} /> Call facility</a><Link href="/my-plan" className="btn-primary !bg-[#d5dfbd] !text-[#293f2d] hover:!bg-[#e1e8d0]" data-testid="link-add-to-plan"><BookmarkPlus size={15} /> Plan a visit</Link></div>
        </div>
      </div>
      <div className="grid gap-6 p-6 lg:grid-cols-[1fr_320px] sm:p-8">
        <div>
          <PrototypeNote />
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Patient rating" value={`${hospital.rating.toFixed(1)} / 5`} icon={<Star size={16} />} />
            <Stat label="Listed reviews" value={`${hospital.reviewCount}`} icon={<Activity size={16} />} />
            <Stat label="Est. wait" value={`${hospital.waitingMinutes} min`} icon={<Clock3 size={16} />} />
            <Stat label="Doctors listed" value={`${hospital.doctorCount}`} icon={<Stethoscope size={16} />} />
          </div>
          <div className="mt-8"><h2 className="font-display text-xl font-bold">Specialties</h2><div className="mt-3 flex flex-wrap gap-2">{hospital.specialties.map(s => <span key={s} className="rounded-full bg-[#eef1e6] px-3 py-1.5 text-xs font-semibold text-[#536548]">{s}</span>)}</div></div>
          <div className="mt-8"><h2 className="font-display text-xl font-bold">Doctors</h2><div className="mt-3 grid gap-3 sm:grid-cols-2">{hospital.doctors?.length ? hospital.doctors.map((d: Doctor) => <div key={d.id} className="rounded-xl border border-[#e6e9df] p-4" data-testid={`doctor-${d.id}`}><div className="flex justify-between gap-2"><p className="font-semibold text-sm">{d.name}</p><span className="rounded-full bg-[#edf2e4] px-2 py-1 text-[9px] font-bold text-[#53743b]">{d.available ? 'Listed available' : 'Availability unknown'}</span></div><p className="mt-1 text-xs text-[#70796b]">{d.specialty} · {d.qualifications}</p><p className="mt-2 text-[10px] text-[#7a8474]">{d.yearsExperience} years experience · sample listing</p></div>) : <p className="text-sm text-[#70796b]">No doctor profiles listed.</p>}</div></div>
        </div>
        <aside className="rounded-2xl bg-[#f1f2ea] p-5">
          <p className="eyebrow">Before visiting</p><h3 className="font-display mt-2 text-lg font-bold">Confirm the details</h3><p className="mt-2 text-xs leading-5 text-[#687262]">Information here is illustrative. Contact the facility to confirm services, doctor schedules, fees and current availability.</p>
          <div className="mt-5 space-y-3 border-t border-[#dfe4d5] pt-4 text-xs"><p className="flex items-start gap-2"><MapPin size={14} className="shrink-0 text-[#677b49]" />{hospital.address}</p><p className="flex items-center gap-2"><Clock3 size={14} className="text-[#677b49]" />{hospital.hours}</p><p className="flex items-center gap-2"><Phone size={14} className="text-[#677b49]" />{hospital.contactPhone}</p></div>
          <Link href={`/appointments?hospital=${hospital.id}`} className="btn-primary mt-5 w-full" data-testid="link-book-appointment">Plan an appointment <ArrowRight size={14} /></Link>
        </aside>
      </div>
    </div>
    <section className="mt-9 grid gap-6 lg:grid-cols-[1fr_360px]">
      <div><h2 className="font-display text-2xl font-bold">Reviews</h2><p className="mt-1 text-xs text-[#737d6e]">Community-submitted feedback. Ratings are not clinical endorsements.</p>
        <div className="mt-4 space-y-3">{hospital.reviews?.length ? hospital.reviews.map((r: Review) => <article className="panel p-5" key={r.id} data-testid={`review-${r.id}`}><div className="flex items-center justify-between"><p className="text-sm font-bold">{r.userName}</p><span className="flex items-center gap-1 text-xs font-bold"><Star size={13} fill="#bd9a42" stroke="#bd9a42" />{r.rating}.0</span></div><p className="mt-3 text-sm leading-6 text-[#596451]">{r.text}</p><p className="mt-3 disclaimer">{r.isDemo ? 'Sample review' : 'Community review'} · {new Date(r.createdAt).toLocaleDateString()}</p></article>) : <div className="panel p-6 text-sm text-[#6b7564]">No reviews yet. Share a helpful note about your experience.</div>}</div>
      </div>
      <form onSubmit={sendReview} className="panel h-fit p-5"><p className="eyebrow">Share feedback</p><h3 className="font-display mt-1 text-lg font-bold">Leave a review</h3><p className="mt-1 text-xs text-[#737d6e]">Your review will be submitted to the facility's community page.</p>
        <label className="mt-4 block text-xs font-semibold">Rating<select className="field mt-1" value={rating} onChange={e => setRating(e.target.value)} data-testid="select-review-rating">{[5,4,3,2,1].map(n => <option key={n} value={n}>{n} stars</option>)}</select></label>
        <label className="mt-3 block text-xs font-semibold">Your note<textarea className="field mt-1 min-h-[116px] py-3" maxLength={1200} value={text} onChange={e => setText(e.target.value)} placeholder="What would you want another visitor to know?" data-testid="input-review-text" /></label>
        <button className="btn-primary mt-4 w-full" type="submit" disabled={!isSignedIn || review.isPending || !text.trim()} data-testid="button-submit-review">{review.isPending ? 'Submitting…' : 'Submit review'}</button>
        {!isSignedIn ? <Link href="/sign-in" className="btn-secondary mt-2 w-full" data-testid="link-sign-in-review">Sign in to leave a review</Link> : null}
        <p className="mt-3 disclaimer">Sign in is required to post a review. Sample reviews may be shown in this prototype.</p>
      </form>
    </section>
  </div></Shell>;
}
function Stat({ label, value, icon }: { label: string; value: string; icon: ReactNode }) { return <div className="rounded-xl bg-[#f1f3eb] p-3"><div className="flex items-center gap-1.5 text-[#63794a]">{icon}<span className="text-[9px] font-bold uppercase tracking-[.1em]">{label}</span></div><p className="font-display mt-2 text-lg font-extrabold">{value}</p></div>; }
function AppointmentsPage() {
  const { isSignedIn } = useAuth();
  const hospitals = useListHospitals();
  const specialties = useListSpecialties();
  const appointments = useListAppointments({ query: { enabled: !!isSignedIn, queryKey: getListAppointmentsQueryKey() } });
  const tokens = useListTokens({ query: { enabled: !!isSignedIn, queryKey: getListTokensQueryKey() } });
  const [loc, setLoc] = useLocation();
  const searchParams = new URLSearchParams(loc.split('?')[1] || '');
  const [hospitalId, setHospitalId] = useState(searchParams.get('hospital') || '');
  const [specialtyId, setSpecialtyId] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('09:30');
  const [patient, setPatient] = useState('');
  const queryClient = useQueryClient();
  const details = useGetHospital(Number(hospitalId || 0), { query: { enabled: !!hospitalId, queryKey: getGetHospitalQueryKey(Number(hospitalId || 0)) } });
  const createAppt = useCreateAppointment({ mutation: { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListAppointmentsQueryKey() }); } } });
  const cancel = useCancelAppointment({ mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListAppointmentsQueryKey() }) } });
  const createToken = useCreateToken({ mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListTokensQueryKey() }) } });
  const matchingDoctors = (details.data?.doctors ?? []).filter((d: Doctor) => !specialtyId || String(d.specialtyId) === specialtyId);
  const submitBooking = (e: FormEvent) => { e.preventDefault(); if (!hospitalId || !specialtyId || !doctorId || !date || !patient.trim()) return;
    (createAppt.mutate as (v: any) => void)({ data: { patientName: patient.trim(), hospitalId: Number(hospitalId), specialtyId: Number(specialtyId), doctorId: Number(doctorId), appointmentDate: date, appointmentTime: time } });
  };
  const requestToken = (hId: number, specId: number) => (createToken.mutate as (v:any)=>void)({ data: { hospitalId: hId, specialtyId: specId } });
  return <Shell><AuthGate><div className="page-wrap py-10"><PageTitle eyebrow="Plan your care" title="Appointments" description="Create a prototype visit request or queue token. These are planning tools, not confirmed bookings or real-time queue positions." />
    <div className="grid gap-7 lg:grid-cols-[.9fr_1.1fr]">
      <form onSubmit={submitBooking} className="panel h-fit p-5 sm:p-6"><p className="eyebrow">Visit request</p><h2 className="font-display mt-2 text-xl font-bold">Plan an appointment</h2><PrototypeNote />
        <label className="mt-5 block text-xs font-semibold">Hospital<select className="field mt-1" required value={hospitalId} onChange={e => { setHospitalId(e.target.value); setSpecialtyId(''); setDoctorId(''); }} data-testid="select-appointment-hospital"><option value="">Choose facility</option>{(hospitals.data ?? []).map((h: Hospital) => <option key={h.id} value={h.id}>{h.name} · {h.city}</option>)}</select></label>
        <label className="mt-3 block text-xs font-semibold">Specialty<select className="field mt-1" required value={specialtyId} onChange={e => { setSpecialtyId(e.target.value); setDoctorId(''); }} data-testid="select-appointment-specialty"><option value="">Choose specialty</option>{(specialties.data ?? []).map((s: Specialty) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <label className="mt-3 block text-xs font-semibold">Doctor<select className="field mt-1" required value={doctorId} onChange={e => setDoctorId(e.target.value)} data-testid="select-appointment-doctor"><option value="">Choose listed doctor</option>{matchingDoctors.map((d: Doctor) => <option key={d.id} value={d.id}>{d.name} · {d.specialty}</option>)}</select></label>
        <p className="mt-1 text-[10px] text-[#7a8474]">{hospitalId ? (details.data?.doctors?.length ? 'Doctor profiles are sample listings; confirm schedules directly.' : 'No listed doctors in this facility yet.') : 'Choose a facility to view listed doctors.'}</p>
        <label className="mt-3 block text-xs font-semibold">Patient name<input className="field mt-1" required maxLength={120} value={patient} onChange={e => setPatient(e.target.value)} data-testid="input-patient-name" /></label>
        <div className="mt-3 grid grid-cols-2 gap-3"><label className="text-xs font-semibold">Preferred date<input className="field mt-1" type="date" required value={date} onChange={e => setDate(e.target.value)} data-testid="input-appointment-date" /></label><label className="text-xs font-semibold">Preferred time<input className="field mt-1" type="time" required value={time} onChange={e => setTime(e.target.value)} data-testid="input-appointment-time" /></label></div>
        <button className="btn-primary mt-5 w-full" type="submit" disabled={createAppt.isPending} data-testid="button-create-appointment">{createAppt.isPending ? 'Saving request…' : 'Save visit request'} <ArrowRight size={15} /></button>
        {createAppt.isError && <p className="mt-3 text-xs text-red-700">Request couldn't be saved. Please try again.</p>}
        {hospitalId && specialtyId && <button type="button" onClick={() => requestToken(Number(hospitalId), Number(specialtyId))} className="btn-secondary mt-3 w-full" disabled={createToken.isPending} data-testid="button-create-token">Request a demo queue token</button>}
      </form>
      <div className="space-y-7">
        <section><div className="mb-3 flex items-end justify-between"><div><p className="eyebrow">Your visits</p><h2 className="font-display mt-1 text-xl font-bold">Appointment requests</h2></div><span className="disclaimer">{appointments.data?.length ?? 0} saved</span></div>
          {appointments.isLoading && <LoadingCards count={1} />}{appointments.isError && <ErrorState retry={() => appointments.refetch()} />}
          {!appointments.isLoading && !appointments.isError && (appointments.data?.length ? <div className="space-y-3">{appointments.data.map((a: Appointment) => <div className="panel p-5" key={a.id} data-testid={`appointment-${a.id}`}><div className="flex flex-col justify-between gap-3 sm:flex-row"><div><div className="flex items-center gap-2"><span className="rounded-full bg-[#edf1e4] px-2 py-1 text-[9px] font-bold uppercase text-[#56703b]">{a.status}</span>{a.isDemo && <span className="text-[9px] text-[#7a8474]">Prototype</span>}</div><h3 className="font-display mt-2 font-bold">{a.hospitalName}</h3><p className="mt-1 text-xs text-[#697363]">{a.specialty} · {a.doctorName}</p><p className="mt-2 flex items-center gap-1 text-xs text-[#526447]"><CalendarDays size={13} />{a.appointmentDate} at {a.appointmentTime}</p><p className="mt-1 text-[10px] text-[#7a8474]">Request code {a.appointmentCode} · Not confirmed until facility verifies</p></div>{a.status === 'booked' && <button onClick={() => (cancel.mutate as (v:any)=>void)({ id: a.id })} className="btn-secondary self-start !text-[#8a4940]" data-testid={`button-cancel-appointment-${a.id}`}>Cancel request</button>}</div></div>)}</div> : <div className="panel p-7 text-center text-sm text-[#6b7564]">Your visit requests will appear here.</div>)}
        </section>
        <section><p className="eyebrow">Queue planning</p><h2 className="font-display mt-1 text-xl font-bold">Demo tokens</h2>
          {tokens.isLoading && <LoadingCards count={1} />}{tokens.isError && <ErrorState retry={() => tokens.refetch()} />}
          {!tokens.isLoading && !tokens.isError && (tokens.data?.length ? <div className="mt-3 space-y-3">{tokens.data.map((t: any) => <div className="panel flex items-center justify-between p-4" key={t.id} data-testid={`token-${t.id}`}><div><p className="font-display text-lg font-extrabold">{t.tokenNumber}</p><p className="text-xs text-[#697363]">{t.hospitalName} · {t.specialty}</p></div><div className="text-right"><p className="text-xs font-bold text-[#566d3d]">{t.waitingMinutes} min estimate</p><p className="disclaimer mt-1">Demo queue only</p></div></div>)}</div> : <div className="panel mt-3 p-5 text-sm text-[#6b7564]">No demo queue tokens yet.</div>)}
        </section>
      </div>
    </div>
  </div></AuthGate></Shell>;
}
function MyPlanPage() {
  const { isSignedIn } = useAuth();
  const plans = useListVisitPlans({ query: { enabled: !!isSignedIn, queryKey: getListVisitPlansQueryKey() } });
  const hospitals = useListHospitals();
  const queryClient = useQueryClient();
  const create = useCreateVisitPlan({ mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListVisitPlansQueryKey() }) } });
  const update = useUpdateVisitPlan({ mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListVisitPlansQueryKey() }) } });
  const remove = useDeleteVisitPlan({ mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListVisitPlansQueryKey() }) } });
  const [hospitalId, setHospitalId] = useState('');
  const [visitDate, setVisitDate] = useState('');
  const [purpose, setPurpose] = useState('');
  const [notes, setNotes] = useState('');
  const [editing, setEditing] = useState<number | null>(null);
  const submit = (e: FormEvent) => { e.preventDefault(); if (!hospitalId || !visitDate || !purpose.trim()) return; const data = { hospitalId: Number(hospitalId), visitDate, purpose: purpose.trim(), notes };
    if (editing) (update.mutate as (v:any)=>void)({ id: editing, data }); else (create.mutate as (v:any)=>void)({ data });
    setEditing(null); setHospitalId(''); setVisitDate(''); setPurpose(''); setNotes('');
  };
  const startEdit = (p: VisitPlan) => { setEditing(p.id); setHospitalId(String(p.hospitalId)); setVisitDate(p.visitDate); setPurpose(p.purpose); setNotes(p.notes); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  return <Shell><AuthGate><div className="page-wrap py-10"><PageTitle eyebrow="A little preparation" title="My visit plan" description="Save visit details and notes to help you prepare. Your plan is private to your account." />
    <div className="grid gap-7 lg:grid-cols-[340px_1fr]">
      <form onSubmit={submit} className="panel h-fit p-5"><p className="eyebrow">{editing ? 'Edit saved plan' : 'New visit plan'}</p><h2 className="font-display mt-1 text-xl font-bold">{editing ? 'Update your plan' : 'What are you planning for?'}</h2>
        <label className="mt-5 block text-xs font-semibold">Facility<select className="field mt-1" required value={hospitalId} onChange={e => setHospitalId(e.target.value)} data-testid="select-plan-hospital"><option value="">Select a facility</option>{(hospitals.data ?? []).map((h: Hospital) => <option key={h.id} value={h.id}>{h.name} · {h.city}</option>)}</select></label>
        <label className="mt-3 block text-xs font-semibold">Visit date<input className="field mt-1" type="date" required value={visitDate} onChange={e => setVisitDate(e.target.value)} data-testid="input-plan-date" /></label>
        <label className="mt-3 block text-xs font-semibold">Purpose<input className="field mt-1" required value={purpose} onChange={e => setPurpose(e.target.value)} placeholder="e.g. Annual check-up" data-testid="input-plan-purpose" /></label>
        <label className="mt-3 block text-xs font-semibold">Notes<textarea className="field mt-1 min-h-[110px] py-3" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Questions to ask, documents to bring…" data-testid="input-plan-notes" /></label>
        <button className="btn-primary mt-4 w-full" type="submit" disabled={create.isPending || update.isPending} data-testid="button-save-plan">{editing ? 'Save changes' : 'Add to my plan'} <Plus size={15} /></button>
        {editing && <button type="button" onClick={() => { setEditing(null); setHospitalId(''); setVisitDate(''); setPurpose(''); setNotes(''); }} className="btn-secondary mt-2 w-full" data-testid="button-cancel-edit-plan">Cancel edit</button>}
      </form>
      <div>
        <div className="mb-4 flex items-end justify-between"><div><p className="eyebrow">Your checklist</p><h2 className="font-display mt-1 text-xl font-bold">Upcoming visits</h2></div><span className="disclaimer">{plans.data?.length ?? 0} saved plans</span></div>
        {plans.isLoading && <LoadingCards />}{plans.isError && <ErrorState retry={() => plans.refetch()} />}
        {!plans.isLoading && !plans.isError && (
          plans.data?.length ? (
            <div className="space-y-3">
              {plans.data.map((p: VisitPlan) => (
                <article key={p.id} className="panel p-5" data-testid={`plan-${p.id}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="rounded-full bg-[#edf1e4] px-2.5 py-1 text-[10px] font-bold text-[#566d3d]">{String(p.visitDate)}</span>
                      <h3 className="font-display mt-3 text-lg font-bold">{p.purpose}</h3>
                      <p className="mt-1 text-sm text-[#667160]">{p.hospitalName}</p>
                      {p.notes && <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#586451]">{p.notes}</p>}
                    </div>
                    <div className="flex gap-2">
                      <button className="btn-secondary !min-h-9 !px-3" onClick={() => startEdit(p)} data-testid={`button-edit-plan-${p.id}`}>Edit</button>
                      <button className="btn-secondary !min-h-9 !px-3 !text-[#8a4940]" onClick={() => { if (window.confirm('Delete this visit plan?')) (remove.mutate as (v:any)=>void)({ id: p.id }); }} data-testid={`button-delete-plan-${p.id}`}>Delete</button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="panel py-14 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#edf1e4] text-[#596f40]"><CalendarDays /></div>
              <h3 className="font-display mt-4 text-lg font-bold">Nothing planned yet</h3>
              <p className="mt-2 text-sm text-[#6b7564]">Add a facility and visit date to start your checklist.</p>
            </div>
          )
        )}
      </div>
    </div>
    <div className="mt-7"><PrototypeNote>Visit plans are personal reminders. They do not reserve a slot or confirm medical services.</PrototypeNote></div>
  </div></AuthGate></Shell>;
}
function EmergencyPage() {
  const [city, setCity] = useState('');
  const [category, setCategory] = useState('');
  const facilities = useListEmergencyFacilities({ city: city || undefined, category: category || undefined });
  return <Shell><div className="page-wrap py-10"><div className="mb-8 overflow-hidden rounded-[24px] bg-[#8e3f34] p-6 text-[#fff8ee] sm:flex sm:items-center sm:justify-between sm:p-9">
    <div><p className="eyebrow !text-[#f4d7c8]">Immediate danger?</p><h1 className="font-display mt-2 text-3xl font-extrabold tracking-[-.04em] sm:text-4xl">Call emergency services.</h1><p className="mt-3 max-w-xl text-sm leading-6 text-[#f4ded4]">For emergency response in India, call 108 now. Do not rely on sample directories or CarePath for emergency dispatch.</p></div>
    <a href="tel:108" className="mt-6 inline-flex min-h-14 items-center gap-3 rounded-2xl bg-[#fff8ee] px-6 font-display text-xl font-extrabold text-[#8e3f34] sm:mt-0" data-testid="link-call-108"><Phone size={20} /> Call 108</a>
  </div>
  <PageTitle eyebrow="Emergency directory" title="Facilities to contact" description="These sample contacts are informational only. Verify phone numbers and current emergency capacity directly." />
  <div className="panel mb-6 grid gap-3 p-4 sm:grid-cols-[1fr_1fr]">
    <select className="field" value={city} onChange={e => setCity(e.target.value)} data-testid="emergency-city"><option value="">All cities</option><option>Hyderabad</option><option>Vijayawada</option></select>
    <select className="field" value={category} onChange={e => setCategory(e.target.value)} data-testid="emergency-category"><option value="">All categories</option><option value="Emergency department">Emergency department</option><option value="Cardiac care">Cardiac care</option><option value="General care">General care</option></select>
  </div>
  {facilities.isLoading && <LoadingCards />}{facilities.isError && <ErrorState retry={() => facilities.refetch()} />}
  {!facilities.isLoading && !facilities.isError && (
    facilities.data?.length ? (
      <div className="grid gap-4 md:grid-cols-2">
        {facilities.data.map((f: EmergencyFacility) => (
          <article className="panel p-5" key={f.id} data-testid={`emergency-facility-${f.id}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#f8e8e1] text-[#985345]"><HeartPulse size={19} /></div>
                <div>
                  <h2 className="font-display font-bold">{f.name}</h2>
                  <p className="mt-1 text-xs capitalize text-[#687262]">{f.type} · {f.city}</p>
                </div>
              </div>
              <span className="rounded-full bg-[#f1f2ea] px-2 py-1 text-[9px] font-bold text-[#687262]">Sample</span>
            </div>
            <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-[#5f6b59]"><MapPin size={14} className="mt-0.5 shrink-0" />{f.address}</p>
            <p className="mt-3 rounded-lg bg-[#f5f2e8] p-3 text-xs leading-5 text-[#687262]">{f.availabilityNote}</p>
            <a href={`tel:${f.phone}`} className="btn-secondary mt-4 w-full" data-testid={`link-emergency-call-${f.id}`}><Phone size={14} /> Call {f.phone}</a>
          </article>
        ))}
      </div>
    ) : (
      <div className="panel p-8 text-center text-sm text-[#6b7564]">No sample facilities match these filters. In an emergency, call 108.</div>
    )
  )}
  <div className="mt-5"><PrototypeNote>Directory data is sample information. Contact emergency services directly to confirm availability.</PrototypeNote></div>
  </div></Shell>;
}
function ProfilePage() {
  const { isSignedIn } = useAuth();
  const profile = useGetProfile({ query: { enabled: !!isSignedIn, queryKey: getGetProfileQueryKey() } });
  const client = useQueryClient();
  const update = useUpdateProfile({ mutation: { onSuccess: () => client.invalidateQueries({ queryKey: getGetProfileQueryKey() }) } });
  const [name, setName] = useState('');
  const initialized = useRef(false);
  useEffect(() => { if (profile.data && !initialized.current) { initialized.current = true; setName(profile.data.name); } }, [profile.data]);
  return <Shell><AuthGate><div className="page-wrap py-10"><PageTitle eyebrow="Account settings" title="Your profile" description="Keep your CarePath account details up to date." />
    {profile.isLoading && <LoadingCards count={1} />}{profile.isError && <ErrorState retry={() => profile.refetch()} />}
    {profile.data && <div className="grid gap-6 lg:grid-cols-[300px_1fr]"><div className="panel p-6 text-center"><div className="mx-auto grid h-16 w-16 place-items-center rounded-[22px] bg-[#e8eddd] text-[#52693a]"><UserRound size={28} /></div><h2 className="font-display mt-4 text-xl font-bold">{profile.data.name}</h2><p className="mt-1 text-sm text-[#6b7564]">{profile.data.email}</p><span className="mt-4 inline-flex rounded-full bg-[#edf1e4] px-3 py-1 text-[10px] font-bold uppercase text-[#56703b]">{profile.data.role}</span><p className="mt-5 disclaimer">Member since {new Date(profile.data.createdAt).toLocaleDateString()}</p></div>
      <form className="panel p-6" onSubmit={e => { e.preventDefault(); (update.mutate as (v:any)=>void)({ data: { name } }); }}><p className="eyebrow">Personal details</p><h2 className="font-display mt-1 text-xl font-bold">Edit your details</h2><label className="mt-5 block max-w-lg text-xs font-semibold">Full name<input className="field mt-1" maxLength={120} required value={name} onChange={e => setName(e.target.value)} data-testid="input-profile-name" /></label><div className="mt-4 max-w-lg"><p className="text-xs font-semibold">Email address</p><p className="mt-2 rounded-xl bg-[#f2f3ec] px-4 py-3 text-sm text-[#6b7564]">{profile.data.email}</p><p className="mt-1 disclaimer">Email is managed by your sign-in provider.</p></div><button className="btn-primary mt-6" disabled={update.isPending} data-testid="button-save-profile">{update.isPending ? 'Saving…' : 'Save profile'} <Check size={15} /></button></form>
    </div>}
  </div></AuthGate></Shell>;
}

function JsonAdminEditor({ label, placeholder, onSave, pending }: { label: string; placeholder: string; onSave: (value: any) => void; pending: boolean }) {
  const [json, setJson] = useState(placeholder);
  const [error, setError] = useState('');
  return <form className="panel p-4" onSubmit={e => { e.preventDefault(); try { onSave(JSON.parse(json)); setError(''); } catch { setError('Enter valid JSON before saving.'); } }}>
    <p className="text-xs font-bold text-[#40583a]">{label}</p><textarea className="field mt-2 min-h-[130px] resize-y py-3 font-mono text-[11px]" value={json} onChange={e => setJson(e.target.value)} data-testid={`input-admin-${label.toLowerCase().replace(/\s/g,'-')}`} />
    {error && <p className="mt-2 text-xs text-red-700">{error}</p>}<button className="btn-primary mt-3 !min-h-10" disabled={pending} data-testid={`button-admin-${label.toLowerCase().replace(/\s/g,'-')}`}>{pending ? 'Saving…' : label}<Plus size={14} /></button>
  </form>;
}
function AdminPage() {
  const { isSignedIn } = useAuth();
  const profile = useGetProfile({ query: { enabled: !!isSignedIn, queryKey: getGetProfileQueryKey() } });
  const [tab, setTab] = useState('hospitals');
  const client = useQueryClient();
  const hospitals = useAdminListHospitals({ query: { enabled: profile.data?.role === 'admin', queryKey: getAdminListHospitalsQueryKey() } });
  const doctors = useAdminListDoctors({ query: { enabled: profile.data?.role === 'admin', queryKey: getAdminListDoctorsQueryKey() } });
  const specialties = useAdminListSpecialties({ query: { enabled: profile.data?.role === 'admin', queryKey: getAdminListSpecialtiesQueryKey() } });
  const appointments = useAdminListAppointments({ query: { enabled: profile.data?.role === 'admin', queryKey: getAdminListAppointmentsQueryKey() } });
  const users = useAdminListUsers({ query: { enabled: profile.data?.role === 'admin', queryKey: getAdminListUsersQueryKey() } });
  const reviews = useAdminListReviews({ query: { enabled: profile.data?.role === 'admin', queryKey: getAdminListReviewsQueryKey() } });
  const createHospital = useAdminCreateHospital({ mutation: { onSuccess: () => { client.invalidateQueries({ queryKey: getAdminListHospitalsQueryKey() }); invalidateFacilityCaches(client); } } });
  const updateHospital = useAdminUpdateHospital({ mutation: { onSuccess: () => { client.invalidateQueries({ queryKey: getAdminListHospitalsQueryKey() }); invalidateFacilityCaches(client); } } });
  const deleteHospital = useAdminDeleteHospital({ mutation: { onSuccess: () => { client.invalidateQueries({ queryKey: getAdminListHospitalsQueryKey() }); invalidateFacilityCaches(client); } } });
  const createDoctor = useAdminCreateDoctor({ mutation: { onSuccess: () => { client.invalidateQueries({ queryKey: getAdminListDoctorsQueryKey() }); client.invalidateQueries({ queryKey: ['/api/hospitals'] }); } } });
  const updateDoctor = useAdminUpdateDoctor({ mutation: { onSuccess: () => { client.invalidateQueries({ queryKey: getAdminListDoctorsQueryKey() }); client.invalidateQueries({ queryKey: ['/api/hospitals'] }); } } });
  const deleteDoctor = useAdminDeleteDoctor({ mutation: { onSuccess: () => { client.invalidateQueries({ queryKey: getAdminListDoctorsQueryKey() }); client.invalidateQueries({ queryKey: ['/api/hospitals'] }); } } });
  const createSpecialty = useAdminCreateSpecialty({ mutation: { onSuccess: () => { client.invalidateQueries({ queryKey: getAdminListSpecialtiesQueryKey() }); invalidateFacilityCaches(client); } } });
  const updateSpecialty = useAdminUpdateSpecialty({ mutation: { onSuccess: () => { client.invalidateQueries({ queryKey: getAdminListSpecialtiesQueryKey() }); invalidateFacilityCaches(client); } } });
  const deleteSpecialty = useAdminDeleteSpecialty({ mutation: { onSuccess: () => { client.invalidateQueries({ queryKey: getAdminListSpecialtiesQueryKey() }); invalidateFacilityCaches(client); } } });
  const moderate = useAdminModerateReview({ mutation: { onSuccess: () => { client.invalidateQueries({ queryKey: getAdminListReviewsQueryKey() }); client.invalidateQueries({ queryKey: ['/api/hospitals'] }); } } });
  const tabs = ['hospitals','doctors','specialties','appointments','reviews','users'];
  if (profile.isLoading) return <Shell><div className="page-wrap py-12"><LoadingCards count={1} /></div></Shell>;
  if (profile.data?.role !== 'admin') return <Shell><AuthGate><div className="page-wrap py-12"><div className="panel mx-auto max-w-xl p-8 text-center"><ShieldCheck className="mx-auto text-[#566d3d]" size={32} /><h1 className="font-display mt-4 text-2xl font-bold">Admin access required</h1><p className="mt-2 text-sm text-[#6b7564]">This management area is only available to CarePath administrators.</p><Link className="btn-secondary mt-5" href="/">Return home</Link></div></div></AuthGate></Shell>;
  const data: any = { hospitals: hospitals.data, doctors: doctors.data, specialties: specialties.data, appointments: appointments.data, reviews: reviews.data, users: users.data };
  const invalidateAll = () => {
    client.invalidateQueries({ queryKey: getAdminListHospitalsQueryKey() });
    client.invalidateQueries({ queryKey: getAdminListDoctorsQueryKey() });
    client.invalidateQueries({ queryKey: getAdminListSpecialtiesQueryKey() });
    client.invalidateQueries({ queryKey: getListHospitalsQueryKey() });
    client.invalidateQueries({ queryKey: getListSpecialtiesQueryKey() });
    client.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
    client.invalidateQueries({ queryKey: ['/api/hospitals'] });
  };
  const createMutation: any = { hospitals: createHospital, doctors: createDoctor, specialties: createSpecialty };
  const placeholder: Record<string,string> = {
    hospitals: '{"name":"New facility","type":"hospital","address":"Street, locality","city":"Hyderabad","locality":"Madhapur","contactPhone":"+91 40 0000 0000","waitingMinutes":20,"isOpen":true,"emergency":false,"hours":"9:00 AM – 6:00 PM","specialtyIds":[]}',
    doctors: '{"hospitalId":1,"name":"Dr. A. Rao","specialtyId":1,"qualifications":"MBBS, MD","yearsExperience":8,"available":true}',
    specialties: '{"name":"Dermatology","description":"Skin, hair and nail care"}',
  };
  const renderRows = () => {
    if (['hospitals','doctors','specialties'].includes(tab)) return <div className="space-y-3">{(data[tab] ?? []).map((item: any) => <article key={item.id} className="panel flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center" data-testid={`admin-row-${tab}-${item.id}`}><div><p className="font-semibold text-sm">{item.name}</p><p className="mt-1 text-xs text-[#6b7564]">{tab === 'hospitals' ? `${item.locality}, ${item.city} · ${item.contactPhone}` : tab === 'doctors' ? `${item.specialty} · ${item.qualifications}` : item.description}</p></div><div className="flex gap-2"><button className="btn-secondary !min-h-9" onClick={() => { const raw = window.prompt(`Edit ${tab.slice(0,-1)} JSON`, JSON.stringify(item, null, 2)); if (!raw) return; try { const parsed = JSON.parse(raw); const mut: any = tab === 'hospitals' ? updateHospital : tab === 'doctors' ? updateDoctor : updateSpecialty; (mut.mutate as (v:any)=>void)({ id: item.id, data: parsed }); } catch { window.alert('Please enter valid JSON.'); } }} data-testid={`button-admin-edit-${tab}-${item.id}`}>Edit</button><button className="btn-secondary !min-h-9 !text-[#8a4940]" onClick={() => { if (!window.confirm(`Delete this ${tab.slice(0,-1)}?`)) return; const mut: any = tab === 'hospitals' ? deleteHospital : tab === 'doctors' ? deleteDoctor : deleteSpecialty; (mut.mutate as (v:any)=>void)({ id: item.id }); }} data-testid={`button-admin-delete-${tab}-${item.id}`}>Delete</button></div></article>)}{!data[tab]?.length && <div className="panel p-6 text-sm text-[#6b7564]">No {tab} records yet.</div>}</div>;
    if (tab === 'reviews') return <div className="space-y-3">{(data.reviews ?? []).map((r: any) => <article className="panel p-4" key={r.id} data-testid={`admin-review-${r.id}`}><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold">{r.userName} · {r.hospitalName}</p><p className="mt-2 text-sm text-[#5d6857]">{r.text}</p><p className="mt-2 disclaimer">{r.rating} stars · {r.status} · {r.isDemo ? 'Sample' : 'User-submitted'}</p></div><select className="field !min-h-9 !w-auto text-xs" value={r.status} onChange={e => (moderate.mutate as (v:any)=>void)({ id: r.id, data: { status: e.target.value } })} data-testid={`select-review-status-${r.id}`}><option value="visible">Visible</option><option value="hidden">Hidden</option></select></div></article>)}{!data.reviews?.length && <div className="panel p-6">No reviews awaiting moderation.</div>}</div>;
    const list = data[tab] ?? [];
    return <div className="space-y-3">{list.map((item: any) => <article key={item.id} className="panel p-4" data-testid={`admin-row-${tab}-${item.id}`}><p className="font-semibold text-sm">{item.hospitalName || item.name || item.patientName || item.email}</p><pre className="mt-2 overflow-auto text-[10px] text-[#6b7564]">{JSON.stringify(item, null, 2)}</pre></article>)}{!list.length && <div className="panel p-6 text-sm text-[#6b7564]">No {tab} records.</div>}</div>;
  };
  return <Shell><div className="page-wrap py-10"><PageTitle eyebrow="Management" title="CarePath admin" description="Manage discovery listings and moderate community information. Sample records are clearly marked for public visitors." />
    <div className="mb-5 flex gap-2 overflow-x-auto pb-2">{tabs.map(t => <button key={t} onClick={() => setTab(t)} className={`rounded-full px-4 py-2 text-xs font-bold capitalize ${tab === t ? 'bg-[#405b32] text-white' : 'bg-[#edf0e6] text-[#5c6953]'}`} data-testid={`admin-tab-${t}`}>{t}</button>)}</div>
    {['hospitals','doctors','specialties'].includes(tab) && <div className="mb-5 grid gap-4 lg:grid-cols-[1fr_1.4fr]">
      <JsonAdminEditor label={`Add ${tab.slice(0,-1)}`} placeholder={placeholder[tab]} pending={createMutation[tab].isPending} onSave={val => { (createMutation[tab].mutate as (v:any)=>void)({ data: val }); }} />
      <div className="panel p-4"><p className="text-xs font-bold text-[#40583a]">Data shape</p><p className="mt-2 text-xs leading-5 text-[#697363]">Use the generated API data model. Numeric ids and fields must match existing specialty and facility ids. Editing and delete actions are available on each record below.</p><p className="mt-3 disclaimer">All related public listing caches refresh after changes.</p></div>
    </div>}
    {tab === 'appointments' && <div className="mb-5 panel flex flex-wrap gap-4 p-4 text-xs text-[#5d6857]"><span>{data.appointments?.length ?? 0} appointments</span><span>{users.data?.length ?? 0} users</span><span>{data.reviews?.length ?? 0} reviews</span></div>}
    {(hospitals.isLoading || doctors.isLoading || specialties.isLoading || appointments.isLoading || users.isLoading || reviews.isLoading) && <LoadingCards count={2} />}
    {(hospitals.isError || doctors.isError || specialties.isError || appointments.isError || users.isError || reviews.isError) && <ErrorState retry={() => invalidateAll()} />}
    {renderRows()}
    <p className="disclaimer mt-5">Admin management requires an admin account. Public facility content may represent prototype data and should not be treated as real-time service availability.</p>
  </div></Shell>;
}
function SignInPage() { return <div className="flex min-h-[100dvh] items-center justify-center bg-[#f8f8f1] px-4 py-10"><div><div className="mb-5 text-center"><Brand /><p className="mt-3 text-xs text-[#667160]">Find care, at your own pace.</p></div><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /></div></div>; }
function SignUpPage() { return <div className="flex min-h-[100dvh] items-center justify-center bg-[#f8f8f1] px-4 py-10"><div><div className="mb-5 text-center"><Brand /><p className="mt-3 text-xs text-[#667160]">A little more clarity for your next visit.</p></div><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} /></div></div>; }
function ClerkCacheInvalidator() {
  const { addListener } = useClerk();
  const client = useQueryClient();
  const previous = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const unsub = addListener(({ user }) => {
      const id = user?.id ?? null;
      if (previous.current !== undefined && previous.current !== id) client.clear();
      previous.current = id;
    });
    return unsub;
  }, [addListener, client]);
  return null;
}
function HomeRedirect() {
  const { isLoaded, isSignedIn } = useAuth();
  const [, setLocation] = useLocation();
  useEffect(() => {
    if (isLoaded && isSignedIn) setLocation('/appointments', { replace: true });
  }, [isLoaded, isSignedIn, setLocation]);
  return isLoaded && isSignedIn
    ? <div className="page-wrap py-16"><LoadingCards count={1} /></div>
    : <Home />;
}
function RoutedErrorBoundary({ children }: { children: ReactNode }) { const [location] = useLocation(); return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>; }
function AppRoutes() {
  const [, setLocation] = useLocation();
  return <ClerkProvider publishableKey={clerkPubKey} proxyUrl={clerkProxyUrl} appearance={clerkAppearance} signInUrl={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`}
    localization={{ signIn: { start: { title: 'Welcome back', subtitle: 'Sign in to plan your care' } }, signUp: { start: { title: 'Create your CarePath account', subtitle: 'Keep your next visit in view' } } }}
    routerPush={to => setLocation(stripBase(to))} routerReplace={to => setLocation(stripBase(to), { replace: true })}>
    <ClerkCacheInvalidator />
    <RoutedErrorBoundary><Switch>
      <Route path="/" component={HomeRedirect} />
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />
      <Route path="/hospitals" component={HospitalsPage} />
      <Route path="/hospitals/:id">{params => <HospitalDetailPage id={params.id} />}</Route>
      <Route path="/appointments" component={AppointmentsPage} />
      <Route path="/my-plan" component={MyPlanPage} />
      <Route path="/emergency" component={EmergencyPage} />
      <Route path="/profile" component={ProfilePage} />
      <Route path="/admin" component={AdminPage} />
      <Route component={NotFound} />
    </Switch></RoutedErrorBoundary>
  </ClerkProvider>;
}
function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={basePath}><AppRoutes /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}
export default App;