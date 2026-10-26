"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Car,
  Phone,
  Mail,
  MapPin,
  Clock,
  Shield,
  Star,
  Users,
  Plane,
  ChevronRight,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";

const HERO_IMAGE =
  "https://dtvoeevhaseb5.cloudfront.net/user-uploads/027845de-1aa2-4ab1-9ce3-bc72387ff4da.png";

const ACCENT = "#e8752a";
const ACCENT_HOVER = "#f0853d";

const SERVICES_HIGHLIGHT = [
  {
    icon: Plane,
    title: "Airport Transfers",
    desc: "Reliable pickup and drop-off to BNA and surrounding airports. We track your flight so we're always on time.",
  },
  {
    icon: Car,
    title: "Private Car Service",
    desc: "Point-to-point rides across Middle Tennessee. Perfect for meetings, events, or a night out.",
  },
  {
    icon: Users,
    title: "Group & Event Transport",
    desc: "Large SUVs and multi-vehicle coordination for weddings, corporate events, and group outings.",
  },
  {
    icon: Clock,
    title: "Hourly Charters",
    desc: "Book by the hour for flexible schedules — errands, multi-stop tours, or all-day availability.",
  },
];

const TRUST_ITEMS = [
  { value: "5,000+", label: "Rides Completed" },
  { value: "4.9★", label: "Average Rating" },
  { value: "24/7", label: "Availability" },
  { value: "100%", label: "On-Time Rate" },
];

const TESTIMONIALS = [
  {
    name: "Sarah M.",
    text: "Always on time, always friendly. I won't use anyone else for my airport rides.",
    rating: 5,
  },
  {
    name: "James T.",
    text: "Booked for a wedding — three vehicles, zero stress. The team was incredible.",
    rating: 5,
  },
  {
    name: "Linda K.",
    text: "Professional, clean vehicles, and great communication. Five stars every time.",
    rating: 5,
  },
];

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const { data: settings } = useQuery({
    queryKey: ["landing-settings"],
    queryFn: async () => {
      const res = await fetch("/api/settings");
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
  });

  const { data: services } = useQuery({
    queryKey: ["landing-services"],
    queryFn: async () => {
      const res = await fetch("/api/services");
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      return data
        .filter((s) => s.is_active && !s.is_addon)
        .sort((a, b) => a.display_order - b.display_order);
    },
  });

  const businessName = settings?.business_name || "Catch A Ride";
  const businessPhone = settings?.business_phone || "";
  const ownerEmail = settings?.owner_email || "";
  const servicesUrl = settings?.services_url || "";

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-inter">
      {/* ── Sticky Nav ─────────────────────────────────────────────── */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
        style={{
          backgroundColor: scrolled
            ? "rgba(10,10,10,0.97)"
            : "rgba(10,10,10,0.85)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderBottom: scrolled
            ? "1px solid rgba(255,255,255,0.08)"
            : "1px solid rgba(255,255,255,0.04)",
        }}
      >
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ backgroundColor: ACCENT }}
            >
              <Car size={20} className="text-white" />
            </div>
            <div className="leading-tight">
              <span className="text-base font-bold tracking-tight block">
                Catch a <span style={{ color: ACCENT }}>RIDE</span>
              </span>
              <span className="text-[10px] text-gray-500 tracking-widest uppercase">
                Nashville, TN
              </span>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-gray-400">
            <a href="#services" className="hover:text-white transition-colors">
              Services
            </a>
            <a href="#why-us" className="hover:text-white transition-colors">
              Why Us
            </a>
            <a href="#reviews" className="hover:text-white transition-colors">
              Reviews
            </a>
            <a href="#contact" className="hover:text-white transition-colors">
              Contact
            </a>
            <a
              href="/dashboard"
              className="hover:text-white transition-colors font-semibold"
            >
              Dashboard
            </a>
          </div>
          <a
            href="/book-wizard/catch-a-ride"
            className="px-5 py-2.5 text-white text-sm font-bold rounded-lg transition-colors"
            style={{ backgroundColor: ACCENT }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = ACCENT_HOVER)
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = ACCENT)
            }
          >
            Book Now
          </a>
        </div>
      </nav>

      {/* ── Hero Section with Background Image ─────────────────────── */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Background image — only visible in the top portion (SUVs area) */}
        <div
          className="absolute top-0 left-0 right-0"
          style={{
            height: "50%",
            backgroundImage: `url(${HERO_IMAGE})`,
            backgroundSize: "cover",
            backgroundPosition: "center 10%",
            backgroundRepeat: "no-repeat",
          }}
        />
        {/* Heavy overlay — fully opaque at top, thin warm glow peeks through in middle */}
        <div
          className="absolute top-0 left-0 right-0"
          style={{
            height: "50%",
            background:
              "linear-gradient(to bottom, rgba(10,10,10,1) 0%, rgba(10,10,10,1) 6%, rgba(10,10,10,0.55) 12%, rgba(10,10,10,0.55) 18%, rgba(10,10,10,0.97) 28%, rgba(10,10,10,1) 40%)",
          }}
        />
        {/* Solid black for the bottom half */}
        <div
          className="absolute bottom-0 left-0 right-0 bg-[#0a0a0a]"
          style={{ height: "62%" }}
        />

        <div className="relative z-10 text-center px-6 max-w-3xl mx-auto space-y-6 pt-24">
          {/* Logo */}
          <div className="flex justify-center mb-4">
            {settings?.logo_url ? (
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center shadow-lg bg-white p-2"
                style={{
                  boxShadow: `0 8px 32px ${ACCENT}33`,
                }}
              >
                <img
                  src={settings.logo_url}
                  alt="Logo"
                  className="w-full h-full object-contain"
                />
              </div>
            ) : (
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center shadow-lg"
                style={{
                  backgroundColor: ACCENT,
                  boxShadow: `0 8px 32px ${ACCENT}33`,
                }}
              >
                <Car size={40} className="text-white" />
              </div>
            )}
          </div>

          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight leading-[1.05]">
            Catch a Ride
          </h1>

          <p
            className="text-xl md:text-2xl font-bold"
            style={{ color: ACCENT }}
          >
            Private, Reliable Rides Across Middle Tennessee
          </p>

          <p className="text-base md:text-lg text-gray-300 tracking-widest uppercase">
            Airport &bull; Downtown &bull; Custom Trips
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6">
            <a
              href="/book-wizard/catch-a-ride"
              className="px-10 py-4 text-white text-lg font-bold rounded-xl transition-all flex items-center gap-3 shadow-lg"
              style={{
                backgroundColor: ACCENT,
                boxShadow: `0 4px 24px ${ACCENT}40`,
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor = ACCENT_HOVER)
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = ACCENT)
              }
            >
              <Phone size={20} /> Call To Book Now
            </a>
          </div>

          {/* Trust bar */}
          <div className="pt-16 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-lg md:max-w-2xl mx-auto">
            {TRUST_ITEMS.map((item) => (
              <div key={item.label} className="text-center">
                <p className="text-2xl font-bold" style={{ color: ACCENT }}>
                  {item.value}
                </p>
                <p className="text-xs text-gray-400 uppercase tracking-widest mt-1">
                  {item.label}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Scroll hint */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-gray-500">
          <span className="text-xs uppercase tracking-widest">Scroll</span>
          <div className="w-5 h-8 border border-gray-600 rounded-full flex items-start justify-center p-1">
            <div className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
          </div>
        </div>
      </section>

      {/* ── Services Section ───────────────────────────────────────── */}
      <section id="services" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16 space-y-3">
            <p
              className="text-xs font-bold uppercase tracking-[0.25em]"
              style={{ color: ACCENT }}
            >
              What We Offer
            </p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              Our Services
            </h2>
            <p className="text-gray-500 max-w-lg mx-auto">
              From airport pickups to all-day charters, we've got your ride
              covered.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {SERVICES_HIGHLIGHT.map((svc) => {
              const Icon = svc.icon;
              return (
                <div
                  key={svc.title}
                  className="group bg-[#111] border border-gray-800 rounded-2xl p-8 hover:border-[#e8752a]/40 transition-all"
                >
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center mb-5 transition-colors"
                    style={{ backgroundColor: `${ACCENT}15`, color: ACCENT }}
                  >
                    <Icon size={24} />
                  </div>
                  <h3 className="text-lg font-bold mb-2">{svc.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">
                    {svc.desc}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Dynamic services list from DB */}
          {services && services.length > 0 && (
            <div className="mt-12 bg-[#111] border border-gray-800 rounded-2xl p-8">
              <h3
                className="text-sm font-bold uppercase tracking-widest mb-6"
                style={{ color: ACCENT }}
              >
                Service Menu & Pricing
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {services.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between py-3 border-b border-gray-800 last:border-0"
                  >
                    <div>
                      <p className="font-semibold text-gray-200">{s.name}</p>
                      {s.description && (
                        <p className="text-xs text-gray-600 mt-0.5">
                          {s.description}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0 ml-4">
                      {s.is_variable_price ? (
                        <span className="text-xs text-gray-500 italic">
                          Quote
                        </span>
                      ) : (
                        <span className="font-bold" style={{ color: ACCENT }}>
                          ${Number(s.default_price).toFixed(0)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 text-center">
                <a
                  href="/book-wizard/catch-a-ride"
                  className="inline-flex items-center gap-2 px-6 py-3 text-white font-bold rounded-xl transition-colors text-sm"
                  style={{ backgroundColor: ACCENT }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor = ACCENT_HOVER)
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = ACCENT)
                  }
                >
                  Book a Service <ChevronRight size={16} />
                </a>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Why Us Section ─────────────────────────────────────────── */}
      <section id="why-us" className="py-24 px-6 bg-[#080808]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16 space-y-3">
            <p
              className="text-xs font-bold uppercase tracking-[0.25em]"
              style={{ color: ACCENT }}
            >
              The Difference
            </p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              Why Choose {businessName}?
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: Shield,
                title: "Licensed & Insured",
                desc: "Fully licensed, commercially insured, and compliant with Tennessee PUC regulations.",
              },
              {
                icon: Clock,
                title: "Always On Time",
                desc: "We track flights, monitor traffic, and arrive early. Punctuality isn't optional — it's guaranteed.",
              },
              {
                icon: Star,
                title: "Premium Experience",
                desc: "Clean vehicles, professional drivers, and personal service — every ride feels first-class.",
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="text-center space-y-4">
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto"
                    style={{ backgroundColor: `${ACCENT}15`, color: ACCENT }}
                  >
                    <Icon size={28} />
                  </div>
                  <h3 className="text-lg font-bold">{item.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed max-w-xs mx-auto">
                    {item.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Testimonials Section ───────────────────────────────────── */}
      <section id="reviews" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16 space-y-3">
            <p
              className="text-xs font-bold uppercase tracking-[0.25em]"
              style={{ color: ACCENT }}
            >
              Testimonials
            </p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              What Our Riders Say
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <div
                key={i}
                className="bg-[#111] border border-gray-800 rounded-2xl p-8 space-y-4"
              >
                <div className="flex gap-1">
                  {Array.from({ length: t.rating }).map((_, j) => (
                    <Star
                      key={j}
                      size={16}
                      style={{ color: ACCENT, fill: ACCENT }}
                    />
                  ))}
                </div>
                <p className="text-gray-400 text-sm leading-relaxed italic">
                  "{t.text}"
                </p>
                <p className="text-sm font-semibold text-gray-300">
                  — {t.name}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Section ────────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center space-y-8">
          <div className="space-y-4">
            <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight">
              Ready to Ride?
            </h2>
            <p className="text-gray-500 text-lg max-w-md mx-auto">
              Book online in under a minute, or give us a call. We'll take care
              of the rest.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="/book-wizard/catch-a-ride"
              className="px-8 py-4 text-white text-base font-bold rounded-xl transition-all flex items-center gap-2 shadow-lg"
              style={{
                backgroundColor: ACCENT,
                boxShadow: `0 4px 24px ${ACCENT}40`,
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor = ACCENT_HOVER)
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = ACCENT)
              }
            >
              Book Online <ArrowRight size={18} />
            </a>
            {businessPhone && (
              <a
                href={`tel:${businessPhone}`}
                className="px-8 py-4 border border-gray-700 text-gray-300 text-base font-semibold rounded-xl hover:border-gray-500 hover:text-white transition-all flex items-center gap-2"
              >
                <Phone size={18} /> {businessPhone}
              </a>
            )}
          </div>
        </div>
      </section>

      {/* ── Contact / Footer ───────────────────────────────────────── */}
      <footer
        id="contact"
        className="border-t border-gray-800 py-16 px-6 bg-[#080808]"
      >
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12">
          {/* Brand */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center"
                style={{ backgroundColor: ACCENT }}
              >
                <Car size={18} className="text-white" />
              </div>
              <span className="text-lg font-bold">{businessName}</span>
            </div>
            <p className="text-sm text-gray-500 leading-relaxed">
              Premium car service in Hendersonville and the greater Nashville
              area. Airport transfers, private rides, and group transport.
            </p>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest">
              Quick Links
            </h4>
            <div className="space-y-2">
              <a
                href="#services"
                className="block text-sm text-gray-400 hover:text-white transition-colors"
              >
                Services
              </a>
              <a
                href="/book-wizard/catch-a-ride"
                className="block text-sm text-gray-400 hover:text-white transition-colors"
              >
                Book a Ride
              </a>
              {servicesUrl && (
                <a
                  href={servicesUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Website
                </a>
              )}
            </div>
          </div>

          {/* Contact */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest">
              Contact
            </h4>
            <div className="space-y-3">
              {businessPhone && (
                <a
                  href={`tel:${businessPhone}`}
                  className="flex items-center gap-3 text-sm text-gray-400 hover:text-white transition-colors"
                >
                  <Phone size={14} style={{ color: ACCENT }} /> {businessPhone}
                </a>
              )}
              {ownerEmail && (
                <a
                  href={`mailto:${ownerEmail}`}
                  className="flex items-center gap-3 text-sm text-gray-400 hover:text-white transition-colors"
                >
                  <Mail size={14} style={{ color: ACCENT }} /> {ownerEmail}
                </a>
              )}
              <div className="flex items-center gap-3 text-sm text-gray-400">
                <MapPin size={14} style={{ color: ACCENT }} /> Hendersonville,
                TN
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto mt-12 pt-8 border-t border-gray-800 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-gray-600">
            © {new Date().getFullYear()} {businessName}. All rights reserved.
          </p>
          <div className="flex items-center gap-6 text-xs text-gray-600">
            <a
              href="https://catcharide.us/privacy-policy/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-gray-400 transition-colors"
            >
              Privacy Policy
            </a>
            <a
              href="https://catcharide.us/terms-and-conditions/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-gray-400 transition-colors"
            >
              Terms & Conditions
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
