import React from 'react';
import { BillDocument, ReceiptSettings } from './types';
import './ThermalReceipt.css';

interface ThermalReceiptProps {
  data: BillDocument;
  settings?: ReceiptSettings;
}

export const ThermalReceipt: React.FC<ThermalReceiptProps> = ({ data, settings: propSettings }) => {
  // Use settings from data if available, otherwise from props
  const settings = data.settings || propSettings;
  const messName = settings?.messName || "MESS";
  
  const { customer, items, meta, account, billId, timestamp } = data;

  // Format Date
  const dateStr = timestamp instanceof Date 
    ? timestamp.toLocaleString() 
    : timestamp?.toDate 
      ? timestamp.toDate().toLocaleString() 
      : new Date().toLocaleString();

  // Calculations
  const calculatedItems = items.map(item => {
    const lineTotal = item.qty * item.rate;
    const taxableValue = lineTotal / (1 + (item.gstPercentage / 100));
    const totalTax = lineTotal - taxableValue;
    const sgst = totalTax / 2;
    const cgst = totalTax / 2;

    return {
      ...item,
      lineTotal,
      taxableValue,
      sgst,
      cgst,
      totalTax
    };
  });

  const grandTotal = calculatedItems.reduce((acc, item) => acc + item.lineTotal, 0);
  
  // Group tax breakdown by percentage
  const taxBreakdown = calculatedItems.reduce((acc, item) => {
    const key = item.gstPercentage.toString();
    if (!acc[key]) {
      acc[key] = { taxableValue: 0, sgst: 0, cgst: 0 };
    }
    acc[key].taxableValue += item.taxableValue;
    acc[key].sgst += item.sgst;
    acc[key].cgst += item.cgst;
    return acc;
  }, {} as Record<string, { taxableValue: number; sgst: number; cgst: number }>);

  return (
    <div className="thermal-receipt-wrapper">
      <div className="thermal-receipt-container">
        <div className="thermal-header">
          <h1 className="thermal-title">{messName}</h1>
          {data.isKOT ? (
            <>
              <p className="thermal-subtitle text-lg font-bold" style={{fontSize: '1.2rem', marginTop: '4px'}}>KITCHEN ORDER TICKET</p>
              {data.kotCategory && <p className="thermal-subtitle font-black" style={{fontSize: '1.4rem', border: '2px solid black', padding: '2px 8px', display: 'inline-block', marginTop: '4px'}}>{data.kotCategory}</p>}
            </>
          ) : (
            <>
              <p className="thermal-subtitle">TAX INVOICE</p>
              {settings?.address && <p className="thermal-subtitle">{settings.address}</p>}
              {settings?.gstin && <p className="thermal-subtitle">GSTIN: {settings.gstin}</p>}
              {settings?.fssai && <p className="thermal-subtitle">FSSAI: {settings.fssai}</p>}
            </>
          )}
        </div>

        <div className="thermal-divider" />

        <div className="thermal-info-row">
          <span>BILL ID:</span>
          <span>{billId}</span>
        </div>
        <div className="thermal-info-row">
          <span>DATE:</span>
          <span>{dateStr}</span>
        </div>
        <div className="thermal-info-row">
          <span>TOKEN NO:</span>
          <span>{meta.tokenNo}</span>
        </div>

        <div className="thermal-divider" />

        <div className="thermal-info-row">
          <span>CUSTOMER:</span>
          <span>{customer.name}</span>
        </div>
        <div className="thermal-info-row">
          <span>REG NO:</span>
          <span>{customer.regNo}</span>
        </div>

        <div className="thermal-divider" />

        <div className="thermal-item-header">
          <span className="thermal-col-name" style={data.isKOT ? {flex: 3} : {}}>ITEM</span>
          <span className="thermal-col-qty" style={data.isKOT ? {flex: 1, textAlign: 'right', fontSize: '1.2rem'} : {}}>QTY</span>
          {!data.isKOT && <span className="thermal-col-rate">RATE</span>}
          {!data.isKOT && <span className="thermal-col-total">AMT</span>}
        </div>

        <div className="thermal-divider" />

        {calculatedItems.map((item, index) => (
          <div key={index} className="thermal-item-row" style={data.isKOT ? {fontSize: '1.2rem', padding: '4px 0'} : {}}>
            <span className="thermal-col-name font-bold" style={data.isKOT ? {flex: 3, fontWeight: 'bold'} : {}}>{item.name}</span>
            <span className="thermal-col-qty font-bold" style={data.isKOT ? {flex: 1, textAlign: 'right', fontWeight: 'bold'} : {}}>x{item.qty}</span>
            {!data.isKOT && <span className="thermal-col-rate">{item.rate.toFixed(2)}</span>}
            {!data.isKOT && <span className="thermal-col-total">{item.lineTotal.toFixed(2)}</span>}
          </div>
        ))}

        <div className="thermal-divider" />

        <div className="thermal-divider" />

        {!data.isKOT && (
          <>
            <div className="thermal-totals">
              <div className="thermal-total-row">
                <span>SUBTOTAL:</span>
                <span>{grandTotal.toFixed(2)}</span>
              </div>
              <div className="thermal-total-row thermal-grand-total">
                <span>NET TOTAL:</span>
                <span>{grandTotal.toFixed(2)}</span>
              </div>
              <div className="thermal-total-row">
                <span>STATUS:</span>
                <span>{meta.paymentStatus}</span>
              </div>
            </div>

            <div className="thermal-divider" />

            <div className="thermal-tax-section">
              <div className="thermal-item-header">
                <span className="thermal-col-name" style={{ flex: 1 }}>GST%</span>
                <span className="thermal-col-total" style={{ flex: 1 }}>VALUE</span>
                <span className="thermal-col-total" style={{ flex: 1 }}>SGST</span>
                <span className="thermal-col-total" style={{ flex: 1 }}>CGST</span>
              </div>
              {Object.entries(taxBreakdown).map(([gst, values]) => (
                <div key={gst} className="thermal-item-row">
                  <span className="thermal-col-name" style={{ flex: 1 }}>{gst}%</span>
                  <span className="thermal-col-total" style={{ flex: 1 }}>{values.taxableValue.toFixed(2)}</span>
                  <span className="thermal-col-total" style={{ flex: 1 }}>{values.sgst.toFixed(2)}</span>
                  <span className="thermal-col-total" style={{ flex: 1 }}>{values.cgst.toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="thermal-divider" />

            {account && (
              <div className="thermal-balance-box">
                REM. BALANCE: RS. {account.currentBalance.toFixed(2)}
              </div>
            )}
          </>
        )}

        <div className="thermal-header" style={{ marginTop: '20px' }}>
          <p className="thermal-subtitle">*** THANK YOU ***</p>
          <p className="thermal-subtitle">VISIT AGAIN</p>
        </div>
      </div>
    </div>
  );
};
