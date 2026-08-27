import Landing from "@/components/landing-sections/Landing";
import AuthBadge from "@/components/auth/auth-badge";

export default function HomePage() {
  return (
    <>
      <AuthBadge />
      <Landing />
    </>
  );
}
