/**
 * Composable for building WhatsApp messages using templates
 * Implements Opsi A: Template with auto-injected billing details and payment links
 */

import { useKosStore } from '~/stores/kos'
import { getDefaultWhatsAppTemplate } from '#shared/whatsapp-template-defaults'

export type TemplateType = 'billing' | 'reminder_overdue' | 'reminder_due_soon' | 'general'
export type WhatsAppDetailField =
  | 'property_name'
  | 'room_name'
  | 'tenant_name'
  | 'occupant_count'
  | 'rent_section'
  | 'utility_section'
  | 'grand_total'
  | 'payment_status'

export const DEFAULT_WHATSAPP_DETAIL_FIELDS: WhatsAppDetailField[] = [
  'property_name',
  'room_name',
  'tenant_name',
  'occupant_count',
  'rent_section',
  'utility_section',
  'grand_total',
  'payment_status',
]

export const WHATSAPP_DETAIL_FIELD_OPTIONS: Array<{ value: WhatsAppDetailField; label: string; description: string }> = [
  { value: 'property_name', label: 'Nama properti', description: 'Menampilkan nama properti di bagian atas detail tagihan.' },
  { value: 'room_name', label: 'Nama kamar', description: 'Menampilkan nama kamar tenant.' },
  { value: 'tenant_name', label: 'Nama penghuni', description: 'Menampilkan nama penghuni pada detail tagihan.' },
  { value: 'occupant_count', label: 'Jumlah penghuni', description: 'Menampilkan jumlah penghuni bila lebih dari satu.' },
  { value: 'rent_section', label: 'Rincian sewa', description: 'Menampilkan blok rincian sewa kamar.' },
  { value: 'utility_section', label: 'Rincian utilitas', description: 'Menampilkan blok rincian listrik, air, dan sampah.' },
  { value: 'grand_total', label: 'Total tagihan', description: 'Menampilkan total akhir tagihan.' },
  { value: 'payment_status', label: 'Status tagihan', description: 'Menampilkan status lunas atau belum lunas.' },
]

export function normalizeWhatsAppDetailFields(fields?: unknown): WhatsAppDetailField[] {
  if (!Array.isArray(fields)) {
    return [...DEFAULT_WHATSAPP_DETAIL_FIELDS]
  }

  const filtered = fields.filter((field): field is WhatsAppDetailField =>
    DEFAULT_WHATSAPP_DETAIL_FIELDS.includes(field as WhatsAppDetailField)
  )

  return filtered.length > 0 ? filtered : [...DEFAULT_WHATSAPP_DETAIL_FIELDS]
}

function appendLabeledLine(lines: string[], label: string, value?: string | number | null) {
  if (value === undefined || value === null || value === '') return
  lines.push(`${label} : ${value}`)
}

function formatCurrencyValue(value?: string | number | null) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(Number(value || 0))
}

function appendSection(lines: string[], sectionLines: string[]) {
  if (sectionLines.length === 0) return
  if (lines.length > 0 && lines[lines.length - 1] !== '') {
    lines.push('')
  }
  lines.push(...sectionLines)
}

export function getBillingStatusLabel(isRentPaid?: boolean, isUtilityPaid?: boolean) {
  return isRentPaid && isUtilityPaid ? 'LUNAS' : 'BELUM LUNAS'
}

export function buildRentDetailBlock(options: {
  periodLabel?: string
  monthsCovered?: number
  roomPrice?: number | string
  totalAmount?: number | string
}): string[] {
  const totalAmount = Number(options.totalAmount || 0)
  if (totalAmount <= 0) return []

  const lines = ['*Sewa Kamar*']
  appendLabeledLine(lines, 'Periode Sewa', options.periodLabel)

  if (options.monthsCovered && options.roomPrice && Number(options.roomPrice) > 0) {
    lines.push(`${options.monthsCovered} bln x ${formatCurrencyValue(options.roomPrice)}`)
  }

  appendLabeledLine(lines, 'Total', formatCurrencyValue(totalAmount))

  return lines
}

export function buildUtilityDetailBlock(options: {
  periodLabel?: string
  usageCost?: number | string
  waterFee?: number | string
  trashFee?: number | string
  totalAmount?: number | string
}): string[] {
  const totalAmount = Number(options.totalAmount || 0)
  if (totalAmount <= 0) return []

  const lines = ['*Utilitas ( Tagihan Listrik, Air & Sampah )*']
  appendLabeledLine(lines, 'Periode Pemakaian', options.periodLabel)

  if (Number(options.usageCost || 0) > 0) {
    appendLabeledLine(lines, 'Listrik', formatCurrencyValue(options.usageCost))
  }

  if (Number(options.waterFee || 0) > 0) {
    appendLabeledLine(lines, 'Air', formatCurrencyValue(options.waterFee))
  }

  if (Number(options.trashFee || 0) > 0) {
    appendLabeledLine(lines, 'Sampah', formatCurrencyValue(options.trashFee))
  }

  appendLabeledLine(lines, 'Total', formatCurrencyValue(totalAmount))

  return lines
}

export function buildBillingSummaryBlock(options: {
  grandTotal?: number | string
  statusLabel?: string
  showGrandTotal?: boolean
  showStatus?: boolean
}): string[] {
  if (!options.showGrandTotal && !options.showStatus) {
    return []
  }

  const lines = ['=============================']

  if (options.showGrandTotal) {
    appendLabeledLine(lines, 'TOTAL TAGIHAN', formatCurrencyValue(options.grandTotal))
  }

  if (options.showStatus) {
    appendLabeledLine(lines, 'STATUS', options.statusLabel || 'BELUM LUNAS')
  }

  lines.push('=============================')
  return lines
}

interface BillingData {
  tenantName: string
  propertyName: string
  roomName: string
  period: string
  customPeriodLabel?: string
  rentPeriod?: string
  utilityPeriod?: string
  occupantCount?: number
  daysUntilDue?: number
  
  // Rent details
  rentAmount?: number | string
  monthsCovered?: number
  roomPrice?: number | string
  isRentPaid?: boolean
  
  // Utility details
  meterStart?: number
  meterEnd?: number
  usageCost?: number | string
  waterFee?: number | string
  trashFee?: number | string
  utilityTotal?: number | string
  isUtilityPaid?: boolean
  
  // Grand totals
  grandTotal: number | string
  
  // Invoice link (auto-generated)
  invoiceUrl?: string
  customDetailSection?: string
}

export function useWhatsAppTemplate() {
  const store = useKosStore()
  const enabledDetailFields = computed(() => normalizeWhatsAppDetailFields(store.settings?.whatsappDetailFields))

  const formatCurrency = (val: number | string) =>
    new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(Number(val))

  const formatPeriod = (period?: string) => {
    if (!period) return ''

    const match = period.match(/^(\d{4})-(\d{2})$/)
    if (!match) return period

    const [, year, month] = match
    const date = new Date(Number(year), Number(month) - 1, 1)

    if (Number.isNaN(date.getTime())) return period

    return new Intl.DateTimeFormat('id-ID', {
      month: 'long',
      year: 'numeric',
    }).format(date)
  }

  const formatPeriodLabel = (period?: string) => {
    if (!period) return ''
    return formatPeriod(period)
  }

  /**
   * Build billing detail section that gets auto-injected
   */
  function buildDetailSection(data: BillingData): string {
    if (data.customDetailSection) {
      return data.customDetailSection
    }

    const hasDetailField = (field: WhatsAppDetailField) => enabledDetailFields.value.includes(field)
  const formattedRentPeriod = formatPeriodLabel(data.rentPeriod)
    const formattedUtilityPeriod = formatPeriodLabel(data.utilityPeriod)
    const statusLabel = getBillingStatusLabel(data.isRentPaid, data.isUtilityPaid)
    const detailLines = ['*TAGIHAN KOST*']

    if (hasDetailField('property_name')) {
      detailLines.push(data.propertyName)
    }

    if (
      hasDetailField('room_name') ||
      hasDetailField('tenant_name') ||
      (hasDetailField('occupant_count') && data.occupantCount && data.occupantCount > 1)
    ) {
      detailLines.push('')
    }

    if (hasDetailField('room_name')) {
      appendLabeledLine(detailLines, 'Kamar', data.roomName)
    }
    if (hasDetailField('tenant_name')) {
      appendLabeledLine(detailLines, 'Penghuni', data.tenantName)
    }

    if (hasDetailField('occupant_count') && data.occupantCount && data.occupantCount > 1) {
      appendLabeledLine(detailLines, 'Jumlah Penghuni', `${data.occupantCount} orang`)
    }

    appendSection(
      detailLines,
      hasDetailField('rent_section')
        ? buildRentDetailBlock({
            periodLabel: formattedRentPeriod,
            monthsCovered: data.monthsCovered,
            roomPrice: data.roomPrice,
            totalAmount: data.rentAmount,
          })
        : [],
    )

    appendSection(
      detailLines,
      hasDetailField('utility_section')
        ? buildUtilityDetailBlock({
            periodLabel: formattedUtilityPeriod,
            usageCost: data.usageCost,
            waterFee: data.waterFee,
            trashFee: data.trashFee,
            totalAmount: data.utilityTotal,
          })
        : [],
    )

    appendSection(
      detailLines,
      buildBillingSummaryBlock({
        grandTotal: data.grandTotal,
        statusLabel,
        showGrandTotal: hasDetailField('grand_total'),
        showStatus: hasDetailField('payment_status'),
      }),
    )

    return detailLines.join('\n')
  }

  /**
   * Build payment link section
   */
  function buildLinkSection(invoiceUrl?: string): string {
    if (!invoiceUrl) return ''
    
    return `\nLihat & Bayar Invoice:\n${invoiceUrl}\n\n(Klik link di atas untuk melihat detail tagihan dan melakukan pembayaran online)`
  }

  /**
   * Build final message by replacing template variables
   */
  function buildMessage(templateMessage: string, data: BillingData): string {
    const detailSection = buildDetailSection(data)
    const linkSection = buildLinkSection(data.invoiceUrl)
    const formattedPeriod = data.customPeriodLabel || formatPeriod(data.period)
    const formattedRentPeriod = formatPeriodLabel(data.rentPeriod)
    const formattedUtilityPeriod = formatPeriodLabel(data.utilityPeriod)
    
    // Replace template variables
    let message = templateMessage
      .replace(/{nama_penyewa}/g, data.tenantName)
      .replace(/{nama_properti}/g, data.propertyName)
      .replace(/{nama_kamar}/g, data.roomName)
      .replace(/{jumlah_tagihan}/g, formatCurrency(data.grandTotal))
      .replace(/{periode}/g, formattedPeriod)
      .replace(/{periode_sewa}/g, formattedRentPeriod)
      .replace(/{periode_utilitas}/g, formattedUtilityPeriod)
      .replace(/{status_tagihan}/g, data.isRentPaid && data.isUtilityPaid ? 'LUNAS' : 'BELUM LUNAS')
      .replace(/{detail_tagihan}/g, detailSection)
      .replace(/{link_pembayaran}/g, linkSection)
    
    // Handle {tanggal_jatuh_tempo} if daysUntilDue is provided
    if (data.daysUntilDue !== undefined) {
      const dueStatus = data.daysUntilDue < 0 
        ? `Lewat ${Math.abs(data.daysUntilDue)} hari`
        : data.daysUntilDue === 0 
          ? 'Hari ini' 
          : `${data.daysUntilDue} hari lagi`
      message = message.replace(/{tanggal_jatuh_tempo}/g, dueStatus)
    }

    if (linkSection && data.invoiceUrl && !message.includes(data.invoiceUrl)) {
      message = `${message.trim()}\n\n${linkSection.trim()}`
    }
    
    return message.trim()
  }

  /**
   * Fetch default template for a type from API
   */
  async function getDefaultTemplate(type: TemplateType, propertyId?: string | null): Promise<{ message: string; name: string }> {
    try {
      const response = await $fetch<{ template: { message: string; name: string } }>(`/api/whatsapp-templates/default/${type}`, {
        query: propertyId ? { propertyId } : undefined,
      })
      return response.template
    } catch (error) {
      console.error('Failed to fetch template:', error)
      // Fallback to basic template
      return {
        ...getDefaultWhatsAppTemplate(type),
      }
    }
  }

  /**
   * Format phone number for wa.me (remove leading 0, add 62)
   */
  function formatPhoneNumber(phone: string): string {
    let phoneNumber = phone.replace(/\D/g, '') // Remove non-digits
    if (phoneNumber.startsWith('0')) {
      phoneNumber = '62' + phoneNumber.slice(1)
    } else if (!phoneNumber.startsWith('62')) {
      phoneNumber = '62' + phoneNumber
    }
    return phoneNumber
  }

  /**
   * Detect iOS / iPadOS (Safari or in-app browsers)
   */
  function isIOS(): boolean {
    if (typeof navigator === 'undefined') return false
    const ua = navigator.userAgent || ''
    // iPadOS 13+ reports as Macintosh but supports touch
    const isIPad = /Macintosh/i.test(ua) && typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 1
    return /iPhone|iPad|iPod/i.test(ua) || isIPad
  }

  /**
   * Build WhatsApp URL (web — for desktop/Android)
   */
  function buildWhatsAppUrl(phone: string, message: string): string {
    const formattedPhone = formatPhoneNumber(phone)
    return `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`
  }

  /**
   * Build WhatsApp deep-link URL (for iOS/iPadOS).
   * Uses the whatsapp:// URL scheme which opens the app DIRECTLY
   * without going through the wa.me → api.whatsapp.com browser redirect.
   */
  function buildWhatsAppDeepLink(phone: string, message: string): string {
    const formattedPhone = formatPhoneNumber(phone)
    return `whatsapp://send?phone=${formattedPhone}&text=${encodeURIComponent(message)}`
  }

  /**
   * Prepare a blank tab synchronously from a user-gesture context.
   * On iOS this is skipped entirely because:
   * - iOS Safari blocks about:blank popups
   * - We use window.location.href instead (which reliably opens WhatsApp)
   */
  function prepareWhatsAppTab() {
    // On iOS, don't open a blank tab — we'll navigate the current page instead
    if (isIOS()) {
      return null
    }

    const pendingTab = window.open('about:blank', '_blank')

    if (pendingTab) {
      try {
        pendingTab.opener = null
      } catch {
        // Ignore browser-specific opener restrictions.
      }
    }

    return pendingTab
  }

  function closePreparedTab(targetWindow?: Window | null) {
    if (targetWindow && !targetWindow.closed) {
      targetWindow.close()
    }
  }

  /**
   * Open WhatsApp via a programmatic <a> tag click.
   * This is the most reliable method on iOS because:
   * 1. It mimics a real user tap on a link
   * 2. Safari doesn't block it as a popup
   * 3. The OS universal-link handler intercepts wa.me and opens WhatsApp directly
   */
  function openViaAnchorClick(url: string): boolean {
    try {
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.target = '_blank'
      anchor.rel = 'noopener noreferrer'
      // Must be in the DOM briefly for some browsers to honour the click
      anchor.style.display = 'none'
      document.body.appendChild(anchor)
      anchor.click()
      // Clean up after a tick
      setTimeout(() => document.body.removeChild(anchor), 100)
      return true
    } catch {
      return false
    }
  }

  /**
   * Open WhatsApp with the message.
   *
   * Strategy per platform:
   * - **iOS/iPadOS**: Use whatsapp://send deep-link to open the app directly,
   *   bypassing the wa.me → api.whatsapp.com browser redirect entirely.
   * - **Desktop/Android**: Use the pre-opened tab if available, otherwise
   *   window.open, then anchor-click as a last resort.
   */
  function openWhatsApp(phone: string, message: string, targetWindow?: Window | null) {
    const waUrl = buildWhatsAppUrl(phone, message)

    // --- iOS / iPadOS path ---
    if (isIOS()) {
      // Close any accidentally opened blank tab
      closePreparedTab(targetWindow)

      // Use whatsapp:// deep link — opens WhatsApp app directly
      // without any browser redirect page
      const deepLink = buildWhatsAppDeepLink(phone, message)
      try {
        window.location.href = deepLink
        return true
      } catch {
        // Fallback: try wa.me via anchor click
        return openViaAnchorClick(waUrl)
      }
    }

    // --- Desktop / Android path ---
    if (targetWindow) {
      try {
        targetWindow.location.href = waUrl
        targetWindow.focus()
        return true
      } catch {
        try {
          targetWindow.location.replace(waUrl)
          targetWindow.focus()
          return true
        } catch {
          // Fall through
        }
      }
    }

    // Try window.open
    const newTab = window.open(waUrl, '_blank')
    if (newTab) {
      try {
        newTab.opener = null
      } catch {
        // Ignore browser-specific opener restrictions.
      }
      return true
    }

    // Last resort: anchor click
    return openViaAnchorClick(waUrl)
  }

  return {
    buildMessage,
    buildDetailSection,
    buildLinkSection,
    getDefaultTemplate,
    formatPhoneNumber,
    buildWhatsAppUrl,
    prepareWhatsAppTab,
    closePreparedTab,
    openWhatsApp,
    formatCurrency
  }
}
