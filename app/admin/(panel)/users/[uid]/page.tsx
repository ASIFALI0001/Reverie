import type { Metadata } from "next";
import { UserDetail } from "@/components/admin/UserDetail";

export const metadata: Metadata = { title: "User" };

export default async function AdminUserPage({ params }: PageProps<"/admin/users/[uid]">) {
  const { uid } = await params;
  return <UserDetail uid={decodeURIComponent(uid)} />;
}
