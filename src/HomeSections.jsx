// HomeSections.jsx — drop into your React project.
// Two homepage pieces:
//   1. <LeadershipFlipCard /> — continuously flips between chairperson and
//      patron messages, each with their photo. Pulls from GET /api/settings.
//   2. <WinnersMarquee /> — an infinite horizontal scroll of the current
//      month's winning department's photos, the "modern website" strip
//      effect (like a logo cloud or testimonial carousel).
//
// Both are read-only/public — no login needed to view them.

import { useState, useEffect, useRef } from "react";
import { Quote, Trophy } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";
const avatarUrl = (name) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name || "Kaizen")}&background=0F2740&color=F2A93B&size=256&bold=true`;

/* ------------------------- Leadership Flip Card ------------------------- */
export function LeadershipFlipCard({ colors }) {
  const C = colors;
  const [settings, setSettings] = useState(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    fetch(`${API_BASE}/api/settings`).then((r) => r.json()).then(setSettings);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setActive((a) => (a + 1) % 2), 7000);
    return () => clearInterval(t);
  }, []);

  if (!settings) return null;

  const sides = [
    { key: "chairperson", name: settings.chairpersonName, role: settings.chairpersonRole, photo: settings.chairpersonPhoto, text: settings.chairpersonMessage },
    { key: "patron", name: settings.patronName, role: settings.patronRole, photo: settings.patronPhoto, text: settings.patronMessage },
  ];

  return (
    <div>
      <div style={{ perspective: "1600px" }} className="w-full">
        <div
          className="relative w-full"
          style={{
            minHeight: 220,
            transformStyle: "preserve-3d",
            transition: "transform 0.8s cubic-bezier(.4,.2,.2,1)",
            transform: `rotateY(${active * 180}deg)`,
          }}
        >
          {sides.map((s, i) => (
            <div
              key={s.key}
              className="absolute inset-0 rounded-lg p-7 flex gap-5"
              style={{ backgroundColor: C.navy, backfaceVisibility: "hidden", transform: `rotateY(${i * 180}deg)` }}
            >
              <img
                src={s.photo || avatarUrl(s.name)}
                alt={s.name}
                className="w-16 h-16 rounded-full object-cover shrink-0 border-2"
                style={{ borderColor: C.amber }}
              />
              <div className="min-w-0">
                <Quote size={18} color={C.amber} />
                <p className="mt-1 text-sm leading-relaxed" style={{ color: "rgba(244,245,240,0.9)" }}>{s.text}</p>
                <div className="mt-3 text-sm font-bold" style={{ color: C.cream }}>{s.name}</div>
                <div className="text-xs uppercase tracking-wide" style={{ color: C.amber, fontFamily: "'IBM Plex Mono', monospace" }}>{s.role}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex justify-center gap-2 mt-4">
        <button onClick={() => setActive(0)} aria-label="Chairperson message" className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: active === 0 ? C.amberDeep : C.hairline }} />
        <button onClick={() => setActive(1)} aria-label="Patron message" className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: active === 1 ? C.amberDeep : C.hairline }} />
      </div>
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
  const trackRef = useRef(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/audits/current-winner-media`).then((r) => r.json()).then(setData);
  }, []);

  if (!data || !data.winner || data.media.length === 0) return null;

  const { winner, media } = data;
  // Duplicate the list so the CSS animation can loop seamlessly at -50%.
  const looped = [...media, ...media];

  return (
    <div className="py-10" style={{ backgroundColor: C.navyDeep }}>
      <div className="max-w-6xl mx-auto px-5 mb-5 flex items-center gap-2">
        <Trophy size={18} color={C.amber} />
        <span className="text-xs uppercase tracking-widest font-semibold" style={{ color: C.amber, fontFamily: "'IBM Plex Mono', monospace" }}>
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
