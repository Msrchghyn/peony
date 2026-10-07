"use client";

import { useEffect, useState } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { ArrowDown, CalendarDays, FileText, Mail, Send, Check, Sparkles } from "lucide-react";

function PeonyFlower({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true">
      <g fill="currentColor">
        {[0, 60, 120, 180, 240, 300].map((r) => (
          <ellipse key={r} cx="16" cy="8.5" rx="5.6" ry="8" transform={`rotate(${r} 16 16)`} />
        ))}
      </g>
      <g fill="#F28FAF">
        {[30, 90, 150, 210, 270, 330].map((r) => (
          <ellipse key={r} cx="16" cy="11.5" rx="4.6" ry="6" transform={`rotate(${r} 16 16)`} />
        ))}
      </g>
      <circle cx="16" cy="16" r="5" fill="#FAC3D6" />
      <circle cx="16" cy="16" r="1.9" fill="#F2C240" />
    </svg>
  );
}

const promos = [
  ["20% off", "promo p-butter t1"],
  ["New arrivals", "promo p-iris t2"],
  ["Free delivery", "promo p-mint t3"],
  ["Limited time", "promo p-rose t4"],
  ["Shop the new season", "promo p-butter t5"],
  ["48 hours left", "promo p-iris t6"],
];

const floatingItems = [
  { className: "float-card float-card--one", rotate: -7, x: -430, y: -145, delay: 0.04, icon: <Mail size={16} />, title: "Interview invite", subtitle: "Tomorrow · 10:30 AM" },
  { className: "float-card float-card--two", rotate: 6, x: 425, y: -145, delay: 0.1, icon: <CalendarDays size={16} />, title: "Meeting moved", subtitle: "Design sync · 3:00 PM" },
  { className: "float-card float-card--three", rotate: -4, x: -435, y: 175, delay: 0.16, icon: <FileText size={16} />, title: "Invoice received", subtitle: "Ready for review" },
  { className: "float-card float-card--four", rotate: 5, x: 430, y: 185, delay: 0.22, icon: <Sparkles size={16} />, title: "Application update", subtitle: "Added to Job Search" },
];

function PromoCard({ label, className }: { label: string; className: string }) {
  return <div className={className}><b>{label}</b><span><i /><i /></span></div>;
}

export default function PeonyHero() {
  const [gmailConnected, setGmailConnected] = useState(false);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const smoothX = useSpring(mouseX, { stiffness: 42, damping: 18, mass: 0.9 });
  const smoothY = useSpring(mouseY, { stiffness: 42, damping: 18, mass: 0.9 });
  const sceneX = useTransform(smoothX, [-1, 1], [-8, 8]);
  const sceneY = useTransform(smoothY, [-1, 1], [-5, 5]);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/gmail/status", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json();
      })
      .then((status) => {
        if (!cancelled && status?.connected) setGmailConnected(true);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const move = (event: MouseEvent) => {
      mouseX.set((event.clientX / window.innerWidth - 0.5) * 2);
      mouseY.set((event.clientY / window.innerHeight - 0.5) * 2);
    };
    window.addEventListener("mousemove", move);
    return () => window.removeEventListener("mousemove", move);
  }, [mouseX, mouseY]);

  return (
    <>
      <header className="nav">
        <div className="wrap nav-in">
          <a className="brand" href="#top" aria-label="Peony, back to top">
            <PeonyFlower />
            <span>Peony</span>
          </a>
          <nav className="nav-links" aria-label="Main navigation">
            <a href="#notice">How it works</a>
            <a href="#gardens">Gardens</a>
            <a href="#act">Ask once</a>
            <a className="btn btn-ink btn-sm" href="/app">{gmailConnected ? "Open your inbox" : "Open Peony"}</a>
          </nav>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="wrap">
          <h1>Your inbox, in bloom.</h1>
          <p className="lede">Peony brings the important things forward, softens the noise, and turns related emails into little spaces that actually make sense.</p>
          <div className="hero-cta">
            <a className="btn btn-ink" href="#act">Open Peony</a>
            <a className="btn btn-ghost" href="#notice">See how it works</a>
          </div>

          <div className="desk">
            <div className="toss" aria-hidden="true">
              {promos.map(([label, className]) => <PromoCard key={label} label={label} className={className} />)}
            </div>

            <motion.div className="hero-floating" aria-hidden="true" style={{ x: sceneX, y: sceneY }}>
              {floatingItems.map((item, index) => (
                <motion.article
                  className={item.className}
                  key={item.title}
                  initial={{ opacity: 0, scale: 0.6, x: 0, y: 0, rotate: 0 }}
                  animate={{ opacity: 1, scale: 1, x: item.x, y: [item.y, item.y - 7, item.y], rotate: item.rotate }}
                  transition={{
                    x: { type: "spring", stiffness: 56, damping: 13, delay: item.delay },
                    scale: { type: "spring", stiffness: 66, damping: 12, delay: item.delay },
                    opacity: { duration: 0.35, delay: item.delay },
                    rotate: { type: "spring", stiffness: 55, damping: 13, delay: item.delay },
                    y: { duration: 5 + index * 0.4, repeat: Infinity, ease: "easeInOut", delay: 1 + item.delay },
                  }}
                >
                  <span className="mini-icon">{item.icon}</span>
                  <div className="float-copy"><b>{item.title}</b><span>{item.subtitle}</span></div>
                </motion.article>
              ))}
            </motion.div>

            <article className="notebook" aria-label="Preview of the Peony inbox">
              <header className="nb-head">
                <div>
                  <p className="nb-day">Wednesday morning</p>
                  <p className="nb-title">Good morning.</p>
                  <p className="nb-sub">Here's what deserves your attention.</p>
                </div>
                <PeonyFlower className="nb-mark" />
              </header>

              <section className="grp">
                <h3 className="grp-h"><span className="dot rose" />Must see<span className="grp-n">4</span></h3>
                <div className="msg"><span className="av av-rose">AS</span><div className="msg-b"><p><b>Adam</b> needs the <b>employee onboarding document</b> by the end of today.</p><div className="reply"><span className="clip-mark">⌕</span><p><b>Reply to Adam:</b> Hi Adam, attached below is the employee onboarding document.</p><div className="reply-foot"><span className="file"><FileText size={14} />Onboarding.pdf</span><button className="btn btn-ink btn-sm" type="button"><Send size={14} />Send</button></div></div></div></div>
                <div className="msg"><span className="av av-iris av-co">N</span><div className="msg-b"><p><b>Northwind Studio</b> confirmed your <b>design engineer</b> application.</p><p className="sub"><span className="tiny-flower">✿</span>Added to garden “Job Search”</p></div></div>
                <div className="msg"><span className="av av-butter">KY</span><div className="msg-b"><p><b>Katherine</b> hasn't replied to your request for the latest <b>design proposal</b>.</p></div><span className="sticker">Follow up</span></div>
                <div className="msg"><span className="av av-mint">JW</span><div className="msg-b"><p><b>Jason</b> moved the <b>weekly check-in</b> to 3:00 PM.</p><div className="stamps"><button className="stamp" type="button">Yes</button><button className="stamp stamp-no" type="button">No</button><button className="stamp stamp-maybe" type="button">Maybe</button></div></div></div>
              </section>

              <section className="grp">
                <h3 className="grp-h"><span className="dot mint" />FYI<span className="grp-n">8 summarized</span></h3>
                <div className="tiles">
                  <div className="tile"><h4>♧ 1 Notification</h4><div className="mini"><b>New sign-in</b>Chrome on Mac, 9:41 AM</div></div>
                  <div className="tile"><h4>✈ 1 Booking</h4><div className="mini pass"><div><b>SFO to JFK</b><br />Flight is on time</div><div className="pass-side"><b>Fri</b><span>7:45</span></div></div></div>
                  <div className="tile"><h4>▣ 1 Package</h4><div className="mini"><b>Order A20</b>Arriving Sep 26<div className="track"><span /><em /><span /><em className="off" /><span className="off" /></div></div></div>
                </div>
                <div className="grow"><span>⌂ 1 apartment application found</span><a href="#gardens">Grow a garden to track it</a></div>
              </section>

              <section className="grp">
                <h3 className="grp-h"><span className="dot iris" />Low priority<span className="grp-n">21 can wait</span></h3>
                <div className="lowrow"><h4>⌁ 1 Promotion</h4><div className="fan"><PromoCard label="20% off" className="promo p-butter" /><PromoCard label="New arrivals" className="promo p-iris" /><PromoCard label="Free delivery" className="promo p-mint" /><PromoCard label="48 hours left" className="promo p-rose" /></div></div>
              </section>
            </article>
          </div>
        </div>
      </section>
    </>
  );
}
