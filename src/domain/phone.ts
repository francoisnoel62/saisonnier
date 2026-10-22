// Chiffres, espaces et « + . - ( ) », au moins 9 chiffres : les numéros français comme étrangers.
const PHONE = /^\+?[\d\s.()-]+$/

export function isPhoneNumber(value: string) {
  return PHONE.test(value) && value.replace(/\D/g, "").length >= 9
}
