import { useState, useEffect, useMemo } from "react";
import {
  Trophy, Users, Calendar, Camera, Video, FileText, ShieldCheck, ClipboardCheck,
  Award, MapPin, CheckCircle2, XCircle, Star, Target, Compass, Crown, Clock,
  Menu, X, Lock, Unlock, Plus, Trash2, Loader2, LogOut, Settings, Upload,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { LeadershipFlipCard, WinnersMarquee, GalleryMarquee } from "./HomeSections";
import {
  auth, departments as departmentsApi, committee as committeeApi,
  audits as auditsApi, events as eventsApi, media, settings as settingsApi,
} from "./api";

/* ============================= DESIGN TOKENS ============================= */
const C = {
  navy: "#0F2740", navyDeep: "#0A1B2E", cream: "#F4F5F0", paper: "#FFFFFF",
  amber: "#F2A93B", amberDeep: "#D98F1F", green: "#2F8F6E", brick: "#C4472B",
  ink: "#1C2024", slate: "#5B6470", hairline: "#DBDCD3",
};
const fontDisplay = { fontFamily: "'Big Shoulders Display', sans-serif" };
const fontMono = { fontFamily: "'IBM Plex Mono', monospace" };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const SIX_S = ["Sort", "Set in Order", "Shine", "Standardize", "Sustain", "Safety"];
const CURRENT_YEAR = new Date().getFullYear();

const pad = (arr) => [...arr, ...Array(12 - arr.length).fill(null)];

const VALUES = [
  { icon: Target, title: "Discipline", text: "We follow the standard, every shift, every audit — no shortcuts." },
  { icon: Users, title: "Teamwork", text: "Every score belongs to the whole department, not one person." },
  { icon: Compass, title: "Ownership", text: "We fix what we find instead of waiting to be told." },
  { icon: ClipboardCheck, title: "Transparency", text: "Every score, win, and miss is visible to everyone, always." },
  { icon: Star, title: "Excellence", text: "We aim past the pass mark — 80% is the floor, not the target." },
  { icon: ShieldCheck, title: "Safety First", text: "No score outweighs a safe floor, safe process, safe person." },
];

/* ================================ HELPERS ==================================== */
const avatarUrl = (name) => `https://ui-avatars.com/api/?name=${encodeURIComponent(name || "Kaizen")}&background=0F2740&color=F2A93B&size=256&bold=true`;

function subScores(score, dept) {
  const seed = dept.length;
  return SIX_S.map((label, i) => { const wobble = ((seed + i * 7) % 9) - 4; return { label, value: Math.max(60, Math.min(100, score + wobble)) }; });
}

// Turns the backend's rankings response (with a `monthly` json_agg array)
// into the fixed 12-slot array the chart/table components expect.
function monthlyJsonToArray(monthlyJson) {
  const arr = Array(12).fill(null);
  (monthlyJson || []).forEach((m) => {
    if (!m || !m.month) return;
    const idx = new Date(m.month).getUTCMonth();
    arr[idx] = m.score !== null && m.score !== undefined ? Number(m.score) : null;
  });
  return arr;
}

/* ================================== UI BITS ================================== */
function Badge({ children, tone = "neutral" }) {
  const tones = { neutral: { bg: "#EDEEE7", fg: C.ink }, amber: { bg: "#FDF0D8", fg: C.amberDeep }, green: { bg: "#E4F2EC", fg: C.green }, brick: { bg: "#F6E4DF", fg: C.brick }, navy: { bg: "#E4EAF0", fg: C.navy } };
  const t = tones[tone];
  return <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold uppercase tracking-wide" style={{ backgroundColor: t.bg, color: t.fg, ...fontMono }}>{children}</span>;
}
function SectionEyebrow({ children }) { return <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: C.amberDeep, ...fontMono }}>{children}</div>; }
function FieldLabel({ children }) { return <label className="block text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: C.slate, ...fontMono }}>{children}</label>; }
const inputStyle = { borderColor: C.hairline, color: C.ink };

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ backgroundColor: "rgba(10,27,46,0.6)" }} onClick={onClose}>
      <div className="w-full max-w-sm rounded-lg p-6" style={{ backgroundColor: C.paper }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-base" style={{ color: C.ink, ...fontDisplay, fontSize: "22px" }}>{title}</h3>
          <button onClick={onClose} style={{ color: C.slate }}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

// A small reusable image-upload button. Shows a spinner while uploading,
// then hands the resulting URL back via onUploaded.
function PhotoUploadButton({ label, onUploaded, uploadFn, accept = "image/*" }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="mt-1">
      <label className="flex items-center gap-1.5 px-2 py-1.5 rounded border text-xs font-semibold cursor-pointer w-fit" style={{ borderColor: C.hairline, color: C.navy }}>
        {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
        {uploading ? "Uploading…" : label}
        <input
          type="file"
          accept={accept}
          className="hidden"
          disabled={uploading}
          onChange={async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            setUploading(true); setError("");
            try {
              const url = await uploadFn(file);
              onUploaded(url);
            } catch (err) {
              setError(err.message || "Upload failed.");
            } finally {
              setUploading(false);
              e.target.value = "";
            }
          }}
        />
      </label>
      {error && <p className="text-xs mt-1" style={{ color: C.brick }}>{error}</p>}
    </div>
  );
}

/* ============================== AUTH MODAL ============================== */
function LoginModal({ onClose, onSubmit, error }) {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  return (
    <Modal title="Administrator login" onClose={onClose}>
      <p className="text-sm mb-3" style={{ color: C.slate }}>Log in with your committee account to edit this site.</p>
      <FieldLabel>Email</FieldLabel>
      <input autoFocus type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border rounded px-3 py-2 text-sm mb-3" style={inputStyle} />
      <FieldLabel>Password</FieldLabel>
      <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === "Enter" && onSubmit(email, pw)} className="w-full border rounded px-3 py-2 text-sm mb-2" style={inputStyle} />
      {error && <p className="text-xs mb-2" style={{ color: C.brick }}>{error}</p>}
      <button onClick={() => onSubmit(email, pw)} className="w-full mt-2 px-4 py-2 rounded text-sm font-semibold" style={{ backgroundColor: C.navy, color: C.cream }}>Log in</button>
    </Modal>
  );
}

function ChangePasswordModal({ onClose, onSubmit, error, success }) {
  const [current, setCurrent] = useState(""); const [next1, setNext1] = useState(""); const [next2, setNext2] = useState("");
  return (
    <Modal title="Change your password" onClose={onClose}>
      <FieldLabel>Current password</FieldLabel>
      <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} className="w-full border rounded px-3 py-2 text-sm mb-3" style={inputStyle} />
      <FieldLabel>New password (min. 8 characters)</FieldLabel>
      <input type="password" value={next1} onChange={(e) => setNext1(e.target.value)} className="w-full border rounded px-3 py-2 text-sm mb-3" style={inputStyle} />
      <FieldLabel>Confirm new password</FieldLabel>
      <input type="password" value={next2} onChange={(e) => setNext2(e.target.value)} className="w-full border rounded px-3 py-2 text-sm mb-2" style={inputStyle} />
      {error && <p className="text-xs mb-2" style={{ color: C.brick }}>{error}</p>}
      {success && <p className="text-xs mb-2" style={{ color: C.green }}>{success}</p>}
      <button onClick={() => onSubmit(current, next1, next2)} className="w-full mt-2 px-4 py-2 rounded text-sm font-semibold" style={{ backgroundColor: C.navy, color: C.cream }}>Update password</button>
    </Modal>
  );
}

/* ================================== NAV ===================================== */
const NAV_ITEMS = [
  { id: "home", label: "Home", icon: Compass }, { id: "committee", label: "Committee", icon: Users },
  { id: "performance", label: "Performance", icon: ClipboardCheck }, { id: "calendar", label: "Calendar", icon: Calendar },
  { id: "rankings", label: "Rankings", icon: Trophy }, { id: "gallery", label: "Gallery", icon: Camera },
];

function Nav({ active, setActive, editing, authed, saving, onEditClick, onLogout, onChangePassword, siteSettings, onSaveSiteSettings }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(siteSettings);
  const [prevSiteSettings, setPrevSiteSettings] = useState(siteSettings);
  if (siteSettings !== prevSiteSettings) { setPrevSiteSettings(siteSettings); setDraft(siteSettings); }
  const commit = (field, value) => setDraft({ ...draft, [field]: value });
  const blurSave = () => onSaveSiteSettings(draft);

  return (
    <header className="sticky top-0 z-50 border-b" style={{ backgroundColor: C.navy, borderColor: "rgba(255,255,255,0.08)" }}>
      <div className="max-w-6xl mx-auto px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {draft.logo ? (
            <img src={draft.logo} alt="logo" className="w-9 h-9 rounded object-cover" style={{ backgroundColor: C.amber }} />
          ) : (
            <div className="w-9 h-9 rounded flex items-center justify-center font-bold" style={{ backgroundColor: C.amber, color: C.navy, ...fontDisplay }}>改</div>
          )}
          {editing ? (
            <div>
              <input value={draft.title || ""} onChange={(e) => commit("title", e.target.value)} onBlur={blurSave} className="text-lg font-bold leading-none tracking-wide bg-transparent border-b" style={{ ...fontDisplay, color: C.cream, borderColor: "rgba(244,245,240,0.3)", width: 140 }} />
              <input value={draft.tagline || ""} onChange={(e) => commit("tagline", e.target.value)} onBlur={blurSave} className="block text-[10px] uppercase tracking-widest bg-transparent border-b mt-0.5" style={{ ...fontMono, color: "rgba(244,245,240,0.8)", borderColor: "rgba(244,245,240,0.2)", width: 140 }} />
              <PhotoUploadButton label="Change logo" uploadFn={media.uploadLogo} onUploaded={(url) => onSaveSiteSettings({ ...draft, logo: url })} />
            </div>
          ) : (
            <div style={{ color: C.cream }}>
              <div className="text-lg font-bold leading-none tracking-wide" style={fontDisplay}>{draft.title || "KAIZEN"}</div>
              <div className="text-[10px] uppercase tracking-widest opacity-70" style={fontMono}>{draft.tagline || "Committee Portal"}</div>
            </div>
          )}
        </div>

        <nav className="hidden md:flex items-center gap-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon; const isActive = active === item.id;
            return <button key={item.id} onClick={() => setActive(item.id)} className="flex items-center gap-1.5 px-3 py-2 rounded text-sm font-medium transition-colors" style={{ color: isActive ? C.navy : C.cream, backgroundColor: isActive ? C.amber : "transparent" }}><Icon size={15} />{item.label}</button>;
          })}
        </nav>

        <div className="hidden md:flex items-center gap-2">
          {saving && <Loader2 size={14} className="animate-spin" color={C.amber} />}
          {authed && editing && <button onClick={onChangePassword} title="Change password" style={{ color: "rgba(244,245,240,0.7)" }}><Settings size={16} /></button>}
          <button onClick={onEditClick} className="flex items-center gap-1.5 px-3 py-2 rounded text-sm font-semibold" style={{ backgroundColor: editing ? C.amber : "rgba(255,255,255,0.1)", color: editing ? C.navy : C.cream }}>
            {editing ? <Unlock size={14} /> : <Lock size={14} />} {editing ? "Editing" : "Admin"}
          </button>
          {authed && <button onClick={onLogout} title="Log out" style={{ color: "rgba(244,245,240,0.7)" }}><LogOut size={16} /></button>}
        </div>

        <button className="md:hidden" style={{ color: C.cream }} onClick={() => setOpen(!open)}>{open ? <X size={22} /> : <Menu size={22} />}</button>
      </div>

      {open && (
        <div className="md:hidden px-5 pb-3 flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon; const isActive = active === item.id;
            return <button key={item.id} onClick={() => { setActive(item.id); setOpen(false); }} className="flex items-center gap-2 px-3 py-2 rounded text-sm font-medium text-left" style={{ color: isActive ? C.navy : C.cream, backgroundColor: isActive ? C.amber : "transparent" }}><Icon size={15} />{item.label}</button>;
          })}
          <button onClick={onEditClick} className="flex items-center gap-2 px-3 py-2 rounded text-sm font-semibold text-left" style={{ backgroundColor: editing ? C.amber : "rgba(255,255,255,0.1)", color: editing ? C.navy : C.cream }}>
            {editing ? <Unlock size={15} /> : <Lock size={15} />} {editing ? "Editing" : "Admin login"}
          </button>
          {authed && (
            <>
              <button onClick={onChangePassword} className="flex items-center gap-2 px-3 py-2 rounded text-sm text-left" style={{ color: C.cream }}><Settings size={15} /> Change password</button>
              <button onClick={onLogout} className="flex items-center gap-2 px-3 py-2 rounded text-sm text-left" style={{ color: C.cream }}><LogOut size={15} /> Log out</button>
            </>
          )}
        </div>
      )}

      {editing && (
        <div className="px-5 py-2 text-xs text-center" style={{ backgroundColor: C.amber, color: C.navy, ...fontMono }}>
          Admin mode — changes save to the live database and are visible to everyone who visits this site.
        </div>
      )}
    </header>
  );
}

/* ============================== HOME / HERO =============================== */
function Scoreboard({ standings, latestMonthLabel }) {
  const rows = standings.slice(0, 6);
  return (
    <div className="rounded-lg overflow-hidden border" style={{ backgroundColor: C.navyDeep, borderColor: "rgba(255,255,255,0.1)" }}>
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
        <span className="text-xs uppercase tracking-widest font-semibold" style={{ color: C.amber, ...fontMono }}>Year-to-Date Standings</span>
        <span className="text-xs" style={{ color: "rgba(255,255,255,0.5)", ...fontMono }}>through {latestMonthLabel}</span>
      </div>
      <div>
        {rows.map((r, i) => (
          <div key={r.dept} className="flex items-center gap-3 px-4 py-2.5 opacity-0" style={{ borderBottom: i < rows.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none", animation: `flapIn 0.5s ease-out forwards`, animationDelay: `${i * 90}ms` }}>
            <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ backgroundColor: i === 0 ? C.amber : "rgba(255,255,255,0.1)", color: i === 0 ? C.navy : C.cream, ...fontMono }}>{i + 1}</span>
            <span className="flex-1 text-sm font-medium truncate" style={{ color: C.cream }}>{r.dept}</span>
            {i === 0 && <Crown size={14} color={C.amber} />}
            <span className="text-lg font-bold tabular-nums" style={{ color: r.ytdAvg >= 80 ? C.amber : "#E7A9A9", ...fontMono }}>{r.ytdAvg.toFixed(1)}%</span>
          </div>
        ))}
      </div>
      <style>{`
        @keyframes flapIn { from { opacity: 0; transform: translateY(6px);} to { opacity: 1; transform: translateY(0);} }
        @media (prefers-reduced-motion: reduce) { [style*="flapIn"] { animation: none !important; opacity: 1 !important; } }
      `}</style>
    </div>
  );
}

function Home({ setActive, standings, latestMonthLabel, departments, siteSettings, editing }) {
  const topDept = standings[0] || { dept: "—", monthsScored: 0 };
  return (
    <div>
      <section style={{ backgroundColor: C.navy }}>
        <div className="max-w-6xl mx-auto px-5 py-16 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <SectionEyebrow>6S · Safety · Continuous Improvement</SectionEyebrow>
            <h1 className="text-6xl md:text-7xl font-extrabold leading-[0.9] tracking-tight" style={{ color: C.cream, ...fontDisplay }}>{siteSettings.title || "KAIZEN"}</h1>
            <p className="mt-4 text-lg max-w-md" style={{ color: "rgba(244,245,240,0.8)" }}>Monthly 6S and safety audits, department by department — scored, published, and rewarded in full view of the company.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <button onClick={() => setActive("performance")} className="px-5 py-2.5 rounded font-semibold text-sm" style={{ backgroundColor: C.amber, color: C.navy }}>View this month's audits</button>
              <button onClick={() => setActive("rankings")} className="px-5 py-2.5 rounded font-semibold text-sm border" style={{ borderColor: "rgba(244,245,240,0.3)", color: C.cream }}>See full rankings</button>
            </div>
          </div>
          <Scoreboard standings={standings} latestMonthLabel={latestMonthLabel} />
        </div>
      </section>

      <section style={{ backgroundColor: C.amber }}>
        <div className="max-w-6xl mx-auto px-5 py-5 grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Departments audited", value: departments.length, icon: Users },
            { label: "Current YTD leader", value: topDept.dept, icon: Trophy, small: true },
            { label: "Months scored so far", value: topDept.monthsScored || 0, icon: Calendar },
            { label: "Months to annual award", value: 12 - (topDept.monthsScored || 0), icon: Award },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="flex items-start gap-2">
                <Icon size={18} color={C.navy} className="mt-0.5 shrink-0" />
                <div>
                  <div className={s.small ? "text-sm font-bold leading-tight" : "text-xl font-bold leading-tight"} style={{ color: C.navy, ...fontMono }}>{s.value}</div>
                  <div className="text-xs" style={{ color: "rgba(15,39,64,0.75)" }}>{s.label}</div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-5 py-16">
        <SectionEyebrow>From our leadership</SectionEyebrow>
        <h2 className="text-3xl font-bold mb-6" style={{ color: C.ink, ...fontDisplay }}>A MESSAGE TO THE COMPANY</h2>
        {/* Pulls chairperson/patron name, role, photo, and message straight
            from the live database. In admin mode it becomes editable inline. */}
        <LeadershipFlipCard colors={C} editing={editing} />
      </section>

      {/* Continuous horizontal scroll of this month's winning department's photos/videos */}
      <WinnersMarquee colors={C} />

      {/* Continuous horizontal scroll of recent uploads across every department */}
      <GalleryMarquee colors={C} />

      <section className="max-w-6xl mx-auto px-5 py-16 grid md:grid-cols-2 gap-8">
        <div className="p-7 rounded-lg border" style={{ borderColor: C.hairline, backgroundColor: C.paper }}>
          <Compass size={20} color={C.amberDeep} />
          <h3 className="mt-3 text-xl font-bold" style={{ color: C.ink, ...fontDisplay }}>OUR VISION</h3>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: C.slate }}>To build a workplace culture where continuous improvement is instinctive — in every department, every process, every day.</p>
        </div>
        <div className="p-7 rounded-lg border" style={{ borderColor: C.hairline, backgroundColor: C.paper }}>
          <Target size={20} color={C.amberDeep} />
          <h3 className="mt-3 text-xl font-bold" style={{ color: C.ink, ...fontDisplay }}>OUR MISSION</h3>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: C.slate }}>To drive measurable operational excellence through structured 6S and safety audits, transparent scoring, and recognition that motivates lasting change.</p>
        </div>
      </section>

      <section className="pb-20" style={{ backgroundColor: C.cream }}>
        <div className="max-w-6xl mx-auto px-5">
          <SectionEyebrow>What we run on</SectionEyebrow>
          <h2 className="text-3xl font-bold mb-8" style={{ color: C.ink, ...fontDisplay }}>CORE VALUES</h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-5">
            {VALUES.map((v) => {
              const Icon = v.icon;
              return (
                <div key={v.title} className="p-5 rounded-lg border" style={{ borderColor: C.hairline, backgroundColor: C.paper }}>
                  <Icon size={18} color={C.green} />
                  <div className="mt-2 font-bold text-sm uppercase tracking-wide" style={{ color: C.ink }}>{v.title}</div>
                  <p className="mt-1 text-sm" style={{ color: C.slate }}>{v.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

/* ================================ COMMITTEE ================================= */
function PersonCard({ person, editing, onChange, onRemove, removable, showAttached, departments }) {
  const [draft, setDraft] = useState(person);
  const [prevPerson, setPrevPerson] = useState(person);
  if (person !== prevPerson) { setPrevPerson(person); setDraft(person); }
  const commit = (field, value) => setDraft({ ...draft, [field]: value });
  const blurSave = () => onChange(draft);
  const toggleDept = (d) => {
    const has = draft.attached.includes(d);
    const attached = has ? draft.attached.filter((x) => x !== d) : [...draft.attached, d];
    const next = { ...draft, attached }; setDraft(next); onChange(next);
  };
  return (
    <div className="p-5 rounded-lg border flex flex-col items-center text-center relative" style={{ borderColor: C.hairline, backgroundColor: C.paper }}>
      {editing && removable && <button onClick={onRemove} className="absolute top-2 right-2 p-1 rounded" style={{ color: C.brick }}><Trash2 size={14} /></button>}
      <img src={draft.photo || avatarUrl(draft.name)} alt={draft.name} className="w-20 h-20 rounded-full object-cover border-2" style={{ borderColor: C.amber }} />
      {!editing ? (
        <>
          <div className="mt-3 font-bold text-sm" style={{ color: C.ink }}>{draft.name}</div>
          <div className="text-xs uppercase tracking-wide mt-0.5" style={{ color: C.amberDeep, ...fontMono }}>{draft.role}</div>
        </>
      ) : (
        <div className="w-full mt-3 space-y-2 text-left">
          <div><FieldLabel>Name</FieldLabel><input className="w-full border rounded px-2 py-1 text-sm" style={inputStyle} value={draft.name} onChange={(e) => commit("name", e.target.value)} onBlur={blurSave} /></div>
          <div><FieldLabel>Title</FieldLabel><input className="w-full border rounded px-2 py-1 text-sm" style={inputStyle} value={draft.role} onChange={(e) => commit("role", e.target.value)} onBlur={blurSave} /></div>
          <div>
            <FieldLabel>Photo</FieldLabel>
            <PhotoUploadButton
              label="Upload photo"
              uploadFn={(file) => media.uploadCommitteePhoto(draft.id, file)}
              onUploaded={(url) => { const next = { ...draft, photo: url }; setDraft(next); onChange(next); }}
            />
          </div>
        </div>
      )}
      {showAttached && !editing && <div className="mt-2 flex flex-wrap gap-1 justify-center">{draft.attached.map((d) => <Badge key={d} tone="navy">{d}</Badge>)}</div>}
      {showAttached && editing && (
        <div className="w-full mt-2 text-left">
          <FieldLabel>Departments attached</FieldLabel>
          <div className="flex flex-wrap gap-1">
            {departments.map((d) => { const on = draft.attached.includes(d); return <button key={d} onClick={() => toggleDept(d)} className="px-2 py-0.5 rounded text-[11px] font-semibold" style={{ backgroundColor: on ? C.navy : "#EDEEE7", color: on ? C.cream : C.slate }}>{d}</button>; })}
          </div>
        </div>
      )}
    </div>
  );
}

function DepartmentsManager({ departments, editing, onAdd, onRename, onRemove }) {
  const [newName, setNewName] = useState("");
  const [confirming, setConfirming] = useState(null);
  const [drafts, setDrafts] = useState(departments);
  const [prevDepartments, setPrevDepartments] = useState(departments);
  if (departments !== prevDepartments) { setPrevDepartments(departments); setDrafts(departments); }

  if (!editing) return null;

  const submitAdd = () => { if (newName.trim()) { onAdd(newName.trim()); setNewName(""); } };

  return (
    <div className="rounded-lg border p-5 mb-10" style={{ borderColor: C.hairline, backgroundColor: C.paper }}>
      <div className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: C.slate, ...fontMono }}>Manage departments</div>
      <div className="space-y-2 mb-4">
        {departments.map((d, i) => (
          <div key={d} className="flex items-center gap-2">
            <input
              value={drafts[i] ?? d}
              onChange={(e) => setDrafts(drafts.map((x, xi) => (xi === i ? e.target.value : x)))}
              onBlur={() => { const v = (drafts[i] || "").trim(); if (v && v !== d) onRename(d, v); }}
              className="flex-1 border rounded px-2 py-1.5 text-sm"
              style={inputStyle}
            />
            {confirming === d ? (
              <>
                <button onClick={() => { onRemove(d); setConfirming(null); }} className="text-xs font-semibold px-2 py-1 rounded" style={{ backgroundColor: C.brick, color: "white" }}>Confirm</button>
                <button onClick={() => setConfirming(null)} className="text-xs font-semibold px-2 py-1 rounded" style={{ backgroundColor: "#EDEEE7", color: C.ink }}>Cancel</button>
              </>
            ) : (
              <button onClick={() => setConfirming(d)} title="Remove department" style={{ color: C.brick }}><Trash2 size={15} /></button>
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submitAdd()} placeholder="New department name" className="flex-1 border rounded px-2 py-1.5 text-sm" style={inputStyle} />
        <button onClick={submitAdd} className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-semibold" style={{ backgroundColor: C.navy, color: C.cream }}><Plus size={13} /> Add</button>
      </div>
      <p className="text-xs mt-3" style={{ color: C.slate }}>Renaming or removing updates the live database immediately — including score history and auditor assignments.</p>
    </div>
  );
}

function Committee({ committeeLead, auditors, departments, editing, onSaveLead, onSaveAuditors, onAddDept, onRenameDept, onRemoveDept }) {
  const updateLead = (updated) => onSaveLead(committeeLead.map((p) => (p.id === updated.id ? updated : p)));
  const updateAuditor = (updated) => onSaveAuditors(auditors.map((p) => (p.id === updated.id ? updated : p)));
  const addAuditor = () => onSaveAuditors([...auditors, { id: `new-${Date.now()}`, name: "New Auditor", role: "Auditor", photo: "", attached: [] }]);
  const removeAuditor = (id) => onSaveAuditors(auditors.filter((p) => p.id !== id));
  return (
    <div className="max-w-6xl mx-auto px-5 py-14">
      <SectionEyebrow>Who runs the program</SectionEyebrow>
      <h2 className="text-3xl font-bold mb-2" style={{ color: C.ink, ...fontDisplay }}>KAIZEN COMMITTEE</h2>
      <p className="text-sm mb-10 max-w-2xl" style={{ color: C.slate }}>Led by a patron, chairperson, deputy, and secretary, with auditors attached to specific departments to keep every audit consistent and accountable.</p>
      <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-5 mb-12">
        {committeeLead.map((p) => <PersonCard key={p.id} person={p} editing={editing} onChange={updateLead} removable={false} showAttached={false} departments={departments} />)}
      </div>

      <DepartmentsManager departments={departments} editing={editing} onAdd={onAddDept} onRename={onRenameDept} onRemove={onRemoveDept} />

      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold uppercase tracking-widest" style={{ color: C.slate, ...fontMono }}>Auditors & Their Departments</h3>
        {editing && <button onClick={addAuditor} className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-semibold" style={{ backgroundColor: C.navy, color: C.cream }}><Plus size={13} /> Add auditor</button>}
      </div>
      <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-5">
        {auditors.map((p) => <PersonCard key={p.id} person={p} editing={editing} onChange={updateAuditor} onRemove={() => removeAuditor(p.id)} removable showAttached departments={departments} />)}
      </div>
    </div>
  );
}

/* =============================== PERFORMANCE ================================ */
function ScoreBar({ label, value }) {
  const color = value >= 80 ? C.green : value >= 70 ? C.amberDeep : C.brick;
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs w-24 shrink-0" style={{ color: C.slate }}>{label}</span>
      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: "#E9EAE3" }}><div className="h-full rounded-full" style={{ width: `${value}%`, backgroundColor: color }} /></div>
      <span className="text-xs w-8 text-right tabular-nums" style={{ color, ...fontMono }}>{value}</span>
    </div>
  );
}
function PerformanceCard({ dept, score, monthLabel, editing, onScoreChange, auditId, onEnsureAudit }) {
  const [open, setOpen] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const hasScore = score !== null && score !== undefined;
  const passed = hasScore && score >= 80;

  // If no audit row exists yet for this department+month (i.e. it hasn't
  // been scored), create one on the fly so the file has somewhere to attach.
  const uploadFile = async (file) => {
    let id = auditId;
    if (!id) {
      try {
        id = await onEnsureAudit();
      } catch (err) {
        setUploadError(err.message || "Couldn't prepare this audit for upload.");
        throw err;
      }
    }
    return media.uploadAuditFile(id, file);
  };

  return (
    <div className="rounded-lg border overflow-hidden" style={{ borderColor: C.hairline, backgroundColor: C.paper }}>
      <div className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="font-bold text-base" style={{ color: C.ink }}>{dept}</div>
            <div className="text-xs mt-0.5" style={{ color: C.slate }}>{monthLabel} {CURRENT_YEAR} audit</div>
          </div>
          {editing ? (
            <input type="number" min={0} max={100} value={score ?? ""} placeholder="—" onChange={(e) => onScoreChange(e.target.value === "" ? null : Number(e.target.value))} className="w-20 text-right border rounded px-2 py-1 text-lg font-bold" style={{ ...inputStyle, ...fontMono }} />
          ) : (
            <div className="text-2xl font-bold tabular-nums" style={{ color: hasScore ? (passed ? C.green : C.brick) : C.slate, ...fontMono }}>{hasScore ? `${score}%` : "—"}</div>
          )}
        </div>
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          {hasScore ? (passed ? <Badge tone="green"><CheckCircle2 size={12} className="inline -mt-0.5 mr-1" />Above 80%</Badge> : <Badge tone="brick"><XCircle size={12} className="inline -mt-0.5 mr-1" />Below 80%</Badge>) : <Badge>Not yet audited</Badge>}
          <Badge><Camera size={12} className="inline -mt-0.5 mr-1" />Photos</Badge><Badge><Video size={12} className="inline -mt-0.5 mr-1" />Video</Badge><Badge><FileText size={12} className="inline -mt-0.5 mr-1" />Report</Badge>
        </div>
        {editing && (
          <>
            <PhotoUploadButton
              label="Upload photo, video, or report"
              accept="image/*,video/*,application/pdf"
              uploadFn={uploadFile}
              onUploaded={() => setUploadError("")}
            />
            {uploadError && <p className="text-xs mt-1" style={{ color: C.brick }}>{uploadError}</p>}
          </>
        )}
        {hasScore && <button onClick={() => setOpen(!open)} className="mt-3 text-xs font-semibold" style={{ color: C.amberDeep }}>{open ? "Hide 6S breakdown ▲" : "View 6S breakdown ▼"}</button>}
      </div>
      {open && hasScore && <div className="px-5 pb-5 space-y-2 pt-4" style={{ borderTop: `1px solid ${C.hairline}` }}>{subScores(score, dept).map((s) => <ScoreBar key={s.label} label={s.label} value={s.value} />)}</div>}
    </div>
  );
}
function Performance({ scores, auditIds, departments, editing, onSaveScore, onEnsureAudit }) {
  const [monthIdx, setMonthIdx] = useState(() => {
    const idx = MONTHS.findIndex((_, i) => departments.every((d) => scores[d]?.[i] === null || scores[d]?.[i] === undefined));
    return idx === -1 ? 11 : Math.max(0, idx - 1);
  });
  const [deptFilter, setDeptFilter] = useState("All");
  const [draft, setDraft] = useState(scores);
  const [savingDept, setSavingDept] = useState(null);
  const [prevScores, setPrevScores] = useState(scores);
  if (scores !== prevScores) { setPrevScores(scores); setDraft(scores); }

  const setScore = async (dept, value) => {
    setDraft({ ...draft, [dept]: draft[dept].map((v, i) => (i === monthIdx ? value : v)) });
    setSavingDept(dept);
    await onSaveScore(dept, monthIdx, value);
    setSavingDept(null);
  };

  const cards = departments.filter((d) => deptFilter === "All" || d === deptFilter).map((d) => ({ dept: d, score: draft[d]?.[monthIdx] ?? null })).sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  return (
    <div className="max-w-6xl mx-auto px-5 py-14">
      <SectionEyebrow>Monthly department audits</SectionEyebrow>
      <h2 className="text-3xl font-bold mb-2" style={{ color: C.ink, ...fontDisplay }}>PERFORMANCE</h2>
      <p className="text-sm mb-6 max-w-2xl" style={{ color: C.slate }}>Every department's 6S and safety score, with supporting photos, video, and written reports from the audit. Scores save to the database as soon as you finish typing, and you can upload media before or after scoring.</p>
      <div className="flex flex-wrap items-center gap-3 mb-8">
        <select value={monthIdx} onChange={(e) => setMonthIdx(Number(e.target.value))} className="px-3 py-2 rounded border text-sm" style={{ ...inputStyle, ...fontMono }}>{MONTHS.map((m, i) => <option key={m} value={i}>{m} {CURRENT_YEAR}</option>)}</select>
        <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className="px-3 py-2 rounded border text-sm" style={{ ...inputStyle, ...fontMono }}><option>All</option>{departments.map((d) => <option key={d}>{d}</option>)}</select>
        {savingDept && <span className="text-xs flex items-center gap-1" style={{ color: C.slate }}><Loader2 size={12} className="animate-spin" /> Saving {savingDept}…</span>}
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {cards.map((c) => (
          <PerformanceCard
            key={c.dept}
            dept={c.dept}
            score={c.score}
            monthLabel={MONTHS[monthIdx]}
            editing={editing}
            onScoreChange={(v) => setScore(c.dept, v)}
            auditId={auditIds?.[c.dept]?.[monthIdx]}
            onEnsureAudit={() => onEnsureAudit(c.dept, monthIdx)}
          />
        ))}
      </div>
    </div>
  );
}

/* ================================ CALENDAR ================================== */
function typeTone(type) { if (type === "Audit") return "navy"; if (type === "Ceremony") return "amber"; return "green"; }
function EventRow({ e, editing, onRemove }) {
  const d = new Date(e.date + "T00:00:00");
  return (
    <div className="flex items-start gap-4 py-4" style={{ borderBottom: `1px solid ${C.hairline}` }}>
      <div className="w-16 shrink-0 text-center rounded py-1.5" style={{ backgroundColor: C.navy, color: C.amber, ...fontMono }}>
        <div className="text-xs uppercase">{d.toLocaleDateString("en-US", { month: "short" })}</div>
        <div className="text-lg font-bold leading-none">{d.getDate()}</div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap"><span className="font-semibold text-sm" style={{ color: C.ink }}>{e.title}</span><Badge tone={typeTone(e.type)}>{e.type}</Badge></div>
        <div className="mt-1 text-xs flex items-center gap-1 flex-wrap" style={{ color: C.slate }}><MapPin size={12} /> {e.depts.join(", ")}<span className="mx-1">·</span><Users size={12} /> {e.auditor}</div>
      </div>
      {editing && <button onClick={onRemove} style={{ color: C.brick }}><Trash2 size={15} /></button>}
    </div>
  );
}
function CalendarSection({ events, departments, editing, onAddEvent, onRemoveEvent }) {
  const [form, setForm] = useState({ date: "", title: "", depts: "", auditor: "", type: "Audit" });
  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date));
  const addEvent = () => {
    if (!form.date || !form.title) return;
    onAddEvent({ date: form.date, title: form.title, depts: form.depts.split(",").map((s) => s.trim()).filter(Boolean), auditor: form.auditor || "—", type: form.type });
    setForm({ date: "", title: "", depts: "", auditor: "", type: "Audit" });
  };
  return (
    <div className="max-w-6xl mx-auto px-5 py-14">
      <SectionEyebrow>What's coming up</SectionEyebrow>
      <h2 className="text-3xl font-bold mb-2" style={{ color: C.ink, ...fontDisplay }}>CALENDAR & EVENTS</h2>
      <p className="text-sm mb-8 max-w-2xl" style={{ color: C.slate }}>Upcoming audit dates, activities, and ceremonies — with the auditor assigned to each department.</p>
      {editing && (
        <div className="rounded-lg border p-5 mb-8 grid sm:grid-cols-2 md:grid-cols-5 gap-3" style={{ borderColor: C.hairline, backgroundColor: C.paper }}>
          <div><FieldLabel>Date</FieldLabel><input type="date" className="w-full border rounded px-2 py-1.5 text-sm" style={inputStyle} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
          <div><FieldLabel>Title</FieldLabel><input className="w-full border rounded px-2 py-1.5 text-sm" style={inputStyle} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div><FieldLabel>Departments (comma-separated)</FieldLabel><input className="w-full border rounded px-2 py-1.5 text-sm" style={inputStyle} value={form.depts} onChange={(e) => setForm({ ...form, depts: e.target.value })} /></div>
          <div><FieldLabel>Auditor</FieldLabel><input className="w-full border rounded px-2 py-1.5 text-sm" style={inputStyle} value={form.auditor} onChange={(e) => setForm({ ...form, auditor: e.target.value })} /></div>
          <div>
            <FieldLabel>Type</FieldLabel>
            <select className="w-full border rounded px-2 py-1.5 text-sm mb-2" style={inputStyle} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}><option>Audit</option><option>Ceremony</option><option>Activity</option></select>
            <button onClick={addEvent} className="w-full flex items-center justify-center gap-1 px-3 py-1.5 rounded text-xs font-semibold" style={{ backgroundColor: C.navy, color: C.cream }}><Plus size={13} /> Add event</button>
          </div>
        </div>
      )}
      <div className="rounded-lg border p-2 sm:p-5" style={{ borderColor: C.hairline, backgroundColor: C.paper }}>{sorted.map((e) => <EventRow key={e.id} e={e} editing={editing} onRemove={() => onRemoveEvent(e.id)} />)}</div>
    </div>
  );
}

/* ================================ RANKINGS =================================== */
function Rankings({ standings, monthlyWinners }) {
  const chartData = MONTHS.map((m, i) => {
    const row = { month: m };
    standings.slice(0, 4).forEach((r) => { const v = r.scores[i]; if (v !== null && v !== undefined) row[r.dept] = v; });
    return row;
  }).filter((row) => Object.keys(row).length > 1);
  const LINE_COLORS = [C.amberDeep, C.green, C.navy, C.brick];
  return (
    <div className="max-w-6xl mx-auto px-5 py-14">
      <SectionEyebrow>January → December {CURRENT_YEAR}</SectionEyebrow>
      <h2 className="text-3xl font-bold mb-2" style={{ color: C.ink, ...fontDisplay }}>DEPARTMENTAL RANKINGS</h2>
      <p className="text-sm mb-8 max-w-2xl" style={{ color: C.slate }}>Monthly winners feed a running year-to-date average, computed live from the database. The department with the highest cumulative score in December takes the Annual Kaizen Award.</p>
      <div className="rounded-lg border p-5 mb-10" style={{ borderColor: C.hairline, backgroundColor: C.paper }}>
        <div className="text-xs font-semibold uppercase tracking-wide mb-4" style={{ color: C.slate, ...fontMono }}>Top 4 departments — monthly trend</div>
        <div style={{ width: "100%", height: 280 }}>
          <ResponsiveContainer>
            <LineChart data={chartData}>
              <CartesianGrid stroke={C.hairline} vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: C.slate }} axisLine={{ stroke: C.hairline }} tickLine={false} />
              <YAxis domain={[60, 100]} tick={{ fontSize: 12, fill: C.slate }} axisLine={{ stroke: C.hairline }} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 8, borderColor: C.hairline, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {standings.slice(0, 4).map((r, i) => <Line key={r.dept} type="monotone" dataKey={r.dept} stroke={LINE_COLORS[i]} strokeWidth={2.5} dot={{ r: 3 }} connectNulls />)}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="rounded-lg border overflow-x-auto mb-10" style={{ borderColor: C.hairline, backgroundColor: C.paper }}>
        <table className="w-full text-sm min-w-[820px]">
          <thead><tr style={{ backgroundColor: C.navy }}><th className="text-left px-4 py-3 font-semibold" style={{ color: C.cream }}>Department</th>{MONTHS.map((m) => <th key={m} className="px-2 py-3 font-semibold text-center" style={{ color: C.cream, ...fontMono }}>{m}</th>)}<th className="px-4 py-3 font-semibold text-center" style={{ color: C.amber, ...fontMono }}>YTD Avg</th></tr></thead>
          <tbody>
            {standings.map((r, i) => (
              <tr key={r.dept} style={{ borderTop: `1px solid ${C.hairline}`, backgroundColor: i === 0 ? "#FDF6E8" : "transparent" }}>
                <td className="px-4 py-3 font-medium flex items-center gap-1.5" style={{ color: C.ink }}>{i === 0 && <Crown size={13} color={C.amberDeep} />}{r.dept}</td>
                {MONTHS.map((m, mi) => { const val = r.scores[mi]; const has = val !== null && val !== undefined; return <td key={m} className="px-2 py-3 text-center tabular-nums" style={{ color: !has ? C.slate : (val >= 80 ? C.green : C.brick), ...fontMono }}>{has ? val : "—"}</td>; })}
                <td className="px-4 py-3 text-center font-bold tabular-nums" style={{ color: C.amberDeep, ...fontMono }}>{r.ytdAvg.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3 className="text-sm font-bold uppercase tracking-widest mb-4" style={{ color: C.slate, ...fontMono }}>Monthly Winners</h3>
      <div className="grid sm:grid-cols-3 md:grid-cols-6 gap-3 mb-10">
        {monthlyWinners.map((w) => (
          <div key={w.month} className="p-3 rounded-lg border text-center" style={{ borderColor: C.hairline, backgroundColor: C.paper }}>
            <div className="text-xs uppercase" style={{ color: C.slate, ...fontMono }}>{w.month} {CURRENT_YEAR}</div>
            <Trophy size={16} color={C.amberDeep} className="mx-auto my-1.5" />
            <div className="text-xs font-semibold" style={{ color: C.ink }}>{w.dept}</div>
            <div className="text-sm font-bold tabular-nums" style={{ color: C.green, ...fontMono }}>{w.score}%</div>
          </div>
        ))}
      </div>
      {standings[0] && (
        <div className="rounded-lg p-7 flex flex-col sm:flex-row items-center gap-5" style={{ backgroundColor: C.navy }}>
          <Award size={40} color={C.amber} className="shrink-0" />
          <div>
            <div className="text-xs uppercase tracking-widest font-semibold" style={{ color: C.amber, ...fontMono }}>Annual Kaizen Award — December {CURRENT_YEAR}</div>
            <p className="text-sm mt-1" style={{ color: "rgba(244,245,240,0.85)" }}>Currently leading the year-to-date average: <strong style={{ color: C.cream }}>{standings[0].dept}</strong> at <span style={{ ...fontMono }}>{standings[0].ytdAvg.toFixed(1)}%</span>. Standings update after every monthly audit.</p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================================= GALLERY =================================== */
function iconFor(type) { if (type === "photo") return Camera; if (type === "video") return Video; return FileText; }
function GalleryTile({ item, editing, onDelete }) {
  const Icon = iconFor(item.file_type);
  const monthLabel = MONTHS[new Date(item.month).getUTCMonth()];
  return (
    <div className="rounded-lg border overflow-hidden relative" style={{ borderColor: C.hairline, backgroundColor: C.paper }}>
      {editing && (
        <button
          onClick={onDelete}
          className="absolute top-2 right-2 z-10 p-1.5 rounded-full"
          style={{ backgroundColor: "rgba(15,39,64,0.85)", color: C.brick }}
          title="Delete this file"
        >
          <Trash2 size={13} />
        </button>
      )}
      <div className="h-32 flex items-center justify-center" style={{ backgroundColor: "#1a2f45" }}>
        {item.file_type === "photo" ? (
          <img src={item.file_url} alt={item.department} className="w-full h-full object-cover" loading="lazy" />
        ) : item.file_type === "video" ? (
          <video src={item.file_url} className="w-full h-full object-cover" muted />
        ) : (
          <a href={item.file_url} target="_blank" rel="noreferrer" className="flex flex-col items-center gap-1" style={{ color: C.cream }}>
            <Icon size={26} /><span className="text-[11px] uppercase tracking-wide" style={fontMono}>Open report</span>
          </a>
        )}
      </div>
      <div className="p-3">
        <div className="text-sm font-semibold" style={{ color: C.ink }}>{item.department}</div>
        <div className="text-xs mt-0.5 flex items-center gap-1" style={{ color: C.slate }}>
          <Icon size={11} /> {item.file_type} · {monthLabel} {CURRENT_YEAR}
        </div>
      </div>
    </div>
  );
}
function GalleryUploadPanel({ departments, deptIdByName, onEnsureAudit, onUploaded }) {
  const [deptName, setDeptName] = useState(departments[0] || "");
  const [monthIdx, setMonthIdx] = useState(new Date().getMonth());
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file || !deptName) return;
    setUploading(true); setError("");
    try {
      const auditId = await onEnsureAudit(deptName, monthIdx);
      await media.uploadAuditFile(auditId, file);
      onUploaded();
    } catch (err) {
      setError(err.message || "Upload failed.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  return (
    <div className="rounded-lg border p-5 mb-8 flex flex-wrap items-end gap-3" style={{ borderColor: C.hairline, backgroundColor: C.paper }}>
      <div>
        <FieldLabel>Department</FieldLabel>
        <select value={deptName} onChange={(e) => setDeptName(e.target.value)} className="border rounded px-2 py-1.5 text-sm" style={inputStyle}>
          {departments.map((d) => <option key={d}>{d}</option>)}
        </select>
      </div>
      <div>
        <FieldLabel>Month</FieldLabel>
        <select value={monthIdx} onChange={(e) => setMonthIdx(Number(e.target.value))} className="border rounded px-2 py-1.5 text-sm" style={inputStyle}>
          {MONTHS.map((m, i) => <option key={m} value={i}>{m} {CURRENT_YEAR}</option>)}
        </select>
      </div>
      <label className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-semibold cursor-pointer" style={{ backgroundColor: C.navy, color: C.cream }}>
        {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
        {uploading ? "Uploading…" : "Add photo, video, or report"}
        <input type="file" accept="image/*,video/*,application/pdf" className="hidden" disabled={uploading} onChange={handleFile} />
      </label>
      {error && <p className="text-xs w-full" style={{ color: C.brick }}>{error}</p>}
    </div>
  );
}

function Gallery({ editing, departments, deptIdByName, onEnsureAudit }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");

  const load = () => {
    media.listAll(CURRENT_YEAR).then(setItems).catch((err) => setError(err.message));
  };
  useEffect(load, []);

  const handleDelete = async (id) => {
    await media.remove(id);
    setItems(items.filter((i) => i.id !== id));
  };

  return (
    <div className="max-w-6xl mx-auto px-5 py-14">
      <SectionEyebrow>Every audit, in view</SectionEyebrow>
      <h2 className="text-3xl font-bold mb-2" style={{ color: C.ink, ...fontDisplay }}>GALLERY</h2>
      <p className="text-sm mb-6 max-w-2xl" style={{ color: C.slate }}>Real photos, videos, and reports uploaded from any department, most recent first.</p>
      {editing && (
        <GalleryUploadPanel
          departments={departments}
          deptIdByName={deptIdByName}
          onEnsureAudit={onEnsureAudit}
          onUploaded={load}
        />
      )}
      {error && <p className="text-sm mb-4" style={{ color: C.brick }}>Couldn't load the gallery: {error}</p>}
      {!items && !error && <p className="text-sm" style={{ color: C.slate }}>Loading…</p>}
      {items && items.length === 0 && <p className="text-sm" style={{ color: C.slate }}>No media uploaded yet this year — use the panel above (or the Performance page) to add photos, videos, or reports.</p>}
      {items && items.length > 0 && (
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-5">
          {items.map((it) => <GalleryTile key={it.id} item={it} editing={editing} onDelete={() => handleDelete(it.id)} />)}
        </div>
      )}
    </div>
  );
}

/* =================================== FOOTER ==================================== */
function Footer({ latestMonthLabel, siteSettings, editing, onSaveSiteSettings }) {
  const [draft, setDraft] = useState(siteSettings.footerText || "");
  const [prevFooterText, setPrevFooterText] = useState(siteSettings.footerText || "");
  if ((siteSettings.footerText || "") !== prevFooterText) {
    setPrevFooterText(siteSettings.footerText || "");
    setDraft(siteSettings.footerText || "");
  }
  return (
    <footer style={{ backgroundColor: C.navyDeep }}>
      <div className="max-w-6xl mx-auto px-5 py-8 flex flex-col sm:flex-row items-center justify-between gap-3">
        {editing ? (
          <input value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={() => onSaveSiteSettings({ ...siteSettings, footerText: draft })} className="text-sm bg-transparent border-b flex-1 max-w-md" style={{ color: "rgba(244,245,240,0.8)", borderColor: "rgba(244,245,240,0.3)" }} />
        ) : (
          <div className="text-sm" style={{ color: "rgba(244,245,240,0.6)" }}>{siteSettings.footerText || "Kaizen Committee"}</div>
        )}
        <div className="text-xs flex items-center gap-1.5" style={{ color: "rgba(244,245,240,0.4)" }}><Clock size={12} /> Standings last updated {latestMonthLabel}</div>
      </div>
    </footer>
  );
}

/* =================================== APP ==================================== */
export default function App() {
  const [active, setActive] = useState("home");
  const [editing, setEditing] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const [deptRows, setDeptRows] = useState([]);          // [{id, name}]
  const [committeeRows, setCommitteeRows] = useState([]); // raw backend rows
  const [events, setEvents] = useState([]);               // UI-shaped events
  const [scores, setScores] = useState({});                // { deptName: [12 values] }
  const [auditIds, setAuditIds] = useState({});             // { deptName: [12 audit ids or undefined] }
  const [standings, setStandings] = useState([]);
  const [monthlyWinners, setMonthlyWinners] = useState([]);
  const [siteSettings, setSiteSettings] = useState({ logo: "", title: "KAIZEN", tagline: "Committee Portal", footerText: "" });

  const [showLogin, setShowLogin] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [showChangePw, setShowChangePw] = useState(false);
  const [changePwError, setChangePwError] = useState("");
  const [changePwSuccess, setChangePwSuccess] = useState("");

  const departments = useMemo(() => deptRows.map((d) => d.name), [deptRows]);
  const deptIdByName = useMemo(() => Object.fromEntries(deptRows.map((d) => [d.name, d.id])), [deptRows]);
  const deptNameById = useMemo(() => Object.fromEntries(deptRows.map((d) => [d.id, d.name])), [deptRows]);
  const memberNameById = useMemo(() => Object.fromEntries(committeeRows.map((c) => [c.id, c.name])), [committeeRows]);

  const committeeLead = useMemo(
    () => committeeRows.filter((c) => c.is_lead).map((c) => shapeMember(c, deptNameById)),
    [committeeRows, deptNameById]
  );
  const auditors = useMemo(
    () => committeeRows.filter((c) => !c.is_lead).map((c) => shapeMember(c, deptNameById)),
    [committeeRows, deptNameById]
  );

  function shapeMember(c, nameById) {
    return { id: c.id, name: c.name, role: c.role, photo: c.photo_url || "", attached: (c.attached_departments || []).map((id) => nameById[id]).filter(Boolean) };
  }

  async function refreshAuditData() {
    const [auditRows, rankingRows, winnerRows] = await Promise.all([
      auditsApi.list(CURRENT_YEAR),
      auditsApi.rankings(CURRENT_YEAR),
      auditsApi.monthlyWinners(CURRENT_YEAR),
    ]);

    const nextScores = {}; const nextAuditIds = {};
    deptRows.forEach((d) => { nextScores[d.name] = pad([]); nextAuditIds[d.name] = pad([]); });
    auditRows.forEach((row) => {
      const name = row.department_name;
      if (!nextScores[name]) return;
      const idx = new Date(row.month).getUTCMonth();
      nextScores[name][idx] = row.score !== null ? Number(row.score) : null;
      nextAuditIds[name][idx] = row.id;
    });
    setScores(nextScores);
    setAuditIds(nextAuditIds);

    setStandings(
      rankingRows.map((r) => ({ dept: r.department, scores: monthlyJsonToArray(r.monthly), ytdAvg: Number(r.ytd_avg) || 0, monthsScored: Number(r.months_scored) || 0 }))
    );
    setMonthlyWinners(winnerRows.map((w) => ({ month: MONTHS[new Date(w.month).getUTCMonth()], dept: w.department, score: Number(w.score) })));
  }

  useEffect(() => {
    (async () => {
      try {
        const [deptList, committeeList, settingsObj, eventRows] = await Promise.all([
          departmentsApi.list(), committeeApi.list(), settingsApi.get(), eventsApi.list(),
        ]);
        setDeptRows(deptList);
        setCommitteeRows(committeeList);
        setSiteSettings({
          logo: settingsObj.logo || "", title: settingsObj.title || "KAIZEN",
          tagline: settingsObj.tagline || "Committee Portal", footerText: settingsObj.footerText || "",
        });

        const nameById = Object.fromEntries(committeeList.map((c) => [c.id, c.name]));
        const deptNameByIdLocal = Object.fromEntries(deptList.map((d) => [d.id, d.name]));
        setEvents(eventRows.map((e) => ({
          id: e.id, date: e.event_date, title: e.title, type: e.event_type,
          depts: (e.department_ids || []).map((id) => deptNameByIdLocal[id]).filter(Boolean),
          auditor: nameById[e.auditor_id] || "—",
        })));

        if (auth.isLoggedIn()) {
          try {
            const { user } = await auth.me();
            setAuthed(true);
            setCurrentUser(user);
          } catch { auth.logout(); }
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Once departments are loaded, fetch score/ranking data (depends on deptRows for shaping).
  useEffect(() => { if (deptRows.length) refreshAuditData(); }, [deptRows]);

  /* ------------------------------ Departments ------------------------------ */
  const handleAddDept = async (name) => {
    setSaving(true);
    await departmentsApi.create(name);
    setDeptRows(await departmentsApi.list());
    setSaving(false);
  };
  const handleRenameDept = async (oldName, newName) => {
    const dept = deptRows.find((d) => d.name === oldName);
    if (!dept) return;
    setSaving(true);
    await departmentsApi.rename(dept.id, newName);
    setDeptRows(await departmentsApi.list());
    setSaving(false);
  };
  const handleRemoveDept = async (name) => {
    const dept = deptRows.find((d) => d.name === name);
    if (!dept) return;
    setSaving(true);
    await departmentsApi.remove(dept.id);
    setDeptRows(await departmentsApi.list());
    setSaving(false);
  };

  /* ------------------------------- Committee -------------------------------- */
  async function syncCommittee(oldArr, newArr, isLead) {
    setSaving(true);
    const oldIds = new Set(oldArr.map((p) => p.id));
    const newIds = new Set(newArr.map((p) => p.id));
    for (const p of oldArr) if (!newIds.has(p.id)) await committeeApi.remove(p.id);
    for (const p of newArr) {
      const attached_departments = (p.attached || []).map((n) => deptIdByName[n]).filter(Boolean);
      if (!oldIds.has(p.id)) {
        await committeeApi.create({ name: p.name, role: p.role, photo_url: p.photo, is_lead: isLead, attached_departments });
      } else {
        const prev = oldArr.find((o) => o.id === p.id);
        if (prev && (prev.name !== p.name || prev.role !== p.role || prev.photo !== p.photo || JSON.stringify(prev.attached) !== JSON.stringify(p.attached))) {
          await committeeApi.update(p.id, { name: p.name, role: p.role, photo_url: p.photo, attached_departments });
        }
      }
    }
    setCommitteeRows(await committeeApi.list());
    setSaving(false);
  }

  /* --------------------------------- Events --------------------------------- */
  const handleAddEvent = async (form) => {
    setSaving(true);
    await eventsApi.create({
      title: form.title, event_date: form.date, event_type: form.type,
      department_ids: form.depts.map((n) => deptIdByName[n]).filter(Boolean),
      auditor_id: null,
    });
    const fresh = await eventsApi.list();
    setEvents(fresh.map((e) => ({
      id: e.id, date: e.event_date, title: e.title, type: e.event_type,
      depts: (e.department_ids || []).map((id) => deptNameById[id]).filter(Boolean),
      auditor: memberNameById[e.auditor_id] || "—",
    })));
    setSaving(false);
  };
  const handleRemoveEvent = async (id) => {
    setSaving(true);
    await eventsApi.remove(id);
    setEvents(events.filter((e) => e.id !== id));
    setSaving(false);
  };

  /* --------------------------------- Scores ---------------------------------- */
  const handleSaveScore = async (deptName, monthIdx, value) => {
    setSaving(true);
    try {
      const monthStr = `${CURRENT_YEAR}-${String(monthIdx + 1).padStart(2, "0")}-01`;
      await auditsApi.submitScore({ department_id: deptIdByName[deptName], month: monthStr, score: value });
      await refreshAuditData();
    } finally {
      setSaving(false);
    }
  };

  // Creates (or fetches, if it already exists) an audit row for a department+month
  // that hasn't been scored yet, so a photo/video/report has something to attach
  // to. Returns the audit id and updates local state so PerformanceCard's next
  // render has it too, without waiting for a full refetch.
  const handleEnsureAudit = async (deptName, monthIdx) => {
    const monthStr = `${CURRENT_YEAR}-${String(monthIdx + 1).padStart(2, "0")}-01`;
    const audit = await auditsApi.ensure(deptIdByName[deptName], monthStr);
    setAuditIds((prev) => {
      const next = { ...prev, [deptName]: [...(prev[deptName] || pad([]))] };
      next[deptName][monthIdx] = audit.id;
      return next;
    });
    return audit.id;
  };

  /* ---------------------------------- Auth ------------------------------------ */
  const handleEditClick = () => { if (editing) setEditing(false); else if (authed) setEditing(true); else { setLoginError(""); setShowLogin(true); } };
  const handleLogin = async (email, pw) => {
    try {
      const user = await auth.login(email, pw);
      setAuthed(true); setCurrentUser(user); setEditing(true); setShowLogin(false);
    } catch (err) {
      setLoginError(err.message || "Login failed.");
    }
  };
  const handleLogout = () => { auth.logout(); setAuthed(false); setEditing(false); setCurrentUser(null); };
  const handleChangePassword = async (current, next1, next2) => {
    setChangePwError(""); setChangePwSuccess("");
    if (next1.length < 8) return setChangePwError("New password must be at least 8 characters.");
    if (next1 !== next2) return setChangePwError("New passwords don't match.");
    try {
      await auth.changePassword(current, next1);
      setChangePwSuccess("Password updated.");
    } catch (err) {
      setChangePwError(err.message || "Could not update password.");
    }
  };

  /* ------------------------------ Site settings -------------------------------- */
  const handleSaveSiteSettings = async (next) => {
    setSiteSettings(next);
    setSaving(true);
    await settingsApi.update(next);
    setSaving(false);
  };

  const latestMonthLabel = useMemo(() => {
    const filled = MONTHS.filter((_, i) => departments.some((d) => scores[d]?.[i] !== null && scores[d]?.[i] !== undefined));
    return filled.length ? `${filled[filled.length - 1]} ${CURRENT_YEAR}` : "—";
  }, [scores, departments]);

  const view = useMemo(() => {
    switch (active) {
      case "committee":
        return (
          <Committee
            committeeLead={committeeLead} auditors={auditors} departments={departments} editing={editing}
            onSaveLead={(next) => syncCommittee(committeeLead, next, true)}
            onSaveAuditors={(next) => syncCommittee(auditors, next, false)}
            onAddDept={handleAddDept} onRenameDept={handleRenameDept} onRemoveDept={handleRemoveDept}
          />
        );
      case "performance":
        return <Performance scores={scores} auditIds={auditIds} departments={departments} editing={editing} onSaveScore={handleSaveScore} onEnsureAudit={handleEnsureAudit} />;
      case "calendar":
        return <CalendarSection events={events} departments={departments} editing={editing} onAddEvent={handleAddEvent} onRemoveEvent={handleRemoveEvent} />;
      case "rankings":
        return <Rankings standings={standings} monthlyWinners={monthlyWinners} />;
      case "gallery":
        return <Gallery editing={editing} departments={departments} deptIdByName={deptIdByName} onEnsureAudit={handleEnsureAudit} />;
      default:
        return <Home setActive={setActive} standings={standings} latestMonthLabel={latestMonthLabel} departments={departments} siteSettings={siteSettings} editing={editing} />;
    }
  }, [active, committeeLead, auditors, scores, auditIds, events, editing, standings, monthlyWinners, latestMonthLabel, departments, siteSettings]);

  if (loading) return <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: C.cream }}><Loader2 className="animate-spin" size={28} color={C.navy} /></div>;

  return (
    <div style={{ backgroundColor: C.cream, minHeight: "100vh", fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@600;700;800&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        * { box-sizing: border-box; }
        button:focus-visible, select:focus-visible, input:focus-visible, textarea:focus-visible { outline: 2px solid ${C.amberDeep}; outline-offset: 2px; }
      `}</style>
      <Nav
        active={active} setActive={setActive} editing={editing} authed={authed} saving={saving}
        onEditClick={handleEditClick} onLogout={handleLogout}
        onChangePassword={() => { setChangePwError(""); setChangePwSuccess(""); setShowChangePw(true); }}
        siteSettings={siteSettings} onSaveSiteSettings={handleSaveSiteSettings}
      />
      {view}
      <Footer latestMonthLabel={latestMonthLabel} siteSettings={siteSettings} editing={editing} onSaveSiteSettings={handleSaveSiteSettings} />
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} onSubmit={handleLogin} error={loginError} />}
      {showChangePw && <ChangePasswordModal onClose={() => setShowChangePw(false)} onSubmit={handleChangePassword} error={changePwError} success={changePwSuccess} />}
    </div>
  );
}
