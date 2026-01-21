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
}

export function useWhatsAppTemplate() {
  const formatCurrency = (val: number | string) =>
    new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(Number(val))

  /**
   * Build billing detail section that gets auto-injected
   */
  function buildDetailSection(data: BillingData): string {
    let detail = `*TAGIHAN KOST*\n`
    detail += `${data.propertyName}\n`
    detail += `================================\n\n`
    detail += `Periode: *${data.period}*\n`
    detail += `Kamar: *${data.roomName}*\n`
    detail += `Penghuni: ${data.tenantName}\n`
    
    if (data.occupantCount && data.occupantCount > 1) {
      detail += `Jumlah Penghuni: ${data.occupantCount} orang\n`
    }
    
    detail += `\n================================\n`

    // Rent section
    if (data.rentAmount && Number(data.rentAmount) > 0) {
      detail += `\n*SEWA KAMAR*\n`
      if (data.monthsCovered && data.roomPrice) {
        detail += `${data.monthsCovered} bulan x ${formatCurrency(data.roomPrice)}\n`
      }
      detail += `Total: ${formatCurrency(data.rentAmount)}`
      detail += data.isRentPaid ? ' [LUNAS]\n' : '\n'
    }

    // Utility section
    if (data.utilityTotal && Number(data.utilityTotal) > 0) {
      detail += `\n*UTILITAS*\n\n`
      
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
    
    // Replace template variables
    let message = templateMessage
      .replace(/{nama_penyewa}/g, data.tenantName)
      .replace(/{nama_properti}/g, data.propertyName)
      .replace(/{nama_kamar}/g, data.roomName)
      .replace(/{jumlah_tagihan}/g, formatCurrency(data.grandTotal))
      .replace(/{periode}/g, data.period)
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
   * Open WhatsApp with the message
   */
  function openWhatsApp(phone: string, message: string) {
    const formattedPhone = formatPhoneNumber(phone)
    const waUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`
    window.open(waUrl, '_blank')
  }

  return {
    buildMessage,
    buildDetailSection,
    buildLinkSection,
    getDefaultTemplate,
    formatPhoneNumber,
    openWhatsApp,
    formatCurrency
  }
}
