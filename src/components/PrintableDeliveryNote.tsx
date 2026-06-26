type PrintableItem = {
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

type PrintableInvoice = {
  invoice_code: string;
  customer_name_snapshot?: string;
  customer_phone_snapshot?: string;
  customer_address_snapshot?: string;
  total_amount: number;
  sale_date: string;
  note?: string;
  items?: PrintableItem[];
  invoice_items?: PrintableItem[];
};

type PrintableRow = {
  key: string;
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

interface PrintableDeliveryNoteProps {
  invoice: PrintableInvoice;
}

const formatNumber = (value: number) => {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Number(value) || 0);
};

const formatVietnameseDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `Ngày ${day} tháng ${month} năm ${year}`;
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
  const isNumericRange = numbers.every(value => !isNaN(value))
    && numbers.every((value, index) => index === 0 || value === numbers[index - 1] + 1);

  if (isNumericRange && sorted.length > 1) {
    return `${sorted[0]}-${sorted[sorted.length - 1]}`;
  }

  return sorted.join(', ');
};

const groupPrintableItems = (items: PrintableItem[]): PrintableRow[] => {
  const groups: Record<string, PrintableRow> = {};

  items.forEach(item => {
    const key = [
      item.product_code || item.product_name || '',
      item.color || '',
      item.unit_type || '',
      item.unit_price || 0
    ].join('|');

    if (!groups[key]) {
      groups[key] = {
        key,
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
    if (groups[key].quantityPerSize !== item.quantity) {
      groups[key].quantityPerSize = null;
    }
  });

  return Object.values(groups).map(group => ({
    ...group,
    sizes: sortSizes(group.sizes)
  }));
};

const buildItemName = (item: PrintableRow) => {
  return item.product_name || item.product_code || 'Hàng hóa';
};

const buildSizeLabel = (item: PrintableRow) => {
  return item.sizes.length > 0 ? compactSizeLabel(item.sizes) : '';
};

const normalizeUnitType = (value?: string) => {
  if (!value) return 'Ri';
  return value.replace(/\s*\([^)]*\)\s*/g, '').trim() || 'Ri';
};

export default function PrintableDeliveryNote({ invoice }: PrintableDeliveryNoteProps) {
  const items = groupPrintableItems(invoice.items || invoice.invoice_items || []);
  const oldDebt = 0;
  const totalPayment = Number(invoice.total_amount || 0) + oldDebt;

  return (
    <div
      id="print-area"
      className="bg-white text-black mx-auto font-sans text-[11px] leading-normal"
      style={{
        fontFamily: 'Arial, Tahoma, "Segoe UI", sans-serif',
        width: '297mm',
        maxWidth: '100%',
        padding: '12mm 14mm',
        boxSizing: 'border-box'
      }}
    >
      <div className="text-center mb-2">
        <h1 className="text-[16px] font-bold uppercase leading-tight">PHIẾU GIAO HÀNG</h1>
        <p className="mt-1">Mã HĐ: {invoice.invoice_code}</p>
      </div>

      <div className="mb-3 space-y-1">
        <p><b>Khách hàng:</b> {invoice.customer_name_snapshot || 'Khách lẻ vãng lai'}</p>
        <p><b>Địa chỉ:</b> {invoice.customer_address_snapshot || ''}</p>
        <p><b>Điện Thoại:</b> {invoice.customer_phone_snapshot || ''}</p>
      </div>

      <table
        className="w-full text-[11px]"
        style={{
          borderCollapse: 'separate',
          borderSpacing: 0,
          border: '1.5px solid #333',
          tableLayout: 'fixed'
        }}
      >
        <thead>
          <tr>
            <th className="text-center font-bold px-2" style={{ borderRight: '1px solid #444', borderBottom: '1px solid #444', width: '46px', height: '30px', lineHeight: '16px', verticalAlign: 'middle' }}>STT</th>
            <th className="text-center font-bold px-2" style={{ borderRight: '1px solid #444', borderBottom: '1px solid #444', width: '220px', height: '30px', lineHeight: '16px', verticalAlign: 'middle' }}>Tên Hàng</th>
            <th className="text-center font-bold px-2" style={{ borderRight: '1px solid #444', borderBottom: '1px solid #444', width: '82px', height: '30px', lineHeight: '16px', verticalAlign: 'middle' }}>Màu</th>
            <th className="text-center font-bold px-2" style={{ borderRight: '1px solid #444', borderBottom: '1px solid #444', width: '78px', height: '30px', lineHeight: '16px', verticalAlign: 'middle' }}>Size</th>
            <th className="text-center font-bold px-2" style={{ borderRight: '1px solid #444', borderBottom: '1px solid #444', width: '76px', height: '30px', lineHeight: '16px', verticalAlign: 'middle' }}>ĐVT</th>
            <th className="text-center font-bold px-2" style={{ borderRight: '1px solid #444', borderBottom: '1px solid #444', width: '62px', height: '30px', lineHeight: '16px', verticalAlign: 'middle' }}>SL</th>
            <th className="text-center font-bold px-2" style={{ borderRight: '1px solid #444', borderBottom: '1px solid #444', width: '112px', height: '30px', lineHeight: '16px', verticalAlign: 'middle' }}>Đơn giá</th>
            <th className="text-center font-bold px-2" style={{ borderRight: '1px solid #444', borderBottom: '1px solid #444', width: '128px', height: '30px', lineHeight: '16px', verticalAlign: 'middle' }}>Thành tiền</th>
            <th className="text-center font-bold px-2" style={{ borderBottom: '1px solid #444', width: '110px', height: '30px', lineHeight: '16px', verticalAlign: 'middle' }}>Ghi chú</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={`${item.product_code || item.product_name || 'item'}-${index}`}>
              <td className="text-center px-2 align-middle" style={{ borderRight: '1px solid #777', borderBottom: '1px solid #777', height: '28px', lineHeight: '16px', verticalAlign: 'middle' }}>{index + 1}</td>
              <td className="px-2 align-middle" style={{ borderRight: '1px solid #777', borderBottom: '1px solid #777', height: '28px', lineHeight: '16px', verticalAlign: 'middle' }}>{buildItemName(item)}</td>
              <td className="text-center px-2 align-middle" style={{ borderRight: '1px solid #777', borderBottom: '1px solid #777', height: '28px', lineHeight: '16px', verticalAlign: 'middle' }}>{item.color || ''}</td>
              <td className="text-center px-2 align-middle" style={{ borderRight: '1px solid #777', borderBottom: '1px solid #777', height: '28px', lineHeight: '16px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>{buildSizeLabel(item)}</td>
              <td className="text-center px-2 align-middle" style={{ borderRight: '1px solid #777', borderBottom: '1px solid #777', height: '28px', lineHeight: '16px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>{normalizeUnitType(item.unit_type)}</td>
              <td className="text-center px-2 align-middle font-bold" style={{ borderRight: '1px solid #777', borderBottom: '1px solid #777', height: '28px', lineHeight: '16px', verticalAlign: 'middle' }}>
                {formatNumber(item.quantityPerSize !== null && item.sizes.length > 1 ? item.quantityPerSize : item.totalPieces)}
              </td>
              <td className="text-right px-2 align-middle" style={{ borderRight: '1px solid #777', borderBottom: '1px solid #777', height: '28px', lineHeight: '16px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>{formatNumber(item.unit_price)}</td>
              <td className="text-right px-2 align-middle font-bold" style={{ borderRight: '1px solid #777', borderBottom: '1px solid #777', height: '28px', lineHeight: '16px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>{formatNumber(item.subtotal)}</td>
              <td className="px-2 align-middle" style={{ borderBottom: '1px solid #777', height: '28px', lineHeight: '16px', verticalAlign: 'middle' }}>{item.note || ''}</td>
            </tr>
          ))}

          <tr>
            <td colSpan={8} className="text-center px-2" style={{ borderRight: '1.5px solid #333', borderBottom: '1.5px solid #333', height: '30px', lineHeight: '16px', verticalAlign: 'middle' }}>Cộng tiền hàng</td>
            <td className="text-right font-bold px-2" style={{ borderBottom: '1.5px solid #333', height: '30px', lineHeight: '16px', verticalAlign: 'middle' }}>{formatNumber(invoice.total_amount)}</td>
          </tr>
          <tr>
            <td colSpan={8} className="text-center px-2" style={{ borderRight: '1.5px solid #333', borderBottom: '1.5px solid #333', height: '30px', lineHeight: '16px', verticalAlign: 'middle' }}>Nợ cũ</td>
            <td className="text-right font-bold px-2" style={{ borderBottom: '1.5px solid #333', height: '30px', lineHeight: '16px', verticalAlign: 'middle' }}>{formatNumber(oldDebt)}</td>
          </tr>
          <tr>
            <td colSpan={8} className="text-center px-2" style={{ borderRight: '1.5px solid #333', height: '30px', lineHeight: '16px', verticalAlign: 'middle' }}>Tổng tiền thanh toán</td>
            <td className="text-right font-bold px-2" style={{ height: '30px', lineHeight: '16px', verticalAlign: 'middle' }}>{formatNumber(totalPayment)}</td>
          </tr>
        </tbody>
      </table>

      <div className="grid grid-cols-2 mt-5 text-center">
        <div className="pt-6">
          <p>Người mua hàng</p>
          <p>(ký,họ tên)</p>
        </div>
        <div>
          <p className="mb-4">{formatVietnameseDate(invoice.sale_date)}</p>
          <p>Người bán hàng</p>
          <p>(ký,họ tên)</p>
        </div>
      </div>
    </div>
  );
}
