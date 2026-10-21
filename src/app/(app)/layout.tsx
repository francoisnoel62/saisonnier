import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { requireUser } from "@/lib/dal"

// Espace authentifié commun aux trois rôles. L'accès propre à chaque espace est vérifié par
// les layouts employeur et admin, et par les pages candidat.
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { user } = await requireUser()

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar
        variant="inset"
        role={user.role}
        user={{ name: user.name, email: user.email }}
      />
      <SidebarInset className="min-w-0">
        <SiteHeader role={user.role} />
        {/* SidebarInset rend déjà l'élément <main> */}
        <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
