import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import INDIA_PLACES from './data/india-major-places.json';

const API_BASE = String(import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '');
const API = API_BASE ? `${API_BASE}${/\/api$/i.test(API_BASE) ? '' : '/api'}` : '/api';
const CATEGORIES = ['Actor', 'Model', 'Presenter', 'Singer', 'Musician', 'Filmmaker', 'Voice artist', 'Dancer', 'Photographer', 'Editor', 'Writer'];
const PUBLIC_FILTERS = ['All categories', ...CATEGORIES];
const PLACES_API_KEY = import.meta.env.VITE_GOOGLE_PLACES_API_KEY || '';
const PLACE_TYPES = ['(cities)', '(regions)'];

async function api(path, opt = {}) { const token = localStorage.getItem('rot_access'); const headers = { 'Content-Type': 'application/json', ...(opt.headers || {}) }; if (token) headers.Authorization = `Bearer ${token}`; const r = await fetch(API + path, { ...opt, headers }); const d = await r.json().catch(() => ({})); if (!r.ok) { const err=Error(d.error || 'Request failed'); err.data=d; throw err; } return d; }
function saveAuth(d) { localStorage.setItem('rot_access', d.accessToken); localStorage.setItem('rot_refresh', d.refreshToken); localStorage.setItem('rot_user', JSON.stringify(d.user)); return d.user; }
function loadRazorpay() { return new Promise((resolve, reject) => { if (window.Razorpay) return resolve(); const s = document.createElement('script'); s.src = 'https://checkout.razorpay.com/v1/checkout.js'; s.onload = resolve; s.onerror = () => reject(Error('Unable to load payment checkout')); document.body.appendChild(s); }); }
function initials(name = '') { return name.split(' ').filter(Boolean).slice(0, 2).map(x => x[0]).join('').toUpperCase() || 'RT'; }
function friendlyError(error) { const m=String(error?.message || ''); if (/Cannot set properties of (null|undefined)|Cannot read propert|TypeError|ReferenceError|SyntaxError|is not a function|undefined is not|failed to fetch/i.test(m)) return 'Something went wrong. Please try again.'; return m || 'Something went wrong. Please try again.'; }

function RecruiterFilters({ search, setSearch, sex, setSex, minAge, setMinAge, maxAge, setMaxAge, minHeight, setMinHeight, maxHeight, setMaxHeight, clear }) {
  return <div className="recruiter-filters">
    <div className="recruiter-filter-head"><span className="eyebrow">RECRUITER SEARCH</span><button type="button" className="text-btn" onClick={clear}>Clear filters</button></div>
    <div className="recruiter-filter-grid">
      <label>Search<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Name, role or keyword" /></label>
      <label>Sex<select value={sex} onChange={e=>setSex(e.target.value)}><option value="">Any</option><option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option></select></label>
      <label>Min age<input type="number" min="0" value={minAge} onChange={e=>setMinAge(e.target.value)} placeholder="18" /></label>
      <label>Max age<input type="number" min="0" value={maxAge} onChange={e=>setMaxAge(e.target.value)} placeholder="60" /></label>
      <label>Min height (cm)<input type="number" min="0" value={minHeight} onChange={e=>setMinHeight(e.target.value)} placeholder="150" /></label>
      <label>Max height (cm)<input type="number" min="0" value={maxHeight} onChange={e=>setMaxHeight(e.target.value)} placeholder="200" /></label>
    </div>
  </div>;
}

function App() {
    const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('rot_user') || 'null'));
    const [profiles, setProfiles] = useState([]); const [castingCalls, setCastingCalls] = useState([]); const [category, setCategory] = useState(''); const [location, setLocation] = useState('');
    const [search, setSearch] = useState(''); const [sex, setSex] = useState(''); const [minAge, setMinAge] = useState(''); const [maxAge, setMaxAge] = useState(''); const [minHeight, setMinHeight] = useState(''); const [maxHeight, setMaxHeight] = useState('');
    const [modal, setModal] = useState(null); const [selected, setSelected] = useState(null); const [sharedProfile, setSharedProfile] = useState(null); const [sharedCastingCall, setSharedCastingCall] = useState(null); const [toast, setToast] = useState(''); const [loading, setLoading] = useState(false); const [menuOpen, setMenuOpen] = useState(false);
    useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(''), 3000); return () => window.clearTimeout(timer); }, [toast]);
    const recruiter = Boolean(user && (user.role === 'RECRUITER' || user.role === 'SUPER_ADMIN'));
    function profileSlug(p) {
      const name = String(p?.displayName || 'talent').toLowerCase().trim()
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'talent';
      return `${name}-${p?.id || ''}`.replace(/-+$/, '');
    }
    useEffect(() => {
      const path = window.location.pathname;
      const short = path.match(/^\/p\/([a-z0-9-]+)$/i);
      const legacy = path.match(/^\/profile\/(\d+)$/);
      const casting = path.match(/^\/c\/([a-z0-9-]+)$/i);
      const slug = short?.[1];
      const castingSlug = casting?.[1];
      const id = legacy?.[1] || (slug ? (slug.match(/-(\d+)$/)?.[1] || '') : '');
      const castingId = castingSlug ? (castingSlug.match(/-(\d+)$/)?.[1] || '') : '';
      if (castingId) {
        api(`/casting-calls/${castingId}/public`).then(d => setSharedCastingCall(d.castingCall)).catch(() => setSharedCastingCall(null));
        return;
      }
      if (!id) return;
      api(`/talents/${id}/public`).then(t => {
        setSharedProfile(t);
        window.history.replaceState({ profile: t.id }, '', `/p/${profileSlug(t)}`);
      }).catch(() => setSharedProfile(null));
    }, []);
    useEffect(() => {
      const onPop = () => {
        const m = window.location.pathname.match(/^\/p\/([a-z0-9-]+)$/i);
        const legacy = window.location.pathname.match(/^\/profile\/(\d+)$/);
        const c = window.location.pathname.match(/^\/c\/([a-z0-9-]+)$/i);
        const id = legacy?.[1] || (m?.[1]?.match(/-(\d+)$/)?.[1] || '');
        const castingId = c?.[1]?.match(/-(\d+)$/)?.[1] || '';
        if (castingId) api(`/casting-calls/${castingId}/public`).then(d => { setSharedCastingCall(d.castingCall); setSharedProfile(null); }).catch(() => setSharedCastingCall(null));
        else if (id) api(`/talents/${id}/public`).then(t => { setSharedProfile(t); setSharedCastingCall(null); }).catch(() => setSharedProfile(null));
        else { setSharedProfile(null); setSharedCastingCall(null); }
      };
      window.addEventListener('popstate', onPop);
      return () => window.removeEventListener('popstate', onPop);
    }, []);
    function openProfile(p) {
      setSelected(null); setSharedProfile(p);
      window.history.pushState({ profile: p.id }, '', `/p/${profileSlug(p)}`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    function closeSharedProfile() { window.history.pushState({}, '', '/'); setSharedProfile(null); setSharedCastingCall(null); }
    function castingSlug(c) {
      const name = String(c?.projectName || c?.title || 'casting-call').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'casting-call';
      return `${name}-${c?.id || ''}`.replace(/-+$/, '');
    }
    function openCastingCall(c) { setSharedProfile(null); setSharedCastingCall(c); window.history.pushState({ castingCall: c.id }, '', `/c/${castingSlug(c)}`); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    const load = async () => { setLoading(true); try { const q = new URLSearchParams(); if (category) q.set('category', category); if (location) q.set('location', location); if (search) q.set('search', search); if (recruiter) { [['search', search], ['sex', sex], ['minAge', minAge], ['maxAge', maxAge], ['minHeight', minHeight], ['maxHeight', maxHeight]].forEach(([k, v]) => v && q.set(k, v)); } const d = await api('/talents?' + q); const items = d.items || []; for (let i = items.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [items[i], items[j]] = [items[j], items[i]]; } setProfiles(items); } catch (e) { setProfiles([]); setToast(friendlyError(e)) } finally { setLoading(false) } };
    useEffect(() => { load() }, [category, location, search, sex, minAge, maxAge, minHeight, maxHeight, user?.role]);
    useEffect(() => { api('/casting-calls').then(d => setCastingCalls(d.castingCalls || [])).catch(() => setCastingCalls([])); }, []);
    function auth(d) { const u = saveAuth(d); setUser(u); setModal(u.role === 'TALENT' ? 'profile' : 'dashboard'); setToast(u.role === 'TALENT' ? 'Build your profile to enter the room.' : 'Welcome back.'); }
    async function logout() { try { await api('/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken: localStorage.getItem('rot_refresh') }) }) } catch { } localStorage.clear(); setUser(null); setModal(null); load(); }
    return <div className={`app ${(sharedProfile || sharedCastingCall) ? 'has-shared-profile' : ''}`}><header className="nav auth-only"><a className="brand-lockup" href="/" aria-label="Room of Talents home" onClick={e => { if (sharedProfile || sharedCastingCall) { e.preventDefault(); closeSharedProfile(); } }}><img src="/logo.png" alt="Room of Talents" className="brand-mark" /><span className="logo">room<span>of</span>talents<span className="dot">.</span></span></a><div className="nav-actions">{user ? <button className="glass" onClick={() => setModal('dashboard')}>{user.name.split(' ')[0]} ↗</button> : <><button className="text-btn" onClick={() => setModal('login')}>Log in</button><button className="solid" onClick={() => setModal('register')}>Join the room ↗</button></>}</div></header>
        <main id="top"><section id="discover" className="directory"><div className="directory-top"><div><div className="eyebrow">ROOM OF TALENTS / LIVE CASTING DIRECTORY</div><div className="directory-title"><h1>Walk into the <i>room of talents.</i></h1><p>Discover distinctive people, bold profiles, and talent ready for the next production.</p>
                <div className="mobile-first-cards">{loading ? <MobileLoadingCards /> : profiles.slice(0, 10).map((p, i) => <TalentCard key={`mobile-${p.id}`} p={p} index={i} onClick={() => openProfile(p)} />)}</div>
                </div></div></div>
            <CastingCallStrip calls={castingCalls} onOpen={openCastingCall} />
            <div className="public-search"><div className="search-main"><span aria-hidden="true">⌕</span><LocationPicker value={location} onChange={setLocation} placeholder="Type 3 letters to find a place" /><div className="category-inline"><label htmlFor="public-category">Category</label><select id="public-category" value={category} onChange={e => setCategory(e.target.value)}><option value="">All categories</option>{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div></div></div>
            {recruiter && (
                <RecruiterFilters
                    search={search}
                    setSearch={setSearch}
                    sex={sex}
                    setSex={setSex}
                    minAge={minAge}
                    setMinAge={setMinAge}
                    maxAge={maxAge}
                    setMaxAge={setMaxAge}
                    minHeight={minHeight}
                    setMinHeight={setMinHeight}
                    maxHeight={maxHeight}
                    setMaxHeight={setMaxHeight}
                    clear={() => {
                        setSearch('');
                        setSex('');
                        setMinAge('');
                        setMaxAge('');
                        setMinHeight('');
                        setMaxHeight('');
                    }}
                />
            )}

            <div className="directory-bar">
                <span>
                    {recruiter
                        ? 'RECRUITER SEARCH / ADVANCED FILTERS'
                        : 'PUBLIC DIRECTORY / PLACE + CATEGORY'}
                </span>

                <span>
                    {loading ? 'UPDATING…' : 'DRAG TO EXPLORE →'}
                </span>
            </div>

            {profiles.length ? (
                <div className="cards">
                    {profiles.map((p, i) => (
                        <TalentCard
                            key={p.id}
                            p={p}
                            index={i}
                            onClick={() => openProfile(p)}
                        />
                    ))}
                </div>
            ) : (
                <div className="empty">
                    <span>NO TALENTS YET</span>
                    <h2>{loading ? 'Finding people…' : 'The room is waiting.'}</h2>
                    <p>
                        Once subscribed talent profiles are live, they will appear here.
                    </p>
                    <button className="solid" onClick={() => setModal('register')}>
                        Create a profile ↗
                    </button>
                </div>
            )}</section>
        </main>
        {sharedProfile && <div className="shared-profile-page"><ProfileView talent={sharedProfile} user={user} onLogin={() => setModal('login')} setToast={setToast} /></div>} {sharedCastingCall && <div className="shared-profile-page"><CastingCallView call={sharedCastingCall} user={user} onLogin={() => setModal('login')} setToast={setToast} /></div>} {selected && <Modal title={selected.displayName} close={() => setSelected(null)} wide><ProfileView talent={selected} user={user} onLogin={() => { setSelected(null); setModal('login') }} setToast={setToast} /></Modal>}
        {modal && <Modal title={modal === 'login' ? 'Welcome back' : modal === 'register' ? 'Join the room' : modal === 'profile' ? 'Your talent profile' : modal === 'subscribe' ? 'Choose your membership' : modal === 'verify' ? 'Verify your email' : modal === 'forgot' ? 'Reset password' : modal === 'reset' ? 'Set a new password' : modal === 'casting' ? 'Post a casting call' : 'Command centre'} close={() => setModal(null)} wide={modal === 'dashboard'}><Form mode={modal} user={user} onAuth={auth} onLogout={logout} setToast={setToast} setModal={setModal} /></Modal>}{toast && <button className="toast" onClick={() => setToast('')}>{toast} ×</button>}<nav className="app-bottom-nav" aria-label="App navigation"><button className="bottom-nav-item active" onClick={() => document.getElementById('top')?.scrollIntoView({ behavior: 'smooth' })}><span className="nav-icon">⌂</span><span>Discover</span></button><button className="bottom-nav-item" onClick={() => setModal(user ? 'dashboard' : 'login')}><span className="nav-icon">◯</span><span>{user ? 'Account' : 'Sign in'}</span></button>{!user && <button className="bottom-nav-item" onClick={() => setModal('register')}><span className="nav-icon">＋</span><span>Join</span></button>}</nav></div>
}
function LocationPicker({ value, onChange, required = false, disabled = false, placeholder = 'Type at least 3 letters to find a place' }) {
    const [open, setOpen] = useState(false);
    const q = String(value || '').trim().toLowerCase();
    const options = useMemo(() => Object.entries(INDIA_PLACES).flatMap(([state, places]) => places.map(place => ({ place, state, label: `${place}, ${state}` }))), []);
    const results = q.length >= 3 ? options.filter(x => `${x.place}, ${x.state}`.toLowerCase().includes(q)).slice(0, 10) : [];
    return <div className="place-picker">
      <input type="text" required={required} disabled={disabled} value={value || ''} placeholder={placeholder} autoComplete="off" onFocus={() => setOpen(true)} onChange={e => { onChange(e.target.value); setOpen(true); }} onBlur={() => setTimeout(() => setOpen(false), 140)} aria-label="Location" />
      {open && !disabled && q.length >= 3 && <div className="place-results">{results.length ? results.map(x => <button type="button" key={`${x.state}-${x.place}`} onMouseDown={e => e.preventDefault()} onClick={() => { onChange(x.label); setOpen(false); }}><strong>{x.place}</strong><small>{x.state}</small></button>) : <div className="place-hint">No major places found. Try another 3+ letters.</div>}</div>}
      {open && !disabled && q.length > 0 && q.length < 3 && <div className="place-results"><div className="place-hint">Type 3 letters to find a major place.</div></div>}
    </div>;
}

function CastingCallStrip({ calls, onOpen }) {
  return <section className="casting-strip" aria-label="Casting calls">
    <div className="casting-strip-head"><div><span className="eyebrow">CASTING CALLS / OPEN</span><h2>Wanted: <i>people.</i></h2></div></div>
    {calls.length ? <div className="casting-cards">{calls.slice(0, 10).map((c, i) => <article className="casting-card" key={c.id || i} onClick={() => onOpen(c)} tabIndex="0" role="button" onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onOpen(c)}>
      {c.imageUrl && <div className="casting-card-photo"><img src={c.imageUrl} alt={c.projectName || c.title || 'Casting call'} /></div>}
      <div className="casting-card-top"><span className="wanted-pill">WANTED: {String(c.category || 'CREATIVE').toUpperCase()}</span><span className="casting-age">{c.ageRange || 'Any age'}</span></div>
      <h3>{c.projectName || c.title}</h3><div className="casting-meta"><span>⌖ {c.location}</span>{c.company && <span>{c.company}</span>}</div><p>{c.requirements || c.details}</p><div className="casting-open-link">Open casting call ↗</div>
    </article>)}</div> : <div className="casting-empty"><span>NO OPEN CASTING CALLS</span><strong>No open casting calls yet.</strong></div>}
  </section>;
}

function TalentCard({ p, index, onClick }) { const cover = (p.photos || [])[0] || p.imageUrl; const visuals = (p.photos || []).length || (p.imageUrl ? 1 : 0); const membership = p.membership === 'EXCLUSIVE' ? 'EXCLUSIVE' : p.membership === 'PRO' ? 'PRO' : ''; return <article className="talent-card" onClick={onClick} tabIndex="0" role="button" onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onClick()}><div className="photo">{cover ? <img src={cover} alt={p.displayName} onError={e => e.currentTarget.style.display = 'none'} /> : <div className="photo-fallback"><span>{initials(p.displayName)}</span></div>}<div className="photo-shade" /><div className="profile-badges">{membership && <span className={`profile-badge ${membership.toLowerCase()}`}>{membership}</span>}</div><span className="availability"><em /> Available</span><b className="card-arrow">↗</b><div className="card-index">{String(index + 1).padStart(2, '0')}</div><div className="photo-count">{visuals} {visuals === 1 ? 'image' : 'images'}</div><div className="card-bottomline"><span>{p.location || 'Location not listed'}</span><span>View profile</span></div></div><div className="talent-copy"><div><h3>{p.displayName}</h3><span className="hero-card-location">⌖ {p.location || 'Location not listed'}</span></div><small>Open to work</small></div></article> }
function MobileLoadingCards() { return <>{[1, 2, 3].map(n => <div className="talent-card skeleton-card" key={n}><div className="photo skeleton" /><div className="talent-copy"><div><div className="skeleton-line wide" /><div className="skeleton-line" /><div className="skeleton-line short" /></div></div></div>)}</> }
function videoMeta(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '').toLowerCase();
    if (host === 'youtu.be' || host.endsWith('youtube.com')) {
      let id = '';
      if (host === 'youtu.be') id = u.pathname.split('/').filter(Boolean)[0] || '';
      else if (u.pathname === '/watch') id = u.searchParams.get('v') || '';
      else if (u.pathname.startsWith('/shorts/')) id = u.pathname.split('/')[2] || '';
      else if (u.pathname.startsWith('/embed/')) id = u.pathname.split('/')[2] || '';
      else id = u.searchParams.get('v') || '';
      return id ? { type: 'youtube', id, label: 'YouTube showreel' } : { type: 'link', label: 'YouTube' };
    }
    if (host === 'vimeo.com' || host.endsWith('.vimeo.com')) {
      const id = u.pathname.split('/').filter(Boolean).find(part => /^\d+$/.test(part)) || '';
      return id ? { type: 'vimeo', id, label: 'Vimeo showreel' } : { type: 'link', label: 'Vimeo' };
    }
    return { type: 'link', label: host };
  } catch { return { type: 'link', label: 'Performance link' }; }
}
function VideoEmbed({ link, index }) {
  const meta = videoMeta(link);
  if (meta.type === 'youtube') return <div className="video-card"><div className="video-embed"><iframe src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(meta.id)}?rel=0`} title={`Performance ${index + 1} YouTube video`} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen /></div><div className="video-info"><strong>Performance {String(index + 1).padStart(2, '0')}</strong><span>YouTube showreel</span></div></div>;
  if (meta.type === 'vimeo') return <div className="video-card"><div className="video-embed"><iframe src={`https://player.vimeo.com/video/${encodeURIComponent(meta.id)}`} title={`Performance ${index + 1} Vimeo video`} loading="lazy" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen /></div><div className="video-info"><strong>Performance {String(index + 1).padStart(2, '0')}</strong><span>Vimeo showreel</span></div></div>;
  return <a className="video-card" href={link} target="_blank" rel="noreferrer"><div className="video-thumb"><div className="video-thumb-fallback">▶</div><span className="play-badge">▶</span></div><div className="video-info"><strong>Performance {String(index + 1).padStart(2, '0')}</strong><span>{meta.label} ↗</span></div></a>;
}
function ProfileView({ talent, user, onLogin, setToast }) {
  const [contact, setContact] = useState(null);
  const [busy, setBusy] = useState(false);
  const visuals = (talent.photos || []).length ? talent.photos : (talent.imageUrl ? [talent.imageUrl] : []);
  const categories = (talent.categories || []).join(' · ');
  const restricted = (talent.categories || []).some(c => ['actor','model','presenter'].includes(String(c).toLowerCase()));
  async function shareProfile() {
    const url = window.location.href;
    try { if (navigator.share) await navigator.share({ title: talent.displayName, text: `View ${talent.displayName} on RoomOfTalents`, url }); else { await navigator.clipboard.writeText(url); setToast('Profile link copied'); } }
    catch { setToast(url); }
  }
  async function reveal() {
    if (!user) { onLogin(); return; }
    setBusy(true);
    try { const d = await api(`/talents/${talent.id}/contact`); setContact(d); }
    catch (e) { setToast(friendlyError(e)); } finally { setBusy(false); }
  }
  const call = contact?.phone ? `tel:${contact.phone}` : '';
  const whatsapp = contact?.phone ? `https://wa.me/${String(contact.phone).replace(/\\D/g,'')}` : '';
  return <div className="profile-view">
    <div className="profile-hero">
      <div className="profile-gallery">{visuals.length ? visuals.slice(0,10).map((src,i)=><img key={`${src.slice(0,20)}-${i}`} src={src} alt={`${talent.displayName} ${i+1}`} />) : <div className="photo-fallback"><span>{initials(talent.displayName)}</span></div>}</div>
      <div>
        <div className="profile-view-heading"><div className="eyebrow">PROFILE / {talent.location}</div><div className="profile-heading-actions">{talent.membership && <span className={`profile-badge profile-membership-badge ${String(talent.membership).toLowerCase()}`}>{talent.membership}</span>}<button type="button" className="icon-button profile-share-button" aria-label="Share profile" title="Share profile" onClick={shareProfile}>↗</button></div></div>
        <h3>{talent.displayName}</h3>
        <p className="role-line">{categories}</p>
        <div className="tags">{(talent.categories||[]).map(c=><span key={c}>{c}</span>)}</div>
      </div>
    </div>
    <div className="profile-body">
      <p>{talent.bio || 'This talent has not added a biography yet.'}</p>
      {restricted && (talent.age || talent.sex || talent.heightCm) && <div className="facts">{talent.age && <span><b>{talent.age}</b> age</span>}{talent.sex && <span><b>{talent.sex}</b> sex</span>}{talent.heightCm && <span><b>{talent.heightCm} cm</b> height</span>}</div>}
      {(talent.skills||[]).length>0 && <div className="skill-row">{talent.skills.map(s=><span key={s}>{s}</span>)}</div>}
      {(talent.performanceLinks||[]).length>0 && <div className="performance-list"><div className="eyebrow">PERFORMANCE / SHOWREEL</div><div className="video-grid">{talent.performanceLinks.slice(0,10).map((link,i)=><VideoEmbed key={`${link}-${i}`} link={link} index={i} />)}</div></div>}
      <div className="contact-box"><div><span className="eyebrow">DIRECT CONTACT</span><strong>{contact ? `${contact.phone||'No phone'} · ${contact.email||'No email'}` : `Contact visible to PRO members, EXCLUSIVE members and hiring accounts`}</strong></div>{contact ? <div className="contact-actions">{contact.phone && <a className="solid" href={call}>Call</a>}{contact.phone && <a className="glass" href={whatsapp} target="_blank" rel="noreferrer">WhatsApp</a>}{contact.email && <a className="glass" href={`mailto:${contact.email}`}>Email</a>}</div> : talent.contactVisible !== false ? <button className="solid" disabled={busy} onClick={reveal}>{busy?'Checking…':'Reveal contact ↗'}</button> : null}</div>
      <div className="profile-conversion"><span className="eyebrow">YOUR NEXT STEP</span><h4>Build a profile that gets discovered.</h4><p>Show your work, skills and identity in a professional public profile like this.</p><button className="solid" onClick={onLogin}>Create your profile ↗</button></div>
    </div>
  </div>;
}
function Plan({ name, price, note, features, onClick }) { return <div className="plan"><div className="eyebrow">{name}</div><div className="price">₹{price}<small>/year</small></div><p>{note}</p><ul>{features.map(f => <li key={f}>✓ {f}</li>)}</ul><button className="solid" onClick={onClick}>Get started ↗</button></div> }
function Modal({ title, close, children, wide }) { return <div className="backdrop" onClick={close}><div className={`modal ${wide ? 'modal-wide' : ''}`} onClick={e => e.stopPropagation()}><button className="close" onClick={close}>×</button><div className="eyebrow">ROOMOFTALENTS.IN</div><h2>{title}</h2>{children}</div></div> }
function loadGoogleIdentityScript() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve();
    const existing = document.querySelector('script[data-google-identity]');
    if (existing) { existing.addEventListener('load', resolve, { once: true }); existing.addEventListener('error', () => reject(Error('Unable to load Google sign-in')), { once: true }); return; }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true; script.defer = true; script.dataset.googleIdentity = 'true';
    script.onload = resolve; script.onerror = () => reject(Error('Unable to load Google sign-in'));
    document.head.appendChild(script);
  });
}
function Form({ mode, user, onAuth, onLogout, setToast, setModal }) {
    const [kind, setKind] = useState('TALENT'); const [editing, setEditing] = useState(false); const [loading, setLoading] = useState(false); const [error, setError] = useState(''); const [status, setStatus] = useState(null); const [subscriptions, setSubscriptions] = useState([]);
    const [f, setF] = useState({ name: '', email: (mode === 'verify' || mode === 'reset' ? localStorage.getItem('rot_pending_email') || '' : ''), password: '', displayName: '', categories: [], location: '', contactVisible: true, age: '', sex: '', heightCm: '', bio: '', phone: '', photos: [], performanceLinks: [], skills: '' });
    const googleButtonRef = useRef(null); const googleClientId = String(import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim();
    useEffect(() => {
      if (!['login','register'].includes(mode) || !googleClientId || !googleButtonRef.current) return;
      let cancelled = false;
      loadGoogleIdentityScript().then(() => {
        if (cancelled || !googleButtonRef.current || !window.google?.accounts?.id) return;
        googleButtonRef.current.innerHTML = '';
        window.google.accounts.id.initialize({ client_id: googleClientId, callback: async (response) => {
          setError(''); setLoading(true);
          try { const d = await api('/auth/google', { method: 'POST', body: JSON.stringify({ credential: response.credential, role: kind }) }); onAuth(d); }
          catch (e) { setError(friendlyError(e)); } finally { setLoading(false); }
        }, auto_select: false, cancel_on_tap_outside: true });
        window.google.accounts.id.renderButton(googleButtonRef.current, { theme: 'outline', size: 'large', width: Math.min(400, googleButtonRef.current.clientWidth || 400), text: 'continue_with', shape: 'rectangular', logo_alignment: 'left' });
      }).catch(e => { if (!cancelled) setError(friendlyError(e)); });
      return () => { cancelled = true; };
    }, [mode, googleClientId, kind]); const set = (k, v) => setF(x => ({ ...x, [k]: v }));
    useEffect(() => { if (mode === 'profile' && user) api('/talents/me').then(d => { if (d.talent) setF(x => ({ ...x, ...d.talent, photos: d.talent.photos || [], performanceLinks: d.talent.performanceLinks || [], skills: (d.talent.skills || []).join(',') })); setStatus(d) }).catch(e => setError(friendlyError(e))); }, [mode, user]); useEffect(() => { if ((mode === 'subscribe' || mode === 'dashboard') && user) api('/subscriptions/mine').then(d => setSubscriptions(d.subscriptions || [])).catch(e => setError(friendlyError(e))); }, [mode, user]);
    async function submit(e) { e.preventDefault(); setError(''); setLoading(true); try { let d; if (mode === 'login') d = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email: f.email, password: f.password }) }); else if (mode === 'register') d = await api('/auth/register', { method: 'POST', body: JSON.stringify({ name: f.name, email: f.email, password: f.password, role: kind }) }); else if (mode === 'verify') d = await api('/auth/verify-email', { method: 'POST', body: JSON.stringify({ email: f.email, code: f.code }) }); else if (mode === 'forgot') d = await api('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email: f.email }) }); else if (mode === 'reset') d = await api('/auth/reset-password', { method: 'POST', body: JSON.stringify({ email: f.email, code: f.code, password: f.password }) }); else if (mode === 'profile') d = await api('/talents', { method: 'POST', body: JSON.stringify({ ...f, contactVisible: f.contactVisible !== false, age: f.age || null, heightCm: f.heightCm || null, skills: f.skills.split(',').map(x => x.trim()).filter(Boolean), categories: f.categories, photos: f.photos || [], performanceLinks: (f.performanceLinks || []).filter(Boolean) }) }); if (d?.verificationRequired) { localStorage.setItem('rot_pending_email', d.email || f.email); setModal('verify'); setToast(d.message); } else if (d?.user) { localStorage.removeItem('rot_pending_email'); onAuth(d); } else if (mode === 'forgot') { localStorage.setItem('rot_pending_email', f.email); setToast(d.message); setModal('reset'); } else if (mode === 'reset') { localStorage.removeItem('rot_pending_email'); setToast(d.message); setModal('login'); } else { setStatus(d); setToast(d.message || 'Saved successfully.'); if (mode === 'profile' && !d.hasActivePro) setModal('subscribe'); } } catch (e) { if (e.data?.verificationRequired) { localStorage.setItem('rot_pending_email', e.data.email || f.email); setModal('verify'); } setError(friendlyError(e)) } finally { setLoading(false) } }
    async function subscribe(plan) { setLoading(true); setError(''); try { await loadRazorpay(); const order = await api('/subscriptions/order', { method: 'POST', body: JSON.stringify({ plan }) }); const payment = new window.Razorpay({ key: order.keyId, amount: order.amount, currency: order.currency, name: 'RoomOfTalents.in', description: plan === 'EXCLUSIVE' ? 'Talent Exclusive' : 'Talent PRO', order_id: order.orderId, prefill: { name: user?.name, email: user?.email }, handler: async response => { try { const d = await api('/subscriptions/verify', { method: 'POST', body: JSON.stringify(response) }); setToast(d.message); setModal('dashboard'); } catch (e) { setError(friendlyError(e)) } }, modal: { ondismiss: () => setLoading(false) } }); payment.open(); } catch (e) { setError(friendlyError(e)); setLoading(false) } }
    if (mode === 'casting') return <CastingForm user={user} setModal={setModal} setToast={setToast} />;
    if (mode === 'subscribe') {
      const active = new Set(subscriptions.filter(s => s.status === 'ACTIVE' && (!s.endsAt || new Date(s.endsAt) > new Date())).map(s => s.plan));
      return <div className="membership-choice"><p>Choose the access level for your talent profile.</p>{active.size > 0 && <div className="active-membership"><span className="eyebrow">YOUR MEMBERSHIP</span><strong>{Array.from(active).join(' + ')} · ACTIVE</strong><small>You are already subscribed. You cannot purchase the same active plan again.</small></div>}<div className="mini-plans">
        {['PRO','EXCLUSIVE'].map(plan => { const isActive = active.has(plan); return <button key={plan} onClick={() => subscribe(plan)} disabled={loading || isActive}><b>{plan}</b><span>{plan === 'PRO' ? '₹499 / year' : '₹1,499 / year'}</span><small>{plan === 'PRO' ? 'Public discovery + PRO contact network' : 'Private exclusive network + PRO benefits'}</small>{isActive && <em>ACTIVE PLAN</em>}</button>; })}
      </div><button className="glass full" onClick={() => setModal('profile')}>Back to profile</button></div>;
    }
    if (mode === 'dashboard') { const activeSubs = subscriptions.filter(s => s.status === 'ACTIVE' && (!s.endsAt || new Date(s.endsAt) > new Date())); const disableAccount = async () => { if (!confirm('Disable your account? You will be signed out and your profile will no longer be active.')) return; try { const d = await api('/auth/disable-account',{method:'POST'}); setToast(d.message); onLogout(); } catch(e) { setError(friendlyError(e)); } }; return user?.role === 'SUPER_ADMIN' ? <AdminPanel setToast={setToast} onLogout={onLogout} /> : <div className="account"><div className="account-head"><div className="avatar">{initials(user?.name)}</div><div><span className="eyebrow">ACCOUNT</span><h3>{user?.name}</h3><p>{user?.email}</p></div><span className="pill">{user?.role}</span></div>{user?.role === 'TALENT' && <>{activeSubs.length > 0 && <div className="active-membership"><span className="eyebrow">YOUR MEMBERSHIP</span><strong>{activeSubs.map(s => s.plan).join(' + ')} · ACTIVE</strong><small>Your current membership is shown here. Active plans cannot be purchased again.</small></div>}<button className="solid full" onClick={() => setModal('profile')}>Manage profile ↗</button><button className="glass full" onClick={() => setModal('subscribe')}>Manage membership ↗</button></>}{user?.role === 'RECRUITER' && <><p className="account-note">Your casting account can search the talent directory and publish open casting calls.</p><button className="solid full" onClick={() => setModal('casting')}>+ Post a casting call</button></>}<Error text={error}/><button className="glass full danger-button" onClick={disableAccount}>Disable my account</button><button className="glass full" onClick={onLogout}>Log out</button></div>; }
    if (mode === 'login') return <form onSubmit={submit}><Field label="Email"><input required type="email" value={f.email} onChange={e => set('email', e.target.value)} /></Field><Field label="Password"><input required type="password" value={f.password} onChange={e => set('password', e.target.value)} /></Field><button type="button" className="auth-link forgot-link" onClick={() => { setError(''); setModal('forgot'); }}>Forgot password?</button><Error text={error} /><button className="solid full" disabled={loading}>{loading ? 'Signing in…' : 'Log in ↗'}</button><div className="auth-divider"><span>or</span></div>{googleClientId ? <><div className="google-login-wrap" ref={googleButtonRef} aria-label="Continue with Google"></div><Field label="For new Google accounts"><select value={kind} onChange={e => setKind(e.target.value)}><option value="TALENT">Talent</option><option value="RECRUITER">Recruiter / Production</option></select></Field></> : <div className="google-unavailable">Google sign-in is not configured. Add <code>VITE_GOOGLE_CLIENT_ID</code> to the client environment.</div>}<div className="auth-switch">New here? <button type="button" className="auth-link" onClick={() => { setError(''); setModal('register'); }}>Join / register</button></div></form>;
    if (mode === 'verify') return <form onSubmit={submit}><p className="auth-note">We sent a 6-digit verification code to <strong>{f.email}</strong>.</p><Field label="Email"><input required type="email" value={f.email} onChange={e => set('email', e.target.value)} /></Field><Field label="Verification code"><input required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={f.code || ''} onChange={e => set('code', e.target.value.replace(/\D/g,''))} /></Field><Error text={error}/><button className="solid full" disabled={loading}>{loading ? 'Verifying…' : 'Verify email ↗'}</button><button type="button" className="glass full" onClick={async () => { try { const d=await api('/auth/resend-verification',{method:'POST',body:JSON.stringify({email:f.email})}); setToast(d.message); } catch(e){setError(friendlyError(e))} }}>Resend code</button></form>;
    if (mode === 'forgot') return <form onSubmit={submit}><p className="auth-note">Enter your account email and we’ll send a password reset OTP.</p><Field label="Email"><input required type="email" value={f.email} onChange={e => set('email', e.target.value)} /></Field><Error text={error}/><button className="solid full" disabled={loading}>{loading ? 'Sending…' : 'Send reset code ↗'}</button></form>;
    if (mode === 'reset') return <form onSubmit={submit}><p className="auth-note">Enter the OTP from your email and choose a new password.</p><Field label="Email"><input required type="email" value={f.email} onChange={e => set('email', e.target.value)} /></Field><Field label="Reset code"><input required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={f.code || ''} onChange={e => set('code', e.target.value.replace(/\D/g,''))} /></Field><Field label="New password"><input required minLength={8} type="password" value={f.password} onChange={e => set('password', e.target.value)} /></Field><Error text={error}/><button className="solid full" disabled={loading}>{loading ? 'Resetting…' : 'Reset password ↗'}</button></form>;
    if (mode === 'register') return <form onSubmit={submit}><Field label="Account type"><select value={kind} onChange={e => setKind(e.target.value)}><option value="TALENT">Talent</option><option value="RECRUITER">Recruiter / Production</option></select></Field>{googleClientId ? <><div className="google-register-label"><span>Quick registration</span></div><div className="google-login-wrap" ref={googleButtonRef} aria-label="Continue with Google"></div><div className="auth-divider"><span>or register with email</span></div></> : null}<Field label="Full name"><input required value={f.name} onChange={e => set('name', e.target.value)} /></Field><Field label="Email"><input required type="email" value={f.email} onChange={e => set('email', e.target.value)} /></Field><Field label="Password"><input required minLength="8" type="password" value={f.password} onChange={e => set('password', e.target.value)} /></Field><Error text={error} /><button className="solid full" disabled={loading}>{loading ? 'Creating…' : 'Create account ↗'}</button><div className="auth-switch">Already have an account? <button type="button" className="auth-link" onClick={() => { setError(''); setModal('login'); }}>Log in</button></div></form>;
    const restricted = f.categories.some(c => ['actor','model','presenter'].includes(String(c).toLowerCase()));
    return <form className="profile-form" onSubmit={submit}><div className="form-intro"><span className="eyebrow">YOUR CASTING PROFILE</span><p>{status?.hasActivePro ? 'Your profile is live.' : 'Activate PRO to become discoverable.'}</p><button type="button" className="glass edit-profile-btn" onClick={() => setEditing(v=>!v)}>{editing?'Lock fields':'Edit profile ↗'}</button></div>
    <Field label="Display name"><input disabled={!editing} required value={f.displayName} onChange={e=>set('displayName',e.target.value)} /></Field>
    <Field label={`Categories (${f.categories.length}/3)`}><div className="category-picker">{CATEGORIES.map(c=><button type="button" key={c} className={f.categories.includes(c)?'selected':''} disabled={!editing||(!f.categories.includes(c)&&f.categories.length>=3)} onClick={()=>set('categories',f.categories.includes(c)?f.categories.filter(x=>x!==c):[...f.categories,c])}>{c}</button>)}</div></Field>
    <Field label="Location"><LocationPicker value={f.location} onChange={v=>set('location',v)} required disabled={!editing} /></Field>
    {restricted && <div className="two-col"><Field label="Sex"><select disabled={!editing} value={f.sex||''} onChange={e=>set('sex',e.target.value)}><option value="">Prefer not to say</option><option>Female</option><option>Male</option><option>Other</option></select></Field><Field label="Age"><input disabled={!editing} type="number" min="1" max="120" value={f.age||''} onChange={e=>set('age',e.target.value)} /></Field><Field label="Height (cm)"><input disabled={!editing} type="number" min="50" max="250" value={f.heightCm||''} onChange={e=>set('heightCm',e.target.value)} /></Field></div>}
    <Field label="Bio"><textarea disabled={!editing} value={f.bio||''} onChange={e=>set('bio',e.target.value)} /></Field>
    <Field label="Phone"><input disabled={!editing} value={f.phone||''} onChange={e=>set('phone',e.target.value)} /></Field>
    <div className="privacy-setting"><div><span className="eyebrow">CONTACT PRIVACY</span><strong>Show my contact details</strong><p>Your phone and email can only be revealed to eligible PRO, EXCLUSIVE or hiring accounts.</p></div><button type="button" className={`privacy-toggle ${f.contactVisible !== false ? 'on' : ''}`} disabled={!editing} onClick={()=>set('contactVisible', f.contactVisible === false)}>{f.contactVisible !== false ? 'Visible' : 'Hidden'}</button></div>
    <Field label="Skills (comma separated)"><input disabled={!editing} value={f.skills||''} onChange={e=>set('skills',e.target.value)} /></Field>
    <Field label={`Upload photos (${(f.photos||[]).length}/10)`}><input disabled={!editing||(f.photos||[]).length>=10} type="file" accept="image/*" multiple onChange={async e=>{const files=Array.from(e.target.files||[]).slice(0,10-(f.photos||[]).length);const data=await Promise.all(files.map(file=>new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>{const img=new Image();img.onload=()=>{const max=1400,scale=Math.min(1,max/Math.max(img.width,img.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);resolve(canvas.toDataURL('image/jpeg',.82));};img.src=reader.result;};reader.readAsDataURL(file);})));set('photos',[...(f.photos||[]),...data]);e.target.value='';}} /><div className="upload-grid">{(f.photos||[]).map((src,i)=><div className="upload-thumb" key={`${src.slice(0,20)}-${i}`}><img src={src} alt={`Uploaded ${i+1}`} /><button type="button" disabled={!editing} onClick={()=>set('photos',f.photos.filter((_,n)=>n!==i))}>×</button></div>)}</div></Field>
    <Field label={`Performance / showreel links (${(f.performanceLinks||[]).length}/10)`}><div className="link-editor">{(f.performanceLinks||[]).map((link,i)=><div className="link-row" key={`${i}-${link}`}><input disabled={!editing} type="url" value={link} placeholder="https://youtube.com/... or https://vimeo.com/..." onChange={e=>set('performanceLinks',f.performanceLinks.map((v,n)=>n===i?e.target.value:v))}/><button type="button" disabled={!editing} className="glass" onClick={()=>set('performanceLinks',f.performanceLinks.filter((_,n)=>n!==i))}>Remove</button></div>)}{(f.performanceLinks||[]).length<10&&<button type="button" disabled={!editing} className="glass" onClick={()=>set('performanceLinks',[...(f.performanceLinks||[]),''])}>+ Add performance link</button>}</div></Field>
    <Error text={error}/><button className="solid full" disabled={!editing||loading||f.categories.length<1}>{loading?'Saving…':'Save profile ↗'}</button>{status?.talent?.id&&<button type="button" className="glass full" onClick={()=>window.open(`/p/${String(f.displayName||'talent').toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')}-${status.talent.id}`,'_blank','noopener,noreferrer')}>View profile as visitor ↗</button>}{status?.hasActivePro===false&&<button type="button" className="glass full" onClick={()=>setModal('subscribe')}>Activate PRO ↗</button>}</form>;
}
function CastingForm({ user, setModal, setToast }) {
  const [f, setF] = useState({ projectName:'', category:'Actor', requirements:'', ageRange:'Any age', location:'', contactEmail:user?.email || '', contactPhone:'', company:'', budget:'', deadline:'', imageUrl:'' });
  const [loading,setLoading]=useState(false); const [error,setError]=useState('');
  const set=(k,v)=>setF(x=>({...x,[k]:v}));
  async function pickPhoto(file){
    if(!file) return;
    if(!file.type.startsWith('image/')) return setError('Please choose an image file.');
    try {
      const reader=new FileReader(); reader.onload=()=>{ const img=new Image(); img.onload=()=>{ const max=1600, scale=Math.min(1,max/Math.max(img.width,img.height)); const canvas=document.createElement('canvas'); canvas.width=Math.max(1,Math.round(img.width*scale)); canvas.height=Math.max(1,Math.round(img.height*scale)); canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height); set('imageUrl',canvas.toDataURL('image/jpeg',.82)); }; img.src=reader.result; }; reader.readAsDataURL(file);
    } catch { setError('Unable to process that image.'); }
  }
  async function submit(e){e.preventDefault();setLoading(true);setError('');try{const d=await api('/casting-calls',{method:'POST',body:JSON.stringify(f)});setToast(d.message||'Casting call posted.');setModal('dashboard');}catch(e){setError(friendlyError(e));}finally{setLoading(false)}}
  return <form className="casting-form" onSubmit={submit}>
    <div className="casting-form-intro"><span className="eyebrow">OPEN CASTING CALL</span><h3>Wanted: {f.category}</h3><p>Publish a clear brief that talents can discover on the home screen.</p></div>
    <Field label="Casting photo"><input type="file" accept="image/*" onChange={e=>pickPhoto(e.target.files?.[0])} />{f.imageUrl && <div className="casting-upload-preview"><img src={f.imageUrl} alt="Casting preview" /><button type="button" className="glass" onClick={()=>set('imageUrl','')}>Remove photo</button></div>}</Field>
    <div className="two-col"><Field label="Project name"><input required value={f.projectName} onChange={e=>set('projectName',e.target.value)} placeholder="Film / ad / music video / event" /></Field><Field label="Wanted category"><select required value={f.category} onChange={e=>set('category',e.target.value)}>{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></Field></div>
    <div className="two-col"><Field label="Age"><select required value={f.ageRange} onChange={e=>set('ageRange',e.target.value)}>{['Any age','0–5','6–12','13–17','18–25','26–35','36–45','46–60','60+'].map(x=><option key={x}>{x}</option>)}</select></Field><Field label="Location"><LocationPicker value={f.location} onChange={v=>set('location',v)} required /></Field></div>
    <Field label="Requirements"><textarea required minLength="10" maxLength="5000" value={f.requirements} onChange={e=>set('requirements',e.target.value)} placeholder="Look, skills, language, experience, dates, wardrobe, availability and anything the talent should know." /></Field>
    <div className="two-col"><Field label="Contact email"><input required type="email" value={f.contactEmail} onChange={e=>set('contactEmail',e.target.value)} /></Field><Field label="Contact phone"><input value={f.contactPhone} onChange={e=>set('contactPhone',e.target.value)} placeholder="Optional" /></Field></div>
    <div className="two-col"><Field label="Company / casting account"><input value={f.company} onChange={e=>set('company',e.target.value)} placeholder="Optional" /></Field><Field label="Budget"><input value={f.budget} onChange={e=>set('budget',e.target.value)} placeholder="Optional" /></Field></div>
    <Field label="Deadline"><input value={f.deadline} onChange={e=>set('deadline',e.target.value)} placeholder="Optional — e.g. 15 Oct 2026" /></Field>
    <Error text={error}/><button className="solid full" disabled={loading}>{loading?'Posting…':'Publish casting call ↗'}</button><button type="button" className="glass full" onClick={()=>setModal('dashboard')}>Cancel</button>
  </form>;
}

function CastingCallView({ call, user, onLogin, setToast }) {
  async function share(){ const url=window.location.href; try { if(navigator.share) await navigator.share({title:call.projectName||call.title,text:`Casting call: ${call.projectName||call.title}`,url}); else {await navigator.clipboard.writeText(url);setToast('Casting call link copied');} } catch {} }
  return <div className="casting-detail-page">
    <div className="casting-detail-head"><div><span className="eyebrow">CASTING CALL / OPEN</span><div className="wanted-pill detail-pill">WANTED: {String(call.category||'CREATIVE').toUpperCase()}</div><h1>{call.projectName||call.title}</h1><div className="casting-detail-meta"><span>⌖ {call.location||'Location not listed'}</span><span>{call.ageRange||'Any age'}</span>{call.company&&<span>{call.company}</span>}</div></div><button type="button" className="icon-button" onClick={share} aria-label="Share casting call" title="Share casting call">↗</button></div>
    {call.imageUrl && <div className="casting-detail-image"><img src={call.imageUrl} alt={call.projectName||call.title||'Casting call'} /></div>}
    <div className="casting-detail-body"><div><span className="eyebrow">REQUIREMENTS</span><p className="casting-detail-requirements">{call.requirements||call.details}</p></div><div className="casting-detail-info">{call.budget&&<div><span>Budget</span><strong>{call.budget}</strong></div>}{call.deadline&&<div><span>Deadline</span><strong>{call.deadline}</strong></div>}</div>
      <div className="casting-apply-box"><div><span className="eyebrow">INTERESTED?</span><strong>Apply or contact the casting account.</strong><p>Sign in to continue. Subscriber access can unlock the casting contact details.</p></div><button className="solid" onClick={onLogin}>Sign in to apply ↗</button></div>
    </div>
  </div>;
}

function AdminPanel({ setToast, onLogout }) {
    const [users, setUsers] = useState([]); const [loading, setLoading] = useState(true); const [working, setWorking] = useState(''); const [query, setQuery] = useState(''); const [role, setRole] = useState('ALL'); const [status, setStatus] = useState('ALL'); const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'TALENT' });
    const load = () => api('/admin/subscriptions/users').then(d => setUsers(d.users || [])).catch(e => setToast(friendlyError(e))).finally(() => setLoading(false)); useEffect(() => { load() }, []);
    const filtered = useMemo(() => users.filter(u => { const q = query.toLowerCase(); return (!q || [u.name, u.email, u.talent?.professionalRole, u.talent?.location].join(' ').toLowerCase().includes(q)) && (role === 'ALL' || u.role === role) && (status === 'ALL' || (status === 'ACTIVE' ? u.isActive : !u.isActive)); }), [users, query, role, status]);
    const stats = { total: users.length, talents: users.filter(u => u.role === 'TALENT').length, recruiters: users.filter(u => u.role === 'RECRUITER').length, active: users.filter(u => u.isActive).length };
    async function grant(userId, plan) { setWorking(`${userId}-${plan}`); try { const d = await api('/admin/subscriptions/grant', { method: 'POST', body: JSON.stringify({ userId, plan, durationDays: 365 }) }); setToast(d.message); await load() } catch (e) { setToast(friendlyError(e)) } finally { setWorking('') } }
    async function toggle(u) { try { await api(`/admin/users/${u.id}/active`, { method: 'PATCH', body: JSON.stringify({ isActive: !u.isActive }) }); setToast(`${u.name} ${u.isActive ? 'disabled' : 'enabled'}`); await load() } catch (e) { setToast(friendlyError(e)) } }
    async function create(e) { e.preventDefault(); try { await api('/admin/users', { method: 'POST', body: JSON.stringify(newUser) }); setNewUser({ name: '', email: '', password: '', role: 'TALENT' }); setToast('Account created'); await load() } catch (e) { setToast(friendlyError(e)) } }
    async function remove(u) { if (!confirm(`Delete ${u.name} permanently?`)) return; try { await api(`/admin/users/${u.id}`, { method: 'DELETE' }); setToast('User deleted'); await load() } catch (e) { setToast(friendlyError(e)) } }
    return <section className="admin"><div className="admin-hero"><div><span className="eyebrow">SUPER ADMIN / COMMAND CENTRE</span><h3>Run the room.</h3><p>Create people, control access and manage complimentary memberships.</p></div><div className="admin-hero-actions"><button className="glass" onClick={onLogout}>Log out ↗</button><button className="solid" onClick={() => document.getElementById('create-account')?.scrollIntoView({ behavior: 'smooth' })}>+ Create account</button></div></div><div className="stat-grid"><Stat n={stats.total} label="Accounts" /><Stat n={stats.talents} label="Talents" /><Stat n={stats.recruiters} label="Recruiters" /><Stat n={stats.active} label="Active" /></div><div id="create-account" className="create-card"><div><span className="eyebrow">CREATE ACCOUNT</span><strong>Put someone in the room</strong></div><form onSubmit={create}><input placeholder="Full name" required value={newUser.name} onChange={e => setNewUser({ ...newUser, name: e.target.value })} /><input type="email" placeholder="Email" required value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} /><input type="password" placeholder="Temporary password" minLength="8" required value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} /><select value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })}><option value="TALENT">Talent</option><option value="RECRUITER">Recruiter</option></select><button className="solid">Create</button></form></div><div className="directory-admin"><div className="admin-toolbar"><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search accounts, roles, locations..." /><select value={role} onChange={e => setRole(e.target.value)}><option value="ALL">All roles</option><option value="TALENT">Talents</option><option value="RECRUITER">Recruiters</option></select><select value={status} onChange={e => setStatus(e.target.value)}><option value="ALL">All status</option><option value="ACTIVE">Active</option><option value="DISABLED">Disabled</option></select></div>{loading ? <div className="admin-empty">Loading command centre…</div> : filtered.length ? <div className="user-table">{filtered.map(u => <UserRow key={u.id} u={u} working={working} grant={grant} toggle={toggle} remove={remove} />)}</div> : <div className="admin-empty">No accounts match these filters.</div>}</div></section>
}
function Stat({ n, label }) { return <div className="stat"><strong>{String(n).padStart(2, '0')}</strong><span>{label}</span></div> }
function UserRow({ u, working, grant, toggle, remove }) { const sub = u.subscriptions?.find(s => s.status === 'ACTIVE' && (!s.endsAt || new Date(s.endsAt) > new Date())); return <div className="user-row"><div className="user-main"><div className="avatar">{initials(u.name)}</div><div><strong>{u.name}</strong><span>{u.email}</span><small>{u.role}{u.talent?.professionalRole ? ` · ${u.talent.professionalRole}` : ''}{u.talent?.location ? ` · ${u.talent.location}` : ''}</small></div></div><div className="user-status"><span className={`status-dot ${u.isActive ? 'on' : 'off'}`}></span>{u.isActive ? 'Active' : 'Disabled'}</div><div className="sub-status">{sub ? <><b>{sub.plan}</b><span>{sub.amount === 0 ? 'Complimentary' : 'Paid'} · {sub.endsAt ? new Date(sub.endsAt).toLocaleDateString() : 'No expiry'}</span></> : <span>No active plan</span>}</div><div className="user-actions"><button className="glass" onClick={() => toggle(u)}>{u.isActive ? 'Disable' : 'Enable'}</button><button className="glass" onClick={() => remove(u)}>Delete</button><div className="grant-menu"><button className="solid" disabled={!!working}>Grant free ↗</button><div className="grant-pop"><button onClick={() => grant(u.id, 'PRO')}>PRO · 365d</button><button onClick={() => grant(u.id, 'EXCLUSIVE')}>Exclusive · 365d</button><button onClick={() => grant(u.id, 'ELITE')}>Elite · 365d</button></div></div></div></div> }
function Field({ label, children }) { return <label>{label}{children}</label> } function Error({ text }) { return text ? <p className="error">{text}</p> : null }
createRoot(document.getElementById('root')).render(<App />);
