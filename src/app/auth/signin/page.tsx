import { GoogleAuthCard } from "@/app/auth/_components/GoogleAuthCard";

export const dynamic = "force-dynamic";

export default function SignIn() {
  return <GoogleAuthCard mode="signin" />;
}
