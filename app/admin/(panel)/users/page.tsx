import type { Metadata } from "next";
import { UsersTable } from "@/components/admin/UsersTable";

export const metadata: Metadata = { title: "Users" };

export default function AdminUsersPage() {
  return <UsersTable />;
}
