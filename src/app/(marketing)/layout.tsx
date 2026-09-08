import LandingFooter from "@/components/marketing/LandingFooter";
import LandingHeader from "@/components/marketing/LandingHeader";

export default function MarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="marketing min-h-screen scroll-smooth">
      <LandingHeader />
      <main>{children}</main>
      <LandingFooter />
    </div>
  );
}
