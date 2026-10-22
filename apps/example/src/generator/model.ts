export type Currency = 'EUR' | 'CZK' | 'USD' | 'GBP'
export type Language = 'en' | 'sk'
export type PaymentMethod = 'transfer' | 'card' | 'cash'

export interface Party {
  name: string
  street: string
  postalCode: string
  city: string
  country: string
  /** Company registration number (IČO). */
  companyId: string
  /** Tax ID (DIČ). */
  taxId: string
  /** VAT ID (IČ DPH). */
  vatId: string
  email: string
  phone: string
}

export interface LineItem {
  id: number
  description: string
  quantity: number
  unit: string
  unitPrice: number
  /** Percent off the line, 0–100. */
  discount: number
  /** VAT rate in percent. */
  vatRate: number
}

export interface Invoice {
  number: string
  orderNumber: string
  issueDate: string
  deliveryDate: string
  dueDate: string
  currency: Currency
  language: Language
  seller: Party
  buyer: Party
  payment: {
    method: PaymentMethod
    bankName: string
    iban: string
    bic: string
    variableSymbol: string
    /** Print an EPC (SEPA) payment QR code. Only for EUR transfers with an IBAN. */
    qr: boolean
  }
  vatPayer: boolean
  reverseCharge: boolean
  items: LineItem[]
  notes: string
  issuedBy: string
  accent: string
  /** A PNG or JPEG data URI. */
  logo: string | null
}

const emptyParty = (): Party => ({
  name: '',
  street: '',
  postalCode: '',
  city: '',
  country: '',
  companyId: '',
  taxId: '',
  vatId: '',
  email: '',
  phone: '',
})

const isoDate = (date: Date) => date.toISOString().slice(0, 10)
const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 86_400_000)

export const sampleInvoice = (today = new Date()): Invoice => ({
  number: `${today.getFullYear()}0042`,
  orderNumber: 'PO-7781',
  issueDate: isoDate(today),
  deliveryDate: isoDate(today),
  dueDate: isoDate(addDays(today, 14)),
  currency: 'EUR',
  language: 'en',
  seller: {
    name: 'Apptiary s.r.o.',
    street: 'Hlavná 12',
    postalCode: '811 01',
    city: 'Bratislava',
    country: 'Slovakia',
    companyId: '12345678',
    taxId: '2020123456',
    vatId: 'SK2020123456',
    email: 'billing@apptiary.example',
    phone: '+421 900 123 456',
  },
  buyer: {
    name: 'Northwind Traders GmbH',
    street: 'Friedrichstraße 68',
    postalCode: '10117',
    city: 'Berlin',
    country: 'Germany',
    companyId: 'HRB 123456',
    taxId: '',
    vatId: 'DE123456789',
    email: 'ap@northwind.example',
    phone: '',
  },
  payment: {
    method: 'transfer',
    bankName: 'Tatra banka, a.s.',
    iban: 'SK31 1100 0000 0026 1234 5678',
    bic: 'TATRSKBX',
    variableSymbol: `${today.getFullYear()}0042`,
    qr: true,
  },
  vatPayer: true,
  reverseCharge: false,
  items: [
    { id: 1, description: 'Discovery workshop', quantity: 1, unit: 'day', unitPrice: 900, discount: 0, vatRate: 23 },
    {
      id: 2,
      description: 'Vue 3 front-end development',
      quantity: 64,
      unit: 'h',
      unitPrice: 75,
      discount: 0,
      vatRate: 23,
    },
    { id: 3, description: 'PDF export module', quantity: 1, unit: 'pc', unitPrice: 1800, discount: 10, vatRate: 23 },
    {
      id: 4,
      description: 'Technical book: Vue in Practice',
      quantity: 2,
      unit: 'pc',
      unitPrice: 39.9,
      discount: 0,
      vatRate: 5,
    },
  ],
  notes: 'Thank you for your business. Please quote the invoice number with your payment.',
  issuedBy: 'Ján Novák',
  accent: '#0f766e',
  logo: null,
})

export const blankInvoice = (today = new Date()): Invoice => ({
  ...sampleInvoice(today),
  orderNumber: '',
  seller: emptyParty(),
  buyer: emptyParty(),
  payment: { method: 'transfer', bankName: '', iban: '', bic: '', variableSymbol: '', qr: false },
  items: [],
  notes: '',
  issuedBy: '',
  logo: null,
})

/** Accepts a parsed JSON value only if it has the shape of an invoice. */
export const isInvoice = (value: unknown): value is Invoice => {
  if (value == null || typeof value !== 'object') return false
  const candidate = value as Partial<Invoice>
  return (
    typeof candidate.number === 'string' &&
    typeof candidate.seller === 'object' &&
    typeof candidate.buyer === 'object' &&
    typeof candidate.payment === 'object' &&
    Array.isArray(candidate.items)
  )
}
