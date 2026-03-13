import Image from "next/image";
import localFont from "next/font/local";
import styles from "./origin-login-screen.module.css";

const lyonDisplayApp = localFont({
  src: "../../../public/login/assets/fonts/LyonDisplay-Regular-Trial.otf",
  variable: "--font-lyon-display-app",
  display: "swap",
});

const suisseIntl = localFont({
  src: [
    {
      path: "../../../public/login/assets/fonts/SuisseIntl-Book.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../../public/login/assets/fonts/SuisseIntl-Medium.ttf",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../../public/login/assets/fonts/SuisseIntl-Bold.ttf",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-suisse-intl",
  display: "swap",
});

function AppleLogo() {
  return (
    <svg aria-hidden="true" viewBox="0 0 15 18" className={styles.socialIcon}>
      <path
        d="M12.53 9.56c.03 2.72 2.45 3.63 2.47 3.64-.02.06-.39 1.29-1.28 2.56-.77 1.1-1.56 2.19-2.81 2.21-1.23.02-1.63-.73-3.04-.73-1.41 0-1.85.71-3.03.76-1.21.05-2.14-1.18-2.92-2.27C.36 13.49-.85 9.41.77 6.65 1.58 5.28 3.02 4.42 4.58 4.4c1.19-.02 2.31.78 3.04.78s2.09-.97 3.53-.83c.6.02 2.29.24 3.37 1.79-.09.05-2.01 1.15-1.99 3.42ZM10.21 2.87c.64-.76 1.08-1.82.96-2.87-.93.04-2.05.6-2.72 1.36-.6.67-1.12 1.75-.98 2.78 1.03.08 2.08-.51 2.74-1.27Z"
        fill="currentColor"
      />
    </svg>
  );
}

function GoogleLogo() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className={styles.socialIcon}>
      <path
        d="M15.81 8.15c0-.66-.05-1.13-.17-1.63H8.16v2.96h4.39c-.09.74-.57 1.84-1.64 2.59l2.53 1.95c1.51-1.39 2.37-3.44 2.37-5.87Z"
        fill="#4285F4"
      />
      <path
        d="M8.16 15.94c2.15 0 3.96-.71 5.28-1.93l-2.52-1.95c-.67.47-1.58.8-2.76.8-2.1 0-3.89-1.39-4.53-3.31L1.03 11.55c1.32 2.6 4.01 4.39 7.13 4.39Z"
        fill="#34A853"
      />
      <path
        d="M3.62 9.55a4.89 4.89 0 0 1-.26-1.58c0-.56.1-1.08.25-1.58L1.03 4.39A7.9 7.9 0 0 0 .18 7.97c0 1.28.31 2.49.85 3.58l2.59-2Z"
        fill="#FBBC05"
      />
      <path
        d="M8.16 3.08c1.5 0 2.51.65 3.08 1.19l2.25-2.2C12.11.79 10.31 0 8.16 0 5.04 0 2.34 1.79 1.03 4.39l2.58 2.01c.64-1.93 2.43-3.32 4.55-3.32Z"
        fill="#EB4335"
      />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 256 256" className={styles.eyeIcon}>
      <path
        d="M247.31 124.76c-.35-.79-8.82-19.58-27.65-38.41C194.57 61.26 162.88 48 128 48S61.43 61.26 36.34 86.35C17.51 105.18 9 124 8.69 124.76a8 8 0 0 0 0 6.49c.35.8 8.82 19.58 27.65 38.41C61.43 194.74 93.12 208 128 208s66.57-13.26 91.66-38.34c18.83-18.83 27.3-37.61 27.65-38.4a8 8 0 0 0 0-6.5ZM128 192c-30.78 0-57.67-11.19-79.93-33.25A133.27 133.27 0 0 1 24.95 128a133.33 133.33 0 0 1 23.12-30.75C70.33 75.19 97.22 64 128 64s57.67 11.19 79.93 33.25A133.33 133.33 0 0 1 231.05 128C223.84 141.46 192.43 192 128 192Zm0-112a48 48 0 1 0 48 48 48.05 48.05 0 0 0-48-48Zm0 80a32 32 0 1 1 32-32 32.04 32.04 0 0 1-32 32Z"
        fill="currentColor"
      />
    </svg>
  );
}

function HeroStarIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 256 256" className={styles.heroStarIcon}>
      <path
        d="M234.29,114.85l-45,38.83L203,211.75a16.4,16.4,0,0,1-24.5,17.82L128,198.49,77.47,229.57A16.4,16.4,0,0,1,53,211.75l13.76-58.07-45-38.83A16.46,16.46,0,0,1,31.08,86l59-4.76,22.76-55.08a16.36,16.36,0,0,1,30.27,0l22.75,55.08,59,4.76a16.46,16.46,0,0,1,9.37,28.86Z"
        fill="currentColor"
      />
    </svg>
  );
}

function OliveBranch({ flipped = false }: { flipped?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 18 49"
      className={flipped ? styles.heroOliveRight : styles.heroOliveLeft}
    >
      <path d="M14.6297 45.0042C15.6255 42.823 15.75 39.0255 13.034 35.6828C11.1115 37.4967 10.9419 41.7964 14.6297 45.0042Z" />
      <path d="M10.1877 9.89245C12.5994 9.32587 15.0571 6.38739 14.8652 1.40968C12.7849 1.74931 9.03526 4.63191 10.1877 9.89245Z" />
      <path d="M9.6415 37.8931C11.3636 36.0815 12.2828 33.0747 11.1832 29.4145C9.05697 30.2286 7.43368 33.6883 9.6415 37.8931Z" />
      <path d="M10.6804 22.3766C8.77611 22.5571 6.17517 24.9954 7.05727 29.7346C8.63451 28.9614 10.8481 26.6602 10.6804 22.3766Z" />
      <path d="M12.2461 15.6003C10.1783 15.5016 7.48578 17.8313 7.49317 22.35C9.72529 21.7552 11.8595 19.5438 12.2461 15.6003Z" />
      <path d="M13.0009 10.0852C11.5798 9.79668 8.67504 10.7126 8.11939 15.0732C9.99959 15.0176 12.3442 13.6324 13.0009 10.0852Z" />
      <path d="M14.389 45.4811C12.4324 42.8351 9.10473 39.1551 5.89373 39.5671C7.50037 44.7834 11.712 46.5984 14.389 45.4811Z" />
      <path d="M2.43175 30.0827C2.33421 35.4731 5.86104 38.7659 8.98157 38.2175C7.83042 35.0849 5.62504 30.4649 2.43175 30.0827Z" />
      <path d="M5.75341 29.8623C5.99608 29.9791 6.25055 30.0676 6.51193 30.1261C6.28596 27.0492 5.48161 22.6305 2.68466 21.4771C1.83094 25.0302 2.84882 28.5516 5.75341 29.8623Z" />
      <path d="M6.60485 21.8379C6.86134 19.0168 6.52772 15.0631 4.125 13.7695C2.73097 17.8138 4.35912 20.9891 6.60485 21.8379Z" />
      <path d="M7.68639 14.8402C8.57639 12.1977 9.00137 8.47735 6.8655 6.78207C4.53791 10.738 6.19512 13.8304 7.68639 14.8402Z" />
    </svg>
  );
}

export function OriginLoginScreen() {
  return (
    <main
      className={`${styles.page} ${lyonDisplayApp.variable} ${suisseIntl.variable}`}
    >
      <div className={styles.shell}>
        <section className={styles.loginPanel}>
          <div className={styles.formWrap}>
            <Image
              src="/brand/lune-logo-mark-white.svg"
              alt="Lune"
              width={160}
              height={92}
              priority
              className={styles.brandMark}
            />
            <h1 className={styles.title}>Welcome back</h1>

            <div className={styles.socialRow}>
              <button
                className={styles.socialButton}
                type="button"
                aria-label="Continue with Apple"
              >
                <AppleLogo />
              </button>
              <button
                className={styles.socialButton}
                type="button"
                aria-label="Continue with Google"
              >
                <GoogleLogo />
              </button>
            </div>

            <button className={styles.employerButton} type="button">
              SSO through employer
            </button>

            <div className={styles.divider}>
              <span>Or sign in with email</span>
            </div>

            <form className={styles.form}>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>E-mail</span>
                <input
                  className={styles.input}
                  type="email"
                  name="username"
                  placeholder="E-mail"
                />
              </label>

              <label className={styles.field}>
                <span className={styles.fieldLabel}>Password</span>
                <span className={styles.passwordShell}>
                  <input
                    className={styles.input}
                    type="password"
                    name="current-password"
                    placeholder="Password"
                  />
                  <button
                    className={styles.eyeButton}
                    type="button"
                    aria-label="Toggle password visibility"
                  >
                    <EyeIcon />
                  </button>
                </span>
              </label>

              <a href="/login" className={styles.forgotLink}>
                Forgot your password?
              </a>

              <button className={styles.submitButton} type="submit">
                Sign in
              </button>
            </form>

            <p className={styles.signUpLine}>
              Don&apos;t have an account yet? <a href="/login">Sign up</a>
            </p>

            <pre className={styles.version}>16d0479</pre>
          </div>
        </section>

        <section className={styles.heroPanel}>
          <div className={styles.heroContent}>
            <div className={styles.heroStreak} aria-hidden="true" />
            <h2 className={styles.heroTitle}>
              Track spend, ask anything.
              <br />
              Own your wealth.
            </h2>

            <div className={styles.heroBadge}>
              <OliveBranch />
              <div className={styles.heroBadgeCenter}>
                <span className={styles.heroStars} aria-hidden="true">
                  <HeroStarIcon />
                  <HeroStarIcon />
                  <HeroStarIcon />
                  <HeroStarIcon />
                  <HeroStarIcon />
                </span>
                <span className={styles.heroMembers}>100K+ MEMBERS</span>
              </div>
              <OliveBranch flipped />
            </div>

            <div className={styles.heroCard}>
              <div className={styles.heroCardTop}>
                <span className={styles.heroCardLabel}>SPENDING THIS MONTH</span>
                <span className={styles.heroCardPlus}>+</span>
              </div>

              <div className={styles.heroCardValue}>$2,132</div>
              <div className={styles.heroCardMonth}>&bull; May</div>

              <div className={styles.heroGraph}>
                <svg
                  viewBox="0 0 360 120"
                  preserveAspectRatio="none"
                  className={styles.heroGraphSvg}
                  aria-hidden="true"
                >
                  <defs>
                    <linearGradient id="heroGraphFade" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgba(255,255,255,0.34)" />
                      <stop offset="100%" stopColor="rgba(255,255,255,0.04)" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M0 101 C55 101, 93 100, 127 92 C162 84, 194 61, 232 47 C271 33, 313 26, 360 26 L360 120 L0 120 Z"
                    className={styles.heroGraphArea}
                  />
                  <path
                    d="M0 101 C55 101, 93 100, 127 92 C162 84, 194 61, 232 47 C271 33, 313 26, 360 26"
                    className={styles.heroGraphLine}
                  />
                </svg>
              </div>

              <div className={styles.heroAxis}>
                <span>01</span>
                <span>07</span>
                <span>14</span>
                <span>21</span>
                <span>28</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
