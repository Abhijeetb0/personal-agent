import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export default function Home() {
  const logged = cookies().get("pa_auth")?.value === "1";
  redirect(logged ? "/dashboard" : "/login");
}
