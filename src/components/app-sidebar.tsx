"use client"

import Link from "next/link"
import { CalendarDaysIcon } from "lucide-react"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { navigation, secondaryNavigation } from "@/config/navigation"
import { site } from "@/config/site"
import { homePathFor, type Role } from "@/domain/roles"

export function AppSidebar({
  user,
  role,
  ...props
}: {
  user: { name: string; email: string }
  role: Role
} & React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:p-1.5!"
            >
              <Link href={homePathFor(role)}>
                <CalendarDaysIcon className="size-5!" aria-hidden />
                <span className="text-base font-semibold">{site.name}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navigation[role]} />
        <NavMain items={secondaryNavigation} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}
