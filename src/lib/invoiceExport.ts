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

const importFromUrl = (url: string): Promise<any> => {
  return new Function('url', 'return import(url)')(url);
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
  return name;
};

export const buildExportSizeLabel = (item: ExportRow) => {
  return item.sizes.length > 0 ? compactSizeLabel(item.sizes) : '';
};

const normalizeUnitType = (value?: string) => {
  if (!value) return 'Ri';
  return value.replace(/\s*\([^)]*\)\s*/g, '').trim() || 'Ri';
};

export const downloadInvoiceExcel = (invoice: InvoiceExportData) => {
  const rows = groupInvoiceItemsForExport(invoice.items || invoice.invoice_items || []);
  const html = `
    <html>
      <head>
        <meta charset="UTF-8" />
        <style>
          @page { size: landscape; margin: 0.35in; }
          html, body {
            margin: 0;
            padding: 0;
            font-family: Arial, Tahoma, sans-serif;
            font-size: 12px;
            color: #000;
          }
          .sheet {
            width: 100%;
            padding: 18px 20px;
            box-sizing: border-box;
          }
          .title {
            font-size: 17px;
            font-weight: bold;
            text-align: center;
            text-transform: uppercase;
            margin-bottom: 4px;
          }
          .code {
            text-align: center;
            margin: 0 0 12px;
          }
          .customer {
            margin: 0 0 4px;
          }
          table {
            border-collapse: collapse;
            table-layout: fixed;
            width: 100%;
            border: 2px solid #333;
          }
          th, td {
            border: 1px solid #555;
            padding: 7px 8px;
            vertical-align: middle;
            mso-border-alt: solid #555 .75pt;
            line-height: 1.35;
          }
          th {
            font-weight: bold;
            text-align: center;
            background: #f2f2f2;
          }
          .right {
            text-align: right;
            white-space: nowrap;
          }
          .center {
            text-align: center;
          }
          .nowrap {
            white-space: nowrap;
          }
          .total-label {
            text-align: center;
            font-weight: bold;
          }
          .total-value {
            text-align: right;
            font-weight: bold;
            white-space: nowrap;
          }
        </style>
      </head>
      <body>
        <div class="sheet">
        <div class="title">PHIẾU GIAO HÀNG</div>
        <p class="code">Mã HĐ: ${escapeHtml(invoice.invoice_code)}</p>
        <p class="customer"><b>Khách hàng:</b> ${escapeHtml(invoice.customer_name_snapshot || 'Khách lẻ vãng lai')}</p>
        <p class="customer"><b>Địa chỉ:</b> ${escapeHtml(invoice.customer_address_snapshot || '')}</p>
        <p class="customer"><b>Điện thoại:</b> ${escapeHtml(invoice.customer_phone_snapshot || '')}</p>
        <table>
          <colgroup>
            <col style="width: 48px;" />
            <col style="width: 220px;" />
            <col style="width: 82px;" />
            <col style="width: 78px;" />
            <col style="width: 76px;" />
            <col style="width: 62px;" />
            <col style="width: 112px;" />
            <col style="width: 128px;" />
            <col style="width: 110px;" />
          </colgroup>
          <thead>
            <tr>
              <th>STT</th>
              <th>Tên Hàng</th>
              <th>Màu</th>
              <th>Size</th>
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
                <td class="center">${escapeHtml(item.color || '')}</td>
                <td class="center">${escapeHtml(buildExportSizeLabel(item))}</td>
                <td class="center nowrap">${escapeHtml(normalizeUnitType(item.unit_type))}</td>
                <td class="center">${formatNumber(item.quantityPerSize !== null && item.sizes.length > 1 ? item.quantityPerSize : item.totalPieces)}</td>
                <td class="right">${formatNumber(item.unit_price)}</td>
                <td class="right">${formatNumber(item.subtotal)}</td>
                <td>${escapeHtml(item.note || '')}</td>
              </tr>
            `).join('')}
            <tr><td colspan="8" class="total-label">Cộng tiền hàng</td><td class="total-value">${formatNumber(invoice.total_amount)}</td></tr>
            <tr><td colspan="8" class="total-label">Nợ cũ</td><td class="total-value">0</td></tr>
            <tr><td colspan="8" class="total-label">Tổng tiền thanh toán</td><td class="total-value">${formatNumber(invoice.total_amount)}</td></tr>
          </tbody>
        </table>
        <p class="right">${escapeHtml(formatDate(invoice.sale_date))}</p>
        </div>
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

export const downloadInvoicePdf = async (invoice: InvoiceExportData, elementId = 'print-area') => {
  const element = document.getElementById(elementId);
  if (!element) {
    alert('Không tìm thấy mẫu hóa đơn để lưu PDF.');
    return;
  }

  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    importFromUrl('https://esm.sh/html2canvas@1.4.1'),
    importFromUrl('https://esm.sh/jspdf@4.2.1')
  ]);

  const pdf = new jsPDF('l', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 8;
  const imageWidth = pageWidth - margin * 2;
  const captureWidth = 1123;

  const captureHost = document.createElement('div');
  captureHost.style.position = 'fixed';
  captureHost.style.left = '-10000px';
  captureHost.style.top = '0';
  captureHost.style.width = `${captureWidth}px`;
  captureHost.style.background = '#ffffff';
  captureHost.style.zIndex = '-1';

  const printableClone = element.cloneNode(true) as HTMLElement;
  printableClone.style.width = `${captureWidth}px`;
  printableClone.style.maxWidth = `${captureWidth}px`;
  printableClone.style.minHeight = '0';
  printableClone.style.margin = '0';
  printableClone.style.transform = 'none';
  printableClone.style.background = '#ffffff';
  printableClone.style.boxSizing = 'border-box';

  captureHost.appendChild(printableClone);
  document.body.appendChild(captureHost);

  let canvas: HTMLCanvasElement;
  try {
    canvas = await html2canvas(printableClone, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      windowWidth: captureWidth,
      scrollX: 0,
      scrollY: 0
    });
  } finally {
    document.body.removeChild(captureHost);
  }

  const imageHeight = (canvas.height * imageWidth) / canvas.width;

  let remainingHeight = imageHeight;
  let sourceY = 0;
  const pageImageHeight = pageHeight - margin * 2;

  while (remainingHeight > 0) {
    const sliceHeightPx = Math.min(
      canvas.height - sourceY,
      Math.floor((pageImageHeight * canvas.width) / imageWidth)
    );
    const pageCanvas = document.createElement('canvas');
    pageCanvas.width = canvas.width;
    pageCanvas.height = sliceHeightPx;

    const context = pageCanvas.getContext('2d');
    if (!context) return;
    context.drawImage(canvas, 0, sourceY, canvas.width, sliceHeightPx, 0, 0, canvas.width, sliceHeightPx);

    const pageData = pageCanvas.toDataURL('image/png');
    const pageSliceHeight = (sliceHeightPx * imageWidth) / canvas.width;
    pdf.addImage(pageData, 'PNG', margin, margin, imageWidth, pageSliceHeight);

    sourceY += sliceHeightPx;
    remainingHeight -= pageSliceHeight;
    if (remainingHeight > 0) pdf.addPage();
  }

  pdf.save(`${invoice.invoice_code || 'hoa-don'}.pdf`);
};
