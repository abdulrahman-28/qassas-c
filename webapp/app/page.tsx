"use client";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import {
  Upload,
  Brain,
  CheckCircle2,
  Zap,
  Shield,
  TrendingUp,
  ArrowRight,
  Eye,
  Cpu,
  Car,
  Wrench,
  Check,
  Mail,
  Phone,
  ExternalLink,
} from "lucide-react";

const useInView = (threshold = 0.15) => {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setInView(true);
          obs.disconnect();
        }
      },
      { threshold },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return [ref, inView] as const;
};

const FadeIn = ({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) => {
  const [ref, inView] = useInView();
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${className}`}
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? "translateY(0)" : "translateY(32px)",
        transitionDelay: `${delay}s`,
      }}
    >
      {children}
    </div>
  );
};

const CountUp = ({
  end,
  suffix = "",
  duration = 2000,
}: {
  end: number;
  suffix?: string;
  duration?: number;
}) => {
  const [val, setVal] = useState(0);
  const [ref, inView] = useInView();
  useEffect(() => {
    if (!inView) return;
    const start = Date.now();
    const num = end;
    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setVal(eased * num);
      if (progress < 1) requestAnimationFrame(tick);
    };
    tick();
  }, [inView]);
  return (
    <span ref={ref}>
      {end >= 1000
        ? `${(val / 1000000).toFixed(val > 900000 ? 0 : 1)}M`
        : val.toFixed(end % 1 !== 0 ? 1 : 0)}
      {suffix}
    </span>
  );
};

const features = [
  {
    icon: Zap,
    title: "High Recall Detection",
    desc: "97% recall rate ensures almost no defective product slips through undetected.",
    color: "text-yellow-500",
    bg: "bg-yellow-50",
  },
  {
    icon: Shield,
    title: "Diffusion-Based Reconstruction",
    desc: "Uses a fine-tuned Stable Diffusion model to reconstruct normal images and flag deviations.",
    color: "text-blue-500",
    bg: "bg-blue-50",
  },
  {
    icon: TrendingUp,
    title: "Trained on Normal Data Only",
    desc: "No defect samples needed for training — the model learns what normal looks like.",
    color: "text-green-500",
    bg: "bg-green-50",
  },
];

const steps = [
  {
    num: "01",
    icon: Upload,
    title: "Upload Images",
    desc: "Send images from your production line through the web interface.",
  },
  {
    num: "02",
    icon: Brain,
    title: "AI Analysis",
    desc: "The diffusion model reconstructs the image and computes anomaly scores across multiple metrics.",
  },
  {
    num: "03",
    icon: CheckCircle2,
    title: "Get Results",
    desc: "Receive a pass/fail verdict, anomaly score, and a visual heatmap highlighting defect regions.",
  },
];

const industries = [
  {
    icon: Cpu,
    title: "Pharmaceuticals",
    items: [
      "Pill surface defect detection",
      "Capsule integrity inspection",
      "Bottle label verification",
    ],
  },
  {
    icon: Car,
    title: "Automotive",
    items: [
      "Paint defect detection",
      "Weld quality inspection",
      "Assembly verification",
    ],
  },
  {
    icon: Wrench,
    title: "Industrial Hardware",
    items: [
      "Welding quality inspection",
      "Tool breakage detection",
      "Contamination detection",
    ],
  },
];

export default function QassasLanding() {
  return (
    <div className="bg-zinc-50 text-slate-800 overflow-x-hidden">
      <style>{`@keyframes scan{0%,100%{top:24px;opacity:.3}50%{top:calc(100% - 24px);opacity:1}}`}</style>

      {/* Landing nav — only shown here since global Navbar hides itself on "/" */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200/60">
        <div className="max-w-7xl mx-auto px-6 md:px-16 h-14 flex items-center justify-between">
          <span className="text-base font-bold text-slate-900 tracking-tight">Qassas</span>
          <Link
            href="/dashboard"
            className="px-4 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to App
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative min-h-[calc(100vh-56px)] flex items-center bg-gradient-to-br from-blue-950 via-blue-800 to-blue-600 overflow-hidden">
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="absolute -bottom-12 left-1/4 w-80 h-80 rounded-full bg-emerald-500/10 blur-3xl" />

        <div className="relative z-10 max-w-2xl px-8 md:px-16 py-28">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/10 text-white/80 text-xs font-medium tracking-wide backdrop-blur-sm mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            AI-powered quality control
          </div>

          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white leading-tight tracking-tight">
            AI-Powered Anomaly{" "}
            <span className="text-blue-300 italic">Detection</span> for
            Manufacturing
          </h1>

          <p className="mt-6 text-base md:text-lg text-white/50 font-light max-w-lg leading-relaxed">
            Revolutionize your quality control with Qassas's cutting-edge
            diffusion model — detecting irregularities, defects, and anomalies
            with unparalleled accuracy.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 mt-10">
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-white text-blue-900 font-semibold text-sm hover:bg-blue-50 hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200"
            >
              Get Started <ArrowRight size={16} />
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-transparent text-white/80 font-medium text-sm border border-white/15 hover:bg-white/5 hover:border-white/30 transition-all duration-200"
            >
              How it works <ExternalLink size={14} />
            </a>
          </div>
        </div>

        {/* Scan visual */}
        <div className="absolute right-0 top-0 bottom-0 w-5/12 hidden lg:flex items-center justify-center pointer-events-none">
          <div className="w-72 h-72 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-md relative">
            <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-blue-400/50 rounded-tl" />
            <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-blue-400/50 rounded-tr" />
            <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-blue-400/50 rounded-bl" />
            <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-blue-400/50 rounded-br" />
            <div
              className="absolute left-4 right-4 h-0.5 rounded-full shadow-lg shadow-blue-500/40"
              style={{
                background:
                  "linear-gradient(90deg, transparent, #3b82f6, #10b981, transparent)",
                animation: "scan 3s ease-in-out infinite",
              }}
            />
            <div className="absolute inset-8 grid grid-cols-2 grid-rows-2 gap-3">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`rounded-lg border flex items-center justify-center ${
                    i === 2
                      ? "bg-white/5 border-white/10"
                      : "bg-white/[0.02] border-white/5"
                  }`}
                >
                  {i === 2 && (
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                  )}
                </div>
              ))}
            </div>
            <div className="absolute -bottom-11 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-semibold tracking-wider whitespace-nowrap">
              <Eye size={12} />
              ANOMALY DETECTED
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <div className="px-6 md:px-16 max-w-4xl mx-auto -mt-12 relative z-10">
        <FadeIn>
          <div className="flex flex-col md:flex-row rounded-2xl overflow-hidden shadow-sm bg-white">
            {[
              { value: <CountUp end={97} suffix="%" />, label: "Recall Rate" },
              { value: <CountUp end={88} suffix="%" />, label: "F1 Score" },
              { value: <CountUp end={78.3} suffix="%" />, label: "Accuracy" },
            ].map((s, i) => (
              <div key={i} className="flex-1 text-center py-10 px-8">
                <div className="text-4xl font-bold text-slate-900 tracking-tight">
                  {s.value}
                </div>
                <div className="text-xs text-slate-400 mt-1 font-medium tracking-wide">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </FadeIn>
      </div>

      {/* Features */}
      <div className="max-w-5xl mx-auto px-6 md:px-16 py-24">
        <FadeIn>
          <p className="text-xs font-semibold tracking-widest uppercase text-blue-600 mb-3">
            Features
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">
            Why choose Qassas?
          </h2>
          <p className="text-base text-slate-500 mt-4 max-w-md font-light leading-relaxed">
            Advanced AI delivering exceptional performance for industrial
            quality control.
          </p>
        </FadeIn>

        <div className="mt-14 space-y-0 divide-y divide-slate-100">
          {features.map((f, i) => (
            <FadeIn key={i} delay={i * 0.1}>
              <div className="flex flex-col md:flex-row md:items-center gap-5 md:gap-10 py-8 group">
                <div
                  className={`w-12 h-12 rounded-xl ${f.bg} ${f.color} flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300`}
                >
                  <f.icon size={22} />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-slate-900 mb-1">
                    {f.title}
                  </h3>
                  <p className="text-sm text-slate-500 leading-relaxed font-light max-w-lg">
                    {f.desc}
                  </p>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>

      {/* How It Works */}
      <div id="how-it-works" className="bg-white">
        <div className="max-w-5xl mx-auto px-6 md:px-16 py-24">
          <FadeIn>
            <p className="text-xs font-semibold tracking-widest uppercase text-blue-600 mb-3">
              Process
            </p>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">
              How it works
            </h2>
            <p className="text-base text-slate-500 mt-4 max-w-md font-light leading-relaxed">
              Simple integration, powerful results — up and running in minutes.
            </p>
          </FadeIn>

          <div className="mt-14 relative">
            <div className="absolute left-6 top-4 bottom-4 w-px bg-slate-100 hidden md:block" />
            <div className="space-y-12">
              {steps.map((s, i) => (
                <FadeIn key={i} delay={i * 0.12}>
                  <div className="flex items-start gap-6 md:gap-10 group">
                    <div className="relative z-10 w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 font-bold text-sm group-hover:bg-blue-600 group-hover:text-white transition-colors duration-300">
                      {s.num}
                    </div>
                    <div className="pt-1">
                      <div className="flex items-center gap-3 mb-2">
                        <s.icon size={16} className="text-slate-400" />
                        <h3 className="text-base font-semibold text-slate-900">
                          {s.title}
                        </h3>
                      </div>
                      <p className="text-sm text-slate-500 leading-relaxed font-light max-w-md">
                        {s.desc}
                      </p>
                    </div>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Industries */}
      <div className="max-w-5xl mx-auto px-6 md:px-16 py-24">
        <FadeIn>
          <p className="text-xs font-semibold tracking-widest uppercase text-blue-600 mb-3">
            Industries
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">
            Proven across industries
          </h2>
          <p className="text-base text-slate-500 mt-4 max-w-md font-light leading-relaxed">
            Trusted by leading manufacturers worldwide for quality control.
          </p>
        </FadeIn>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mt-14">
          {industries.map((ind, i) => (
            <FadeIn key={i} delay={i * 0.1}>
              <div>
                <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
                  <ind.icon size={18} />
                </div>
                <h3 className="text-base font-semibold text-slate-900 mb-4">
                  {ind.title}
                </h3>
                <div className="space-y-3">
                  {ind.items.map((item, j) => (
                    <div
                      key={j}
                      className="flex items-center gap-2.5 text-sm text-slate-500 font-light"
                    >
                      <Check size={14} className="text-emerald-500 shrink-0" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="px-6 md:px-16 mb-24">
        <FadeIn>
          <div className="max-w-5xl mx-auto bg-gradient-to-br from-blue-950 to-blue-800 rounded-3xl px-8 md:px-16 py-20 text-center relative overflow-hidden">
            <div className="absolute -top-48 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-blue-500/15 blur-3xl" />
            <h2 className="text-3xl md:text-4xl font-bold text-white relative z-10 tracking-tight">
              Ready to transform your
              <br />
              quality control?
            </h2>
            <p className="text-base text-white/50 mt-4 font-light relative z-10">
              AI-powered anomaly detection built for pharmaceutical manufacturing.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center mt-10 relative z-10">
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-white text-blue-950 font-semibold text-sm hover:bg-blue-50 hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200"
              >
                Get Started <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </FadeIn>
      </div>

      {/* Footer */}
      <footer className="bg-slate-950 px-8 md:px-16 py-16 text-white/50">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between gap-12">
          <div className="max-w-xs">
            <h3 className="text-2xl font-bold text-white mb-3">Qassas</h3>
            <p className="text-sm leading-relaxed font-light">
              AI-powered visual inspection and anomaly detection for
              pharmaceutical manufacturing quality control.
            </p>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white/80 tracking-wide mb-4">
              Contact
            </h4>
            <a
              href="mailto:support@qassas.ai"
              className="flex items-center gap-2 text-sm py-1 hover:text-white/80 transition-colors font-light"
            >
              <Mail size={13} /> support@qassas.ai
            </a>
            <a
              href="tel:054323452"
              className="flex items-center gap-2 text-sm py-1 hover:text-white/80 transition-colors font-light"
            >
              <Phone size={13} /> 054 323 452
            </a>
          </div>
        </div>
        <div className="max-w-6xl mx-auto mt-10 pt-6 border-t border-white/5 text-center text-xs font-light">
          © 2026 Qassas. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
