import { chatGPTSignInPath, getChatGPTUser } from "@/app/chatgpt-auth";
import KCAccountApp from "@/app/kc-account-app";
import SignInView from "@/app/signin-view";

export const dynamic = "force-dynamic";

export default async function Page() {
  const user = await getChatGPTUser();
  if (!user) {
    return <SignInView signInHref={chatGPTSignInPath("/")} />;
  }
  return <KCAccountApp initialUser={user} />;
}
