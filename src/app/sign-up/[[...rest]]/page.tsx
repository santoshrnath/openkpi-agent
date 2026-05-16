import { SignUp } from "@clerk/nextjs";

export const dynamic = "force-dynamic";

export default function SignUpPage() {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "40px 0 80px" }}>
      <SignUp />
    </div>
  );
}
