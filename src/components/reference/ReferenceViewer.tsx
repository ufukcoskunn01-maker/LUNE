import type { Metadata } from "next";

import styles from "./reference-viewer.module.css";

type ReferenceViewerProps = {
  title: string;
  mode: "html" | "image";
  src: string;
};

export function referenceMetadata(title: string): Metadata {
  return {
    title: `${title} | Reference`,
  };
}

export function ReferenceViewer({ title, mode, src }: ReferenceViewerProps) {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>{title}</h1>
      </header>
      <div className={styles.surface}>
        {mode === "html" ? (
          <iframe src={src} title={title} className={styles.frame} />
        ) : (
          <img src={src} alt={title} className={styles.image} />
        )}
      </div>
    </main>
  );
}
