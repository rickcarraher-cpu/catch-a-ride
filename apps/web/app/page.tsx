import { useQuery } from "@tanstack/react-query";

export default function LandingPage() {
  const { data: settings } = useQuery({
    queryKey: ["public-settings"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/public/settings");
        if (!res.ok) return {};
        return res.json();
      } catch {
        return {};
      }
    },
  });

  const companyName = settings?.companyName || "Catch a Ride";
  const city = settings?.city || "Nashville, TN";
  const phone = settings?.phone || "";
  const phoneDigits = phone.replace(/\D/g, "");

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-white/10">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold text-lg tracking-wide">
              {companyName}
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-slate-300">
            <a href="#services" className="hover:text-white transition-colors">Services</a>
            <a href="#why" className="hover:text-white transition-colors">Why Us</a>
            <a href="#reviews" className="hover:text-white transition-colors">Reviews</a>
            <a href="#contact" className="hover:text-white transition-colors">Contact</a>
            <a href="/dashboard" className="hover:text-white transition-colors">Dashboard</a>
          </div>
          {phoneDigits && (
            <a
              href={`tel:${phoneDigits}`}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm px-4 py-2 rounded-full transition-colors"
            >
              Book Now
            </a>
          )}
        </div>
      </nav>

      {/* Hero */}
      <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-6 pt-16 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-amber-500/10 rounded-full blur-3xl" />
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 text-sm text-amber-300 mb-8">
            {city}
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 leading-tight">
            Private, Reliable
            <br />
            <span className="text-amber-400">Rides</span> Across
            <br />
            Middle Tennessee
          </h1>
          <p className="text-xl text-slate-300 mb-10 max-w-xl mx-auto">
            Airport transfers, corporate travel, and special events — handled
            with care by a local team you can trust.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {phoneDigits && (
              <a
                href={`tel:${phoneDigits}`}
                className="flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-lg px-8 py-4 rounded-full transition-colors"
              >
                Call To Book Now
              </a>
            )}
            <a
              href="#services"
              className="flex items-center justify-center gap-2 border border-white/30 hover:border-white/60 text-white font-semibold text-lg px-8 py-4 rounded-full transition-colors"
            >
              See Our Services
            </a>
          </div>
        </div>
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 animate-bounce">
          <span className="text-slate-500 text-sm">Scroll</span>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-white/10 bg-slate-900/50">
        <div className="max-w-6xl mx-auto px-6 py-12 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { value: "5,000+", label: "Rides Completed" },
            { value: "4.9★", label: "Average Rating" },
            { value: "24/7", label: "Availability" },
            { value: "100%", label: "On-Time Rate" },
          ].map((stat) => (
            <div key={stat.label}>
              <div className="text-3xl md:text-4xl font-bold text-amber-400 mb-1">
                {stat.value}
              </div>
              <div className="text-sm text-slate-400">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Services */}
      <section id="services" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-amber-400 text-sm font-semibold tracking-widest uppercase mb-3">
              What We Offer
            </p>
            <h2 className="text-4xl md:text-5xl font-bold">Our Services</h2>
            <p className="text-slate-400 mt-4 max-w-xl mx-auto">
              From airport pickups to all-day charters, we've got your ride covered.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                title: "Airport Transfers",
                desc: "Reliable pickup and drop-off to BNA and surrounding airports. We track your flight so we're always on time.",
              },
              {
                title: "Private Car Service",
                desc: "Point-to-point rides across Middle Tennessee. Perfect for meetings, events, or a night out.",
              },
              {
                title: "Group & Event Transport",
                desc: "Large SUVs and multi-vehicle coordination for weddings, corporate events, and group outings.",
              },
              {
                title: "Hourly Charters",
                desc: "Book by the hour for flexible schedules — errands, multi-stop tours, or all-day availability.",
              },
            ].map((s) => (
              <div
                key={s.title}
                className="bg-slate-900 border border-white/10 rounded-2xl p-8 hover:border-amber-500/40 transition-colors group"
              >
                <h3 className="text-xl font-semibold mb-2">{s.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Us */}
      <section id="why" className="py-24 px-6 bg-slate-900/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-amber-400 text-sm font-semibold tracking-widest uppercase mb-3">
              The Difference
            </p>
            <h2 className="text-4xl md:text-5xl font-bold">Why Choose {companyName}?</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                title: "Licensed & Insured",
                desc: "Fully licensed, commercially insured, and compliant with Tennessee PUC regulations.",
              },
              {
                title: "Always On Time",
                desc: "We track flights, monitor traffic, and arrive early. Punctuality isn't optional — it's guaranteed.",
              },
              {
                title: "Premium Experience",
                desc: "Clean vehicles, professional drivers, and personal service — every ride feels first-class.",
              },
            ].map((item) => (
              <div key={item.title} className="text-center px-4">
                <h3 className="text-xl font-semibold mb-3">{item.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Reviews */}
      <section id="reviews" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-amber-400 text-sm font-semibold tracking-widest uppercase mb-3">
              Testimonials
            </p>
            <h2 className="text-4xl md:text-5xl font-bold">What Our Riders Say</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                quote: "Always on time, always friendly. I won't use anyone else for my airport rides.",
                name: "Sarah M.",
              },
              {
                quote: "Booked for a wedding — three vehicles, zero stress. The team was incredible.",
                name: "James T.",
              },
              {
                quote: "Professional, clean vehicles, and great communication. Five stars every time.",
                name: "Linda K.",
              },
            ].map((r) => (
              <div
                key={r.name}
                className="bg-slate-900 border border-white/10 rounded-2xl p-8"
              >
                <p className="text-slate-300 text-sm leading-relaxed mb-6">
                  "{r.quote}"
                </p>
                <p className="text-sm font-semibold text-amber-400">— {r.name}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="contact" className="py-24 px-6">
        <div className="max-w-2xl mx-auto text-center bg-gradient-to-br from-amber-500/20 to-slate-900 border border-amber-500/30 rounded-3xl p-12">
          <h2 className="text-4xl font-bold mb-4">Ready to Ride?</h2>
          <p className="text-slate-300 mb-8">
            Book online in under a minute, or give us a call. We'll take care of the rest.
          </p>
          {phoneDigits && (
            <a
              href={`tel:${phoneDigits}`}
              className="inline-flex items-center gap-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xl px-10 py-5 rounded-full transition-colors"
            >
              Book Online
            </a>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-12 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <span className="font-bold">{companyName}</span>
          </div>
          <p className="text-slate-500 text-sm text-center">
            Premium car service in Hendersonville and the greater Nashville area.
            <br />
            Airport transfers, private rides, and group transport.
          </p>
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            {city}
          </div>
        </div>
        <div className="max-w-6xl mx-auto mt-8 pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-600">
          <span>© {new Date().getFullYear()} {companyName}. All rights reserved.</span>
          <div className="flex gap-4">
            <a href="/privacy-policy" className="hover:text-slate-400 transition-colors">Privacy Policy</a>
            <a href="/terms-and-conditions" className="hover:text-slate-400 transition-colors">Terms & Conditions</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
