"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ArrowRight, Building2, CheckCircle2, FileSearch, LockKeyhole, ShieldCheck, UserRoundCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LanguageMenu } from "@/components/language-menu";

type Language = "th" | "en";

export default function SignInView({ signInHref }: { signInHref: string }) {
  const [language, setLanguage] = useState<Language>("th");
  const tr = (thai: string, english: string) => language === "th" ? thai : english;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved = window.localStorage.getItem("kc-account-language");
      const selected = saved === "en" ? "en" : "th";
      setLanguage(selected);
      document.documentElement.lang = selected;
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const changeLanguage = (value: string) => {
    if (value !== "th" && value !== "en") return;
    setLanguage(value);
    window.localStorage.setItem("kc-account-language", value);
    document.documentElement.lang = value;
  };

  return (
    <main className="signin-page">
      <section className="signin-shell" aria-label={tr("เข้าสู่ระบบ KC Account 360", "Sign in to KC Account 360")}>
        <aside className="signin-brand-panel">
          <div className="signin-brand-logo">
            <Image src="/api/branding/logo" width={2172} height={724} alt="KC Account 360" priority unoptimized />
          </div>

          <div className="signin-brand-copy">
            <span className="signin-trust-pill"><ShieldCheck />{tr("แพลตฟอร์มบริหารบัญชีและการเงินขององค์กร", "Enterprise accounting and finance platform")}</span>
            <h1>{tr("ทุกบัญชี ทุกธุรกรรม ในระบบที่เชื่อถือได้", "Every account and transaction in one trusted system")}</h1>
            <p>{tr("ควบคุมงานบัญชีครบวงจร ตั้งแต่รับข้อมูล การอนุมัติ การกระทบยอด ไปจนถึงการปิดงวด พร้อมประวัติที่ตรวจสอบย้อนหลังได้", "Manage the complete accounting cycle—from data intake and approvals to reconciliation and closing—with a traceable audit history.")}</p>
          </div>

          <div className="signin-feature-grid">
            <div><LockKeyhole /><span>{tr("การเชื่อมต่อเข้ารหัส", "Encrypted connection")}</span></div>
            <div><UserRoundCheck /><span>{tr("เข้าถึงตามบทบาท", "Role-based access")}</span></div>
            <div><FileSearch /><span>{tr("ตรวจสอบย้อนหลังได้", "Traceable audit trail")}</span></div>
          </div>

          <footer className="signin-brand-footer"><span>© 2026 KAI-COM</span><span>{tr("สำหรับผู้ได้รับอนุญาตเท่านั้น", "Authorized users only")}</span></footer>
        </aside>

        <section className="signin-access-panel">
          <div className="signin-access-top">
            <span>KC ACCOUNT 360 · {tr("ระบบบัญชีและการเงินอัจฉริยะ", "INTELLIGENT FINANCE SYSTEM")}</span>
            <LanguageMenu language={language} onChange={changeLanguage} compact />
          </div>

          <div className="signin-access-content">
            <div className="signin-welcome">
              <span className="signin-welcome-icon"><Building2 /></span>
              <div><p>{tr("ยินดีต้อนรับกลับ", "Welcome back")}</p><h2>KC Account 360</h2></div>
            </div>
            <p className="signin-intro">{tr("เข้าสู่ระบบด้วยบัญชี ChatGPT Workspace ขององค์กร เพื่อใช้งานตามสิทธิ์ที่ได้รับ", "Sign in with your organization’s ChatGPT Workspace account to continue with your assigned access.")}</p>

            <div className="signin-workspace-card">
              <span className="signin-workspace-icon"><ShieldCheck /></span>
              <div><strong>ChatGPT Workspace</strong><small>{tr("ยืนยันตัวตนและสิทธิ์การเข้าถึงอย่างปลอดภัย", "Secure identity and access verification")}</small></div>
              <CheckCircle2 />
            </div>

            <Button asChild className="signin-button">
              <a href={signInHref}><LockKeyhole />{tr("เข้าสู่ระบบอย่างปลอดภัย", "Secure sign in")}<ArrowRight /></a>
            </Button>

            <div className="signin-security-note">
              <span><ShieldCheck /></span>
              <div><strong>{tr("การเข้าถึงระดับ Enterprise ที่ปลอดภัย", "Secure enterprise access")}</strong><p>{tr("ระบบตรวจสอบบทบาท สิทธิ์อนุมัติ และการเข้าถึงข้อมูลก่อนเปิด Workspace ทุกครั้ง", "Your role, approval permissions, and data access are verified before the workspace opens.")}</p></div>
            </div>
          </div>

          <footer className="signin-access-footer"><span>KC Account 360 · {tr("สำหรับผู้ได้รับอนุญาตเท่านั้น", "Authorized users only")}</span><span>Version 1.0.0</span></footer>
        </section>
      </section>
    </main>
  );
}
