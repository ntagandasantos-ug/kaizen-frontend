// HomeSections.jsx — drop into your React project.
// Two homepage pieces:
//   1. <LeadershipFlipCard /> — continuously flips between chairperson and
//      patron messages, each with their photo. Pulls from GET /api/settings.
//      Pass editing={true} to show inline edit fields + photo upload when
//      the site is in admin mode.
//   2. <WinnersMarquee /> — an infinite horizontal scroll of the current
//      month's winning department's photos, the "modern website" strip
//      effect (like a logo cloud or testimonial carousel). Read-only.

import { useState, useEffect, useRef } from "react";
import { Quote, Trophy, Upload, Loader2, Camera } from "lucide-react";
import { settings as settingsApi, media, gallery as galleryApi } from "./api";

const avatarUrl = (name) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name || "Kaizen")}&background=0F2740&color=F2A93B&size=256&bold=true`;

const fontMono = { fontFamily: "'IBM Plex Mono', monospace" };

/* ------------------------- Leadership Flip Card ------------------------- */
export function LeadershipFlipCard({ colors, editing = false }) {
  const C = colors;
  const [settingsObj, setSettingsObj] = useState(null);
  const [active, setActive] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    settingsApi.get().then(setSettingsObj).catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    if (editing) return; // don't auto-flip while someone is editing
    const t = setInterval(() => setActive((a) => (a + 1) % 2), 7000);
    return () => clearInterval(t);
  }, [editing]);

  if (error) return <p className="text-sm" style={{ color: C.brick }}>Couldn't load leadership messages: {error}</p>;
  if (!settingsObj) return null;

  const fieldPrefix = { chairperson: "chairperson", patron: "patron" };
  const sides = [
    { key: "chairperson", name: settingsObj.chairpersonName, role: settingsObj.chairpersonRole, photo: settingsObj.chairpersonPhoto, text: settingsObj.chairpersonMessage },
    { key: "patron", name: settingsObj.patronName, role: settingsObj.patronRole, photo: settingsObj.patronPhoto, text: settingsObj.patronMessage },
  ];

  const patchField = async (key, field, value) => {
    const prefix = fieldPrefix[key];
    const settingKey = `${prefix}${field.charAt(0).toUpperCase()}${field.slice(1)}`; // e.g. chairpersonName
    const next = { ...settingsObj, [settingKey]: value };
    setSettingsObj(next);
    setSaving(true);
    try {
      await settingsApi.update({ [settingKey]: value });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div style={{ perspective: "1600px" }} className="w-full">
        <div
          className="relative w-full"
          style={{
            minHeight: editing ? 320 : 220,
            transformStyle: "preserve-3d",
            transition: "transform 0.8s cubic-bezier(.4,.2,.2,1)",
            transform: editing ? "none" : `rotateY(${active * 180}deg)`,
          }}
        >
          {sides.map((s, i) => (
            <div
              key={s.key}
              className={editing ? "relative rounded-lg p-7 flex gap-5 mb-4" : "absolute inset-0 rounded-lg p-7 flex gap-5"}
              style={editing ? { backgroundColor: C.navy } : { backgroundColor: C.navy, backfaceVisibility: "hidden", transform: `rotateY(${i * 180}deg)` }}
            >
              <div className="shrink-0">
                <img
                  src={s.photo || avatarUrl(s.name)}
                  alt={s.name}
                  className="w-16 h-16 rounded-full object-cover border-2"
                  style={{ borderColor: C.amber }}
                />
                {editing && (
                  <PhotoUploadButton
                    label="Photo"
                    uploadFn={media.uploadLogo}
                    onUploaded={(url) => patchField(s.key, "photo", url)}
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                {!editing && <Quote size={18} color={C.amber} />}
                {editing ? (
                  <>
                    <label className="block text-[10px] uppercase tracking-wide mb-0.5" style={{ color: C.amber, ...fontMono }}>Message</label>
                    <textarea
                      className="w-full rounded px-2 py-1.5 text-sm mb-2"
                      style={{ backgroundColor: "rgba(255,255,255,0.08)", color: C.cream, border: "1px solid rgba(255,255,255,0.15)" }}
                      rows={3}
                      defaultValue={s.text}
                      onBlur={(e) => patchField(s.key, "message", e.target.value)}
                    />
                    <label className="block text-[10px] uppercase tracking-wide mb-0.5" style={{ color: C.amber, ...fontMono }}>Name</label>
                    <input
                      className="w-full rounded px-2 py-1 text-sm mb-2"
                      style={{ backgroundColor: "rgba(255,255,255,0.08)", color: C.cream, border: "1px solid rgba(255,255,255,0.15)" }}
                      defaultValue={s.name}
                      onBlur={(e) => patchField(s.key, "name", e.target.value)}
                    />
                    <label className="block text-[10px] uppercase tracking-wide mb-0.5" style={{ color: C.amber, ...fontMono }}>Title</label>
                    <input
                      className="w-full rounded px-2 py-1 text-sm"
                      style={{ backgroundColor: "rgba(255,255,255,0.08)", color: C.cream, border: "1px solid rgba(255,255,255,0.15)" }}
                      defaultValue={s.role}
                      onBlur={(e) => patchField(s.key, "role", e.target.value)}
                    />
                  </>
                ) : (
                  <>
                    <p className="mt-1 text-sm leading-relaxed" style={{ color: "rgba(244,245,240,0.9)" }}>{s.text}</p>
                    <div className="mt-3 text-sm font-bold" style={{ color: C.cream }}>{s.name}</div>
                    <div className="text-xs uppercase tracking-wide" style={{ color: C.amber, ...fontMono }}>{s.role}</div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      {!editing && (
        <div className="flex justify-center gap-2 mt-4">
          <button onClick={() => setActive(0)} aria-label="Chairperson message" className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: active === 0 ? C.amberDeep : C.hairline }} />
          <button onClick={() => setActive(1)} aria-label="Patron message" className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: active === 1 ? C.amberDeep : C.hairline }} />
        </div>
      )}
      {saving && <p className="text-xs mt-2 flex items-center gap-1" style={{ color: C.slate }}><Loader2 size={12} className="animate-spin" /> Saving…</p>}
      {error && <p className="text-xs mt-2" style={{ color: C.brick }}>{error}</p>}
    </div>
  );
}

/* --------------------------- shared upload button -------------------------- */
function PhotoUploadButton({ label, onUploaded, uploadFn }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="mt-1">
      <label
        className="flex items-center gap-1 px-2 py-1 rounded border text-[10px] font-semibold cursor-pointer w-fit"
        style={{ borderColor: "rgba(255,255,255,0.25)", color: "#F4F5F0" }}
      >
        {uploading ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />}
        {uploading ? "…" : label}
        <input
          type="file"
          accept="image/*"
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
      {error && <p className="text-[10px] mt-1" style={{ color: "#E7A9A9", maxWidth: 180 }}>{error}</p>}
    </div>
  );
}

/* ---------------------------- Winners Marquee ---------------------------- */
// Continuous horizontal scroll — the classic "modern website" logo-cloud /
// testimonial-strip effect. Pure CSS animation (translateX loop), pauses on
// hover, and duplicates the media list so the loop has no visible seam.
export function WinnersMarquee({ colors }) {
  const C = colors;
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const trackRef = useRef(null);

  useEffect(() => {
    media.currentWinnerMedia().then(setData).catch((err) => setError(err.message));
  }, []);

  if (error) return null; // fail silently on the homepage — this section is decorative
  if (!data || !data.winner || data.media.length === 0) return null;

  const { winner, media: files } = data;
  // Duplicate the list so the CSS animation can loop seamlessly at -50%.
  const looped = [...files, ...files];

  return (
    <div className="py-10" style={{ backgroundColor: C.navyDeep }}>
      <div className="max-w-6xl mx-auto px-5 mb-5 flex items-center gap-2">
        <Trophy size={18} color={C.amber} />
        <span className="text-xs uppercase tracking-widest font-semibold" style={{ color: C.amber, ...fontMono }}>
          {winner.department} — {new Date(winner.month).toLocaleDateString("en-US", { month: "long", year: "numeric" })} Winner
        </span>
      </div>

      <div className="overflow-hidden w-full" style={{ maskImage: "linear-gradient(90deg, transparent, black 8%, black 92%, transparent)" }}>
        <div
          ref={trackRef}
          className="flex gap-4 w-max marquee-track"
          style={{ animation: "marqueeScroll 28s linear infinite" }}
        >
          {looped.map((m, i) => (
            <div
              key={`${m.id}-${i}`}
              className="rounded-lg overflow-hidden shrink-0"
              style={{ width: 220, height: 150, backgroundColor: "#1a2f45" }}
            >
              {m.file_type === "video" ? (
                <video src={m.file_url} className="w-full h-full object-cover" muted loop autoPlay playsInline />
              ) : (
                <img src={m.file_url} alt={winner.department} className="w-full h-full object-cover" loading="lazy" />
              )}
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes marqueeScroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .marquee-track:hover { animation-play-state: paused; }
        @media (prefers-reduced-motion: reduce) {
          .marquee-track { animation: none !important; }
        }
      `}</style>
    </div>
  );
}

/* ------------------------- General Gallery Marquee ------------------------ */
// Same continuous horizontal-scroll effect as WinnersMarquee, but shows
// recent uploads from EVERY department, not just the current month's winner.
// This is what actually reflects everything uploaded via the Gallery page.
export function GalleryMarquee({ colors }) {
  const C = colors;
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    galleryApi.list()
      .then((rows) => setItems(rows.filter((r) => r.file_type === "photo" || r.file_type === "video").slice(0, 20)))
      .catch((err) => setError(err.message));
  }, []);

  if (error) return null;
  if (!items || items.length === 0) return null;

  const looped = [...items, ...items];

  return (
    <div className="py-10" style={{ backgroundColor: C.navy }}>
      <div className="max-w-6xl mx-auto px-5 mb-5 flex items-center gap-2">
        <Camera size={18} color={C.amber} />
        <span className="text-xs uppercase tracking-widest font-semibold" style={{ color: C.amber, ...fontMono }}>
          From the Gallery
        </span>
      </div>

      <div className="overflow-hidden w-full" style={{ maskImage: "linear-gradient(90deg, transparent, black 8%, black 92%, transparent)" }}>
        <div className="flex gap-4 w-max marquee-track-reverse" style={{ animation: "marqueeScrollReverse 34s linear infinite" }}>
          {looped.map((m, i) => (
            <div key={`${m.id}-${i}`} className="rounded-lg overflow-hidden shrink-0 relative" style={{ width: 220, height: 150, backgroundColor: "#0A1B2E" }}>
              {m.file_type === "video" ? (
                <video src={m.file_url} className="w-full h-full object-cover" muted loop autoPlay playsInline />
              ) : (
                <img src={m.file_url} alt={m.caption || "Gallery photo"} className="w-full h-full object-cover" loading="lazy" />
              )}
              {m.caption && (
                <div className="absolute bottom-0 left-0 right-0 px-2 py-1" style={{ background: "linear-gradient(transparent, rgba(0,0,0,0.7))" }}>
                  <span className="text-[10px] font-semibold" style={{ color: "#F4F5F0" }}>{m.caption}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes marqueeScrollReverse {
          from { transform: translateX(-50%); }
          to { transform: translateX(0); }
        }
        .marquee-track-reverse:hover { animation-play-state: paused; }
        @media (prefers-reduced-motion: reduce) {
          .marquee-track-reverse { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
