import type { Metadata } from "next"

import { ChangePasswordForm } from "@/components/account/change-password-form"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { requireUser } from "@/lib/dal"

export const metadata: Metadata = { title: "Mon compte" }

export default async function AccountPage() {
  const { user } = await requireUser()

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Informations</CardTitle>
          <CardDescription>
            Ces informations ne peuvent pas être modifiées ici.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="account-name">Nom</FieldLabel>
              <Input id="account-name" value={user.name} readOnly />
            </Field>
            <Field>
              <FieldLabel htmlFor="account-email">Adresse email</FieldLabel>
              <Input
                id="account-email"
                type="email"
                value={user.email}
                readOnly
              />
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mot de passe</CardTitle>
          <CardDescription>
            Vos autres appareils seront déconnectés après le changement.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>
    </div>
  )
}
