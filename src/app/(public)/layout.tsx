import { PublicFooter } from "@/components/public/public-footer"
import { PublicHeader } from "@/components/public/public-header"
import { getSession } from "@/lib/dal"
import styles from "@/components/public/public.module.css"

export default async function PublicLayout({ children }: LayoutProps<"/">) {
  const session = await getSession()
  return (
    <div className={styles.site}>
      <PublicHeader role={session?.user.role} />
      <main id="contenu" className={styles.main}>
        {children}
      </main>
      <PublicFooter />
    </div>
  )
}
