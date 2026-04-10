/**
 * Composable for building WhatsApp messages using templates
 * Implements Opsi A: Template with auto-injected billing details and payment links
 */

export type TemplateType = 'billing' | 'reminder_overdue' | 'reminder_due_soon' | 'general'

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

    const formattedPeriod = formatPeriod(data.period)
    const formattedRentPeriod = formatPeriodLabel(data.rentPeriod)
    const formattedUtilityPeriod = formatPeriodLabel(data.utilityPeriod)
    let detail = `*TAGIHAN KOST*\n`
    detail += `${data.propertyName}\n`
    detail += `================================\n\n`
    detail += `Periode: *${formattedPeriod}*\n`
    detail += `Kamar: *${data.roomName}*\n`
    detail += `Penghuni: ${data.tenantName}\n`
    
    if (data.occupantCount && data.occupantCount > 1) {
      detail += `Jumlah Penghuni: ${data.occupantCount} orang\n`
    }
    
    detail += `\n================================\n`

    // Rent section
    if (data.rentAmount && Number(data.rentAmount) > 0) {
      detail += `\n*SEWA KAMAR*\n`
      if (formattedRentPeriod) {
        detail += `Periode Sewa: ${formattedRentPeriod}\n`
      }
      if (data.monthsCovered && data.roomPrice) {
        detail += `${data.monthsCovered} bulan x ${formatCurrency(data.roomPrice)}\n`
      }
      detail += `Total: ${formatCurrency(data.rentAmount)}`
      detail += data.isRentPaid ? ' [LUNAS]\n' : '\n'
    }

    // Utility section
    if (data.utilityTotal && Number(data.utilityTotal) > 0) {
      detail += `\n*UTILITAS*\n\n`
      if (formattedUtilityPeriod) {
        detail += `Periode Utilitas: ${formattedUtilityPeriod}\n\n`
      }
      
      // Electricity
      if (data.meterStart !== undefined && data.meterEnd !== undefined) {
        const kwhUsage = data.meterEnd - data.meterStart
        detail += `Listrik:\n`
        detail += `  ${data.meterStart} -> ${data.meterEnd} = ${kwhUsage} kWh\n`
        if (data.usageCost) {
          detail += `  ${formatCurrency(data.usageCost)}\n\n`
        }
      }
      
      // Water
      if (data.waterFee && Number(data.waterFee) > 0) {
        detail += `Air:\n`
        if (data.occupantCount && data.occupantCount > 1) {
          const waterPerPerson = Number(data.waterFee) / data.occupantCount
          detail += `  ${formatCurrency(waterPerPerson)} x ${data.occupantCount} orang\n`
        }
        detail += `  ${formatCurrency(data.waterFee)}\n`
      }
      
      // Trash
      if (data.trashFee && Number(data.trashFee) > 0) {
        detail += `\nSampah:\n`
        detail += `  ${formatCurrency(data.trashFee)}\n`
      }
      
      detail += `\nTotal Utilitas: ${formatCurrency(data.utilityTotal)}`
      detail += data.isUtilityPaid ? ' [LUNAS]\n' : '\n'
    }

    detail += `\n================================\n`
    detail += `*TOTAL TAGIHAN: ${formatCurrency(data.grandTotal)}*\n`
    
    const allPaid = data.isRentPaid && data.isUtilityPaid
    if (!allPaid) {
      detail += `Status: *BELUM LUNAS*\n`
    }
    
    detail += `================================`
    
    return detail
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
    
    return message.trim()
  }

  /**
   * Fetch default template for a type from API
   */
  async function getDefaultTemplate(type: TemplateType): Promise<{ message: string; name: string }> {
    try {
      const response = await $fetch<{ template: { message: string; name: string } }>(`/api/whatsapp-templates/default/${type}`)
      return response.template
    } catch (error) {
      console.error('Failed to fetch template:', error)
      // Fallback to basic template
      return {
        name: 'Fallback Template',
        message: `Halo {nama_penyewa},\n\n{detail_tagihan}\n\n{link_pembayaran}\n\nMohon segera melakukan pembayaran.\nTerima kasih.`
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
