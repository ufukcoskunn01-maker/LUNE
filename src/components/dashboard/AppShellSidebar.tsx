"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { appShellNavSections } from "./app-shell-nav";
import styles from "./home.module.css";

export function AppShellSidebar() {
  const pathname = usePathname();

  return (
    <aside className={styles.sidebar}>
      <div className={styles.logoBlock}>
        <Image src="/brand/lune-logo-mark-white.svg" alt="" width={36} height={36} className={styles.logoMark} priority />
        <span className={styles.logoWord}>Lune</span>
      </div>

      <nav className={styles.nav} aria-label="Primary">
        {appShellNavSections.map((section) => (
          <section key={section.title} className={styles.navSection}>
            <div className={styles.navTitle}>{section.title}</div>
            <ul className={styles.navList}>
              {section.items.map((item) => {
                const active = pathname === item.href;

                return (
                  <li key={item.href}>
                    <Link href={item.href} className={`${styles.navItem} ${active ? styles.navItemActive : ""}`.trim()}>
                      <span className={styles.navIcon}>{item.icon}</span>
                      <span className={styles.navItemLabel}>{item.sidebarLabel}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </nav>

      <Link href="/ai" className={styles.askButton}>
        <SparkIcon />
        <span>Ask anything</span>
      </Link>
    </aside>
  );
}

function SparkIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 3.8 14.15 9.85 20.2 12l-6.05 2.15L12 20.2l-2.15-6.05L3.8 12l6.05-2.15Z"
        fill="currentColor"
      />
    </svg>
  );
}
