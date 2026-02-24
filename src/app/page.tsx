"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Plus } from "lucide-react";
import { BackgroundVideo } from "@/components/marketing/BackgroundVideo";

type TrackCard = {
  title: string;
  description: string;
  image: string;
  imageAlt: string;
  background: string;
};

type GrowthCard = {
  titleItalic: string;
  titleTail: string;
  description: string;
  image: string;
  imageAlt: string;
};

type StoryCard = {
  tag: string;
  title: string;
  date: string;
  summary: string;
  href: string;
};

type ResourceItem = {
  label?: string;
  title: string;
  date: string;
  href: string;
};

type ResourceGroup = {
  title: string;
  subtitle: string;
  items: ResourceItem[];
  ctaHref: string;
};

const TRACK_CARDS: TrackCard[] = [
  {
    title: "Monitor daily spend",
    description: "Capture every movement by package, contractor, and discipline in one feed.",
    image: "/origin/images/68bf6605b4df5f9a02f2489b_spend-this-month.png",
    imageAlt: "Spend this month graphic",
    background: "/origin/images/68ade502cb28cdafcd93510c_Frame%201171277096.jpg",
  },
  {
    title: "Build resilient budgets",
    description: "Track baseline, contingency, and committed costs against live execution.",
    image: "/origin/images/68c02b1aa2d9315689379726_budgetcard.png",
    imageAlt: "Budget card graphic",
    background: "/origin/images/68ade4d51f31e1e9f347cf81_Frame%201171277095.jpg",
  },
  {
    title: "Control upcoming transactions",
    description: "Keep cash commitments visible and resolve upcoming cost spikes before impact.",
    image: "/origin/images/68bf64b1237dc852e9cbcdc0_upcoming-card-3.png",
    imageAlt: "Upcoming transactions graphic",
    background: "/origin/images/68ade51d592c71c8975df4b7_Frame%2048100179.jpg",
  },
];

const GROWTH_CARDS: GrowthCard[] = [
  {
    titleItalic: "Monitor",
    titleTail: "portfolio performance",
    description: "View cost curves and EVM trends across all active workfronts in real time.",
    image: "/origin/images/68bf62637b5f6813a3d48c56_portfolio-performance.png",
    imageAlt: "Portfolio performance chart",
  },
  {
    titleItalic: "Visualize",
    titleTail: "allocation and risk",
    description: "See exposure by discipline, package type, and contract structure instantly.",
    image: "/origin/images/68acccfaa258c2a8cbe1b4e8_3_Card_.png",
    imageAlt: "Allocation and risk card",
  },
  {
    titleItalic: "Inspect",
    titleTail: "every package detail",
    description: "Drill into outliers and trace variance to source rows and source files.",
    image: "/origin/images/68acccfae513691732224781_5_Card_.png",
    imageAlt: "Detailed package card",
  },
  {
    titleItalic: "Forecast",
    titleTail: "what comes next",
    description: "Run scenario-based projections and detect future pressure before delivery slips.",
    image: "/origin/images/68b7555efe58911d1050d3e4_1b7239eb1b5f8e3b968aebdff411859a_6_Card_.svg",
    imageAlt: "Forecast card",
  },
];

const TESTIMONIALS = [
  {
    quote: "Origin is a one-stop shop for everything financial in your life.",
    author: "SARAH W.",
    bg: "/origin/images/68acd528c25e85a31ee91cea_aea62ac5e3b1a484ce8af496bc9356fd_Frame%201171277260.png",
  },
  {
    quote: "I was able to invite my partner in just a few clicks, and now we track spending and goals together.",
    author: "ANDREW P.",
    bg: "/origin/images/68acd528eff05fd8f147b257_Frame%201171277261.png",
  },
  {
    quote: "Spend tracking is simple and clean. It is great to see my net worth and finances in one place.",
    author: "SONIA H.",
    bg: "/origin/images/68acd528532db4e79e21bd27_666b21044c70f1d6377cef513b8b46f8_Frame%201171277262.png",
  },
  {
    quote: "All my accounts connect and stay up to date. I can collaborate with my partner seamlessly.",
    author: "ALEX C.",
    bg: "/origin/images/68acd5283e22423f13fa59a3_Frame%201171277263.png",
  },
] as const;

const DISCOVER_STORIES: StoryCard[] = [
  {
    tag: "Published 4.7.2025",
    title: "Majority of Gen Z Plan to Doom Spend Tax Refund as Recession Fears Rise",
    date: "Origin Research",
    summary: "A Harris Poll study highlights how younger groups may spend tax refunds under recession pressure.",
    href: "https://useorigin.com/resources/blog/majority-of-gen-z-plan-to-doom-spend-tax-refund-as-recession-fears-rise",
  },
  {
    tag: "Published 6.7.2023",
    title: "Origin buys Finny to Expand Financial Wellness App for Employees",
    date: "Company Update",
    summary: "Origin announced the Finny acquisition to expand education, content, and debt support tools.",
    href: "https://useorigin.com/resources/blog/origin-buys-finny-to-expand-financial-wellness-app-for-employees",
  },
  {
    tag: "Published 11.27.2024",
    title: "Estate Planning Considerations For Small (And Large) Business Owners",
    date: "Planning Guide",
    summary: "A practical checklist covering wills, trusts, buy-sell agreements, and annual estate-plan reviews.",
    href: "https://useorigin.com/resources/blog/estate-planning-considerations-for-small-and-large-business-owners",
  },
  {
    tag: "Published 7.13.2023",
    title: "How to Implement a Financial Wellness Program for Your Employees",
    date: "Employer Playbook",
    summary: "A framework to assess workforce needs, deploy financial tools, and track benefit engagement.",
    href: "https://useorigin.com/resources/blog/how-to-implement-a-financial-wellness-program-for-your-employees",
  },
];

const RESOURCE_GROUPS: ResourceGroup[] = [
  {
    title: "Articles",
    subtitle: "Deep dives into personal finance",
    items: [
      {
        title: "How We Built the First AI Financial Advisor with Full-Context Reasoning Regulated by the SEC",
        date: "11.12.2025",
        href: "https://useorigin.com/resources/blog/technical-overview",
      },
      {
        title: "AI in Personal Finance 2026: Comparing the Top Tools and Approaches",
        date: "2.13.2026",
        href: "https://useorigin.com/resources/blog/ai-in-personal-finance-2026-comparing-the-top-tools-and-approaches",
      },
      {
        title: "AI vs Human Financial Advisors: Comprehensive 2026 Comparison",
        date: "2.13.2026",
        href: "https://useorigin.com/resources/blog/ai-vs-human-financial-advisors-comprehensive-2026-comparison",
      },
      {
        title: "10 Best Investments for Beginners in 2026 (With Tools and Tips)",
        date: "2.12.2026",
        href: "https://useorigin.com/resources/blog/10-best-investments-for-beginners-in-2026-with-tools-tips",
      },
    ],
    ctaHref: "https://useorigin.com/resources/blog",
  },
  {
    title: "News",
    subtitle: "Origin in the news",
    items: [
      {
        label: "The Washington Post",
        title: "Want to retain young talent? Start offering financial advice.",
        date: "9.23.2025",
        href: "https://www.washingtonpost.com/business/2025/09/23/want-retain-young-talent-start-offering-financial-advice/",
      },
      {
        label: "Fortune",
        title: "Origin's newest update makes it easier for couples to budget",
        date: "4.30.2025",
        href: "https://fortune.com/article/origin-partner-mode-budget-couples/",
      },
      {
        label: "Fast Company",
        title: "Origin named to Fast Company's Most Innovative Companies List for 2025",
        date: "3.18.2025",
        href: "https://www.fastcompany.com/91269557/finance-personal-finance-most-innovative-companies-2025",
      },
    ],
    ctaHref: "https://useorigin.com/resources/news",
  },
  {
    title: "Case Studies",
    subtitle: "How leading organizations use Origin",
    items: [
      {
        label: "Udemy",
        title: "Udemy Invests in Their Number One Asset: Employee Well-being",
        date: "10.26.2023",
        href: "https://useorigin.com/resources/case-study/udemy",
      },
      {
        label: "Webflow",
        title: "How Webflow Uses Origin to Design a Global Benefits Strategy",
        date: "10.26.2023",
        href: "https://useorigin.com/resources/case-study/webflow",
      },
    ],
    ctaHref: "https://useorigin.com/resources/case-study",
  },
  {
    title: "Webinars",
    subtitle: "Conversations led by Origin financial planners",
    items: [
      {
        title: "Conquering Debt",
        date: "3.20.2024",
        href: "https://useorigin.com/resources/webinar/conquering-debt",
      },
      {
        title: "Tax Season Readiness",
        date: "2.21.2024",
        href: "https://useorigin.com/resources/webinar/tax-season-readiness",
      },
      {
        title: "Financially Sustainable Living",
        date: "1.24.2024",
        href: "https://useorigin.com/resources/webinar/financially-sustainable-living",
      },
    ],
    ctaHref: "https://useorigin.com/resources/webinar",
  },
  {
    title: "E-books",
    subtitle: "Reports for HR leaders",
    items: [
      {
        title: "Redefining wellness benefits: How to take a holistic approach to employee well-being",
        date: "10.26.2023",
        href: "https://useorigin.com/resources/ebook/redefining-wellness-benefits-how-to-take-a-holistic-approach-to-employee-well-being",
      },
      {
        title: "How financial wellness can help your DEI strategy",
        date: "10.26.2023",
        href: "https://useorigin.com/resources/ebook/how-financial-wellness-can-help-your-diversity-equity-and-inclusion-strategy",
      },
      {
        title: "The state of employee financial health and wealth",
        date: "10.26.2023",
        href: "https://offer.useorigin.com/state-of-financial-health-wealth-ebook-origin",
      },
    ],
    ctaHref: "https://useorigin.com/resources/ebook",
  },
];

export default function HomePage() {
  const router = useRouter();
  const [askText, setAskText] = useState("Ask about project risk, burn-rate, and forecast.");
  const [didFocusAsk, setDidFocusAsk] = useState(false);
  const manageSectionRef = useRef<HTMLDivElement | null>(null);
  const [manageBgScale, setManageBgScale] = useState(1.08);

  function submitAsk(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextQuestion = askText.trim();
    if (!nextQuestion) {
      router.push("/ai");
      return;
    }

    router.push(`/ai?question=${encodeURIComponent(nextQuestion)}`);
  }

  useEffect(() => {
    const section = manageSectionRef.current;
    if (!section) return;

    let frame = 0;
    const updateScale = () => {
      frame = 0;
      const rect = section.getBoundingClientRect();
      const viewport = window.innerHeight || 1;
      const progressRaw = (viewport - rect.top) / (viewport + rect.height);
      const progress = Math.max(0, Math.min(1, progressRaw));
      const next = 1.08 + progress * 0.36;
      setManageBgScale((prev) => (Math.abs(prev - next) > 0.002 ? next : prev));
    };

    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(updateScale);
    };

    updateScale();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <main className="min-h-screen bg-[#0f1011] text-zinc-100" style={{ fontFamily: '"SuisseIntl", Arial, sans-serif' }}>
      <header className="fixed inset-x-0 top-0 z-40 px-6 pt-6">
        <div className="relative mx-auto flex w-full items-center justify-between rounded-xl bg-white/[0.06] p-1 backdrop-blur-2xl">
          <div className="flex items-center pl-4">
            <Link href="/" className="inline-flex">
              <Image
                src="/brand/lune-logo-mark-white.svg"
                alt="LUNE logo"
                width={44}
                height={25}
              />
            </Link>
          </div>

          <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-2 md:flex">
            <button className="inline-flex items-center gap-1 rounded-lg bg-white/[0.08] px-4 py-2 font-mono text-[12px] uppercase tracking-[0.02em] text-white transition hover:bg-white/[0.16]">
              Products <Plus className="h-3.5 w-3.5" />
            </button>
            <Link
              href="/dashboard"
              className="rounded-lg bg-white/[0.08] px-4 py-2 font-mono text-[12px] uppercase tracking-[0.02em] text-white transition hover:bg-white/[0.16]"
            >
              For Employers
            </Link>
            <Link
              href="/reports"
              className="rounded-lg bg-white/[0.08] px-4 py-2 font-mono text-[12px] uppercase tracking-[0.02em] text-white transition hover:bg-white/[0.16]"
            >
              Resources
            </Link>
          </nav>

          <div className="flex items-center gap-2 pr-2">
            <Link
              href="/dashboard"
              className="hidden px-3 font-mono text-[12px] uppercase tracking-[0.02em] text-zinc-100/95 transition hover:text-white md:inline-flex"
            >
              Log In
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-lg bg-white px-8 py-3 font-mono text-[12px] font-semibold uppercase tracking-[0.02em] text-black transition hover:bg-zinc-200"
            >
              Get Started <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      <BackgroundVideo
        mp4Src="/origin/media/68acbc076b672f730e0c77b9/68bb73e8d95f81619ab0f106_Clouds1-transcode.mp4"
        webmSrc="/origin/media/68acbc076b672f730e0c77b9/68bb73e8d95f81619ab0f106_Clouds1-transcode.webm"
        toneOverlayClassName="bg-transparent"
        fadeOverlayClassName="bg-[linear-gradient(180deg,rgba(15,16,17,0)_0%,rgba(15,16,17,0.45)_72%,rgba(15,16,17,0.88)_100%)]"
        className="relative overflow-hidden border-b border-white/10"
      >
        <section className="mx-auto flex min-h-screen w-full max-w-[1200px] flex-col items-center justify-center px-4 pb-[50px] pt-[180px] text-center">
          <div className="rounded-xl border border-[#d6ebff]/45 bg-[#d9f0ff]/95 px-4 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-[#1f6e96]">
            $1 for 1 year - limited time
          </div>

          <h1
            className="mb-6 mt-6 text-[clamp(64px,8vw,96px)] font-light leading-[0.9] text-white"
            style={{ fontFamily: '"LyonDisplay App", Georgia, "Times New Roman", serif' }}
          >
            <span className="italic">Own</span> your project.
          </h1>

          <div className="mb-6 max-w-[420px]">
            <p className="text-[16px] font-semibold leading-[1.35] text-white">Origin is your personal AI Project Advisor.</p>
            <p className="text-[16px] font-light leading-[1.35] text-white/82">
              Track spending, progress, resources, risk, and optimize your project future, all in one place.
            </p>
          </div>

          <div className="mb-0 mt-0">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-lg bg-white px-8 py-3 font-mono text-[12px] font-semibold uppercase tracking-[0.02em] text-black transition hover:bg-zinc-200"
            >
              Get Started <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <form
            onSubmit={submitAsk}
            className="mt-10 flex w-full max-w-[590px] items-center rounded-[100vw] border border-white/20 bg-white/[0.12] p-[10px] pl-8 backdrop-blur-2xl shadow-[0_18px_20px_rgba(0,0,0,0.2)]"
          >
            <input
              value={askText}
              onFocus={() => {
                if (!didFocusAsk) {
                  setAskText("");
                  setDidFocusAsk(true);
                }
              }}
              onChange={(event) => setAskText(event.target.value)}
              placeholder="Where are my top project overruns?"
              className="h-[60px] flex-1 bg-transparent text-left font-sans text-[16px] font-light text-white outline-none placeholder:text-white/85"
              aria-label="Ask AI Assistant"
            />
            <button
              type="submit"
              className="inline-flex h-[60px] w-[60px] items-center justify-center rounded-full bg-white/[0.24] transition hover:bg-white/[0.34]"
              aria-label="Send question to AI Assistant"
            >
              <Image
                src="/origin/images/68acc0dd9b190be3a4886ccb_up-arrow.svg"
                alt=""
                width={20}
                height={20}
              />
            </button>
          </form>

          <p className="mt-9 text-[16px] font-light text-white/70">Track everything. Ask anything.</p>

          <Image
            src="/origin/images/68acd7a5e5cde3d99e192e5e_54389a561455c6d1a4fd45db9a022b82_certificate-img.svg"
            alt="Forbes and Fast Company mentions"
            width={430}
            height={64}
            className="mt-4 h-auto w-[320px] md:w-[430px]"
          />
        </section>
      </BackgroundVideo>

      <section className="w-full px-4 py-20 md:px-6">
        <div className="mx-auto w-full max-w-[1240px]">
          <div className="mx-auto max-w-3xl text-center">
            <h2
              className="text-[clamp(2.8rem,7.6vw,6.3rem)] font-normal leading-[1] tracking-[-0.02em] text-zinc-100"
              style={{ fontFamily: '"Iowan Old Style", "Times New Roman", serif' }}
            >
              <span className="italic">Simplify</span> your project
            </h2>
          </div>

          <div className="mt-10">
            <Image
              src="/origin/images/68bb319d2327f0531c6d5b7f_phone1.png"
              alt="Phone app preview"
              width={1920}
              height={1080}
              className="h-auto w-full"
            />
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1240px] border-t border-white/10 px-4 py-20 md:px-6">
        <div className="max-w-3xl">
          <h2 className="text-4xl md:text-5xl">
            <span className="font-serif italic font-light">Track</span> everything
          </h2>
          <p className="mt-3 max-w-2xl text-zinc-300">
            Connect all project finance and execution channels so every control report comes from one trusted dataset.
          </p>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-3">
          {TRACK_CARDS.map((card) => (
            <article key={card.title} className="group relative overflow-hidden rounded-3xl border border-white/15 bg-[#0b0e14]">
              <Image
                src={card.background}
                alt="Card background"
                fill
                className="object-cover opacity-70 transition duration-500 group-hover:scale-[1.03]"
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.35)_0%,rgba(0,0,0,0.8)_74%)]" />

              <div className="relative p-5">
                <div className="overflow-hidden rounded-2xl border border-white/15 bg-black/30 p-2">
                  <Image src={card.image} alt={card.imageAlt} width={716} height={510} className="h-auto w-full" />
                </div>
                <h3 className="mt-4 text-xl font-medium">{card.title}</h3>
                <p className="mt-2 text-sm text-zinc-300">{card.description}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="relative overflow-hidden border-y border-white/10 py-20">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(74,91,255,0.28),transparent_52%),radial-gradient(circle_at_75%_100%,rgba(4,190,174,0.2),transparent_48%)]" />
        <div className="relative mx-auto w-full max-w-[1240px] px-4 md:px-6">
          <div className="mx-auto max-w-3xl text-center">
            <Image
              src="/origin/images/68addfe5b5ebdbf6f5d59eaa_Union.svg"
              alt="Spark icon"
              width={30}
              height={30}
              className="mx-auto"
            />
            <h2 className="mt-4 text-4xl md:text-5xl">
              <span className="font-serif italic font-light">Ask</span> anything
            </h2>
            <p className="mt-3 text-zinc-300">
              Ask questions in plain language and get instant answers tied to project data, trends, and forecast logic.
            </p>
          </div>

          <div className="mx-auto mt-8 max-w-5xl overflow-hidden rounded-[28px] border border-white/15 bg-black/40">
            <Image
              src="/origin/images/68bf0eadb29fee35c002ae8c_forecast-home.png"
              alt="Ask anything preview"
              width={2276}
              height={1450}
              className="h-auto w-full"
            />
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1240px] px-4 py-20 md:px-6">
        <div className="max-w-3xl">
          <h2 className="text-4xl md:text-5xl">
            <span className="font-serif italic font-light">Grow</span> delivery confidence
          </h2>
          <p className="mt-3 text-zinc-300">
            Build executive-level visibility with faster insights and fewer manual steps.
          </p>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          {GROWTH_CARDS.map((card) => (
            <article key={card.titleTail} className="rounded-3xl border border-white/15 bg-[#0a0b0f] p-5">
              <h3 className="text-2xl font-medium">
                <span className="font-serif italic font-light">{card.titleItalic}</span> {card.titleTail}
              </h3>
              <p className="mt-2 text-sm text-zinc-300">{card.description}</p>
              <div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-black/30 p-2">
                <Image src={card.image} alt={card.imageAlt} width={1074} height={568} className="h-auto w-full" />
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="w-full border-t border-white/10 py-20">
        <div className="mx-auto w-full max-w-[1240px] px-4 md:px-6">
          <div className="mx-auto max-w-4xl text-center">
            <h2 className="text-4xl md:text-5xl">
              <span className="font-serif italic font-light">Manage</span> projects together
            </h2>
            <p className="mt-3 text-zinc-300">
              Create a shared intelligent home for project controls and decision making.
            </p>
          </div>
        </div>

        <div
          ref={manageSectionRef}
          className="relative mt-12 flex min-h-[760px] w-full items-center justify-center overflow-visible md:min-h-[860px]"
        >
          <Image
            src="/origin/images/68acd2db507fa7c358f3bf43_Group%2048100208-p-1600.avif"
            alt="Manage together globe"
            fill
            className="object-contain object-center opacity-95 will-change-transform transition-transform duration-200"
            style={{ transform: `scale(${manageBgScale})` }}
          />
          <div className="relative z-10 max-w-[420px] px-4 text-center">
            <h3
              className="text-[42px] leading-[0.94] text-white"
              style={{ fontFamily: '"LyonDisplay App", Georgia, "Times New Roman", serif' }}
            >
              <span className="italic">Manage</span> money together
            </h3>
            <p className="mt-3 text-sm text-zinc-200">
              Add collaborators, align cashflow visibility, and keep one source of truth for every package.
            </p>
            <Image
              src="/origin/images/68acd078571a5d311d25fee7_manage.svg"
              alt="Manage icon"
              width={220}
              height={220}
              className="mx-auto mt-6 h-auto w-[180px]"
            />
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1240px] px-4 py-20 md:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h2
            className="text-[clamp(44px,6.5vw,72px)] leading-[0.94] text-white"
            style={{ fontFamily: '"LyonDisplay App", Georgia, "Times New Roman", serif' }}
          >
            <span className="italic">Read</span> what people say
          </h2>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {TESTIMONIALS.map((item) => (
            <article key={item.author} className="relative min-h-[360px] overflow-hidden rounded-[24px] border border-white/10">
              <Image src={item.bg} alt="Testimonial background" fill className="object-cover" />
              <div className="absolute inset-0 bg-black/35" />
              <div className="relative flex h-full flex-col justify-between p-6 text-center">
                <Image
                  src="/origin/images/68acd3d1459c4533e7d4649a_stars.svg"
                  alt="Stars"
                  width={90}
                  height={14}
                  className="mx-auto"
                />
                <p className="text-[18px] font-light leading-[1.45] text-white">{item.quote}</p>
                <p className="font-mono text-[11px] tracking-[0.18em] text-white/90">{item.author}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1240px] px-4 pb-20 md:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h3
            className="text-[clamp(38px,5.5vw,64px)] leading-[0.94] text-white"
            style={{ fontFamily: '"LyonDisplay App", Georgia, "Times New Roman", serif' }}
          >
            <span className="italic">Discover</span> what&apos;s new
          </h3>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {DISCOVER_STORIES.map((story) => (
            <article key={story.href} className="rounded-2xl border border-white/10 bg-[linear-gradient(135deg,#2b2b2c,#131313)] p-6">
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-white/50">{story.tag}</p>
              <p className="mt-3 text-[22px] leading-[1.22] text-white">{story.title}</p>
              <p className="mt-3 text-sm text-zinc-300">{story.summary}</p>
              <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-400">{story.date}</p>
              <Link
                href={story.href}
                target="_blank"
                rel="noreferrer"
                className="mt-6 inline-flex rounded-lg border border-white/15 bg-white/[0.08] px-4 py-2 font-mono text-[12px] uppercase"
              >
                Read more
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1240px] border-t border-white/10 px-4 pb-20 pt-16 md:px-6">
        <div className="mx-auto max-w-4xl text-center">
          <h3
            className="text-[clamp(40px,6vw,72px)] leading-[0.94] text-white"
            style={{ fontFamily: '"LyonDisplay App", Georgia, "Times New Roman", serif' }}
          >
            <span className="italic">Resources</span> for your team
          </h3>
          <p className="mx-auto mt-3 max-w-3xl text-zinc-300">
            Sync all your finances and controls. Connect all accounts and report streams in one place that stays easy to scan.
          </p>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-white/20 bg-white/[0.08] px-3 py-1 font-mono text-[11px] uppercase tracking-[0.12em] text-white">
            All Types
          </span>
          <span className="rounded-full border border-white/15 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.12em] text-zinc-300">Articles</span>
          <span className="rounded-full border border-white/15 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.12em] text-zinc-300">News</span>
          <span className="rounded-full border border-white/15 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.12em] text-zinc-300">Case Studies</span>
          <span className="rounded-full border border-white/15 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.12em] text-zinc-300">Webinars</span>
          <span className="rounded-full border border-white/15 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.12em] text-zinc-300">E-books</span>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-white/20 bg-white/[0.08] px-3 py-1 font-mono text-[11px] uppercase tracking-[0.12em] text-white">
            Topics
          </span>
          <span className="rounded-full border border-white/15 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.12em] text-zinc-300">Estate Planning</span>
          <span className="rounded-full border border-white/15 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.12em] text-zinc-300">Personal Finance</span>
          <span className="rounded-full border border-white/15 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.12em] text-zinc-300">Tax Strategy</span>
          <span className="rounded-full border border-white/15 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.12em] text-zinc-300">Product Updates</span>
          <span className="rounded-full border border-white/15 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.12em] text-zinc-300">Employee Benefits</span>
        </div>

        <article className="mt-8 overflow-hidden rounded-3xl border border-white/10 bg-[#101217]">
          <div className="grid gap-0 md:grid-cols-[1.1fr_0.9fr]">
            <div className="relative min-h-[300px]">
              <Image
                src="/origin/images/68bf62637b5f6813a3d48c56_portfolio-performance.png"
                alt="Featured article visual"
                fill
                className="object-cover"
              />
              <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(4,8,18,0.62)_0%,rgba(4,8,18,0.15)_60%,rgba(4,8,18,0.75)_100%)]" />
              <div className="relative z-10 p-6">
                <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-white/70">Featured article</p>
                <h4 className="mt-3 max-w-xl text-[28px] leading-[1.2] text-white md:text-[34px]">
                  How We Built the First AI Financial Advisor with Full-Context Reasoning Regulated by the SEC
                </h4>
                <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-200">11.12.2025</p>
                <Link
                  href="https://useorigin.com/resources/blog/technical-overview"
                  target="_blank"
                  rel="noreferrer"
                  className="mt-5 inline-flex rounded-lg border border-white/20 bg-black/35 px-4 py-2 font-mono text-[12px] uppercase text-white"
                >
                  Read article
                </Link>
              </div>
            </div>
            <div className="p-6">
              <h5 className="text-lg text-white">Latest in resources</h5>
              <div className="mt-4 space-y-3">
                {RESOURCE_GROUPS[0].items.slice(1).map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-xl border border-white/10 bg-white/[0.03] p-3 transition hover:bg-white/[0.08]"
                  >
                    <p className="text-sm leading-[1.35] text-zinc-100">{item.title}</p>
                    <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-400">{item.date}</p>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </article>

        <div className="mt-8 grid gap-4 xl:grid-cols-5 md:grid-cols-2">
          {RESOURCE_GROUPS.map((group) => (
            <article key={group.title} className="rounded-2xl border border-white/10 bg-[#0d1016] p-5">
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-400">{group.title}</p>
              <h4 className="mt-3 text-lg text-white">{group.subtitle}</h4>
              <div className="mt-4 space-y-3">
                {group.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-xl border border-white/10 bg-white/[0.03] p-3 transition hover:bg-white/[0.08]"
                  >
                    {item.label ? (
                      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400">{item.label}</p>
                    ) : null}
                    <p className="mt-1 text-sm leading-[1.35] text-zinc-100">{item.title}</p>
                    <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400">{item.date}</p>
                  </Link>
                ))}
              </div>
              <Link
                href={group.ctaHref}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex rounded-lg border border-white/15 bg-white/[0.08] px-3 py-2 font-mono text-[11px] uppercase tracking-[0.1em] text-zinc-100"
              >
                See more
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="relative overflow-hidden border-t border-white/10 py-20">
        <Image
          src="/origin/images/68acd82646629c5e94323829_Group%2048100209.avif"
          alt="Footer hero background"
          fill
          className="object-cover opacity-70"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,7,8,0.65)_0%,rgba(5,6,8,0.92)_100%)]" />

        <div className="relative mx-auto grid w-full max-w-[1240px] items-center gap-8 px-4 md:grid-cols-[1.08fr_0.92fr] md:px-6">
          <div>
            <div className="inline-block rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.14em] text-zinc-200">
              Ready to deploy
            </div>
            <h2 className="mt-4 text-4xl md:text-6xl">
              <span className="font-serif italic font-light">Launch</span> your command layer
            </h2>
            <p className="mt-3 max-w-xl text-zinc-200">
              Move from manual controls to automated project intelligence with one coherent operating surface.
            </p>
            <Link
              href="/dashboard"
              className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white px-5 py-2.5 text-sm font-medium text-black transition hover:bg-zinc-200"
            >
              Open Dashboard <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="relative mx-auto w-full max-w-[460px]">
            <Image
              src="/origin/images/68acd7c24626801554c0de6c_Device%2013PM.avif"
              alt="Mobile app visual"
              width={432}
              height={611}
              className="mx-auto h-auto w-[78%]"
            />
          </div>
        </div>
      </section>
    </main>
  );
}
