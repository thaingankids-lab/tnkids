type InvoiceExportItem = {
  product_code?: string;
  product_name?: string;
  color?: string;
  size?: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  unit_type?: string;
  note?: string;
};

export type InvoiceExportData = {
  invoice_code: string;
  customer_name_snapshot?: string;
  customer_phone_snapshot?: string;
  customer_address_snapshot?: string;
  total_amount: number;
  sale_date: string;
  items?: InvoiceExportItem[];
  invoice_items?: InvoiceExportItem[];
};

type ExportRow = {
  product_code?: string;
  product_name?: string;
  color?: string;
  sizes: string[];
  quantityPerSize: number | null;
  totalPieces: number;
  unit_price: number;
  subtotal: number;
  unit_type?: string;
  note?: string;
};

const sortSizes = (sizes: string[]) => {
  return [...sizes].sort((a, b) => {
    const numA = parseInt(a, 10);
    const numB = parseInt(b, 10);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    return a.localeCompare(b);
  });
};

const compactSizeLabel = (sizes: string[]) => {
  const sorted = sortSizes(sizes);
  const numbers = sorted.map(size => parseInt(size, 10));
  const isNumericRange = numbers.length > 1
    && numbers.every(value => !isNaN(value))
    && numbers.every((value, index) => index === 0 || value === numbers[index - 1] + 1);

  return isNumericRange ? `${sorted[0]}-${sorted[sorted.length - 1]}` : sorted.join(', ');
};

const formatNumber = (value: number) => {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Number(value) || 0);
};

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `Ngày ${date.getDate().toString().padStart(2, '0')} tháng ${(date.getMonth() + 1).toString().padStart(2, '0')} năm ${date.getFullYear()}`;
};

const escapeHtml = (value: unknown) => {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
};

export const groupInvoiceItemsForExport = (items: InvoiceExportItem[]): ExportRow[] => {
  const groups: Record<string, ExportRow> = {};

  items.forEach(item => {
    const key = [
      item.product_code || item.product_name || '',
      item.color || '',
      item.unit_type || '',
      item.unit_price || 0
    ].join('|');

    if (!groups[key]) {
      groups[key] = {
        product_code: item.product_code,
        product_name: item.product_name,
        color: item.color,
        sizes: [],
        quantityPerSize: item.quantity,
        totalPieces: 0,
        unit_price: item.unit_price,
        subtotal: 0,
        unit_type: item.unit_type,
        note: item.note
      };
    }

    if (item.size) groups[key].sizes.push(item.size);
    groups[key].totalPieces += Number(item.quantity) || 0;
    groups[key].subtotal += Number(item.subtotal) || 0;
    if (groups[key].quantityPerSize !== item.quantity) groups[key].quantityPerSize = null;
  });

  return Object.values(groups).map(group => ({ ...group, sizes: sortSizes(group.sizes) }));
};

export const buildExportItemName = (item: ExportRow) => {
  const name = item.product_name || item.product_code || 'Hàng hóa';
  const sizeLabel = item.sizes.length > 0 ? `cỡ ${compactSizeLabel(item.sizes)}` : '';
  return [name, item.color, sizeLabel].filter(Boolean).join(', ');
};

export const downloadInvoiceExcel = (invoice: InvoiceExportData) => {
  const rows = groupInvoiceItemsForExport(invoice.items || invoice.invoice_items || []);
  const html = `
    <html>
      <head>
        <meta charset="UTF-8" />
        <style>
          body { font-family: Arial, Tahoma, sans-serif; font-size: 12px; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #555; padding: 5px; }
          th { font-weight: bold; text-align: center; }
          .right { text-align: right; }
          .center { text-align: center; }
          .title { font-size: 16px; font-weight: bold; text-align: center; }
        </style>
      </head>
      <body>
        <div class="title">PHIẾU GIAO HÀNG</div>
        <p class="center">Mã HĐ: ${escapeHtml(invoice.invoice_code)}</p>
        <p><b>Khách hàng:</b> ${escapeHtml(invoice.customer_name_snapshot || 'Khách lẻ vãng lai')}</p>
        <p><b>Địa chỉ:</b> ${escapeHtml(invoice.customer_address_snapshot || '')}</p>
        <p><b>Điện thoại:</b> ${escapeHtml(invoice.customer_phone_snapshot || '')}</p>
        <table>
          <thead>
            <tr>
              <th>STT</th>
              <th>Tên Hàng</th>
              <th>ĐVT</th>
              <th>SL</th>
              <th>Đơn giá</th>
              <th>Thành tiền</th>
              <th>Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((item, index) => `
              <tr>
                <td class="center">${index + 1}</td>
                <td>${escapeHtml(buildExportItemName(item))}</td>
                <td class="center">${escapeHtml(item.unit_type || 'Ri')}</td>
                <td class="center">${formatNumber(item.quantityPerSize !== null && item.sizes.length > 1 ? item.quantityPerSize : item.totalPieces)}</td>
                <td class="right">${formatNumber(item.unit_price)}</td>
                <td class="right">${formatNumber(item.subtotal)}</td>
                <td>${escapeHtml(item.note || '')}</td>
              </tr>
            `).join('')}
            <tr><td colspan="6" class="center">Cộng tiền hàng</td><td class="right"><b>${formatNumber(invoice.total_amount)}</b></td></tr>
            <tr><td colspan="6" class="center">Nợ cũ</td><td class="right"><b>0</b></td></tr>
            <tr><td colspan="6" class="center">Tổng tiền thanh toán</td><td class="right"><b>${formatNumber(invoice.total_amount)}</b></td></tr>
          </tbody>
        </table>
        <p class="right">${escapeHtml(formatDate(invoice.sale_date))}</p>
      </body>
    </html>
  `;

  const blob = new Blob(['\ufeff', html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${invoice.invoice_code || 'hoa-don'}.xls`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
