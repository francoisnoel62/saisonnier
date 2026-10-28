"use client"

import Link from "next/link"

import { NavMain } from "@/components/nav-main"
import { Brand } from "@/components/public/brand"
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
              className="h-12 data-[slot=sidebar-menu-button]:p-1.5!"
            >
              <Link href={homePathFor(role)}>
                <Brand />
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
