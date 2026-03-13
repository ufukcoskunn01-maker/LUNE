import type { ReactNode } from "react";

import styles from "./home.module.css";
import { AppShellSidebar } from "./AppShellSidebar";

type AppScaffoldPageProps = {
  title: string;
  children?: ReactNode;
  eyebrow?: string;
  message?: string;
  description?: string;
};

export function AppScaffoldPage({
  title,
  children,
  eyebrow = "Workspace",
  message = "Page under construction. This route is scaffolded and ready for future app logic.",
  description,
}: AppScaffoldPageProps) {
  return (
    <div className={styles.appShell}>
      <AppShellSidebar />

      <div className={styles.mainArea}>
        <header className={`${styles.topChrome} ${styles.topChromeCompact}`}>
          <div className={styles.titleBar}>
            <span className={styles.pageTitle}>{title}</span>
            <div className={styles.iconRow}>
              <IconCircle className={styles.iconCircleProfile} label="Profile">
                <UserIcon />
              </IconCircle>
              <IconCircle className={styles.iconCirclePrimary} label="Add">
                <PlusIcon />
              </IconCircle>
              <IconCircle className={styles.iconCircleSecondary} label="Help">
                <HelpIcon />
              </IconCircle>
              <IconCircle className={`${styles.iconCircleSecondary} ${styles.iconCircleSettings}`} label="Settings">
                <GearIcon />
              </IconCircle>
            </div>
          </div>
        </header>

        <main className={styles.scrollArea}>
          <div className={styles.placeholderPage}>
            <section className={styles.placeholderCard}>
              <div className={styles.placeholderEyebrow}>{eyebrow}</div>
              <h1 className={styles.placeholderTitle}>{title}</h1>
              <p className={styles.placeholderBody}>{description ?? message}</p>
              <div className={styles.placeholderInset}>
                <div className={styles.placeholderInsetTitle}>Workspace status</div>
                <p className={styles.placeholderInsetBody}>{message}</p>
              </div>
              {children}
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

function IconCircle({ children, label, className = "" }: { children: ReactNode; label: string; className?: string }) {
  return (
    <button type="button" className={`${styles.iconCircle} ${className}`.trim()} aria-label={label}>
      {children}
    </button>
  );
}

function IconBase({ children }: { children: ReactNode }) {
  return <svg viewBox="0 0 256 256" aria-hidden="true">{children}</svg>;
}

function UserIcon() { return <IconBase><path d="M128 128a40 40 0 1 0-40-40 40 40 0 0 0 40 40Zm0 16c-35.35 0-64 18.61-64 41.6a8 8 0 0 0 16 0C80 172.57 101.53 160 128 160s48 12.57 48 25.6a8 8 0 0 0 16 0C192 162.61 163.35 144 128 144Z" /></IconBase>; }
function PlusIcon() { return <IconBase><path d="M128 56a8 8 0 0 1 8 8v56h56a8 8 0 0 1 0 16h-56v56a8 8 0 0 1-16 0v-56H64a8 8 0 0 1 0-16h56V64a8 8 0 0 1 8-8Z" /></IconBase>; }
function HelpIcon() { return <IconBase><path d="M140 180a12 12 0 1 1-12-12 12 12 0 0 1 12 12Zm-12-164A112 112 0 1 0 240 128 112.12 112.12 0 0 0 128 16Zm0 208a96 96 0 1 1 96-96 96.11 96.11 0 0 1-96 96Zm-8-72a8 8 0 0 1 8-8 20 20 0 1 0-20-20 8 8 0 0 1-16 0 36 36 0 1 1 44 35.12V160a8 8 0 0 1-16 0Z" /></IconBase>; }
function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 8.75a3.25 3.25 0 1 0 0 6.5 3.25 3.25 0 0 0 0-6.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19.2 13.1v-2.2l-1.7-.45a5.86 5.86 0 0 0-.5-1.2l.92-1.48-1.55-1.55-1.48.92c-.38-.2-.78-.37-1.2-.5L13.1 4.8h-2.2l-.45 1.7c-.42.13-.82.3-1.2.5l-1.48-.92-1.55 1.55.92 1.48c-.2.38-.37.78-.5 1.2l-1.7.45v2.2l1.7.45c.13.42.3.82.5 1.2l-.92 1.48 1.55 1.55 1.48-.92c.38.2.78.37 1.2.5l.45 1.7h2.2l.45-1.7c.42-.13.82-.3 1.2-.5l1.48.92 1.55-1.55-.92-1.48c.2-.38.37-.78.5-1.2l1.7-.45Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
