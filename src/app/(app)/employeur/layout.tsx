import { requireRole } from "@/lib/dal"

export default async function EmployeurLayout({
  children,
}: LayoutProps<"/employeur">) {
  await requireRole("employer")
  return children
}
