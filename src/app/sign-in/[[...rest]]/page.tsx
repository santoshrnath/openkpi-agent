import { SignIn } from "@clerk/nextjs";

export const dynamic = "force-dynamic";

export default function SignInPage() {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "40px 0 80px" }}>
      <SignIn />
    </div>
  );
}
