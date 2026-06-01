import { GoogleAuthCard } from "@/app/auth/_components/GoogleAuthCard";

export const dynamic = "force-dynamic";

export default function SignUp() {
  return <GoogleAuthCard mode="signup" />;
}
