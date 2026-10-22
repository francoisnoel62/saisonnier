import { SunSnowIcon } from "lucide-react"
import { site } from "@/config/site"
import styles from "./public.module.css"

export function Brand() {
  return (
    <span className={styles.brand}>
      <span className={styles.brandIcon}>
        <SunSnowIcon aria-hidden />
      </span>
      <span>{site.name}</span>
    </span>
  )
}
