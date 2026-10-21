import { requireRole } from "@/lib/dal"

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireRole("admin")
  return children
}
