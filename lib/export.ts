import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import 'jspdf-autotable'

export function exportToCSV(data: any[], filename: string, columns: { key: string; header: string }[]) {
  const csvRows = []
  const headers = columns.map(c => c.header)
  csvRows.push(headers.join(','))

  for (const row of data) {
    const values = columns.map(c => {
      let val = row[c.key]
      if (val === null || val === undefined) val = ''
      const escaped = ('' + val).replace(/"/g, '""')
      return `"${escaped}"`
    })
    csvRows.push(values.join(','))
  }

  const csvString = csvRows.join('\n')
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', `${filename}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export function exportToExcel(data: any[], filename: string, columns: { key: string; header: string }[]) {
  const formattedData = data.map(item => {
    const row: Record<string, any> = {}
    columns.forEach(col => {
      row[col.header] = item[col.key]
    })
    return row
  })

  const worksheet = XLSX.utils.json_to_sheet(formattedData)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data')
  
  XLSX.writeFile(workbook, `${filename}.xlsx`)
}

export function generateLedgerPDF(
  entries: any[], 
  entity: any, 
  settings: any
) {
  const doc = new jsPDF()
  
  doc.setFontSize(18)
  doc.text(settings.shopName || 'Shop', 105, 15, { align: 'center' })
  doc.setFontSize(12)
  doc.text('Ledger Account', 105, 22, { align: 'center' })
  
  doc.setFontSize(10)
  doc.text(`Name: ${entity.name}`, 14, 35)
  if (entity.mobile) doc.text(`Mobile: ${entity.mobile}`, 14, 40)
  
  const tableData = entries.map(entry => [
    new Date(entry.createdAt).toLocaleDateString(),
    entry.description,
    entry.type === 'DEBIT' ? entry.amount.toFixed(2) : '-',
    entry.type === 'CREDIT' ? entry.amount.toFixed(2) : '-',
    entry.balanceAfter.toFixed(2)
  ])

  doc.autoTable({
    startY: 45,
    head: [['Date', 'Description', 'Debit', 'Credit', 'Balance']],
    body: tableData,
    theme: 'grid'
  })

  return doc
}

export function generateReportPDF(
  title: string, 
  data: any[], 
  columns: { key: string; header: string }[], 
  settings: any,
  summary?: Record<string, string>
) {
  const doc = new jsPDF()
  
  doc.setFontSize(18)
  doc.text(settings.shopName || 'Shop', 105, 15, { align: 'center' })
  doc.setFontSize(14)
  doc.text(title, 105, 23, { align: 'center' })
  
  const headers = columns.map(c => c.header)
  const tableData = data.map(row => columns.map(c => row[c.key]?.toString() || '-'))

  doc.autoTable({
    startY: 35,
    head: [headers],
    body: tableData,
    theme: 'grid'
  })

  // @ts-ignore
  let finalY = doc.lastAutoTable.finalY || 50

  if (summary) {
    finalY += 10
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('Summary:', 14, finalY)
    
    doc.setFont('helvetica', 'normal')
    let y = finalY + 6
    for (const [key, val] of Object.entries(summary)) {
      doc.text(`${key}: ${val}`, 14, y)
      y += 6
    }
  }

  return doc
}
