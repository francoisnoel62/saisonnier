import { PublicFooter } from "@/components/public/public-footer"
import { PublicHeader } from "@/components/public/public-header"
import { getSession } from "@/lib/dal"

// Pages ouvertes à tous : la session sert seulement à proposer « Accéder à mon espace ».
export default async function PublicLayout({ children }: LayoutProps<"/">) {
  const session = await getSession()

  return (
    <>
      <PublicHeader role={session?.user.role} />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-10">
        {children}
      </main>
      <PublicFooter />
    </>
  )
}
